import { z } from 'zod';

export const appSectionSchema = z.enum([
  'home',
  'characters',
  'stories',
  'scene-editor',
  'exports',
  'asset-library',
  'settings'
]);

export type AppSection = z.infer<typeof appSectionSchema>;

export const appDataLayoutSchema = z.object({
  root: z.string(),
  database: z.string(),
  characters: z.string(),
  projects: z.string(),
  assets: z.string(),
  renders: z.string(),
  exports: z.string(),
  cache: z.string(),
  logs: z.string(),
  models: z.string(),
  backups: z.string()
});

export type AppDataLayout = z.infer<typeof appDataLayoutSchema>;

export const studioHealthSchema = z.object({
  appVersion: z.string(),
  databaseReady: z.boolean(),
  migrationsApplied: z.number().int().nonnegative(),
  appData: appDataLayoutSchema,
  lastError: z.string().nullable()
});

export type StudioHealth = z.infer<typeof studioHealthSchema>;

export const characterSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['draft', 'ready', 'needs_attention', 'failed']),
  animationCount: z.number().int().nonnegative(),
  warningCount: z.number().int().nonnegative(),
  thumbnailPath: z.string().nullable(),
  updatedAt: z.string()
});

export type CharacterSummary = z.infer<typeof characterSummarySchema>;

export const markerNameSchema = z.enum([
  'head',
  'neck',
  'leftShoulder',
  'rightShoulder',
  'leftElbow',
  'rightElbow',
  'leftWrist',
  'rightWrist',
  'leftHip',
  'rightHip',
  'leftKnee',
  'rightKnee',
  'leftAnkle',
  'rightAnkle'
]);

export type MarkerName = z.infer<typeof markerNameSchema>;

export const bodyMarkerSchema = z.object({
  name: markerNameSchema,
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1)
});

export type BodyMarker = z.infer<typeof bodyMarkerSchema>;

export const puppetBoneSchema = z.object({
  id: z.string(),
  from: markerNameSchema,
  to: markerNameSchema,
  layer: z.enum(['behind-body', 'body', 'front-body'])
});

export type PuppetBone = z.infer<typeof puppetBoneSchema>;

export const puppetLayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  filePath: z.string(),
  bounds: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().min(0).max(1),
    height: z.number().min(0).max(1)
  }),
  pivot: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1)
  }),
  zIndex: z.number().int()
});

export type PuppetLayer = z.infer<typeof puppetLayerSchema>;

export const animationNameSchema = z.enum(['idle', 'blink', 'talk', 'wave', 'walk-left', 'walk-right']);

export type AnimationName = z.infer<typeof animationNameSchema>;

export const characterDetailSchema = characterSummarySchema.extend({
  description: z.string(),
  packagePath: z.string(),
  sourceImagePath: z.string().nullable(),
  cleanedImagePath: z.string().nullable(),
  bodyMarkers: z.array(bodyMarkerSchema),
  skeleton: z
    .object({
      bones: z.array(puppetBoneSchema),
      defaultFacing: z.enum(['left', 'right']),
      layerOrder: z.array(z.string())
    })
    .nullable(),
  animations: z.array(animationNameSchema),
  puppetLayers: z.array(puppetLayerSchema),
  buildWarnings: z.array(z.string())
});

export type CharacterDetail = z.infer<typeof characterDetailSchema>;

export const updateCharacterMarkersSchema = z.object({
  characterId: z.string().trim().min(1),
  markers: z.array(bodyMarkerSchema).min(14)
});

export type UpdateCharacterMarkersRequest = z.infer<typeof updateCharacterMarkersSchema>;

export const rebuildCharacterPuppetSchema = z.object({
  characterId: z.string().trim().min(1)
});

export type RebuildCharacterPuppetRequest = z.infer<typeof rebuildCharacterPuppetSchema>;

export const characterActionSchema = z.object({
  characterId: z.string().trim().min(1)
});

export type CharacterActionRequest = z.infer<typeof characterActionSchema>;

export const imageQualityStatusSchema = z.enum(['good', 'needs_cleanup', 'detected', 'uncertain', 'low']);

export const imageQualityReportSchema = z.object({
  background: imageQualityStatusSchema,
  fullBody: imageQualityStatusSchema,
  armsVisible: imageQualityStatusSchema,
  legsVisible: imageQualityStatusSchema,
  imageResolution: imageQualityStatusSchema,
  characterPosition: imageQualityStatusSchema,
  messages: z.array(z.string())
});

export type ImageQualityReport = z.infer<typeof imageQualityReportSchema>;

export const imageAnalysisRequestSchema = z.object({
  filePath: z.string().trim().min(1)
});

export type ImageAnalysisRequest = z.infer<typeof imageAnalysisRequestSchema>;

export const imageAnalysisResultSchema = z.object({
  filePath: z.string(),
  fileName: z.string(),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  byteSize: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  hasTransparentBackground: z.boolean(),
  previewDataUrl: z.string(),
  report: imageQualityReportSchema
});

export type ImageAnalysisResult = z.infer<typeof imageAnalysisResultSchema>;

export const createCharacterDraftSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(1000).optional(),
  sourceImagePath: z.string().trim().min(1).optional(),
  sourceImageDataUrl: z.string().startsWith('data:image/').optional(),
  voice: z.string().trim().max(80).optional(),
  pronouns: z.string().trim().max(60).optional(),
  defaultScale: z.number().min(0.25).max(3).default(1),
  importReport: imageQualityReportSchema.optional()
});

export type CreateCharacterDraftRequest = z.infer<typeof createCharacterDraftSchema>;

export const createCharacterDraftResponseSchema = z.object({
  character: characterSummarySchema
});

export type CreateCharacterDraftResponse = z.infer<typeof createCharacterDraftResponseSchema>;

export const stageAssetSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['background', 'prop']),
  color: z.string(),
  description: z.string()
});

export type StageAsset = z.infer<typeof stageAssetSchema>;

export const timelineClipSchema = z.object({
  id: z.string(),
  characterId: z.string().nullable(),
  assetId: z.string().nullable(),
  startMs: z.number().int().nonnegative(),
  durationMs: z.number().int().positive(),
  action: animationNameSchema,
  dialogue: z.string(),
  subtitle: z.string(),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  scale: z.number().min(0.2).max(3),
  facing: z.enum(['left', 'right']),
  transition: z.enum(['gentle-cut', 'soft-hold', 'calm-move'])
});

export type TimelineClip = z.infer<typeof timelineClipSchema>;

export const cartoonProjectSchema = z.object({
  id: z.string(),
  title: z.string(),
  prompt: z.string(),
  status: z.enum(['draft', 'ready', 'exporting', 'exported', 'failed']),
  characterId: z.string().nullable(),
  backgroundId: z.string(),
  format: z.object({
    preset: z.literal('youtube-shorts'),
    width: z.literal(1080),
    height: z.literal(1920),
    fps: z.literal(30),
    safeAreaPercent: z.number().min(0).max(0.3)
  }),
  accessibilityProfile: z.object({
    audience: z.literal('autistic-children'),
    sensoryIntensity: z.enum(['calm', 'medium']),
    maxClipDurationMs: z.number().int().positive(),
    subtitleMode: z.literal('always-on'),
    flashingContent: z.literal(false),
    suddenAudio: z.literal(false),
    highContrastSubtitles: z.literal(true)
  }),
  clips: z.array(timelineClipSchema),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type CartoonProject = z.infer<typeof cartoonProjectSchema>;

export const createCartoonProjectSchema = z.object({
  title: z.string().trim().min(1).max(100),
  prompt: z.string().trim().min(1).max(5000),
  characterId: z.string().trim().min(1).nullable().optional(),
  backgroundId: z.string().trim().min(1).optional()
});

export type CreateCartoonProjectRequest = z.infer<typeof createCartoonProjectSchema>;

export const exportJobSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  status: z.enum(['queued', 'ready', 'failed']),
  filePath: z.string(),
  preset: z.enum(['preview-html', 'mp4-ffmpeg']),
  message: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type ExportJob = z.infer<typeof exportJobSchema>;

export const createExportSchema = z.object({
  projectId: z.string().trim().min(1),
  preset: z.enum(['preview-html', 'mp4-ffmpeg']).default('preview-html')
});

export type CreateExportRequest = z.infer<typeof createExportSchema>;

export const ipcChannels = {
  appGetHealth: 'app:getHealth',
  characterList: 'character:list',
  characterCreateDraft: 'character:createDraft',
  characterGet: 'character:get',
  characterUpdateMarkers: 'character:updateMarkers',
  characterRebuildPuppet: 'character:rebuildPuppet',
  characterDuplicate: 'character:duplicate',
  characterDelete: 'character:delete',
  imageAnalyze: 'image:analyze',
  dialogSelectImage: 'dialog:selectImage',
  assetList: 'asset:list',
  projectList: 'project:list',
  projectCreateFromPrompt: 'project:createFromPrompt',
  exportList: 'export:list',
  exportCreate: 'export:create'
} as const;

export interface StudioApi {
  getHealth: () => Promise<StudioHealth>;
  listCharacters: () => Promise<CharacterSummary[]>;
  getCharacter: (characterId: string) => Promise<CharacterDetail>;
  createCharacterDraft: (
    request: CreateCharacterDraftRequest
  ) => Promise<CreateCharacterDraftResponse>;
  updateCharacterMarkers: (request: UpdateCharacterMarkersRequest) => Promise<CharacterDetail>;
  rebuildCharacterPuppet: (request: RebuildCharacterPuppetRequest) => Promise<CharacterDetail>;
  duplicateCharacter: (request: CharacterActionRequest) => Promise<CharacterSummary>;
  deleteCharacter: (request: CharacterActionRequest) => Promise<{ deleted: true }>;
  analyzeImage: (request: ImageAnalysisRequest) => Promise<ImageAnalysisResult>;
  selectImage: () => Promise<string | null>;
  listAssets: () => Promise<StageAsset[]>;
  listProjects: () => Promise<CartoonProject[]>;
  createProjectFromPrompt: (request: CreateCartoonProjectRequest) => Promise<CartoonProject>;
  listExports: () => Promise<ExportJob[]>;
  createExport: (request: CreateExportRequest) => Promise<ExportJob>;
}
