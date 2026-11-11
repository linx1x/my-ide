/**
 * N8n API routes: status, workflows (list, import, export).
 */
import type { Application, Response } from 'express';
import config from '../../config.js';
import type { DashboardContext } from '../context.js';

const n8nPublicPath = config.n8nPublicPath || '/n8n';

function getN8nApiHeaders() {
  if (!config.n8nApiKey) {return null;}
  return {
    'Content-Type': 'application/json',
    'X-N8N-API-KEY': config.n8nApiKey,
  };
}

async function callN8n(path: string, options: { method?: string; headers?: Record<string, string>; body?: unknown; authRequired?: boolean } = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.authRequired) {
    const apiHeaders = getN8nApiHeaders();
    if (!apiHeaders) {throw new Error('N8N_API_KEY is required for this operation');}
    Object.assign(headers, apiHeaders);
  }
  const url = `${config.n8nInternalUrl.replace(/\/$/, '')}${path}`;
  const reqInit: RequestInit = {
    method: options.method || 'GET',
    headers,
  };
  if (options.body !== undefined) {reqInit.body = JSON.stringify(options.body);}
  const response = await fetch(url, reqInit);
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => '');
  return { ok: response.ok, status: response.status, data };
}

/** n8n POST /workflows rejects read-only root fields such as `active` (activate via UI or PATCH after create). */
function prepareWorkflowForN8nCreate(workflow: unknown): Record<string, unknown> {
  if (!workflow || typeof workflow !== 'object') {return {};}
  const w = { ...(workflow as Record<string, unknown>) };
  delete w.id;
  delete w.active;
  return w;
}

function extractMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object') {
    const o = data as { message?: unknown; error?: unknown };
    if (typeof o.message === 'string') {return o.message;}
    if (typeof o.error === 'string') {return o.error;}
  }
  return fallback;
}

/** n8n returned 401/403 — not the same as dashboard JWT failure */
const N8N_API_KEY_HINT =
  'n8n rejected the API call. In n8n open Settings → API, create an API key, set N8N_API_KEY in the bridge .env to that value, restart the bridge, and ensure N8N_ENABLED=1. (This is separate from logging into the dashboard via WhatsApp.)';

type N8nCallResult = { ok: boolean; status: number; data: unknown };

/** Send error JSON for a failed callN8n result. Returns true if the response was sent. */
function respondIfN8nCallFailed(
  res: Response,
  out: N8nCallResult,
  fallbackMessage: string,
  opts?: { includeDetails?: boolean },
): boolean {
  if (out.ok) {return false;}
  const msg = extractMessage(out.data, fallbackMessage);
  const details =
    opts?.includeDetails && out.data && typeof out.data === 'object' ? { details: out.data } : {};
  if (out.status === 401 || out.status === 403) {
    res.status(502).json({
      error: msg,
      hint: N8N_API_KEY_HINT,
      upstreamStatus: out.status,
      ...details,
    });
    return true;
  }
  res.status(out.status).json({ error: msg, ...details });
  return true;
}

export function registerN8nRoutes(app: Application, ctx: DashboardContext): void {
  const { authMiddleware } = ctx;

  app.get('/api/n8n/status', authMiddleware, async (_req, res) => {
    if (!config.n8nEnabled) {
      return res.json({
        enabled: false,
        reachable: false,
        embedUrl: `${n8nPublicPath}/`,
        publicPath: n8nPublicPath,
        internalUrl: config.n8nInternalUrl,
        hasApiKey: !!config.n8nApiKey,
        error: 'N8N_ENABLED is not set to 1',
      });
    }
    try {
      const health = await callN8n('/healthz');
      res.json({
        enabled: true,
        reachable: health.ok,
        healthStatus: health.status,
        embedUrl: `${n8nPublicPath}/`,
        publicPath: n8nPublicPath,
        internalUrl: config.n8nInternalUrl,
        hasApiKey: !!config.n8nApiKey,
        uiEmbedMode: config.n8nUiEmbedMode,
      });
    } catch (err) {
      res.json({
        enabled: true,
        reachable: false,
        embedUrl: `${n8nPublicPath}/`,
        publicPath: n8nPublicPath,
        internalUrl: config.n8nInternalUrl,
        hasApiKey: !!config.n8nApiKey,
        uiEmbedMode: config.n8nUiEmbedMode,
        error: (err as Error).message,
      });
    }
  });

  app.get('/api/n8n/workflows', authMiddleware, async (_req, res) => {
    if (!config.n8nEnabled) {return res.status(400).json({ error: 'n8n integration disabled' });}
    try {
      const out = await callN8n('/api/v1/workflows', { authRequired: true });
      if (respondIfN8nCallFailed(res, out, 'Failed to fetch workflows')) {return;}
      const workflows = out.data && typeof out.data === 'object' && 'data' in out.data
        ? ((out.data as { data?: unknown[] }).data ?? [])
        : (Array.isArray(out.data) ? out.data : []);
      res.json({ ok: true, workflows });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/n8n/workflows/import', authMiddleware, async (req, res) => {
    if (!config.n8nEnabled) {return res.status(400).json({ error: 'n8n integration disabled' });}
    const workflow = req.body?.workflow || req.body;
    if (!workflow || typeof workflow !== 'object') {
      return res.status(400).json({ error: 'workflow JSON body required' });
    }
    const payload = prepareWorkflowForN8nCreate(workflow);
    try {
      const out = await callN8n('/api/v1/workflows', {
        method: 'POST',
        authRequired: true,
        body: payload,
      });
      if (respondIfN8nCallFailed(res, out, 'Import failed', { includeDetails: true })) {return;}
      res.json({ ok: true, workflow: out.data });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/n8n/workflows/:id/export', authMiddleware, async (req, res) => {
    if (!config.n8nEnabled) {return res.status(400).json({ error: 'n8n integration disabled' });}
    const idRaw = req.params.id;
    const id = typeof idRaw === 'string' ? idRaw : '';
    if (!id) {return res.status(400).json({ error: 'workflow id required' });}
    try {
      const out = await callN8n(`/api/v1/workflows/${encodeURIComponent(id)}`, { authRequired: true });
      if (respondIfN8nCallFailed(res, out, 'Export failed')) {return;}
      res.json({ ok: true, workflow: out.data });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

}
