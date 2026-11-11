/**
 * Database visualizer API routes: connect, disconnect, tables, schema, query.
 */
import express from 'express';
import * as dbViz from '../db-visualizer.js';
import type { DashboardContext } from '../context.js';

export function registerDbRoutes(app: express.Application, ctx: DashboardContext): void {
  const { authMiddleware, csrfGuard, getCodebaseRoot, safePath, isSensitivePath } = ctx;

  app.post('/api/db/connect', authMiddleware, csrfGuard, express.json(), async (req, res) => {
    const { type, path: relPath, host, port, user, password, database, connectionString } = req.body || {};
    if (!type || !['sqlite', 'postgres', 'mysql'].includes(type)) {
      return res.status(400).json({ error: 'type must be sqlite, postgres, or mysql' });
    }
    try {
      if (type === 'sqlite') {
        if (!relPath) {return res.status(400).json({ error: 'path is required for SQLite' });}
        const full = safePath(relPath, getCodebaseRoot());
        if (!full) {return res.status(403).json({ error: 'Invalid or disallowed path' });}
        if (isSensitivePath(relPath)) {return res.status(403).json({ error: 'Path not allowed for security' });}
        const owner = String((req as any).auth?.phone || 'user');
        const connectionId = await dbViz.connect('sqlite', { path: full }, { owner });
        return res.json({ connectionId });
      }
      if (type === 'postgres') {
        const pgConfig = connectionString
          ? { connectionString }
          : { host: host || 'localhost', port: port || 5432, user, password, database: database || 'postgres' };
        const owner = String((req as any).auth?.phone || 'user');
        const connectionId = await dbViz.connect('postgres', pgConfig, { owner });
        return res.json({ connectionId });
      }
      if (type === 'mysql') {
        const mysqlConfig = { host: host || 'localhost', port: port || 3306, user, password, database };
        const owner = String((req as any).auth?.phone || 'user');
        const connectionId = await dbViz.connect('mysql', mysqlConfig, { owner });
        return res.json({ connectionId });
      }
    } catch (err) {
      res.status(500).json({ error: (err as Error).message || 'Connection failed' });
    }
  });

  app.post('/api/db/disconnect', authMiddleware, csrfGuard, express.json(), async (req, res) => {
    const { connectionId } = req.body || {};
    if (!connectionId) {return res.status(400).json({ error: 'connectionId is required' });}
    const owner = String((req as any).auth?.phone || 'user');
    if (!dbViz.connectionBelongsTo(connectionId, owner)) {
      return res.status(403).json({ error: 'Connection not found or access denied' });
    }
    try {
      await dbViz.disconnect(connectionId);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/db/tables', authMiddleware, async (req, res) => {
    const connectionId = req.query.connectionId;
    if (!connectionId) {return res.status(400).json({ error: 'connectionId is required' });}
    const owner = String((req as any).auth?.phone || 'user');
    if (!dbViz.connectionBelongsTo(String(connectionId), owner)) {
      return res.status(403).json({ error: 'Connection not found or access denied' });
    }
    try {
      const tables = await dbViz.listTables(String(connectionId));
      res.json({ tables });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/db/schema', authMiddleware, async (req, res) => {
    const connectionId = req.query.connectionId;
    const table = req.query.table;
    if (!connectionId || !table) {return res.status(400).json({ error: 'connectionId and table are required' });}
    const owner = String((req as any).auth?.phone || 'user');
    if (!dbViz.connectionBelongsTo(String(connectionId), owner)) {
      return res.status(403).json({ error: 'Connection not found or access denied' });
    }
    try {
      const columns = await dbViz.getSchema(String(connectionId), String(table));
      res.json({ columns });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/db/query', authMiddleware, csrfGuard, express.json(), async (req, res) => {
    const { connectionId, sql, params } = req.body || {};
    if (!connectionId || !sql) {return res.status(400).json({ error: 'connectionId and sql are required' });}
    const owner = String((req as any).auth?.phone || 'user');
    if (!dbViz.connectionBelongsTo(connectionId, owner)) {
      return res.status(403).json({ error: 'Connection not found or access denied' });
    }
    try {
      const result = await dbViz.runQuery(connectionId, sql, Array.isArray(params) ? params : []);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message || 'Query failed' });
    }
  });
}
