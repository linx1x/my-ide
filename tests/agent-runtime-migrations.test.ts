import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runAgentMigrations } from '../src/agent/db/migrate.js';

describe('agent runtime migrations', () => {
  let dir: string;
  let db: Database.Database;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'agent-runtime-'));
    db = new Database(join(dir, 'runtime.db'));
    runAgentMigrations(db);
  });

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('creates trace and ledger tables', () => {
    const names = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
      )
      .all() as { name: string }[];
    expect(names.map((r) => r.name)).toContain('trace_events');
    expect(names.map((r) => r.name)).toContain('budget_ledger');
    expect(names.map((r) => r.name)).toContain('schema_migrations');
  });

  it('applies migrations only once', () => {
    runAgentMigrations(db);
    const versions = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[];
    expect(versions.map((v) => v.version)).toEqual([1]);
  });
});
