import fs from 'fs-extra';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { afterEach, describe, expect, it } from 'vitest';
import { CharacterPreparationService } from '../src/main/services/characterPreparationService';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((path) => fs.remove(path)));
});

describe('CharacterPreparationService', () => {
  it('creates cleaned image and silhouette metadata from alpha input', async () => {
    const root = join(tmpdir(), `brightsen-studio-test-${Date.now()}`);
    temporaryRoots.push(root);

    const packagePath = join(root, 'character');
    const sourcePath = join(packagePath, 'source');
    await fs.ensureDir(sourcePath);
    await fs.ensureDir(join(packagePath, 'cleaned'));

    const png = new PNG({ width: 20, height: 30 });
    for (let y = 8; y < 25; y += 1) {
      for (let x = 6; x < 15; x += 1) {
        const index = (y * png.width + x) * 4;
        png.data[index] = 240;
        png.data[index + 1] = 80;
        png.data[index + 2] = 90;
        png.data[index + 3] = 255;
      }
    }

    const importedPath = join(sourcePath, 'imported.png');
    await fs.writeFile(importedPath, PNG.sync.write(png));

    const result = await new CharacterPreparationService().prepare(importedPath, packagePath);

    expect(result.method).toBe('alpha');
    expect(result.bounds).toMatchObject({ x: 6, y: 8, width: 9, height: 17 });
    await expect(fs.pathExists(result.cleanedImagePath)).resolves.toBe(true);
    await expect(fs.pathExists(result.silhouettePath)).resolves.toBe(true);
    await expect(fs.pathExists(result.metadataPath)).resolves.toBe(true);
    expect(result.bodyRegions.map((region) => region.name)).toContain('head');
  });
});
