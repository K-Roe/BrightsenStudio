import { nativeImage } from 'electron';
import fs from 'fs-extra';
import { basename, extname } from 'node:path';
import {
  imageAnalysisRequestSchema,
  type ImageAnalysisRequest,
  type ImageAnalysisResult,
  type ImageQualityReport
} from '../../shared/ipc.js';

const supportedTypes: Record<string, ImageAnalysisResult['mimeType']> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
};

const minimumUsefulDimension = 512;
const maximumByteSize = 40 * 1024 * 1024;

export class ImageImportService {
  public async analyze(request: ImageAnalysisRequest): Promise<ImageAnalysisResult> {
    const parsed = imageAnalysisRequestSchema.parse(request);
    const extension = extname(parsed.filePath).toLowerCase();
    const mimeType = supportedTypes[extension];

    if (!mimeType) {
      throw new Error('Unsupported image format.');
    }

    const stat = await fs.stat(parsed.filePath);
    if (!stat.isFile()) {
      throw new Error('Selected path is not a file.');
    }

    if (stat.size > maximumByteSize) {
      throw new Error('Selected image is too large.');
    }

    await fs.access(parsed.filePath, fs.constants.R_OK);

    const image = nativeImage.createFromPath(parsed.filePath);
    if (image.isEmpty()) {
      throw new Error('Selected image could not be read.');
    }

    const size = image.getSize();
    const hasTransparentBackground = await this.detectAlpha(parsed.filePath, extension);
    const report = this.createReport(size.width, size.height, hasTransparentBackground, stat.size);

    return {
      filePath: parsed.filePath,
      fileName: basename(parsed.filePath),
      mimeType,
      byteSize: stat.size,
      width: size.width,
      height: size.height,
      hasTransparentBackground,
      previewDataUrl: image.toDataURL(),
      report
    };
  }

  private async detectAlpha(filePath: string, extension: string): Promise<boolean> {
    const buffer = await fs.readFile(filePath);

    if (extension === '.png') {
      const pngSignature = '89504e470d0a1a0a';
      if (buffer.subarray(0, 8).toString('hex') !== pngSignature || buffer.length < 26) {
        return false;
      }

      const colorType = buffer[25];
      const hasAlphaColorType = colorType === 4 || colorType === 6;
      const hasTransparencyChunk = buffer.includes(Buffer.from('tRNS'));
      return hasAlphaColorType || hasTransparencyChunk;
    }

    if (extension === '.webp') {
      const riff = buffer.subarray(0, 4).toString('ascii');
      const webp = buffer.subarray(8, 12).toString('ascii');
      if (riff !== 'RIFF' || webp !== 'WEBP') {
        return false;
      }

      const hasAlphaChunk = buffer.includes(Buffer.from('ALPH'));
      const vp8xIndex = buffer.indexOf(Buffer.from('VP8X'));
      const alphaByte = vp8xIndex >= 0 && buffer.length > vp8xIndex + 8 ? buffer[vp8xIndex + 8] : 0;
      const alphaFlagSet = ((alphaByte ?? 0) & 0b00010000) !== 0;
      return hasAlphaChunk || alphaFlagSet;
    }

    return false;
  }

  private createReport(
    width: number,
    height: number,
    hasTransparentBackground: boolean,
    byteSize: number
  ): ImageQualityReport {
    const lowResolution = width < minimumUsefulDimension || height < minimumUsefulDimension;
    const portraitish = height >= width * 1.05;
    const messages = [
      hasTransparentBackground
        ? 'The drawing already appears to have transparency.'
        : 'Studio can try a simple background cleanup on the next step.',
      lowResolution
        ? 'A larger drawing will give Studio more detail to work with.'
        : 'The image resolution is suitable for the first build step.',
      portraitish
        ? 'The image shape looks suitable for a standing character.'
        : 'A full-body standing character usually works best in a taller image.'
    ];

    if (byteSize > maximumByteSize * 0.7) {
      messages.push('The image is quite large, so later processing may take longer.');
    }

    return {
      background: hasTransparentBackground ? 'good' : 'needs_cleanup',
      fullBody: portraitish ? 'detected' : 'uncertain',
      armsVisible: 'uncertain',
      legsVisible: 'uncertain',
      imageResolution: lowResolution ? 'low' : 'good',
      characterPosition: 'uncertain',
      messages
    };
  }
}
