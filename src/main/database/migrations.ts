import type { Database } from 'sql.js';

export interface Migration {
  id: number;
  name: string;
  up: (database: Database) => void;
}

export const migrations: Migration[] = [
  {
    id: 1,
    name: 'create_core_tables',
    up(database) {
      database.run(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS characters (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          status TEXT NOT NULL,
          package_path TEXT NOT NULL,
          thumbnail_path TEXT,
          animation_count INTEGER NOT NULL DEFAULT 0,
          warning_count INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          status TEXT NOT NULL,
          project_path TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS assets (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          category TEXT,
          file_path TEXT NOT NULL,
          metadata_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS exports (
          id TEXT PRIMARY KEY,
          project_id TEXT,
          status TEXT NOT NULL,
          file_path TEXT NOT NULL,
          preset TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_characters_updated_at ON characters(updated_at);
        CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at);
        CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);
      `);
    }
  }
];

export function runMigrations(database: Database): number {
  database.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedResult = database.exec('SELECT id FROM schema_migrations');
  const appliedRows = appliedResult[0]?.values ?? [];
  const applied = new Set(appliedRows.map((row) => Number(row[0])));

  const pending = migrations.filter((migration) => !applied.has(migration.id));
  for (const migration of pending) {
    database.run('BEGIN TRANSACTION');
    try {
      migration.up(database);
      database.run('INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)', [
        migration.id,
        migration.name,
        new Date().toISOString()
      ]);
      database.run('COMMIT');
    } catch (error) {
      database.run('ROLLBACK');
      throw error;
    }
  }

  return migrations.length;
}
