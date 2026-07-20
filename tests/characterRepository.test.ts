import fs from 'fs-extra';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import initSqlJs from 'sql.js';
import { afterEach, describe, expect, it } from 'vitest';
import { runMigrations } from '../src/main/database/migrations';
import { CharacterPreparationService } from '../src/main/services/characterPreparationService';
import { CharacterRepository } from '../src/main/services/characterRepository';
import type { AppDataLayout } from '../src/shared/ipc';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((path) => fs.remove(path)));
});

describe('CharacterRepository', () => {
  it('creates segmented puppet layers from one cleaned drawing', async () => {
    const { repository } = await createRepository();
    const sourceImageDataUrl = createCharacterDataUrl();

    const summary = await repository.createDraft({
      name: 'Max',
      defaultScale: 1,
      sourceImageDataUrl
    });
    const detail = await repository.get(summary.id);

    expect(detail.status).toBe('ready');
    expect(detail.puppetLayers.map((layer) => layer.id)).toEqual([
      'leftLeg',
      'rightLeg',
      'torso',
      'head',
      'leftArm',
      'rightArm'
    ]);
    await expect(fs.pathExists(detail.puppetLayers[0]?.filePath ?? '')).resolves.toBe(true);
  });

  it('duplicates and deletes local character packages', async () => {
    const { repository } = await createRepository();
    const summary = await repository.createDraft({
      name: 'Max',
      defaultScale: 1,
      sourceImageDataUrl: createCharacterDataUrl()
    });
    const original = await repository.get(summary.id);

    const duplicated = await repository.duplicate(summary.id);
    const duplicatedDetail = await repository.get(duplicated.id);

    expect(duplicated.name).toBe('Max Copy');
    expect(duplicatedDetail.packagePath).not.toBe(original.packagePath);
    await expect(fs.pathExists(duplicatedDetail.packagePath)).resolves.toBe(true);

    await repository.delete(duplicated.id);
    await expect(fs.pathExists(duplicatedDetail.packagePath)).resolves.toBe(false);
  });
});

async function createRepository(): Promise<{ repository: CharacterRepository; layout: AppDataLayout }> {
  const root = join(tmpdir(), `brightsen-studio-character-test-${Date.now()}-${Math.random()}`);
  temporaryRoots.push(root);
  const layout: AppDataLayout = {
    root,
    database: join(root, 'database'),
    characters: join(root, 'characters'),
    projects: join(root, 'projects'),
    assets: join(root, 'assets'),
    renders: join(root, 'renders'),
    exports: join(root, 'exports'),
    cache: join(root, 'cache'),
    logs: join(root, 'logs'),
    models: join(root, 'models'),
    backups: join(root, 'backups')
  };

  await Promise.all(Object.values(layout).map((path) => fs.ensureDir(path)));
  const SQL = await initSqlJs();
  const database = new SQL.Database();
  runMigrations(database);
  const persist = async (): Promise<void> => undefined;

  return {
    repository: new CharacterRepository(database, layout, persist, new CharacterPreparationService()),
    layout
  };
}

function createCharacterDataUrl(): string {
  const png = new PNG({ width: 90, height: 120 });

  for (let y = 8; y < 112; y += 1) {
    for (let x = 25; x < 66; x += 1) {
      const index = (y * png.width + x) * 4;
      png.data[index] = 230;
      png.data[index + 1] = 90;
      png.data[index + 2] = 120;
      png.data[index + 3] = 255;
    }
  }

  return `data:image/png;base64,${PNG.sync.write(png).toString('base64')}`;
}
