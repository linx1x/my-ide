/**
 * Mastra-backed agent chat (SSE) for the dashboard.
 */
import express from 'express';
import { z } from 'zod';
import config from '../../config.js';
import { streamDashboardAgentChat } from '../../agent/chat/stream-dashboard-chat.js';
import { resolveDefaultProvider } from '../../agent/mastra/model.js';
import type { DashboardAgentProvider } from '../../agent/mastra/model.js';
import { newRequestId } from '../../agent/runtime/request-id.js';
import { getAgentRuntimeDb } from '../../agent/db/agent-runtime-db.js';
import type { DashboardContext } from '../context.js';

const bodySchema = z.object({
  threadId: z.string().min(1).max(256).optional(),
  message: z.string().min(1).max(120_000),
  provider: z.enum(['openai', 'anthropic', 'qwen']).optional(),
});

export function registerAgentRoutes(app: express.Application, ctx: DashboardContext): void {
  if (!config.agentChatEnabled) {
    return;
  }

  try {
    getAgentRuntimeDb();
  } catch {
    // Fail individual requests if DB cannot open
  }

  app.post(
    '/api/agent/chat',
    ctx.authMiddleware,
    ctx.limiters.api,
    express.json({ limit: '4mb' }),
    async (req, res) => {
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request body' });
      }
      const phone = String((req as express.Request & { auth?: { phone?: string } }).auth?.phone ?? '');
      if (!phone) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const requestId = newRequestId();
      const threadId = parsed.data.threadId ?? `default-${phone}`;
      const provider = (parsed.data.provider ?? resolveDefaultProvider()) as DashboardAgentProvider;

      const ac = new AbortController();
      req.on('close', () => ac.abort());

      try {
        await streamDashboardAgentChat({
          ctx,
          res,
          userId: phone,
          threadId,
          message: parsed.data.message,
          provider,
          requestId,
          abortSignal: ac.signal,
        });
      } catch (err) {
        if (!res.headersSent) {
          const message = err instanceof Error ? err.message : 'Agent failed';
          res.status(500).json({ error: message });
        }
      }
    },
  );
}
