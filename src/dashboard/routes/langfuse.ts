import type { Express } from 'express';
import config from '../../config.js';

export function registerLangfuseRoutes(app: Express, _ctx: unknown) {
  app.get('/api/langfuse/status', (_req, res) => {
    res.json({
      enabled: config.langfuseEnabled,
      publicPath: config.langfusePublicPath,
      internalUrl: config.langfuseInternalUrl,
    });
  });
}
