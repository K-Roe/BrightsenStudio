import { contextBridge, ipcRenderer } from 'electron';
import {
  cartoonProjectSchema,
  characterActionSchema,
  createCharacterDraftResponseSchema,
  createCartoonProjectSchema,
  createExportSchema,
  exportJobSchema,
  rebuildCharacterPuppetSchema,
  imageAnalysisRequestSchema,
  imageAnalysisResultSchema,
  ipcChannels,
  stageAssetSchema,
  studioHealthSchema,
  updateCharacterMarkersSchema,
  type CreateCharacterDraftRequest,
  type StudioApi,
  characterDetailSchema,
  characterSummarySchema
} from '../shared/ipc.js';

const api: StudioApi = {
  async getHealth() {
    const result = await ipcRenderer.invoke(ipcChannels.appGetHealth);
    return studioHealthSchema.parse(result);
  },
  async listCharacters() {
    const result = await ipcRenderer.invoke(ipcChannels.characterList);
    return characterSummarySchema.array().parse(result);
  },
  async getCharacter(characterId) {
    const result = await ipcRenderer.invoke(ipcChannels.characterGet, characterId);
    return characterDetailSchema.parse(result);
  },
  async createCharacterDraft(request: CreateCharacterDraftRequest) {
    const result = await ipcRenderer.invoke(ipcChannels.characterCreateDraft, request);
    return createCharacterDraftResponseSchema.parse(result);
  },
  async updateCharacterMarkers(request) {
    const parsedRequest = updateCharacterMarkersSchema.parse(request);
    const result = await ipcRenderer.invoke(ipcChannels.characterUpdateMarkers, parsedRequest);
    return characterDetailSchema.parse(result);
  },
  async rebuildCharacterPuppet(request) {
    const parsedRequest = rebuildCharacterPuppetSchema.parse(request);
    const result = await ipcRenderer.invoke(ipcChannels.characterRebuildPuppet, parsedRequest);
    return characterDetailSchema.parse(result);
  },
  async duplicateCharacter(request) {
    const parsedRequest = characterActionSchema.parse(request);
    const result = await ipcRenderer.invoke(ipcChannels.characterDuplicate, parsedRequest);
    return characterSummarySchema.parse(result);
  },
  async deleteCharacter(request) {
    const parsedRequest = characterActionSchema.parse(request);
    const result = await ipcRenderer.invoke(ipcChannels.characterDelete, parsedRequest);
    if (result?.deleted !== true) {
      throw new Error('Character was not deleted.');
    }
    return { deleted: true };
  },
  async analyzeImage(request) {
    const parsedRequest = imageAnalysisRequestSchema.parse(request);
    const result = await ipcRenderer.invoke(ipcChannels.imageAnalyze, parsedRequest);
    return imageAnalysisResultSchema.parse(result);
  },
  async selectImage() {
    const result = await ipcRenderer.invoke(ipcChannels.dialogSelectImage);
    return typeof result === 'string' || result === null ? result : null;
  },
  async listAssets() {
    const result = await ipcRenderer.invoke(ipcChannels.assetList);
    return stageAssetSchema.array().parse(result);
  },
  async listProjects() {
    const result = await ipcRenderer.invoke(ipcChannels.projectList);
    return cartoonProjectSchema.array().parse(result);
  },
  async createProjectFromPrompt(request) {
    const parsedRequest = createCartoonProjectSchema.parse(request);
    const result = await ipcRenderer.invoke(ipcChannels.projectCreateFromPrompt, parsedRequest);
    return cartoonProjectSchema.parse(result);
  },
  async listExports() {
    const result = await ipcRenderer.invoke(ipcChannels.exportList);
    return exportJobSchema.array().parse(result);
  },
  async createExport(request) {
    const parsedRequest = createExportSchema.parse(request);
    const result = await ipcRenderer.invoke(ipcChannels.exportCreate, parsedRequest);
    return exportJobSchema.parse(result);
  }
};

contextBridge.exposeInMainWorld('studio', api);
