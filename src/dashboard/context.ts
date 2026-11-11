/**
 * Dashboard server context: auth, path helpers, limiters, and shared dependencies for route modules.
 */
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RequestHandler, Response as ExpressResponse } from 'express';
import type HttpProxyServer from 'http-proxy';
import config from '../config.js';
import { verifyToken } from './auth.js';
import { getActiveProject as getActiveProjectFromProjects } from '../services/projects.js';
import { safePathResolve, isSensitivePath as isSensitivePathCheck } from './path-utils.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export type RateLimiters = {
  auth: RequestHandler;
  api: RequestHandler;
  search: RequestHandler;
  completion: RequestHandler;
  voice: RequestHandler;
  upload: RequestHandler;
  skillsSearch: RequestHandler;
};

export type ProjectJob = { status: string; logs: string[]; result: unknown; error: unknown; watchers: Set<ExpressResponse> };

export type DashboardContext = {
  authMiddleware: RequestHandler;
  csrfGuard: RequestHandler;
  getCodebaseRoot: () => string;
  getAppRoot: () => string;
  getActiveProject: () => { path: string; id: string } | null;
  safePath: (relPath: string, root?: string) => string | null;
  isSensitivePath: (relPath: string) => boolean;
  getWorkspacesDir: () => string;
  limiters: RateLimiters;
  getWhatsAppSock: () => unknown;
  createProjectJob: () => { id: string; job: ProjectJob } | null;
  pushProjectJobLog: (job: ProjectJob, line: string) => void;
  finishProjectJob: (jobId: string, status: string, payload?: { result?: unknown; error?: string }) => void;
  getProjectJob: (jobId: string) => ProjectJob | undefined;
  sandboxPreviewProxy?: HttpProxyServer;
};

function authMiddleware(): RequestHandler {
  return (req, res, next) => {
    const token = req.cookies?.dashboard_token || req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const result = verifyToken(token);
    if (!result.ok) {
      return res.status(401).json({ error: result.error || 'Unauthorized' });
    }
    (req as any).auth = { phone: result.phone };
    next();
  };
}

/** Bridge app root (repo root). Use for repo-local resources. */
function getAppRoot(): string {
  return resolve(__dirname, '..', '..');
}

/** Root for Codebase tab: active project, or __app__, or path, or DASHBOARD_WORKDIR */
function getCodebaseRoot(): string {
  const active = getActiveProjectFromProjects();
  if (active) {return active.path;}
  const val = config.dashboardCodebaseRoot;
  if (!val) {return resolve(config.codebaseWorkDir);}
  if (val === '__app__') {return resolve(__dirname, '..', '..');}
  return resolve(val);
}

/** Resolve and validate path is inside codebase root (no traversal). */
function safePath(relPath: string, root?: string): string | null {
  return safePathResolve(relPath, root ?? getCodebaseRoot());
}

function isSensitivePath(relPath: string): boolean {
  return isSensitivePathCheck(relPath);
}

function getWorkspacesDir(): string {
  const bridgeData = config.bridgeDataDir ? resolve(config.bridgeDataDir) : resolve(process.cwd(), 'bridge-data');
  return join(bridgeData, 'workspaces');
}

function buildCsrfGuard(corsOrigins: string[], dashboardPort: number): RequestHandler {
  return (req, res, next) => {
    if (req.path === '/webhooks/github') {return next();}
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      const xrw = req.headers['x-requested-with'];
      if (!xrw || String(xrw).toLowerCase() !== 'fetch') {
        return res.status(403).json({ error: 'Forbidden: invalid CSRF header' });
      }
      const origin = req.headers['origin'];
      if (origin) {
        const allowed = [
          ...corsOrigins,
          `http://localhost:${dashboardPort}`,
          `http://127.0.0.1:${dashboardPort}`,
        ];
        if (!allowed.includes(origin)) {
          return res.status(403).json({ error: 'Forbidden: origin not allowed' });
        }
      }
    }
    next();
  };
}

export type CreateDashboardContextOptions = {
  corsOrigins: string[];
  dashboardPort: number;
  limiters: RateLimiters;
  getWhatsAppSock: () => unknown;
  createProjectJob: () => { id: string; job: ProjectJob } | null;
  pushProjectJobLog: (job: ProjectJob, line: string) => void;
  finishProjectJob: (jobId: string, status: string, payload?: { result?: unknown; error?: string }) => void;
  getProjectJob: (jobId: string) => ProjectJob | undefined;
  sandboxPreviewProxy?: HttpProxyServer;
};

export function createDashboardContext(opts: CreateDashboardContextOptions): DashboardContext {
  const base: Omit<DashboardContext, 'sandboxPreviewProxy'> = {
    authMiddleware: authMiddleware(),
    csrfGuard: buildCsrfGuard(opts.corsOrigins, opts.dashboardPort),
    getCodebaseRoot,
    getAppRoot,
    getActiveProject: getActiveProjectFromProjects,
    safePath,
    isSensitivePath,
    getWorkspacesDir,
    limiters: opts.limiters,
    getWhatsAppSock: opts.getWhatsAppSock,
    createProjectJob: opts.createProjectJob,
    pushProjectJobLog: opts.pushProjectJobLog,
    finishProjectJob: opts.finishProjectJob,
    getProjectJob: opts.getProjectJob,
  };
  if (opts.sandboxPreviewProxy) {
    return { ...base, sandboxPreviewProxy: opts.sandboxPreviewProxy };
  }
  return base;
}
