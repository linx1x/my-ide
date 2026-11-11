/**
 * Database visualizer: in-memory connection store and helpers for SQLite, PostgreSQL, MySQL.
 * Used by dashboard /api/db/* routes. Connections are keyed by connectionId (UUID).
 */
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import type { Database as SqliteDb } from 'better-sqlite3';
import pg from 'pg';
import mysql from 'mysql2/promise';
import appConfig from '../config.js';
import { logger } from '../logger.js';

const MAX_ROWS = 2000;
const _QUERY_TIMEOUT_MS = 15000;

export type DbType = 'sqlite' | 'postgres' | 'mysql';

export interface SqliteConfig {
  path: string; // already resolved full path from server (safePath)
}

export interface PgConfig {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  connectionString?: string;
}

export interface MysqlConfig {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
}

type DbClient =
  | { type: 'sqlite'; db: SqliteDb }
  | { type: 'postgres'; client: pg.Client }
  | { type: 'mysql'; conn: mysql.Connection };

const connections = new Map<
  string,
  { client: DbClient; lastUsed: number; owner: string }
>();

function touch(connectionId: string) {
  const entry = connections.get(connectionId);
  if (entry) {entry.lastUsed = Date.now();}
}

function countForOwner(owner: string): number {
  let n = 0;
  for (const e of connections.values()) {
    if (e.owner === owner) {n++;}
  }
  return n;
}

/** Disconnect connections idle longer than configured TTL. Returns count closed. */
export function sweepIdleDbConnections(): number {
  const ttl = appConfig.dashboardDbConnectionIdleMs;
  const now = Date.now();
  const toClose: string[] = [];
  for (const [id, entry] of connections) {
    if (now - entry.lastUsed >= ttl) {toClose.push(id);}
  }
  for (const id of toClose) {
    disconnect(id);
    logger.info({ connectionId: id }, 'Dashboard: closed idle DB visualizer connection');
  }
  return toClose.length;
}

export function connectionBelongsTo(connectionId: string, owner: string): boolean {
  const e = connections.get(connectionId);
  return !!e && e.owner === owner;
}

export type ConnectOptions = { owner?: string };

export function connect(
  type: DbType,
  dbConfig: SqliteConfig | PgConfig | MysqlConfig,
  options: ConnectOptions = {},
): Promise<string> {
  sweepIdleDbConnections();
  const owner = options.owner || 'anonymous';
  const maxUser = appConfig.dashboardDbMaxConnectionsPerUser;
  const maxTotal = appConfig.dashboardDbMaxTotalConnections;
  if (connections.size >= maxTotal) {
    return Promise.reject(
      new Error(
        `Too many open DB connections (${maxTotal} max). Close unused connections or wait for idle cleanup.`,
      ),
    );
  }
  if (countForOwner(owner) >= maxUser) {
    return Promise.reject(
      new Error(
        `Too many connections for this session (${maxUser} max). Disconnect one first.`,
      ),
    );
  }

  const id = randomUUID();
  if (type === 'sqlite') {
    const c = dbConfig as SqliteConfig;
    const db = new Database(c.path, { readonly: true });
    connections.set(id, {
      client: { type: 'sqlite', db },
      lastUsed: Date.now(),
      owner,
    });
    return Promise.resolve(id);
  }
  if (type === 'postgres') {
    const c = dbConfig as PgConfig;
    const client = new pg.Client(
      c.connectionString
        ? { connectionString: c.connectionString }
        : {
          host: c.host || 'localhost',
          port: c.port || 5432,
          user: c.user,
          password: c.password,
          database: c.database || 'postgres',
        },
    );
    return client.connect().then(() => {
      connections.set(id, {
        client: { type: 'postgres', client },
        lastUsed: Date.now(),
        owner,
      });
      return id;
    });
  }
  if (type === 'mysql') {
    const c = dbConfig as MysqlConfig;
    return mysql
      .createConnection({
        host: c.host || 'localhost',
        port: c.port || 3306,
        user: c.user,
        password: c.password,
        database: c.database,
      } as any)
      .then((conn) => {
        connections.set(id, {
          client: { type: 'mysql', conn },
          lastUsed: Date.now(),
          owner,
        });
        return id;
      });
  }
  return Promise.reject(new Error(`Unsupported type: ${type}`));
}

export function disconnect(connectionId: string): Promise<void> {
  const entry = connections.get(connectionId);
  if (!entry) {return Promise.resolve();}
  connections.delete(connectionId);
  const { client } = entry;
  if (client.type === 'sqlite') {
    try {
      client.db.close();
    } catch {}
    return Promise.resolve();
  }
  if (client.type === 'postgres') {
    return client.client.end().catch(() => {});
  }
  if (client.type === 'mysql') {
    return client.conn.end().catch(() => {});
  }
  return Promise.resolve();
}

function isSelectOnly(sql: string): boolean {
  const trimmed = sql.trim();
  return /^\s*select\s/i.test(trimmed);
}

export function listTables(connectionId: string): Promise<{ name: string }[]> {
  const entry = connections.get(connectionId);
  if (!entry) {return Promise.reject(new Error('Connection not found'));}
  touch(connectionId);
  const { client } = entry;
  if (client.type === 'sqlite') {
    const rows = client.db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
      )
      .all() as { name: string }[];
    return Promise.resolve(rows);
  }
  if (client.type === 'postgres') {
    return client.client
      .query(
        "SELECT tablename AS name FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
      )
      .then((res: { rows: { name: string }[] }) => res.rows);
  }
  if (client.type === 'mysql') {
    return client.conn.query('SHOW TABLES').then(([rows]: any) => {
      const arr = (rows as { [k: string]: string }[]) || [];
      const key = (arr[0] && Object.keys(arr[0])[0]) || 'name';
      return arr.map((r) => ({ name: r[key] ?? '' }));
    });
  }
  return Promise.reject(new Error('Unknown client type'));
}

// config for mysql database name in listTables - we don't have it in client. Fix: store database name in connection entry for mysql.
// Actually SHOW TABLES returns a single column whose name is "Tables_in_<db>". So the key is dynamic. We can do:
// const rows = (result[0] as any[]); const first = rows[0]; const key = first ? Object.keys(first)[0] : 'name'; then map rows to { name: r[key] }.
// I did that above. So we're good.

export function getSchema(
  connectionId: string,
  table: string,
): Promise<{ name: string; type: string; nullable?: boolean; key?: string }[]> {
  const entry = connections.get(connectionId);
  if (!entry) {return Promise.reject(new Error('Connection not found'));}
  touch(connectionId);
  const { client } = entry;
  const safeTable = table.replace(/["\\]/g, ''); // minimal sanitization; identifier
  if (client.type === 'sqlite') {
    const rows = client.db.prepare(`PRAGMA table_info(${safeTable})`).all() as {
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: unknown;
      pk: number;
    }[];
    return Promise.resolve(
      rows.map((r) => {
        const out: { name: string; type: string; nullable?: boolean; key?: string } = {
          name: r.name,
          type: r.type || '',
          nullable: r.notnull === 0,
        };
        if (r.pk) {out.key = 'PRI';}
        return out;
      }),
    );
  }
  if (client.type === 'postgres') {
    return client.client
      .query(
        `SELECT column_name AS name, data_type AS type, is_nullable = 'YES' AS nullable
         FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
        [table],
      )
      .then(
        (res: { rows: { name: string; type: string; nullable: boolean }[] }) =>
          res.rows.map((r) => ({
            name: r.name,
            type: r.type,
            nullable: r.nullable,
          })),
      );
  }
  if (client.type === 'mysql') {
    return client.conn
      .query('SHOW COLUMNS FROM ??', [table] as any)
      .then(([rows]: any) =>
        (
          rows as { Field: string; Type: string; Null: string; Key: string }[]
        ).map((r) => {
          const out: { name: string; type: string; nullable?: boolean; key?: string } = {
            name: r.Field,
            type: r.Type,
            nullable: r.Null === 'YES',
          };
          if (r.Key) {out.key = r.Key;}
          return out;
        }),
      );
  }
  return Promise.reject(new Error('Unknown client type'));
}

function runQuerySqlite(
  db: SqliteDb,
  sql: string,
  params: unknown[],
): { columns: string[]; rows: unknown[][] } {
  const stmt = db.prepare(sql);
  const rows = stmt.raw(true).all(...params) as unknown[][];
  const columns = stmt.columns().map((c) => (c as { name: string }).name);
  return { columns, rows: rows.slice(0, MAX_ROWS) };
}

export function runQuery(
  connectionId: string,
  sql: string,
  params: unknown[] = [],
): Promise<{ columns: string[]; rows: unknown[][] }> {
  if (!isSelectOnly(sql))
  {return Promise.reject(new Error('Only SELECT queries are allowed'));}
  const entry = connections.get(connectionId);
  if (!entry) {return Promise.reject(new Error('Connection not found'));}
  touch(connectionId);
  const { client } = entry;
  if (client.type === 'sqlite') {
    try {
      const result = runQuerySqlite(client.db, sql, params);
      return Promise.resolve(result);
    } catch (err) {
      return Promise.reject(err);
    }
  }
  if (client.type === 'postgres') {
    return client.client
      .query({ text: sql, values: params, rowMode: 'array' })
      .then((res: { fields: { name: string }[]; rows: unknown[][] }) => ({
        columns: res.fields.map((f) => f.name),
        rows: (res.rows || []).slice(0, MAX_ROWS),
      }))
      .catch((err: Error) => Promise.reject(err));
  }
  if (client.type === 'mysql') {
    return client.conn
      .execute(sql, params as any)
      .then(([rows, fields]: [unknown, { name: string }[]]) => {
        const columns = (fields || []).map((f) => f.name);
        const rowArr = (rows as Record<string, unknown>[]) || [];
        const rowsAsArrays = rowArr
          .slice(0, MAX_ROWS)
          .map((r) => columns.map((col) => r[col]));
        return { columns, rows: rowsAsArrays };
      })
      .catch((err: Error) => Promise.reject(err));
  }
  return Promise.reject(new Error('Unknown client type'));
}
