/**
 * Reverse proxy for sandbox preview dev servers (CSP / Location / socket cleanup).
 */
import httpProxy from 'http-proxy';
import { logger } from '../logger.js';

type PreviewReq = any;

export function createSandboxPreviewProxy() {
  const sandboxPreviewProxy = httpProxy.createProxyServer({});
  sandboxPreviewProxy.on('proxyReq', (proxyReq: any, req: PreviewReq) => {
    req._previewProxyReq = proxyReq;
  });
  sandboxPreviewProxy.on('proxyRes', (proxyRes: any, req: PreviewReq) => {
    delete proxyRes.headers['x-frame-options'];
    const csp = proxyRes.headers['content-security-policy'];
    if (typeof csp === 'string') {
      const without = csp.replace(/frame-ancestors\s+[^;]+;?/gi, '');
      proxyRes.headers['content-security-policy'] =
        without.trim().replace(/;\s*$/, '') + "; frame-ancestors 'self';";
    } else {
      proxyRes.headers['content-security-policy'] = "frame-ancestors 'self';";
    }
    const targetOrigin = req._previewTargetOrigin;
    const dashboardHost = req.headers.host;
    if (targetOrigin && dashboardHost && proxyRes.headers.location) {
      const loc = proxyRes.headers.location;
      try {
        const u = new URL(loc, targetOrigin);
        if (
          u.origin === targetOrigin ||
          u.origin === targetOrigin.replace(/\/$/, '')
        ) {
          const protocol = req.protocol === 'https' ? 'https:' : 'http:';
          proxyRes.headers.location =
            protocol + '//' + dashboardHost + u.pathname + u.search;
        }
      } catch {}
      delete req._previewTargetOrigin;
    } else if (targetOrigin) {
      delete req._previewTargetOrigin;
    }
    proxyRes.once('close', () => {
      const pr = req._previewProxyReq;
      if (pr?.socket) {pr.socket.destroy();}
      delete req._previewProxyReq;
    });
  });
  sandboxPreviewProxy.on('error', (err: any, req: PreviewReq, res: any) => {
    logger.warn({ err: err.message }, 'Dashboard: sandbox preview proxy error');
    const pr = req && req._previewProxyReq;
    if (pr?.socket) {pr.socket.destroy();}
    if (req) {delete req._previewProxyReq;}
    if (!res.headersSent) {res.status?.(502).send?.('Preview unavailable');}
  });
  return sandboxPreviewProxy;
}
