import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import config from '../../config.js';
import { runAgentMigrations } from './migrate.js';

let singleton: Database.Database | null = null;

export function resolveAgentRuntimeDbPath(): string {
  const override = config.agentRuntimeDbPath?.trim();
  if (override) {
    return resolve(override);
  }
  const base = config.bridgeDataDir ? resolve(config.bridgeDataDir) : resolve(process.cwd(), 'bridge-data');
  return join(base, 'agent-runtime.db');
}

export function resolveMastraLibsqlUrl(): string {
  const override = config.agentMastraLibsqlUrl?.trim();
  if (override) {
    return override;
  }
  const base = config.bridgeDataDir ? resolve(config.bridgeDataDir) : resolve(process.cwd(), 'bridge-data');
  const filePath = join(base, 'mastra-memory.db');
  const normalized = filePath.replace(/\\/g, '/');
  return `file:${normalized}`;
}

export function getAgentRuntimeDb(): Database.Database {
  if (singleton) {
    return singleton;
  }
  const path = resolveAgentRuntimeDbPath();
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  runAgentMigrations(db);
  singleton = db;
  return db;
}

/** Test helper: reset singleton after closing. */
export function __resetAgentRuntimeDbForTests(): void {
  singleton = null;
}
