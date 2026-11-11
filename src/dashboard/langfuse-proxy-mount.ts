/**
 * Langfuse reverse proxy: path helper, proxy server, dashboard mounts.
 */
import httpProxy from 'http-proxy';
import config from '../config.js';
import { logger } from '../logger.js';

export const langfusePublicPath = config.langfusePublicPath || '/langfuse';

export function isLangfusePath(pathname = '') {
  return pathname === langfusePublicPath || pathname.startsWith(`${langfusePublicPath}/`);
}

export function createLangfuseProxy() {
  if (!config.langfuseEnabled) {return null;}
  const langfuseProxy = httpProxy.createProxyServer({
    target: config.langfuseInternalUrl,
    changeOrigin: true,
    ws: true,
    secure: false,
    xfwd: true,
  });
  langfuseProxy.on('proxyReq', (proxyReq: any, req: any) => {
    proxyReq.setHeader('x-forwarded-host', req.headers.host || '');
    proxyReq.setHeader('x-forwarded-proto', req.headers['x-forwarded-proto'] || 'http');
    const originUrl = config.langfuseInternalUrl.replace(/\/+$/, '');
    proxyReq.setHeader('Origin', originUrl);
  });
  langfuseProxy.on('proxyRes', (proxyRes: any, req: any, res: any) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  });
  langfuseProxy.on('error', (err: any, req: any, res: any) => {
    logger.warn({ err: err.message }, 'Dashboard: LangFuse proxy error');
    if (res?.writeHead) {
      const origin = req?.headers?.origin;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (origin) {
        headers['Access-Control-Allow-Origin'] = origin;
        headers['Access-Control-Allow-Credentials'] = 'true';
      } else {
        headers['Access-Control-Allow-Origin'] = '*';
      }
      res.writeHead(502, headers);
      res.end(JSON.stringify({ error: 'LangFuse unavailable' }));
    }
  });
  return langfuseProxy;
}

export function registerLangfuseDashboardProxy(app: any, { langfuseProxy, verifyToken }: { langfuseProxy: any; verifyToken: (token: string) => { ok: boolean } }) {
  if (!config.langfuseEnabled || !langfuseProxy) {return;}
  app.use((req: any, res: any, next: any) => {
    if (req.method !== 'OPTIONS') {return next();}
    const path = (req.path || req.url || '').split('?')[0];
    if (!isLangfusePath(path)) {return next();}
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.status(204).end();
  });

  app.use((req: any, res: any, next: any) => {
    const path = (req.path || req.url || '').split('?')[0];
    if (!isLangfusePath(path)) {return next();}
    if (req.method !== 'OPTIONS') {
      const token =
        req.cookies?.dashboard_token ||
        req.headers.authorization?.replace(/^Bearer\s+/i, '');
      const authResult = verifyToken(token);
      if (!authResult.ok) {
        return res.status(401).json({ error: 'Unauthorized: log in to the dashboard first' });
      }
    }
    const query = (req.url || '').includes('?') ? '?' + (req.url || '').split('?')[1] : '';
    const stripped = path.slice(langfusePublicPath.length) || '/';
    req.url = stripped + query;
    langfuseProxy.web(req, res, { target: config.langfuseInternalUrl });
  });
}
