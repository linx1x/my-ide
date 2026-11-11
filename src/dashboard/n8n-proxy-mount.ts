/**
 * n8n reverse proxy: path helpers, proxy server, dashboard mounts (auth, OPTIONS, /rest).
 */
import express from 'express';
import { join } from 'node:path';
import httpProxy from 'http-proxy';
import config from '../config.js';
import { logger } from '../logger.js';

export const n8nPublicPath = config.n8nPublicPath || '/n8n';

export function isN8nPath(pathname = '') {
  return pathname === n8nPublicPath || pathname.startsWith(`${n8nPublicPath}/`);
}

/** n8n UI requests /rest/*, /types/*, /assets/*, /static/*, /healthz from root when served without N8N_PATH */
export function isN8nRootPath(pathname = '') {
  return (
    pathname === '/healthz' ||
    pathname === '/rest' ||
    pathname.startsWith('/rest/') ||
    pathname.startsWith('/types/') ||
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/static/')
  );
}

export function isN8nRelatedRequest(req: any) {
  const path = (req.path || req.url || '').split('?')[0];
  if (isN8nPath(path)) {return true;}
  return isN8nRootPath(path);
}

/** Origin n8n expects when behind reverse proxy (matches N8N_EDITOR_BASE_URL host), not N8N_INTERNAL_URL. */
function n8nProxyClientOrigin(req: any): string {
  const fromBrowser = req.headers?.origin;
  if (typeof fromBrowser === 'string' && fromBrowser.trim()) {
    return fromBrowser.trim().replace(/\/+$/, '');
  }
  const host = req.headers?.host;
  if (typeof host === 'string' && host.trim()) {
    const xfProto = req.headers['x-forwarded-proto'];
    const proto =
      typeof xfProto === 'string'
        ? xfProto.split(',')[0]?.trim() || 'http'
        : 'http';
    return `${proto}://${host.trim()}`;
  }
  return `http://127.0.0.1:${config.dashboardPort}`;
}

export function createN8nProxy() {
  if (!config.n8nEnabled) {return null;}
  const n8nProxy = httpProxy.createProxyServer({
    target: config.n8nInternalUrl,
    changeOrigin: true,
    ws: true,
    secure: false,
    xfwd: true,
    /** Avoid premature closes on slow n8n UI / SSE-style responses (default is often 0 = socket default). */
    timeout: 120_000,
    proxyTimeout: 120_000,
  });
  n8nProxy.on('proxyReq', (proxyReq: any, req: any) => {
    proxyReq.setHeader('x-forwarded-host', req.headers.host || '');
    proxyReq.setHeader(
      'x-forwarded-proto',
      req.headers['x-forwarded-proto'] || 'http',
    );
    proxyReq.setHeader('Origin', n8nProxyClientOrigin(req));
  });
  n8nProxy.on('proxyReqWs', (proxyReq: any, req: any) => {
    proxyReq.setHeader('x-forwarded-host', req.headers.host || '');
    proxyReq.setHeader(
      'x-forwarded-proto',
      req.headers['x-forwarded-proto'] || 'http',
    );
    proxyReq.setHeader('origin', n8nProxyClientOrigin(req));
  });
  n8nProxy.on('proxyRes', (proxyRes: any, req: any, res: any) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Requested-With',
    );
  });
  n8nProxy.on('error', (err: any, req: any, res: any) => {
    const msg = err?.message || String(err);
    const code = err?.code as string | undefined;
    const transient =
      code === 'ECONNRESET' ||
      code === 'EPIPE' ||
      code === 'ECONNABORTED' ||
      /socket hang up/i.test(msg);
    if (transient) {
      logger.debug({ err: msg, code }, 'Dashboard: n8n proxy disconnect (often client tab or n8n closed the socket)');
    } else {
      logger.warn({ err: msg, code }, 'Dashboard: n8n proxy error');
    }
    if (res && typeof res.writeHead === 'function' && !res.headersSent) {
      try {
        const origin = req?.headers?.origin;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (origin) {
          headers['Access-Control-Allow-Origin'] = origin;
          headers['Access-Control-Allow-Credentials'] = 'true';
        } else {
          headers['Access-Control-Allow-Origin'] = '*';
        }
        res.writeHead(502, headers);
        res.end(
          JSON.stringify({
            error: 'n8n unavailable',
            hint:
              `Start n8n and set N8N_INTERNAL_URL to match n8n's listen port (project compose: container port 5678, bridge uses http://n8n:5678; npm start on host with Docker n8n: http://127.0.0.1:5678). Editor URL stays http://localhost:${config.dashboardPort}/n8n/ — that is not the internal port.`,
          }),
        );
      } catch {
        /* response may already be torn down */
      }
    }
  });
  return n8nProxy;
}

export function registerN8nDashboardProxy(app: any, { n8nProxy, dashboardModuleDir, verifyToken }: { n8nProxy: any; dashboardModuleDir: string; verifyToken: (token: string) => { ok: boolean } }) {
  if (!config.n8nEnabled || !n8nProxy) {return;}
  const dashboardAssetDir = join(dashboardModuleDir, 'client', 'dist', 'assets');
  app.use('/assets', express.static(dashboardAssetDir));

  app.use((req: any, res: any, next: any) => {
    if (req.method !== 'OPTIONS') {return next();}
    const path = (req.path || req.url || '').split('?')[0];
    if (!isN8nPath(path) && !isN8nRootPath(path)) {return next();}
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Requested-With',
    );
    res.status(204).end();
  });

  app.use((req: any, res: any, next: any) => {
    const path = (req.path || req.url || '').split('?')[0];
    if (!isN8nPath(path)) {return next();}
    if (req.method !== 'OPTIONS') {
      const token =
        req.cookies?.dashboard_token ||
        req.headers.authorization?.replace(/^Bearer\s+/i, '');
      const authResult = verifyToken(token);
      if (!authResult.ok) {
        return res
          .status(401)
          .json({ error: 'Unauthorized: log in to the dashboard first' });
      }
    }
    const query = (req.url || '').includes('?')
      ? '?' + (req.url || '').split('?')[1]
      : '';
    const stripped = path.slice(n8nPublicPath.length) || '/';
    req.url = stripped + query;
    n8nProxy.web(req, res, { target: config.n8nInternalUrl });
  });

  app.use((req: any, res: any, next: any) => {
    const pathname = (req.path || req.url || '').split('?')[0];
    const proxyRest = pathname === '/rest' || pathname.startsWith('/rest/');
    const proxyTypes = pathname.startsWith('/types/');
    const proxyStatic = pathname.startsWith('/static/');
    const proxyAssets = pathname.startsWith('/assets/');
    const proxyHealthz = pathname === '/healthz';
    if (!proxyRest && !proxyTypes && !proxyStatic && !proxyAssets && !proxyHealthz) {return next();}
    if ((proxyRest || proxyTypes) && req.method !== 'OPTIONS') {
      const token =
        req.cookies?.dashboard_token ||
        req.headers.authorization?.replace(/^Bearer\s+/i, '');
      const authResult = verifyToken(token);
      if (!authResult.ok) {
        return res
          .status(401)
          .json({ error: 'Unauthorized: log in to the dashboard first' });
      }
    }
    n8nProxy.web(req, res, { target: config.n8nInternalUrl });
  });
}
