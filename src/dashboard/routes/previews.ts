/**
 * Previews API routes and proxy: create, events, get, stop, active, proxy.
 */
import express from 'express';
import {
  createPreview,
  getPreview,
  stopPreview,
  streamPreviewEvents,
  resolvePreviewTarget,
  getActivePreviewForSession,
} from '../sandbox/index.js';
import type { DashboardContext } from '../context.js';

export function registerPreviewsRoutes(app: express.Application, ctx: DashboardContext): void {
  const { authMiddleware, sandboxPreviewProxy } = ctx;

  app.use((req, res, next) => {
    const path = ((req.url || '').split('?')[0] ?? '');
    if (path.match(/^\/api\/previews\/[^/]+\/$/)) {
      req.url = path.slice(0, -1) + (req.url && req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '');
    }
    next();
  });

  app.post('/api/previews', authMiddleware, express.json({ limit: '20mb' }), async (req, res) => {
    const sessionKey = 'web:' + (req as any).auth.phone;
    const { source, mode, runtimeHint } = req.body || {};
    if (!source || (source.type !== 'builder-files' && source.type !== 'project-path' && source.type !== 'template-disk')) {
      return res.status(400).json({ error: 'source with type builder-files, project-path, or template-disk required' });
    }
    if (source.type === 'project-path' && !source.projectPath) {
      return res.status(400).json({ error: 'source.projectPath required for project-path' });
    }
    if (source.type === 'template-disk' && !source.frameworkId) {
      return res.status(400).json({ error: 'source.frameworkId required for template-disk' });
    }
    if (
      source.type === 'builder-files' &&
      !source.templateDisk &&
      !source.templateAppId &&
      (!Array.isArray(source.files) || source.files.length === 0)
    ) {
      return res.status(400).json({ error: 'source.files array required for builder-files without templateDisk or templateAppId' });
    }
    if (source.type === 'builder-files' && source.templateDisk && !Array.isArray(source.files)) {
      return res.status(400).json({ error: 'source.files array required for builder-files with templateDisk' });
    }
    if (source.type === 'builder-files' && source.templateAppId !== null && !String(source.templateAppId).trim()) {
      return res.status(400).json({ error: 'source.templateAppId must be non-empty when set' });
    }
    try {
      const session = createPreview({
        source,
        sessionKey,
        mode,
        runtimeHint,
      });
      res.status(202).json({
        previewId: session.previewId,
        status: session.status,
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/previews/events', authMiddleware, (req, res) => {
    const sessionKey = 'web:' + (req as any).auth.phone;
    const previewId = (req.query.previewId && String(req.query.previewId)) || null;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    const unsub = streamPreviewEvents(sessionKey, previewId, (event) => {
      try {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
        res.flush?.();
      } catch {}
    });
    req.on('close', () => unsub());
  });

  function handleGetPreviewSession(req: express.Request, res: express.Response, _next: express.NextFunction) {
    const wantsJson = /application\/json/i.test(req.get('accept') || '');
    if (!wantsJson) {return _next();}
    const sessionKey = 'web:' + (req as any).auth.phone;
    const session = getPreview(String(req.params.previewId ?? ''), sessionKey);
    if (!session) {return res.status(404).json({ error: 'Preview not found' });}
    res.json({
      previewId: session.previewId,
      previewUrl: session.previewUrl,
      previewPort: session.internalPort ?? undefined,
      status: session.status,
      error: session.error,
      logs: session.logs,
      startedAt: session.startedAt,
      lastActivityAt: session.lastActivityAt,
    });
  }

  app.get('/api/previews/:previewId', authMiddleware, handleGetPreviewSession);
  app.get('/api/previews/:previewId/', authMiddleware, handleGetPreviewSession);

  app.post('/api/previews/:previewId/stop', authMiddleware, async (req, res) => {
    const sessionKey = 'web:' + (req as any).auth.phone;
    const ok = await stopPreview(String(req.params.previewId ?? ''), sessionKey);
    if (!ok) {return res.status(404).json({ error: 'Preview not found' });}
    res.json({ ok: true });
  });

  app.get('/api/previews/active', authMiddleware, (req, res) => {
    const sessionKey = 'web:' + (req as any).auth.phone;
    const session = getActivePreviewForSession(sessionKey);
    if (!session) {return res.json({ active: null });}
    res.json({
      active: {
        previewId: session.previewId,
        previewUrl: session.previewUrl,
        status: session.status,
      },
    });
  });

  function handlePreviewProxy(req: express.Request, res: express.Response, _next: express.NextFunction) {
    if (!sandboxPreviewProxy) {return res.status(502).send('Preview proxy not available');}
    try {
      const sessionKey = 'web:' + (req as any).auth?.phone;
      const previewId = String(req.params.previewId ?? '');
      const session = getPreview(previewId, sessionKey);
      if (!session) {return res.status(404).json({ error: 'Preview not found' });}
      const target = resolvePreviewTarget(previewId);
      if (!target) {return res.status(502).send('Preview server unavailable');}
      const fullPath = typeof req.originalUrl === 'string' ? req.originalUrl : (req.url && typeof req.url === 'string' ? req.url : '');
      const pathSuffix = fullPath.replace(new RegExp(`^/api/previews/${String(previewId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?`), '/');
      req.url = session.basePath ? (fullPath || '/') : (pathSuffix || '/');
      const targetUrl = `http://${target.host}:${target.port}`;
      (req as any)._previewTargetOrigin = `http://${target.host}:${target.port}`;
      sandboxPreviewProxy.web(req, res, { target: targetUrl }, (err: Error) => {
        delete (req as any)._previewTargetOrigin;
        if (err && !(res as any).headersSent) {res.status(502).send('Preview server unavailable');}
      });
    } catch (err) {
      const errMsg = (err as Error).message;
      console.error('[Dashboard] Preview proxy handler error:', errMsg, (err as Error).stack);
      if (!(res as any).headersSent) {res.status(500).json({ error: errMsg });}
    }
  }

  app.use('/api/previews/:previewId', authMiddleware, handlePreviewProxy);
  app.use('/api/previews/:previewId/', authMiddleware, handlePreviewProxy);
}
