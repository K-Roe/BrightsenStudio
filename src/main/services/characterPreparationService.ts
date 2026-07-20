import fs from 'fs-extra';
import { join } from 'node:path';
import { PNG } from 'pngjs';

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface BodyRegion {
  name: 'head' | 'torso' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg';
  bounds: Bounds;
  confidence: 'estimated' | 'uncertain';
}

export interface PreparationResult {
  cleanedImagePath: string;
  silhouettePath: string;
  metadataPath: string;
  method: 'alpha' | 'plain-background' | 'whole-character-fallback';
  bounds: Bounds;
  bodyRegions: BodyRegion[];
  warnings: string[];
}

export class CharacterPreparationService {
  public async prepare(importedImagePath: string, packagePath: string): Promise<PreparationResult> {
    const buffer = await fs.readFile(importedImagePath);
    const source = PNG.sync.read(buffer);
    const mask = this.createForegroundMask(source);
    const foreground = this.cleanupMask(mask.foreground, source.width, source.height);
    const bounds = this.findBounds(foreground, source.width, source.height);
    const warnings: string[] = [...mask.warnings];

    const finalBounds =
      bounds ??
      ({
        x: 0,
        y: 0,
        width: source.width,
        height: source.height
      } satisfies Bounds);

    const method = bounds ? mask.method : 'whole-character-fallback';
    if (!bounds) {
      warnings.push('Studio could not isolate the character, so it kept the whole drawing.');
    }

    const cleaned = this.createCleanedImage(source, foreground, bounds !== null);
    const silhouette = this.createSilhouetteImage(source.width, source.height, foreground, bounds !== null);
    const bodyRegions = this.estimateBodyRegions(finalBounds);
    const cleanedImagePath = join(packagePath, 'cleaned', 'character.png');
    const silhouettePath = join(packagePath, 'cleaned', 'silhouette.png');
    const metadataPath = join(packagePath, 'cleaned', 'silhouette.json');

    await fs.writeFile(cleanedImagePath, PNG.sync.write(cleaned));
    await fs.writeFile(silhouettePath, PNG.sync.write(silhouette));
    await fs.writeJson(
      metadataPath,
      {
        schemaVersion: 1,
        method,
        bounds: finalBounds,
        canvas: {
          width: source.width,
          height: source.height
        },
        bodyRegions,
        warnings
      },
      { spaces: 2 }
    );

    return {
      cleanedImagePath,
      silhouettePath,
      metadataPath,
      method,
      bounds: finalBounds,
      bodyRegions,
      warnings
    };
  }

  private createForegroundMask(source: PNG): {
    foreground: Uint8Array;
    method: PreparationResult['method'];
    warnings: string[];
  } {
    const foreground = new Uint8Array(source.width * source.height);
    const hasAlpha = this.hasUsefulAlpha(source);

    if (hasAlpha) {
      for (let pixel = 0; pixel < foreground.length; pixel += 1) {
        foreground[pixel] = (source.data[pixel * 4 + 3] ?? 0) > 24 ? 1 : 0;
      }

      return { foreground, method: 'alpha', warnings: [] };
    }

    const background = this.estimateCornerBackground(source);
    const threshold = 54;
    for (let pixel = 0; pixel < foreground.length; pixel += 1) {
      const index = pixel * 4;
      const distance = Math.sqrt(
        ((source.data[index] ?? 0) - background.r) ** 2 +
          ((source.data[index + 1] ?? 0) - background.g) ** 2 +
          ((source.data[index + 2] ?? 0) - background.b) ** 2
      );
      foreground[pixel] = distance > threshold ? 1 : 0;
    }

    return {
      foreground,
      method: 'plain-background',
      warnings: ['Background was estimated from the image corners.']
    };
  }

  private hasUsefulAlpha(source: PNG): boolean {
    let transparentPixels = 0;
    for (let index = 3; index < source.data.length; index += 4) {
      if ((source.data[index] ?? 255) < 240) {
        transparentPixels += 1;
      }
    }

    return transparentPixels > source.width * source.height * 0.01;
  }

  private estimateCornerBackground(source: PNG): { r: number; g: number; b: number } {
    const points = [
      this.sample(source, 0, 0),
      this.sample(source, source.width - 1, 0),
      this.sample(source, 0, source.height - 1),
      this.sample(source, source.width - 1, source.height - 1)
    ];

    return points.reduce(
      (acc, point) => ({
        r: acc.r + point.r / points.length,
        g: acc.g + point.g / points.length,
        b: acc.b + point.b / points.length
      }),
      { r: 0, g: 0, b: 0 }
    );
  }

  private sample(source: PNG, x: number, y: number): { r: number; g: number; b: number } {
    const index = (y * source.width + x) * 4;
    return {
      r: source.data[index] ?? 0,
      g: source.data[index + 1] ?? 0,
      b: source.data[index + 2] ?? 0
    };
  }

  private findBounds(foreground: Uint8Array, width: number, height: number): Bounds | null {
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    let count = 0;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (foreground[y * width + x] === 0) {
          continue;
        }

        count += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }

    const coverage = count / (width * height);
    if (count === 0 || coverage < 0.01 || coverage > 0.96) {
      return null;
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1
    };
  }

  private cleanupMask(foreground: Uint8Array, width: number, height: number): Uint8Array {
    const cleaned = new Uint8Array(foreground);

    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const pixel = y * width + x;
        let neighbours = 0;

        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            if (offsetX === 0 && offsetY === 0) {
              continue;
            }

            neighbours += foreground[(y + offsetY) * width + x + offsetX] ?? 0;
          }
        }

        if (foreground[pixel] === 1 && neighbours <= 1) {
          cleaned[pixel] = 0;
        }

        if (foreground[pixel] === 0 && neighbours >= 7) {
          cleaned[pixel] = 1;
        }
      }
    }

    return cleaned;
  }

  private createCleanedImage(source: PNG, foreground: Uint8Array, useMask: boolean): PNG {
    const cleaned = new PNG({ width: source.width, height: source.height });
    source.data.copy(cleaned.data);

    if (!useMask) {
      return cleaned;
    }

    for (let pixel = 0; pixel < foreground.length; pixel += 1) {
      if (foreground[pixel] === 0) {
        cleaned.data[pixel * 4 + 3] = 0;
      }
    }

    return cleaned;
  }

  private createSilhouetteImage(
    width: number,
    height: number,
    foreground: Uint8Array,
    useMask: boolean
  ): PNG {
    const silhouette = new PNG({ width, height });

    for (let pixel = 0; pixel < foreground.length; pixel += 1) {
      const index = pixel * 4;
      const visible = useMask ? foreground[pixel] === 1 : true;
      silhouette.data[index] = visible ? 30 : 0;
      silhouette.data[index + 1] = visible ? 222 : 0;
      silhouette.data[index + 2] = visible ? 140 : 0;
      silhouette.data[index + 3] = visible ? 255 : 0;
    }

    return silhouette;
  }

  private estimateBodyRegions(bounds: Bounds): BodyRegion[] {
    const armWidth = bounds.width * 0.22;
    const legWidth = bounds.width * 0.22;
    const centreX = bounds.x + bounds.width / 2;

    return [
      {
        name: 'head',
        bounds: this.region(bounds.x + bounds.width * 0.32, bounds.y, bounds.width * 0.36, bounds.height * 0.2),
        confidence: 'estimated'
      },
      {
        name: 'torso',
        bounds: this.region(bounds.x + bounds.width * 0.27, bounds.y + bounds.height * 0.2, bounds.width * 0.46, bounds.height * 0.34),
        confidence: 'estimated'
      },
      {
        name: 'leftArm',
        bounds: this.region(bounds.x, bounds.y + bounds.height * 0.22, armWidth, bounds.height * 0.36),
        confidence: 'uncertain'
      },
      {
        name: 'rightArm',
        bounds: this.region(bounds.x + bounds.width - armWidth, bounds.y + bounds.height * 0.22, armWidth, bounds.height * 0.36),
        confidence: 'uncertain'
      },
      {
        name: 'leftLeg',
        bounds: this.region(centreX - legWidth, bounds.y + bounds.height * 0.54, legWidth, bounds.height * 0.46),
        confidence: 'uncertain'
      },
      {
        name: 'rightLeg',
        bounds: this.region(centreX, bounds.y + bounds.height * 0.54, legWidth, bounds.height * 0.46),
        confidence: 'uncertain'
      }
    ];
  }

  private region(x: number, y: number, width: number, height: number): Bounds {
    return {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height)
    };
  }
}
