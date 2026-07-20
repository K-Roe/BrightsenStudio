import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { openStudioDatabase } from './database/database.js';
import { registerIpcHandlers } from './ipc.js';
import { ensureAppDataLayout } from './services/appPaths.js';
import { CharacterRepository } from './services/characterRepository.js';
import { CharacterPreparationService } from './services/characterPreparationService.js';
import { ImageImportService } from './services/imageImportService.js';
import { StudioLogger } from './services/logger.js';
import { ProjectRepository } from './services/projectRepository.js';

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

let mainWindow: BrowserWindow | null = null;

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    title: 'BrightSen Studio',
    backgroundColor: '#101820',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

async function bootstrap(): Promise<void> {
  const appData = await ensureAppDataLayout();
  const logger = new StudioLogger(appData);

  try {
    const database = await openStudioDatabase(appData);
    const preparation = new CharacterPreparationService();
    const characters = new CharacterRepository(
      database.connection,
      appData,
      database.persist,
      preparation
    );
    const imageImport = new ImageImportService();
    const projects = new ProjectRepository(database.connection, appData, database.persist);

    registerIpcHandlers({
      appVersion: app.getVersion(),
      appData,
      databaseReady: true,
      migrationsApplied: database.migrationsApplied,
      characters,
      projects,
      imageImport,
      logger
    });

    await logger.info('startup', 'BrightSen Studio opened.');
  } catch (error) {
    await logger.error('startup', 'Studio could not prepare its local database.', {
      technicalDetails: error instanceof Error ? error.stack : String(error)
    });
    throw error;
  }

  await createWindow();
}

app.whenReady().then(bootstrap).catch((error) => {
  console.error(error);
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  }
});
