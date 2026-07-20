import fs from 'fs-extra';
import { join } from 'node:path';
import initSqlJs, { type Database } from 'sql.js';
import type { AppDataLayout } from '../../shared/ipc.js';
import { runMigrations } from './migrations.js';

export interface StudioDatabase {
  connection: Database;
  migrationsApplied: number;
  persist: () => Promise<void>;
}

export async function openStudioDatabase(layout: AppDataLayout): Promise<StudioDatabase> {
  const databasePath = join(layout.database, 'studio.sqlite');
  const SQL = await initSqlJs();
  const existing = (await fs.pathExists(databasePath)) ? await fs.readFile(databasePath) : undefined;
  const connection = existing ? new SQL.Database(existing) : new SQL.Database();

  const migrationsApplied = runMigrations(connection);
  const persist = async (): Promise<void> => {
    const exported = connection.export();
    await fs.writeFile(databasePath, Buffer.from(exported));
  };

  await persist();

  return { connection, migrationsApplied, persist };
}
