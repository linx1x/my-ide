import type Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Apply versioned SQL migrations (001_name.sql, 002_....sql) once per version.
 */
export function runAgentMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      applied_at_ms INTEGER NOT NULL
    );
  `);
  const applied = new Set(
    (db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map((r) => r.version),
  );
  const dir = join(__dirname, 'migrations');
  const files = readdirSync(dir)
    .filter((f) => /^\d{3}_.+\.sql$/i.test(f))
    .sort();
  for (const file of files) {
    const version = parseInt(file.slice(0, 3), 10);
    if (Number.isNaN(version) || applied.has(version)) {
      continue;
    }
    const sql = readFileSync(join(dir, file), 'utf8');
    db.exec('BEGIN;');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (version, applied_at_ms) VALUES (?, ?)').run(version, Date.now());
      db.exec('COMMIT;');
    } catch (e) {
      db.exec('ROLLBACK;');
      throw e;
    }
  }
}
