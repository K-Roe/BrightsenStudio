import fs from 'fs-extra';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';
import { afterEach, describe, expect, it } from 'vitest';
import type { AppDataLayout } from '../src/shared/ipc';
import { runMigrations } from '../src/main/database/migrations';
import { ProjectRepository } from '../src/main/services/projectRepository';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((path) => fs.remove(path)));
});

describe('ProjectRepository', () => {
  it('creates deterministic timeline clips from a local prompt', async () => {
    const repository = await createRepository();

    const project = await repository.createFromPrompt({
      title: 'Park hello',
      prompt: 'Max walks into the park. Max waves and says hello.',
      characterId: 'character-1',
      backgroundId: 'sunny-park'
    });

    expect(project.clips).toHaveLength(2);
    expect(project.clips[0]).toMatchObject({ action: 'walk-right', characterId: 'character-1' });
    expect(project.clips[1]?.action).toBe('wave');
    expect(project.clips[1]?.assetId).toBeNull();
    expect(project.format).toMatchObject({ preset: 'youtube-shorts', width: 1080, height: 1920 });
    expect(project.accessibilityProfile).toMatchObject({
      audience: 'autistic-children',
      flashingContent: false,
      subtitleMode: 'always-on'
    });
    expect(project.clips[0]?.transition).toBe('calm-move');
  });

  it('creates a local preview export with the real cleaned character image', async () => {
    const { repository, layout, database } = await createRepositoryWithLayout();
    const characterId = 'character-1';
    await createCharacterPackage(layout, database, characterId);
    const project = await repository.createFromPrompt({
      title: 'Preview test',
      prompt: 'Max says hello.',
      characterId
    });

    const job = await repository.createExport({ projectId: project.id, preset: 'preview-html' });

    expect(job.status).toBe('ready');
    expect(job.filePath.startsWith(layout.exports)).toBe(true);
    await expect(fs.pathExists(job.filePath)).resolves.toBe(true);
    const exportHtml = await fs.readFile(job.filePath, 'utf8');
    expect(exportHtml).toContain('data:image/png;base64');
    expect(exportHtml).toContain('puppet-layer-head');
  });

  it('adds simple focus props when prompts mention starter assets', async () => {
    const repository = await createRepository();

    const project = await repository.createFromPrompt({
      title: 'Star focus',
      prompt: 'Max smiles at the bright star.',
      characterId: 'character-1'
    });

    expect(project.clips[0]).toMatchObject({ assetId: 'star-prop', transition: 'soft-hold' });
  });

  it('creates a local MP4 export through bundled FFmpeg', async () => {
    const { repository, layout } = await createRepositoryWithLayout();
    const project = await repository.createFromPrompt({
      title: 'MP4 test',
      prompt: 'Max waves.',
      characterId: null
    });

    const job = await repository.createExport({ projectId: project.id, preset: 'mp4-ffmpeg' });
    const stat = await fs.stat(job.filePath);

    expect(job.status).toBe('ready');
    expect(job.filePath.startsWith(layout.exports)).toBe(true);
    expect(stat.size).toBeGreaterThan(0);
  }, 30_000);
});

async function createRepository(): Promise<ProjectRepository> {
  return (await createRepositoryWithLayout()).repository;
}

async function createRepositoryWithLayout(): Promise<{
  repository: ProjectRepository;
  layout: AppDataLayout;
  database: Database;
}> {
  const root = join(tmpdir(), `brightsen-studio-project-test-${Date.now()}-${Math.random()}`);
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

  return { repository: new ProjectRepository(database, layout, persist), layout, database };
}

async function createCharacterPackage(
  layout: AppDataLayout,
  database: Database,
  characterId: string
): Promise<void> {
  const packagePath = join(layout.characters, characterId);
  const cleanedPath = join(packagePath, 'cleaned', 'character.png');
  const headLayerPath = join(packagePath, 'layers', 'head.png');
  await fs.ensureDir(join(packagePath, 'cleaned'));
  await fs.ensureDir(join(packagePath, 'layers'));

  const png = new PNG({ width: 4, height: 4 });
  for (let index = 0; index < png.data.length; index += 4) {
    png.data[index] = 255;
    png.data[index + 1] = 120;
    png.data[index + 2] = 120;
    png.data[index + 3] = 255;
  }

  await fs.writeFile(cleanedPath, PNG.sync.write(png));
  await fs.writeFile(headLayerPath, PNG.sync.write(png));
  await fs.writeJson(
    join(packagePath, 'character.json'),
    {
      preparation: {
        cleanedImagePath: cleanedPath
      },
      puppetLayers: [
        {
          id: 'head',
          name: 'Head',
          filePath: headLayerPath,
          bounds: { x: 0.35, y: 0.05, width: 0.3, height: 0.22 },
          pivot: { x: 0.5, y: 0.9 },
          zIndex: 30
        }
      ]
    },
    { spaces: 2 }
  );
  database.run(
    `
      INSERT INTO characters (
        id, name, description, status, package_path, thumbnail_path,
        animation_count, warning_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      characterId,
      'Max',
      null,
      'ready',
      packagePath,
      cleanedPath,
      6,
      0,
      new Date().toISOString(),
      new Date().toISOString()
    ]
  );
}
