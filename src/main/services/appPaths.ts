import { app } from 'electron';
import fs from 'fs-extra';
import { join } from 'node:path';
import type { AppDataLayout } from '../../shared/ipc.js';

const APP_DATA_FOLDER = 'BrightSenStudio';

export function getAppDataLayout(): AppDataLayout {
  const root = join(app.getPath('appData'), APP_DATA_FOLDER);

  return {
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
}

export async function ensureAppDataLayout(): Promise<AppDataLayout> {
  const layout = getAppDataLayout();
  await Promise.all(Object.values(layout).map((path) => fs.ensureDir(path)));
  return layout;
}
