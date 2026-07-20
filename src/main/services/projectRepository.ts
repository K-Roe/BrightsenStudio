import fs from 'fs-extra';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { PNG } from 'pngjs';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import type { Database } from 'sql.js';
import {
  createCartoonProjectSchema,
  createExportSchema,
  type CartoonProject,
  type CreateCartoonProjectRequest,
  type CreateExportRequest,
  type ExportJob,
  type PuppetLayer,
  type StageAsset,
  type TimelineClip
} from '../../shared/ipc.js';
import type { AppDataLayout } from '../../shared/ipc.js';

const execFileAsync = promisify(execFile);

const starterAssets: StageAsset[] = [
  {
    id: 'sunny-park',
    name: 'Sunny Park',
    type: 'background',
    color: '#7ddc8a',
    description: 'A bright outdoor park for friendly stories.'
  },
  {
    id: 'classroom',
    name: 'Classroom',
    type: 'background',
    color: '#57c7ff',
    description: 'A clean learning room for educational scenes.'
  },
  {
    id: 'bedroom',
    name: 'Bedroom',
    type: 'background',
    color: '#f6c85f',
    description: 'A calm home space for bedtime or quiet stories.'
  },
  {
    id: 'star-prop',
    name: 'Bright Star',
    type: 'prop',
    color: '#fde047',
    description: 'A simple reward prop for child-friendly scenes.'
  }
];

export class ProjectRepository {
  public constructor(
    private readonly database: Database,
    private readonly layout: AppDataLayout,
    private readonly persist: () => Promise<void>
  ) {}

  public listAssets(): StageAsset[] {
    return starterAssets;
  }

  public async listProjects(): Promise<CartoonProject[]> {
    const result = this.database.exec(`
      SELECT id, project_path
      FROM projects
      ORDER BY updated_at DESC
    `);

    const rows = result[0]?.values ?? [];
    const projects: CartoonProject[] = [];
    for (const row of rows) {
      const projectPath = String(row[1]);
      const manifestPath = join(projectPath, 'project.json');
      if (await fs.pathExists(manifestPath)) {
        projects.push(createProject(await fs.readJson(manifestPath)));
      }
    }

    return projects;
  }

  public async createFromPrompt(request: CreateCartoonProjectRequest): Promise<CartoonProject> {
    const parsed = createCartoonProjectSchema.parse(request);
    const now = new Date().toISOString();
    const id = randomUUID();
    const projectPath = join(this.layout.projects, id);
    const project = createProject({
      id,
      title: parsed.title,
      prompt: parsed.prompt,
      status: 'ready',
      characterId: parsed.characterId ?? null,
      backgroundId: parsed.backgroundId ?? 'sunny-park',
      format: createShortsFormat(),
      accessibilityProfile: createAutismFriendlyProfile(),
      clips: this.parsePrompt(parsed.prompt, parsed.characterId ?? null),
      createdAt: now,
      updatedAt: now
    });

    await fs.ensureDir(projectPath);
    await fs.writeJson(join(projectPath, 'project.json'), project, { spaces: 2 });

    this.database.run(
      `
        INSERT INTO projects (id, title, status, project_path, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [project.id, project.title, project.status, projectPath, now, now]
    );
    await this.persist();

    return project;
  }

  public async listExports(): Promise<ExportJob[]> {
    const result = this.database.exec(`
      SELECT id, project_id, status, file_path, preset, created_at, updated_at
      FROM exports
      ORDER BY updated_at DESC
    `);

    return (
      result[0]?.values.map((row) => ({
        id: String(row[0]),
        projectId: String(row[1]),
        status: row[2] as ExportJob['status'],
        filePath: String(row[3]),
        preset: row[4] as ExportJob['preset'],
        message:
          row[4] === 'mp4-ffmpeg' && row[2] === 'failed'
            ? 'FFmpeg was not found locally. Install FFmpeg and try MP4 again, or use preview export.'
            : 'Export is ready on this computer.',
        createdAt: String(row[5]),
        updatedAt: String(row[6])
      })) ?? []
    );
  }

  public async createExport(request: CreateExportRequest): Promise<ExportJob> {
    const parsed = createExportSchema.parse(request);
    const projects = await this.listProjects();
    const project = projects.find((item) => item.id === parsed.projectId);
    if (!project) {
      throw new Error('Project was not found.');
    }

    const now = new Date().toISOString();
    const id = randomUUID();
    await fs.ensureDir(this.layout.exports);

    const canCreatePreview = parsed.preset === 'preview-html';
    const filePath = join(
      this.layout.exports,
      `${project.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${id.slice(0, 8)}.${canCreatePreview ? 'html' : 'mp4'}`
    );
    let status: ExportJob['status'] = 'ready';
    let message = canCreatePreview
      ? 'Preview export is ready as a local HTML file.'
      : 'MP4 export is ready as a local H.264 file.';

    if (canCreatePreview) {
      await fs.writeFile(filePath, await this.renderPreviewHtml(project), 'utf8');
    } else {
      try {
        await this.renderMp4(project, filePath, id);
      } catch (error) {
        status = 'failed';
        message = `MP4 export failed locally: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    this.database.run(
      `
        INSERT INTO exports (id, project_id, status, file_path, preset, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [id, project.id, status, filePath, parsed.preset, now, now]
    );
    await this.persist();

    return {
      id,
      projectId: project.id,
      status,
      filePath,
      preset: parsed.preset,
      message,
      createdAt: now,
      updatedAt: now
    };
  }

  private parsePrompt(prompt: string, characterId: string | null): TimelineClip[] {
    const sentences = prompt
      .split(/(?<=[.!?])\s+|\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 12);
    const lines = sentences.length > 0 ? sentences : [prompt.trim()];

    return lines.map((line, index) => {
      const lower = line.toLowerCase();
      const action = lower.includes('walk')
        ? index % 2 === 0
          ? 'walk-right'
          : 'walk-left'
        : lower.includes('wave')
          ? 'wave'
          : lower.includes('say') || line.includes('"')
            ? 'talk'
            : 'idle';

      return {
        id: randomUUID(),
        characterId,
        assetId: lower.includes('star') ? 'star-prop' : null,
        startMs: index * 3200,
        durationMs: Math.max(3200, Math.min(5200, line.length * 82)),
        action,
        dialogue: this.cleanDialogue(line),
        subtitle: this.cleanDialogue(line),
        x: action === 'walk-left' ? 0.68 : 0.35,
        y: 0.78,
        scale: 1,
        facing: action === 'walk-left' ? 'left' : 'right',
        transition: action === 'walk-left' || action === 'walk-right' ? 'calm-move' : 'soft-hold'
      };
    });
  }

  private async renderPreviewHtml(project: CartoonProject): Promise<string> {
    const asset = starterAssets.find((item) => item.id === project.backgroundId) ?? {
      id: 'fallback',
      name: 'Fallback',
      type: 'background',
      color: '#57c7ff',
      description: 'Fallback background.'
    };
    const characterAssets = project.characterId ? await this.getCharacterRenderAssets(project.characterId) : null;
    const clips = project.clips
      .map(
        (clip) => `<li><strong>${clip.action}</strong> ${escapeHtml(clip.subtitle)} <span>${(clip.startMs / 1000).toFixed(1)}s</span></li>`
      )
      .join('');
    const firstClip = project.clips[0];
    const prop = firstClip?.assetId ? starterAssets.find((item) => item.id === firstClip.assetId) : null;
    const propMarkup = prop
      ? `<div class="prop" aria-hidden="true" style="background:${prop.color}">${escapeHtml(prop.name.slice(0, 1))}</div>`
      : '';
    const characterMarkup = characterAssets?.layers.length
      ? `<div class="segmented-character">${characterAssets.layers
          .slice()
          .sort((left, right) => left.zIndex - right.zIndex)
          .map(
            (layer) =>
              `<img class="puppet-layer puppet-layer-${escapeHtml(layer.id)}" src="${layer.dataUri}" alt="" style="left:${layer.bounds.x * 100}%;top:${layer.bounds.y * 100}%;width:${layer.bounds.width * 100}%;height:${layer.bounds.height * 100}%;transform-origin:${layer.pivot.x * 100}% ${layer.pivot.y * 100}%;z-index:${layer.zIndex}">`
          )
          .join('')}</div>`
      : characterAssets?.wholeImageDataUri
        ? `<img class="character-image" src="${characterAssets.wholeImageDataUri}" alt="">`
      : '<div class="character-fallback" aria-hidden="true"></div>';

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(project.title)}</title>
  <style>
    body { margin: 0; font-family: Segoe UI, sans-serif; background: #101820; color: #f6fbff; }
    main { max-width: 520px; margin: 0 auto; padding: 24px; }
    .stage { position: relative; aspect-ratio: 9 / 16; overflow: hidden; border-radius: 18px; background: linear-gradient(160deg, ${asset.color}, #10202b); box-shadow: 0 22px 70px rgba(0,0,0,.36); }
    .character { position: absolute; left: ${(firstClip?.x ?? 0.5) * 100}%; top: ${(firstClip?.y ?? 0.78) * 100}%; width: 46%; transform: translate(-50%, -100%) scaleX(${firstClip?.facing === 'left' ? -1 : 1}); transform-origin: 50% 100%; }
    .character-image { display: block; width: 100%; filter: drop-shadow(0 24px 28px rgba(0,0,0,.3)); }
    .segmented-character { position: relative; width: 100%; aspect-ratio: 3 / 4; filter: drop-shadow(0 24px 28px rgba(0,0,0,.3)); }
    .puppet-layer { position: absolute; display: block; object-fit: contain; }
    .puppet-layer-rightArm { transform: ${firstClip?.action === 'wave' ? 'rotate(-34deg)' : 'none'}; }
    .puppet-layer-leftLeg { transform: ${firstClip?.action === 'walk-left' || firstClip?.action === 'walk-right' ? 'rotate(8deg)' : 'none'}; }
    .puppet-layer-rightLeg { transform: ${firstClip?.action === 'walk-left' || firstClip?.action === 'walk-right' ? 'rotate(-8deg)' : 'none'}; }
    .character-fallback { width: 150px; height: 240px; border-radius: 80px 80px 42px 42px; background: #fff; }
    .prop { position: absolute; right: 12%; top: 22%; display: grid; width: 74px; height: 74px; place-items: center; clip-path: polygon(50% 0, 62% 36%, 100% 36%, 69% 57%, 82% 100%, 50% 73%, 18% 100%, 31% 57%, 0 36%, 38% 36%); color: #071820; font-weight: 900; }
    .subtitle { position: absolute; left: 7%; right: 7%; bottom: 7%; border-radius: 14px; padding: 14px 16px; color: #071820; background: rgba(255,255,255,.94); font-size: 1.1rem; font-weight: 800; line-height: 1.35; text-align: center; }
    li { margin: 12px 0; color: #dbeafe; line-height: 1.5; }
    span { color: #9bb5c2; margin-left: 8px; }
  </style>
</head>
<body>
  <main>
    <p>BrightSen Studio local preview export</p>
    <h1>${escapeHtml(project.title)}</h1>
    <section class="stage">
      <div class="character">${characterMarkup}</div>
      ${propMarkup}
      <div class="subtitle">${escapeHtml(firstClip?.subtitle ?? 'Ready')}</div>
    </section>
    <h2>Timeline</h2>
    <ol>${clips}</ol>
  </main>
</body>
</html>`;
  }

  private cleanDialogue(line: string): string {
    const cleaned = line.replace(/^say\s+/i, '').replaceAll('"', '').trim();
    return cleaned.length > 90 ? `${cleaned.slice(0, 87).trim()}...` : cleaned;
  }

  private async renderMp4(project: CartoonProject, filePath: string, exportId: string): Promise<void> {
    const frameDirectory = join(this.layout.renders, exportId);
    await fs.emptyDir(frameDirectory);

    const frameRate = 5;
    const width = 540;
    const height = 960;
    const totalDurationMs = Math.min(
      30_000,
      Math.max(3200, project.clips.reduce((max, clip) => Math.max(max, clip.startMs + clip.durationMs), 0))
    );
    const frameCount = Math.max(1, Math.ceil((totalDurationMs / 1000) * frameRate));
    const background = starterAssets.find((asset) => asset.id === project.backgroundId) ?? starterAssets[0];
    const characterAssets = project.characterId ? await this.getCharacterRenderAssets(project.characterId) : null;
    const layerCache = new Map<string, PNG>();

    for (let frame = 0; frame < frameCount; frame += 1) {
      const timeMs = (frame / frameRate) * 1000;
      const clip = this.clipAt(project, timeMs);
      const image = new PNG({ width, height });
      this.fillBackground(image, background?.color ?? '#57c7ff');

      if (clip) {
        await this.drawCharacter(image, clip, timeMs, characterAssets, layerCache);
        this.drawProp(image, clip);
        this.drawSubtitle(image, clip.subtitle);
      }

      await fs.writeFile(join(frameDirectory, `frame-${String(frame).padStart(4, '0')}.png`), PNG.sync.write(image));
    }

    const narrationPath = await this.createNarrationAudio(project, frameDirectory);
    const ffmpegArgs = [
      '-y',
      '-framerate',
      String(frameRate),
      '-i',
      join(frameDirectory, 'frame-%04d.png'),
      ...(narrationPath ? ['-i', narrationPath] : []),
      '-vf',
      'scale=1080:1920',
      '-r',
      '30',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      ...(narrationPath ? ['-c:a', 'aac', '-shortest'] : []),
      filePath
    ];

    await execFileAsync(ffmpegInstaller.path, ffmpegArgs);

    await fs.remove(frameDirectory);
  }

  private async createNarrationAudio(project: CartoonProject, frameDirectory: string): Promise<string | null> {
    const narration = project.clips
      .map((clip) => clip.dialogue.trim())
      .filter(Boolean)
      .join(' ');

    if (narration.length === 0 || process.platform !== 'win32') {
      return null;
    }

    const narrationTextPath = join(frameDirectory, 'narration.txt');
    const narrationWavePath = join(frameDirectory, 'narration.wav');
    await fs.writeFile(narrationTextPath, narration, 'utf8');

    const script = [
      'Add-Type -AssemblyName System.Speech',
      '$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer',
      '$speaker.Rate = -2',
      '$speaker.Volume = 85',
      '$speaker.SetOutputToWaveFile($args[1])',
      '$speaker.Speak((Get-Content -Raw -LiteralPath $args[0]))',
      '$speaker.Dispose()'
    ].join('; ');

    try {
      await execFileAsync('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        script,
        narrationTextPath,
        narrationWavePath
      ]);
      return (await fs.pathExists(narrationWavePath)) ? narrationWavePath : null;
    } catch {
      return null;
    }
  }

  private clipAt(project: CartoonProject, timeMs: number): TimelineClip | null {
    return (
      project.clips.find((clip) => timeMs >= clip.startMs && timeMs < clip.startMs + clip.durationMs) ??
      project.clips.at(-1) ??
      null
    );
  }

  private fillBackground(image: PNG, color: string): void {
    const rgb = parseHex(color);
    for (let y = 0; y < image.height; y += 1) {
      const blend = y / image.height;
      const r = Math.round(rgb.r * (1 - blend) + 16 * blend);
      const g = Math.round(rgb.g * (1 - blend) + 32 * blend);
      const b = Math.round(rgb.b * (1 - blend) + 43 * blend);
      for (let x = 0; x < image.width; x += 1) {
        const index = (y * image.width + x) * 4;
        image.data[index] = r;
        image.data[index + 1] = g;
        image.data[index + 2] = b;
        image.data[index + 3] = 255;
      }
    }
  }

  private async drawCharacter(
    image: PNG,
    clip: TimelineClip,
    timeMs: number,
    assets: Awaited<ReturnType<ProjectRepository['getCharacterRenderAssets']>>,
    layerCache: Map<string, PNG>
  ): Promise<void> {
    const progress = (timeMs - clip.startMs) / clip.durationMs;
    const walkOffset = clip.action === 'walk-right' ? progress * 0.2 : clip.action === 'walk-left' ? -progress * 0.2 : 0;
    const characterWidth = Math.round(image.width * 0.42 * clip.scale);
    const characterHeight = Math.round(characterWidth * 1.34);
    const characterX = Math.round((Math.min(0.82, Math.max(0.18, clip.x + walkOffset)) * image.width) - characterWidth / 2);
    const characterY = Math.round(clip.y * image.height - characterHeight);

    if (assets?.layers.length) {
      for (const layer of assets.layers.slice().sort((left, right) => left.zIndex - right.zIndex)) {
        const source = await this.readPng(layer.filePath, layerCache);
        this.compositeScaled(
          image,
          source,
          characterX + Math.round(layer.bounds.x * characterWidth),
          characterY + Math.round(layer.bounds.y * characterHeight),
          Math.max(1, Math.round(layer.bounds.width * characterWidth)),
          Math.max(1, Math.round(layer.bounds.height * characterHeight))
        );
      }
      return;
    }

    if (assets?.wholeImagePath) {
      const source = await this.readPng(assets.wholeImagePath, layerCache);
      this.compositeScaled(image, source, characterX, characterY, characterWidth, characterHeight);
    }
  }

  private drawProp(image: PNG, clip: TimelineClip): void {
    if (clip.assetId !== 'star-prop') {
      return;
    }

    const centerX = Math.round(image.width * 0.78);
    const centerY = Math.round(image.height * 0.23);
    const radius = Math.round(image.width * 0.08);
    const color = parseHex('#fde047');

    for (let y = centerY - radius; y <= centerY + radius; y += 1) {
      for (let x = centerX - radius; x <= centerX + radius; x += 1) {
        if (x < 0 || y < 0 || x >= image.width || y >= image.height) {
          continue;
        }

        const distance = Math.abs(x - centerX) + Math.abs(y - centerY);
        if (distance > radius * 1.15) {
          continue;
        }

        const index = (y * image.width + x) * 4;
        image.data[index] = color.r;
        image.data[index + 1] = color.g;
        image.data[index + 2] = color.b;
        image.data[index + 3] = 255;
      }
    }
  }

  private drawSubtitle(image: PNG, subtitle: string): void {
    const boxX = Math.round(image.width * 0.07);
    const boxY = Math.round(image.height * 0.82);
    const boxWidth = Math.round(image.width * 0.86);
    const boxHeight = Math.round(image.height * 0.11);
    this.fillRect(image, boxX, boxY, boxWidth, boxHeight, { r: 255, g: 255, b: 255, a: 238 });

    const words = subtitle.slice(0, 56).split(/\s+/).filter(Boolean);
    const line = words.join(' ');
    const dotSize = 5;
    let cursorX = boxX + 22;
    const cursorY = boxY + Math.round(boxHeight / 2) - dotSize;

    for (const char of line.slice(0, 44)) {
      if (char === ' ') {
        cursorX += dotSize * 2;
        continue;
      }
      this.fillRect(image, cursorX, cursorY, dotSize, dotSize * 2, { r: 7, g: 24, b: 32, a: 255 });
      cursorX += dotSize + 3;
      if (cursorX > boxX + boxWidth - 24) {
        break;
      }
    }
  }

  private async readPng(filePath: string, cache: Map<string, PNG>): Promise<PNG> {
    const cached = cache.get(filePath);
    if (cached) {
      return cached;
    }

    const image = PNG.sync.read(await fs.readFile(filePath));
    cache.set(filePath, image);
    return image;
  }

  private compositeScaled(target: PNG, source: PNG, x: number, y: number, width: number, height: number): void {
    for (let targetY = 0; targetY < height; targetY += 1) {
      const destinationY = y + targetY;
      if (destinationY < 0 || destinationY >= target.height) {
        continue;
      }

      const sourceY = Math.min(source.height - 1, Math.max(0, Math.floor((targetY / height) * source.height)));
      for (let targetX = 0; targetX < width; targetX += 1) {
        const destinationX = x + targetX;
        if (destinationX < 0 || destinationX >= target.width) {
          continue;
        }

        const sourceX = Math.min(source.width - 1, Math.max(0, Math.floor((targetX / width) * source.width)));
        const sourceIndex = (sourceY * source.width + sourceX) * 4;
        const alpha = (source.data[sourceIndex + 3] ?? 0) / 255;
        if (alpha <= 0) {
          continue;
        }

        const targetIndex = (destinationY * target.width + destinationX) * 4;
        target.data[targetIndex] = Math.round((source.data[sourceIndex] ?? 0) * alpha + (target.data[targetIndex] ?? 0) * (1 - alpha));
        target.data[targetIndex + 1] = Math.round((source.data[sourceIndex + 1] ?? 0) * alpha + (target.data[targetIndex + 1] ?? 0) * (1 - alpha));
        target.data[targetIndex + 2] = Math.round((source.data[sourceIndex + 2] ?? 0) * alpha + (target.data[targetIndex + 2] ?? 0) * (1 - alpha));
        target.data[targetIndex + 3] = 255;
      }
    }
  }

  private fillRect(
    image: PNG,
    x: number,
    y: number,
    width: number,
    height: number,
    color: { r: number; g: number; b: number; a: number }
  ): void {
    for (let offsetY = 0; offsetY < height; offsetY += 1) {
      const targetY = y + offsetY;
      if (targetY < 0 || targetY >= image.height) {
        continue;
      }
      for (let offsetX = 0; offsetX < width; offsetX += 1) {
        const targetX = x + offsetX;
        if (targetX < 0 || targetX >= image.width) {
          continue;
        }
        const index = (targetY * image.width + targetX) * 4;
        const alpha = color.a / 255;
        image.data[index] = Math.round(color.r * alpha + (image.data[index] ?? 0) * (1 - alpha));
        image.data[index + 1] = Math.round(color.g * alpha + (image.data[index + 1] ?? 0) * (1 - alpha));
        image.data[index + 2] = Math.round(color.b * alpha + (image.data[index + 2] ?? 0) * (1 - alpha));
        image.data[index + 3] = 255;
      }
    }
  }

  private async getCharacterRenderAssets(characterId: string): Promise<{
    wholeImageDataUri: string | null;
    wholeImagePath: string | null;
    layers: Array<PuppetLayer & { dataUri: string }>;
  } | null> {
    const result = this.database.exec(
      `
        SELECT package_path
        FROM characters
        WHERE id = '${characterId.replaceAll("'", "''")}'
      `
    );
    const packagePath = result[0]?.values[0]?.[0];
    if (!packagePath) {
      return null;
    }

    const manifestPath = join(String(packagePath), 'character.json');
    if (!(await fs.pathExists(manifestPath))) {
      return null;
    }

    const manifest = await fs.readJson(manifestPath);
    const cleanedImagePath =
      typeof manifest.preparation?.cleanedImagePath === 'string'
        ? manifest.preparation.cleanedImagePath
        : typeof manifest.sourceImagePath === 'string'
          ? manifest.sourceImagePath
          : null;

    const wholeImagePath =
      cleanedImagePath && (await fs.pathExists(cleanedImagePath))
        ? cleanedImagePath
        : null;
    const wholeImageDataUri =
      cleanedImagePath && (await fs.pathExists(cleanedImagePath))
        ? await this.imageDataUri(cleanedImagePath)
        : null;
    const layers: Array<PuppetLayer & { dataUri: string }> = [];

    if (Array.isArray(manifest.puppetLayers)) {
      for (const rawLayer of manifest.puppetLayers) {
        const layer = rawLayer as PuppetLayer;
        if (typeof layer.filePath !== 'string' || !(await fs.pathExists(layer.filePath))) {
          continue;
        }

        layers.push({
          id: String(layer.id),
          name: String(layer.name),
          filePath: layer.filePath,
          bounds: layer.bounds,
          pivot: layer.pivot,
          zIndex: Number(layer.zIndex),
          dataUri: await this.imageDataUri(layer.filePath)
        });
      }
    }

    return { wholeImageDataUri, wholeImagePath, layers };
  }

  private async imageDataUri(filePath: string): Promise<string> {
    return `data:image/png;base64,${(await fs.readFile(filePath)).toString('base64')}`;
  }
}

function createProject(value: unknown): CartoonProject {
  const project = value as Partial<CartoonProject>;
  return {
    id: String(project.id),
    title: String(project.title),
    prompt: String(project.prompt),
    status: (project.status ?? 'draft') as CartoonProject['status'],
    characterId: project.characterId ?? null,
    backgroundId: String(project.backgroundId ?? 'sunny-park'),
    format: project.format ?? createShortsFormat(),
    accessibilityProfile: project.accessibilityProfile ?? createAutismFriendlyProfile(),
    clips: Array.isArray(project.clips)
      ? project.clips.map((clip) => ({
          ...clip,
          subtitle: clip.subtitle ?? clip.dialogue,
          transition: clip.transition ?? 'soft-hold'
        }))
      : [],
    createdAt: String(project.createdAt),
    updatedAt: String(project.updatedAt)
  };
}

function createShortsFormat(): CartoonProject['format'] {
  return {
    preset: 'youtube-shorts',
    width: 1080,
    height: 1920,
    fps: 30,
    safeAreaPercent: 0.08
  };
}

function createAutismFriendlyProfile(): CartoonProject['accessibilityProfile'] {
  return {
    audience: 'autistic-children',
    sensoryIntensity: 'calm',
    maxClipDurationMs: 5200,
    subtitleMode: 'always-on',
    flashingContent: false,
    suddenAudio: false,
    highContrastSubtitles: true
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function parseHex(value: string): { r: number; g: number; b: number } {
  const normalized = /^#[0-9a-fA-F]{6}$/.test(value) ? value.slice(1) : '57c7ff';
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16)
  };
}
