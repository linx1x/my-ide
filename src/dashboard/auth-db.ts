import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import Database from 'better-sqlite3';
import config from '../config.js';

function getAuthDataDir(): string {
  const root = config.bridgeDataDir ? resolve(config.bridgeDataDir) : resolve(process.cwd(), 'bridge-data');
  return join(root, 'auth');
}

function ensureAuthDataDir(): void {
  const dir = getAuthDataDir();
  if (!existsSync(dir)) {mkdirSync(dir, { recursive: true });}
}

let authDb: Database.Database | null = null;

export function getAuthDb(): Database.Database {
  if (authDb) {return authDb;}
  ensureAuthDataDir();
  authDb = new Database(join(getAuthDataDir(), 'auth.db'));
  authDb.pragma('journal_mode = WAL');
  authDb.exec(`
    CREATE TABLE IF NOT EXISTS revoked_tokens (
      jti TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires ON revoked_tokens (expires_at);
  `);
  authDb.prepare('DELETE FROM revoked_tokens WHERE expires_at <= ?').run(Date.now());
  return authDb;
}
