import fs from 'fs-extra';
import { randomUUID } from 'node:crypto';
import { basename, extname, join } from 'node:path';
import { PNG } from 'pngjs';
import type { Database } from 'sql.js';
import {
  type BodyMarker,
  type CharacterDetail,
  type CharacterSummary,
  type CreateCharacterDraftRequest,
  type MarkerName,
  type PuppetBone,
  type PuppetLayer,
  type UpdateCharacterMarkersRequest,
  createCharacterDraftSchema
} from '../../shared/ipc.js';
import type { AppDataLayout } from '../../shared/ipc.js';
import type { CharacterPreparationService, PreparationResult } from './characterPreparationService.js';

export class CharacterRepository {
  public constructor(
    private readonly database: Database,
    private readonly layout: AppDataLayout,
    private readonly persist: () => Promise<void>,
    private readonly preparation: CharacterPreparationService
  ) {}

  public list(): CharacterSummary[] {
    const result = this.database.exec(`
        SELECT id, name, status, thumbnail_path, animation_count, warning_count, updated_at
        FROM characters
        ORDER BY updated_at DESC
      `);
    const rows =
      result[0]?.values.map((value) => ({
        id: String(value[0]),
        name: String(value[1]),
        status: value[2] as CharacterSummary['status'],
        thumbnail_path: value[3] === null ? null : String(value[3]),
        animation_count: Number(value[4]),
        warning_count: Number(value[5]),
        updated_at: String(value[6])
      })) ?? [];

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      thumbnailPath: row.thumbnail_path,
      animationCount: row.animation_count,
      warningCount: row.warning_count,
      updatedAt: row.updated_at
    }));
  }

  public async createDraft(request: CreateCharacterDraftRequest): Promise<CharacterSummary> {
    const parsed = createCharacterDraftSchema.parse(request);
    const id = randomUUID();
    const now = new Date().toISOString();
    const packagePath = join(this.layout.characters, id);
    const sourcePath = join(packagePath, 'source');

    await fs.ensureDir(sourcePath);
    await fs.ensureDir(join(packagePath, 'cleaned'));
    await fs.ensureDir(join(packagePath, 'layers'));
    await fs.ensureDir(join(packagePath, 'face'));
    await fs.ensureDir(join(packagePath, 'mouths'));
    await fs.ensureDir(join(packagePath, 'expressions'));
    await fs.ensureDir(join(packagePath, 'animations'));
    await fs.ensureDir(join(packagePath, 'thumbnails'));
    await fs.ensureDir(join(packagePath, 'previews'));

    let importedImagePath: string | null = null;
    let originalImagePath: string | null = null;

    if (parsed.sourceImagePath) {
      const originalExtension = extname(parsed.sourceImagePath).toLowerCase() || '.image';
      originalImagePath = join(sourcePath, `original${originalExtension}`);
      await fs.copy(parsed.sourceImagePath, originalImagePath, { overwrite: true });
    }

    if (parsed.sourceImageDataUrl) {
      importedImagePath = join(sourcePath, 'imported.png');
      await fs.writeFile(importedImagePath, this.decodeDataUrl(parsed.sourceImageDataUrl));
    }

    let preparationResult: PreparationResult | null = null;
    if (importedImagePath) {
      preparationResult = await this.preparation.prepare(importedImagePath, packagePath);
    }

    const buildWarnings = [
      ...(parsed.importReport?.messages.filter((message) => message.trim().length > 0) ?? []),
      ...(preparationResult?.warnings ?? [])
    ];

    const uniqueBuildWarnings =
      buildWarnings.filter((message, index, items) => items.indexOf(message) === index);

    const importWarnings =
      parsed.importReport?.messages.filter((message) => message.trim().length > 0) ?? [];

    const markers = preparationResult ? this.estimateMarkers(preparationResult.bounds) : [];
    const puppetLayers = preparationResult
      ? await this.buildPuppetLayers(packagePath, preparationResult.cleanedImagePath, markers)
      : [];

    const manifest = {
      schemaVersion: 1,
      id,
      name: parsed.name,
      description: parsed.description ?? '',
      voice: parsed.voice ?? '',
      pronouns: parsed.pronouns ?? '',
      sourceImagePath: importedImagePath,
      originalImagePath,
      originalFileName: parsed.sourceImagePath ? basename(parsed.sourceImagePath) : null,
      buildVersion: '0.1.0-milestone-2',
      status: 'draft',
      importReport: parsed.importReport ?? null,
      preparation: preparationResult
        ? {
            method: preparationResult.method,
            cleanedImagePath: preparationResult.cleanedImagePath,
            silhouettePath: preparationResult.silhouettePath,
            metadataPath: preparationResult.metadataPath,
            bounds: preparationResult.bounds
          }
        : null,
      bodyRegions: preparationResult?.bodyRegions ?? null,
      layerFiles: puppetLayers.map((layer) => layer.filePath),
      puppetLayers,
      pivotPoints: markers,
      skeleton: preparationResult ? this.buildSkeleton() : null,
      faceConfiguration: null,
      mouthConfiguration: null,
      expressions: [],
      animations: preparationResult ? ['idle', 'blink', 'talk', 'wave', 'walk-left', 'walk-right'] : [],
      defaultScale: parsed.defaultScale,
      buildWarnings: uniqueBuildWarnings,
      importWarnings,
      createdAt: now,
      updatedAt: now
    };

    await fs.writeJson(join(packagePath, 'character.json'), manifest, { spaces: 2 });

    this.database.run(
      `
        INSERT INTO characters (
          id, name, description, status, package_path, thumbnail_path,
          animation_count, warning_count, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        parsed.name,
        parsed.description ?? null,
        preparationResult ? 'ready' : 'draft',
        packagePath,
        importedImagePath,
        preparationResult ? 6 : 0,
        uniqueBuildWarnings.length,
        now,
        now
      ]
    );
    await this.persist();

    return {
      id,
      name: parsed.name,
      status: preparationResult ? 'ready' : 'draft',
      thumbnailPath: importedImagePath,
      animationCount: preparationResult ? 6 : 0,
      warningCount: uniqueBuildWarnings.length,
      updatedAt: now
    };
  }

  public async get(characterId: string): Promise<CharacterDetail> {
    const row = this.findCharacterRow(characterId);
    const manifest = await fs.readJson(join(row.packagePath, 'character.json'));

    return {
      id: row.id,
      name: row.name,
      status: row.status,
      animationCount: row.animationCount,
      warningCount: row.warningCount,
      thumbnailPath: row.thumbnailPath,
      updatedAt: row.updatedAt,
      description: typeof manifest.description === 'string' ? manifest.description : '',
      packagePath: row.packagePath,
      sourceImagePath:
        typeof manifest.preparation?.cleanedImagePath === 'string'
          ? manifest.preparation.cleanedImagePath
          : typeof manifest.sourceImagePath === 'string'
            ? manifest.sourceImagePath
            : null,
      cleanedImagePath:
        typeof manifest.preparation?.cleanedImagePath === 'string'
          ? manifest.preparation.cleanedImagePath
          : null,
      bodyMarkers: this.normalizeMarkers(manifest.pivotPoints),
      skeleton: manifest.skeleton ?? null,
      animations: this.normalizeAnimations(manifest.animations),
      puppetLayers: this.normalizePuppetLayers(manifest.puppetLayers),
      buildWarnings: Array.isArray(manifest.buildWarnings) ? manifest.buildWarnings.map(String) : []
    };
  }

  public async updateMarkers(request: UpdateCharacterMarkersRequest): Promise<CharacterDetail> {
    const row = this.findCharacterRow(request.characterId);
    const manifestPath = join(row.packagePath, 'character.json');
    const manifest = await fs.readJson(manifestPath);
    const now = new Date().toISOString();
    const markers = this.normalizeMarkers(request.markers);

    manifest.pivotPoints = markers;
    manifest.skeleton = this.buildSkeleton();
    manifest.puppetLayers = await this.buildPuppetLayers(
      row.packagePath,
      this.resolveCleanedImagePath(manifest),
      markers
    );
    manifest.layerFiles = manifest.puppetLayers.map((layer: PuppetLayer) => layer.filePath);
    manifest.animations = ['idle', 'blink', 'talk', 'wave', 'walk-left', 'walk-right'];
    manifest.status = 'ready';
    manifest.updatedAt = now;

    await fs.writeJson(manifestPath, manifest, { spaces: 2 });
    this.database.run(
      `
        UPDATE characters
        SET status = ?, animation_count = ?, updated_at = ?
        WHERE id = ?
      `,
      ['ready', manifest.animations.length, now, request.characterId]
    );
    await this.persist();

    return this.get(request.characterId);
  }

  public async rebuildPuppet(characterId: string): Promise<CharacterDetail> {
    const current = await this.get(characterId);
    return this.updateMarkers({ characterId, markers: current.bodyMarkers });
  }

  public async duplicate(characterId: string): Promise<CharacterSummary> {
    const row = this.findCharacterRow(characterId);
    const id = randomUUID();
    const now = new Date().toISOString();
    const packagePath = join(this.layout.characters, id);
    const name = `${row.name} Copy`;

    await fs.copy(row.packagePath, packagePath, { overwrite: true });
    const manifestPath = join(packagePath, 'character.json');
    const originalManifest = await fs.readFile(manifestPath, 'utf8');
    const rewrittenManifest = originalManifest
      .replaceAll(row.packagePath.replaceAll('\\', '\\\\'), packagePath.replaceAll('\\', '\\\\'))
      .replaceAll(row.packagePath, packagePath);
    const manifest = JSON.parse(rewrittenManifest) as {
      id?: string;
      name?: string;
      createdAt?: string;
      updatedAt?: string;
    };
    manifest.id = id;
    manifest.name = name;
    manifest.createdAt = now;
    manifest.updatedAt = now;
    await fs.writeJson(manifestPath, manifest, { spaces: 2 });

    const thumbnailPath = row.thumbnailPath?.startsWith(row.packagePath)
      ? row.thumbnailPath.replace(row.packagePath, packagePath)
      : row.thumbnailPath;

    this.database.run(
      `
        INSERT INTO characters (
          id, name, description, status, package_path, thumbnail_path,
          animation_count, warning_count, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        name,
        null,
        row.status,
        packagePath,
        thumbnailPath,
        row.animationCount,
        row.warningCount,
        now,
        now
      ]
    );
    await this.persist();

    return {
      id,
      name,
      status: row.status,
      thumbnailPath,
      animationCount: row.animationCount,
      warningCount: row.warningCount,
      updatedAt: now
    };
  }

  public async delete(characterId: string): Promise<void> {
    const row = this.findCharacterRow(characterId);
    this.database.run('DELETE FROM characters WHERE id = ?', [characterId]);
    await this.persist();
    await fs.remove(row.packagePath);
  }

  private findCharacterRow(characterId: string): {
    id: string;
    name: string;
    status: CharacterSummary['status'];
    packagePath: string;
    thumbnailPath: string | null;
    animationCount: number;
    warningCount: number;
    updatedAt: string;
  } {
    const result = this.database.exec(
      `
        SELECT id, name, status, package_path, thumbnail_path, animation_count, warning_count, updated_at
        FROM characters
        WHERE id = '${characterId.replaceAll("'", "''")}'
      `
    );
    const value = result[0]?.values[0];
    if (!value) {
      throw new Error('Character was not found.');
    }

    return {
      id: String(value[0]),
      name: String(value[1]),
      status: value[2] as CharacterSummary['status'],
      packagePath: String(value[3]),
      thumbnailPath: value[4] === null ? null : String(value[4]),
      animationCount: Number(value[5]),
      warningCount: Number(value[6]),
      updatedAt: String(value[7])
    };
  }

  private normalizeMarkers(value: unknown): BodyMarker[] {
    if (!Array.isArray(value) || value.length === 0) {
      return this.estimateMarkers();
    }

    return value.map((item) => ({
      name: String((item as BodyMarker).name) as MarkerName,
      x: this.clamp(Number((item as BodyMarker).x), 0, 1),
      y: this.clamp(Number((item as BodyMarker).y), 0, 1)
    }));
  }

  private normalizeAnimations(value: unknown): CharacterDetail['animations'] {
    const fallback: CharacterDetail['animations'] = ['idle', 'blink', 'talk', 'wave', 'walk-left', 'walk-right'];
    if (!Array.isArray(value) || value.length === 0) {
      return fallback;
    }

    return fallback.filter((animation) => value.includes(animation));
  }

  private normalizePuppetLayers(value: unknown): PuppetLayer[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((layer) => {
        const item = layer as PuppetLayer;
        return {
          id: String(item.id),
          name: String(item.name),
          filePath: String(item.filePath),
          bounds: {
            x: this.clamp(Number(item.bounds?.x), 0, 1),
            y: this.clamp(Number(item.bounds?.y), 0, 1),
            width: this.clamp(Number(item.bounds?.width), 0, 1),
            height: this.clamp(Number(item.bounds?.height), 0, 1)
          },
          pivot: {
            x: this.clamp(Number(item.pivot?.x), 0, 1),
            y: this.clamp(Number(item.pivot?.y), 0, 1)
          },
          zIndex: Number.isInteger(item.zIndex) ? item.zIndex : 0
        };
      })
      .filter((layer) => layer.filePath.length > 0 && layer.bounds.width > 0 && layer.bounds.height > 0);
  }

  private estimateMarkers(bounds?: { x: number; y: number; width: number; height: number }): BodyMarker[] {
    const canvasWidth = 900;
    const canvasHeight = 1200;
    const left = bounds ? bounds.x / canvasWidth : 0.25;
    const top = bounds ? bounds.y / canvasHeight : 0.05;
    const width = bounds ? bounds.width / canvasWidth : 0.5;
    const height = bounds ? bounds.height / canvasHeight : 0.9;
    const x = (ratio: number) => this.clamp(left + width * ratio, 0.04, 0.96);
    const y = (ratio: number) => this.clamp(top + height * ratio, 0.04, 0.98);

    return [
      { name: 'head', x: x(0.5), y: y(0.08) },
      { name: 'neck', x: x(0.5), y: y(0.2) },
      { name: 'leftShoulder', x: x(0.33), y: y(0.24) },
      { name: 'rightShoulder', x: x(0.67), y: y(0.24) },
      { name: 'leftElbow', x: x(0.2), y: y(0.42) },
      { name: 'rightElbow', x: x(0.8), y: y(0.42) },
      { name: 'leftWrist', x: x(0.16), y: y(0.58) },
      { name: 'rightWrist', x: x(0.84), y: y(0.58) },
      { name: 'leftHip', x: x(0.42), y: y(0.56) },
      { name: 'rightHip', x: x(0.58), y: y(0.56) },
      { name: 'leftKnee', x: x(0.4), y: y(0.76) },
      { name: 'rightKnee', x: x(0.6), y: y(0.76) },
      { name: 'leftAnkle', x: x(0.38), y: y(0.95) },
      { name: 'rightAnkle', x: x(0.62), y: y(0.95) }
    ];
  }

  private buildSkeleton(): { bones: PuppetBone[]; defaultFacing: 'right'; layerOrder: string[] } {
    return {
      defaultFacing: 'right',
      layerOrder: ['leftLeg', 'rightLeg', 'torso', 'head', 'leftArm', 'rightArm', 'mouth', 'eyes'],
      bones: [
        { id: 'spine', from: 'head', to: 'leftHip', layer: 'body' },
        { id: 'left-upper-arm', from: 'leftShoulder', to: 'leftElbow', layer: 'front-body' },
        { id: 'left-lower-arm', from: 'leftElbow', to: 'leftWrist', layer: 'front-body' },
        { id: 'right-upper-arm', from: 'rightShoulder', to: 'rightElbow', layer: 'behind-body' },
        { id: 'right-lower-arm', from: 'rightElbow', to: 'rightWrist', layer: 'behind-body' },
        { id: 'left-upper-leg', from: 'leftHip', to: 'leftKnee', layer: 'behind-body' },
        { id: 'left-lower-leg', from: 'leftKnee', to: 'leftAnkle', layer: 'behind-body' },
        { id: 'right-upper-leg', from: 'rightHip', to: 'rightKnee', layer: 'body' },
        { id: 'right-lower-leg', from: 'rightKnee', to: 'rightAnkle', layer: 'body' }
      ]
    };
  }

  private async buildPuppetLayers(
    packagePath: string,
    cleanedImagePath: string | null,
    markers: BodyMarker[]
  ): Promise<PuppetLayer[]> {
    if (!cleanedImagePath || !(await fs.pathExists(cleanedImagePath))) {
      return [];
    }

    const source = PNG.sync.read(await fs.readFile(cleanedImagePath));
    const markerMap = new Map(markers.map((marker) => [marker.name, marker]));
    const layerPath = join(packagePath, 'layers');
    await fs.ensureDir(layerPath);

    const definitions: Array<{
      id: string;
      name: string;
      markerNames: MarkerName[];
      pivotName: MarkerName;
      paddingX: number;
      paddingY: number;
      zIndex: number;
    }> = [
      {
        id: 'leftLeg',
        name: 'Left leg',
        markerNames: ['leftHip', 'leftKnee', 'leftAnkle'],
        pivotName: 'leftHip',
        paddingX: 0.06,
        paddingY: 0.04,
        zIndex: 10
      },
      {
        id: 'rightLeg',
        name: 'Right leg',
        markerNames: ['rightHip', 'rightKnee', 'rightAnkle'],
        pivotName: 'rightHip',
        paddingX: 0.06,
        paddingY: 0.04,
        zIndex: 12
      },
      {
        id: 'torso',
        name: 'Torso',
        markerNames: ['leftShoulder', 'rightShoulder', 'leftHip', 'rightHip', 'neck'],
        pivotName: 'neck',
        paddingX: 0.08,
        paddingY: 0.05,
        zIndex: 20
      },
      {
        id: 'head',
        name: 'Head',
        markerNames: ['head', 'neck', 'leftShoulder', 'rightShoulder'],
        pivotName: 'neck',
        paddingX: 0.1,
        paddingY: 0.08,
        zIndex: 30
      },
      {
        id: 'leftArm',
        name: 'Left arm',
        markerNames: ['leftShoulder', 'leftElbow', 'leftWrist'],
        pivotName: 'leftShoulder',
        paddingX: 0.06,
        paddingY: 0.04,
        zIndex: 40
      },
      {
        id: 'rightArm',
        name: 'Right arm',
        markerNames: ['rightShoulder', 'rightElbow', 'rightWrist'],
        pivotName: 'rightShoulder',
        paddingX: 0.06,
        paddingY: 0.04,
        zIndex: 42
      }
    ];

    const layers: PuppetLayer[] = [];
    for (const definition of definitions) {
      const points = definition.markerNames
        .map((name) => markerMap.get(name))
        .filter((marker): marker is BodyMarker => Boolean(marker));
      const pivot = markerMap.get(definition.pivotName);

      if (points.length === 0 || !pivot) {
        continue;
      }

      const bounds = this.layerBounds(points, definition.paddingX, definition.paddingY);
      const pixelBounds = {
        x: Math.round(bounds.x * source.width),
        y: Math.round(bounds.y * source.height),
        width: Math.max(1, Math.round(bounds.width * source.width)),
        height: Math.max(1, Math.round(bounds.height * source.height))
      };
      const layer = new PNG({ width: pixelBounds.width, height: pixelBounds.height });

      for (let y = 0; y < pixelBounds.height; y += 1) {
        for (let x = 0; x < pixelBounds.width; x += 1) {
          const sourceX = pixelBounds.x + x;
          const sourceY = pixelBounds.y + y;
          const sourceIndex = (sourceY * source.width + sourceX) * 4;
          const targetIndex = (y * pixelBounds.width + x) * 4;
          layer.data[targetIndex] = source.data[sourceIndex] ?? 0;
          layer.data[targetIndex + 1] = source.data[sourceIndex + 1] ?? 0;
          layer.data[targetIndex + 2] = source.data[sourceIndex + 2] ?? 0;
          layer.data[targetIndex + 3] = source.data[sourceIndex + 3] ?? 0;
        }
      }

      const filePath = join(layerPath, `${definition.id}.png`);
      await fs.writeFile(filePath, PNG.sync.write(layer));

      layers.push({
        id: definition.id,
        name: definition.name,
        filePath,
        bounds,
        pivot: {
          x: this.clamp((pivot.x - bounds.x) / bounds.width, 0, 1),
          y: this.clamp((pivot.y - bounds.y) / bounds.height, 0, 1)
        },
        zIndex: definition.zIndex
      });
    }

    await fs.writeJson(join(layerPath, 'layers.json'), { schemaVersion: 1, layers }, { spaces: 2 });
    return layers;
  }

  private layerBounds(points: BodyMarker[], paddingX: number, paddingY: number): PuppetLayer['bounds'] {
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const minX = this.clamp(Math.min(...xs) - paddingX, 0, 1);
    const maxX = this.clamp(Math.max(...xs) + paddingX, 0, 1);
    const minY = this.clamp(Math.min(...ys) - paddingY, 0, 1);
    const maxY = this.clamp(Math.max(...ys) + paddingY, 0, 1);

    return {
      x: minX,
      y: minY,
      width: Math.max(0.01, maxX - minX),
      height: Math.max(0.01, maxY - minY)
    };
  }

  private resolveCleanedImagePath(manifest: unknown): string | null {
    const value = manifest as {
      preparation?: { cleanedImagePath?: unknown };
      sourceImagePath?: unknown;
    };

    if (typeof value.preparation?.cleanedImagePath === 'string') {
      return value.preparation.cleanedImagePath;
    }

    return typeof value.sourceImagePath === 'string' ? value.sourceImagePath : null;
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(maximum, Math.max(minimum, value));
  }

  private decodeDataUrl(dataUrl: string): Buffer {
    const match = /^data:image\/[a-zA-Z0-9.+-]+;base64,(?<payload>.+)$/.exec(dataUrl);

    if (!match?.groups?.payload) {
      throw new Error('Invalid image data.');
    }

    return Buffer.from(match.groups.payload, 'base64');
  }
}
