import { dialog, ipcMain } from 'electron';
import {
  characterActionSchema,
  createCartoonProjectSchema,
  createCharacterDraftSchema,
  createExportSchema,
  rebuildCharacterPuppetSchema,
  imageAnalysisRequestSchema,
  ipcChannels,
  studioHealthSchema,
  updateCharacterMarkersSchema,
  type StudioHealth
} from '../shared/ipc.js';
import type { CharacterRepository } from './services/characterRepository.js';
import type { AppDataLayout } from '../shared/ipc.js';
import type { ImageImportService } from './services/imageImportService.js';
import type { StudioLogger } from './services/logger.js';
import type { ProjectRepository } from './services/projectRepository.js';

interface IpcDependencies {
  appVersion: string;
  appData: AppDataLayout;
  databaseReady: boolean;
  migrationsApplied: number;
  characters: CharacterRepository;
  projects: ProjectRepository;
  imageImport: ImageImportService;
  logger: StudioLogger;
}

export function registerIpcHandlers(dependencies: IpcDependencies): void {
  ipcMain.handle(ipcChannels.appGetHealth, async (): Promise<StudioHealth> => {
    return studioHealthSchema.parse({
      appVersion: dependencies.appVersion,
      databaseReady: dependencies.databaseReady,
      migrationsApplied: dependencies.migrationsApplied,
      appData: dependencies.appData,
      lastError: dependencies.logger.getLastError()
    });
  });

  ipcMain.handle(ipcChannels.characterList, async () => {
    return dependencies.characters.list();
  });

  ipcMain.handle(ipcChannels.characterCreateDraft, async (_event, rawRequest) => {
    const request = createCharacterDraftSchema.parse(rawRequest);
    const character = await dependencies.characters.createDraft(request);
    await dependencies.logger.info('characters', 'Created draft character package.', {
      characterId: character.id
    });
    return { character };
  });

  ipcMain.handle(ipcChannels.characterGet, async (_event, rawCharacterId) => {
    return dependencies.characters.get(String(rawCharacterId));
  });

  ipcMain.handle(ipcChannels.characterUpdateMarkers, async (_event, rawRequest) => {
    const request = updateCharacterMarkersSchema.parse(rawRequest);
    const character = await dependencies.characters.updateMarkers(request);
    await dependencies.logger.info('characters', 'Updated character body markers.', {
      characterId: character.id
    });
    return character;
  });

  ipcMain.handle(ipcChannels.characterRebuildPuppet, async (_event, rawRequest) => {
    const request = rebuildCharacterPuppetSchema.parse(rawRequest);
    const character = await dependencies.characters.rebuildPuppet(request.characterId);
    await dependencies.logger.info('characters', 'Rebuilt character puppet.', {
      characterId: character.id
    });
    return character;
  });

  ipcMain.handle(ipcChannels.characterDuplicate, async (_event, rawRequest) => {
    const request = characterActionSchema.parse(rawRequest);
    const character = await dependencies.characters.duplicate(request.characterId);
    await dependencies.logger.info('characters', 'Duplicated character package.', {
      characterId: character.id
    });
    return character;
  });

  ipcMain.handle(ipcChannels.characterDelete, async (_event, rawRequest) => {
    const request = characterActionSchema.parse(rawRequest);
    await dependencies.characters.delete(request.characterId);
    await dependencies.logger.info('characters', 'Deleted character package.', {
      characterId: request.characterId
    });
    return { deleted: true };
  });

  ipcMain.handle(ipcChannels.imageAnalyze, async (_event, rawRequest) => {
    const request = imageAnalysisRequestSchema.parse(rawRequest);
    const analysis = await dependencies.imageImport.analyze(request);
    await dependencies.logger.info('image-import', 'Analysed character source image.', {
      technicalDetails: `${analysis.fileName} ${analysis.width}x${analysis.height}`
    });
    return analysis;
  });

  ipcMain.handle(ipcChannels.dialogSelectImage, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choose a character drawing',
      properties: ['openFile'],
      filters: [
        {
          name: 'Character images',
          extensions: ['png', 'jpg', 'jpeg', 'webp']
        }
      ]
    });

    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  ipcMain.handle(ipcChannels.assetList, async () => {
    return dependencies.projects.listAssets();
  });

  ipcMain.handle(ipcChannels.projectList, async () => {
    return dependencies.projects.listProjects();
  });

  ipcMain.handle(ipcChannels.projectCreateFromPrompt, async (_event, rawRequest) => {
    const request = createCartoonProjectSchema.parse(rawRequest);
    const project = await dependencies.projects.createFromPrompt(request);
    await dependencies.logger.info('projects', 'Created cartoon project from local prompt parser.', {
      projectId: project.id
    });
    return project;
  });

  ipcMain.handle(ipcChannels.exportList, async () => {
    return dependencies.projects.listExports();
  });

  ipcMain.handle(ipcChannels.exportCreate, async (_event, rawRequest) => {
    const request = createExportSchema.parse(rawRequest);
    const job = await dependencies.projects.createExport(request);
    await dependencies.logger.info('exports', 'Created local export job.', {
      projectId: job.projectId
    });
    return job;
  });
}
