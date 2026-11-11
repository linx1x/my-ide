/**
 * Dashboard HTTP server: auth, agent chat, codebase viewer (IDE mode).
 * Phone verification via WhatsApp OTP (uses ALLOWED_NUMBERS).
 */
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Server as HttpServer } from 'node:http';
import config from '../config.js';
import { verifyToken } from './auth.js';
import { reapIdlePreviews } from './sandbox/index.js';
import { createDashboardContext } from './context.js';
import { createSandboxPreviewProxy } from './sandbox-preview-proxy.js';
import {
  createN8nProxy,
  registerN8nDashboardProxy,
  n8nPublicPath,
} from './n8n-proxy-mount.js';
import {
  createLangfuseProxy,
  registerLangfuseDashboardProxy,
} from './langfuse-proxy-mount.js';
import {
  registerDashboardExpressCore,
  registerDashboardBodyParsers,
} from './express-core.js';
import {
  createProjectJob,
  pushProjectJobLog,
  finishProjectJob,
  getProjectJob,
} from './project-jobs.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerVoiceRoutes } from './routes/voice.js';
import { registerFilesRoutes } from './routes/files.js';
import { registerGitRoutes } from './routes/git.js';
import { registerProjectsRoutes } from './routes/projects.js';
import { registerPreviewsRoutes } from './routes/previews.js';
import { registerN8nRoutes } from './routes/n8n.js';
import { registerLangfuseRoutes } from './routes/langfuse.js';
import { registerDbRoutes } from './routes/db.js';
import { registerGithubRoutes } from './routes/github.js';
import { registerStatusRoutes } from './routes/status.js';
import { registerAgentRoutes } from './routes/agent.js';
import { getAgentRuntimeDb } from '../agent/db/agent-runtime-db.js';
import { logger } from '../logger.js';
import { setupTerminalWebSocket } from './ws.js';
import { sweepIdleDbConnections } from './db-visualizer.js';
import type { ProjectJob } from './context.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
let whatsappSock: unknown = null;

export function setWhatsAppSock(sock: unknown): void {
  whatsappSock = sock;
}

const app = express();
const sandboxPreviewProxy = createSandboxPreviewProxy();
const n8nProxy = createN8nProxy();
const langfuseProxy = createLangfuseProxy();

const { corsOrigins, limiters } = registerDashboardExpressCore(app);

const ctx = createDashboardContext({
  corsOrigins,
  dashboardPort: config.dashboardPort,
  limiters,
  getWhatsAppSock: () => whatsappSock,
  createProjectJob: createProjectJob as unknown as () => { id: string; job: ProjectJob } | null,
  pushProjectJobLog,
  finishProjectJob,
  getProjectJob: getProjectJob as unknown as (jobId: string) => ProjectJob | undefined,
  sandboxPreviewProxy,
});

registerDashboardBodyParsers(app);

app.use('/api', (req, res, next) => {
  return ctx.csrfGuard(req, res, next);
});

registerN8nDashboardProxy(app, {
  n8nProxy,
  dashboardModuleDir: __dirname,
  verifyToken,
});
registerLangfuseDashboardProxy(app, { langfuseProxy, verifyToken });

registerAuthRoutes(app, ctx as Parameters<typeof registerAuthRoutes>[1]);
registerVoiceRoutes(app, ctx);
registerFilesRoutes(app, ctx);
registerGitRoutes(app, ctx);
registerProjectsRoutes(app, ctx);
registerPreviewsRoutes(app, ctx);
registerN8nRoutes(app, ctx);
registerLangfuseRoutes(app, ctx);
registerDbRoutes(app, ctx);
registerGithubRoutes(app, ctx);
registerStatusRoutes(app, ctx);
registerAgentRoutes(app, ctx);

const clientDist = join(__dirname, 'client', 'dist');
const staticDir = clientDist;

app.use(express.static(staticDir));
app.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, max-age=0, must-revalidate');
  res.setHeader('X-Dashboard-Mode', 'react');
  res.sendFile(join(staticDir, 'index.html'));
});

export async function createDashboardServer(): Promise<HttpServer> {
  if (config.agentChatEnabled) {
    try {
      getAgentRuntimeDb();
      logger.info('Agent runtime SQLite initialized');
    } catch (err) {
      logger.error({ err }, 'Agent runtime DB initialization failed');
    }
  }
  if (!existsSync(clientDist)) {
    throw new Error(
      'Dashboard build not found at src/dashboard/client/dist. Run `npm run build:dashboard` first.',
    );
  }
  try {
    const publicUrl = new URL(config.dashboardBaseUrl);
    const isLocalPublicUrl = ['localhost', '127.0.0.1', '::1'].includes(publicUrl.hostname);
    if (!isLocalPublicUrl && !config.dashboardCorsStrict) {
      logger.warn(
        { dashboardBaseUrl: config.dashboardBaseUrl },
        'Dashboard appears publicly exposed. Set DASHBOARD_CORS_STRICT=1 and DASHBOARD_CORS_ORIGIN to the exact dashboard origin.',
      );
    }
  } catch {}
  if (config.n8nEnabled) {
    try {
      const targetUrl = new URL(config.n8nInternalUrl);
      if (
        targetUrl.pathname &&
        targetUrl.pathname !== '/' &&
        !targetUrl.pathname.startsWith(n8nPublicPath)
      ) {
        logger.warn(
          { path: targetUrl.pathname, n8nPublicPath },
          'Dashboard: N8N_INTERNAL_URL includes path while N8N_PUBLIC_PATH differs. Verify reverse-proxy path settings.',
        );
      }
      if (!config.n8nApiKey) {
        logger.warn('Dashboard: N8N_API_KEY not set. Workflow management APIs (/api/n8n/workflows/*) will fail.');
      }
    } catch {
      logger.warn('Dashboard: Invalid N8N_INTERNAL_URL. Expected absolute URL like http://localhost:5678');
    }
  }
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err, requestId: (_req as Request & { id?: string }).id, path: _req.path, method: _req.method }, 'Request error');
    if (process.env.NODE_ENV === 'production') {
      res.status(500).json({ error: 'An error occurred. Try again later.' });
    } else {
      const message = err instanceof Error ? err.message : 'Internal server error';
      res.status(500).json({ error: message });
    }
  });

  const server = app.listen(config.dashboardPort, () => {
    logger.info({ port: config.dashboardPort }, 'Dashboard listening');
  });

  setupTerminalWebSocket(server, {
    getCodebaseRoot: ctx.getCodebaseRoot,
    sandboxPreviewProxy,
    n8nProxy,
    n8nPublicPath: config.n8nPublicPath || '/n8n',
  });
  const idleTimeoutMs = config.previewIdleTimeoutMs ?? 30 * 60 * 1000;
  setInterval(async () => {
    const n = await reapIdlePreviews(idleTimeoutMs);
    if (n > 0) {logger.info({ count: n }, 'Dashboard: reaped idle preview(s)');}
  }, 60 * 1000);
  setInterval(() => {
    const n = sweepIdleDbConnections();
    if (n > 0) {logger.info({ count: n }, 'Dashboard: swept idle DB visualizer connection(s)');}
  }, 5 * 60 * 1000);
  return server;
}
