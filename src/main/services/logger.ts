import fs from 'fs-extra';
import { join } from 'node:path';
import type { AppDataLayout } from '../../shared/ipc.js';

export type LogSeverity = 'info' | 'warning' | 'error';

export interface LogEntry {
  timestamp: string;
  area: string;
  severity: LogSeverity;
  message: string;
  technicalDetails?: string;
  projectId?: string;
  characterId?: string;
}

export class StudioLogger {
  private lastError: string | null = null;

  public constructor(private readonly layout: AppDataLayout) {}

  public getLastError(): string | null {
    return this.lastError;
  }

  public async info(area: string, message: string, details?: Partial<LogEntry>): Promise<void> {
    await this.write({ area, message, severity: 'info', ...details });
  }

  public async warning(area: string, message: string, details?: Partial<LogEntry>): Promise<void> {
    await this.write({ area, message, severity: 'warning', ...details });
  }

  public async error(area: string, message: string, details?: Partial<LogEntry>): Promise<void> {
    this.lastError = message;
    await this.write({ area, message, severity: 'error', ...details });
  }

  private async write(entry: Omit<LogEntry, 'timestamp'>): Promise<void> {
    const timestamp = new Date().toISOString();
    const line = `${JSON.stringify({ timestamp, ...entry })}\n`;
    const logFile = join(this.layout.logs, `${timestamp.slice(0, 10)}.jsonl`);
    await fs.appendFile(logFile, line, 'utf8');
  }
}
