import { describe, expect, it } from 'vitest';
import {
  createCartoonProjectSchema,
  createCharacterDraftSchema,
  createExportSchema,
  studioHealthSchema,
  updateCharacterMarkersSchema
} from '../src/shared/ipc';

describe('IPC contracts', () => {
  it('accepts a valid character draft request', () => {
    expect(
      createCharacterDraftSchema.parse({
        name: 'Max',
        description: 'Friendly playground character'
      })
    ).toMatchObject({ name: 'Max' });
  });

  it('rejects empty character names', () => {
    expect(() => createCharacterDraftSchema.parse({ name: '' })).toThrow();
  });

  it('validates studio health payloads', () => {
    expect(
      studioHealthSchema.parse({
        appVersion: '0.1.0',
        databaseReady: true,
        migrationsApplied: 1,
        appData: {
          root: 'root',
          database: 'database',
          characters: 'characters',
          projects: 'projects',
          assets: 'assets',
          renders: 'renders',
          exports: 'exports',
          cache: 'cache',
          logs: 'logs',
          models: 'models',
          backups: 'backups'
        },
        lastError: null
      }).databaseReady
    ).toBe(true);
  });

  it('accepts valid marker correction payloads', () => {
    const markers = [
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
    ].map((name, index) => ({ name, x: 0.4 + index * 0.005, y: 0.1 + index * 0.05 }));

    expect(updateCharacterMarkersSchema.parse({ characterId: 'character-1', markers }).markers).toHaveLength(14);
  });

  it('accepts local cartoon prompt and export requests', () => {
    expect(
      createCartoonProjectSchema.parse({
        title: 'Hello',
        prompt: 'Max waves.',
        characterId: 'character-1'
      }).title
    ).toBe('Hello');
    expect(createExportSchema.parse({ projectId: 'project-1' }).preset).toBe('preview-html');
  });
});
