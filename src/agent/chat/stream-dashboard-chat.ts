import type { Response } from 'express';
import config from '../../config.js';
import type { DashboardContext } from '../../dashboard/context.js';
import { replyNonEmptyScorer } from '../evals/dashboard-scorers.js';
import { getAgentRuntimeDb } from '../db/agent-runtime-db.js';
import { insertBudgetLedger, insertTraceEvent } from '../db/trace-recorder.js';
import { getDashboardAgent, getPlannerAgent } from '../mastra/dashboard-agent.js';
import type { DashboardAgentProvider } from '../mastra/model.js';
import { assertProviderConfigured, buildMastraModelForProvider } from '../mastra/model.js';
import { formatSseData, type AgentSseEvent } from '../runtime/sse-events.js';

function writeSse(res: Response, event: AgentSseEvent): void {
  res.write(formatSseData(event));
}

function mapChunkToEvents(chunk: Record<string, unknown>): AgentSseEvent[] {
  const type = typeof chunk.type === 'string' ? chunk.type : '';
  const payload = (chunk.payload as Record<string, unknown> | undefined) ?? {};

  if (type === 'text-delta') {
    const text = typeof payload.text === 'string' ? payload.text : '';
    return text ? [{ type: 'token', text }] : [];
  }
  if (type === 'reasoning-delta') {
    const text = typeof payload.text === 'string' ? payload.text : '';
    return [{ type: 'trace', name: 'reasoning_delta', payload: { text } }];
  }
  if (type === 'tool-call-input-streaming-start') {
    const toolCallId = String(payload.toolCallId ?? '');
    const toolName = String(payload.toolName ?? 'tool');
    return [{ type: 'tool_call_started', toolCallId, toolName, args: {} }];
  }
  if (type === 'tool-call-delta') {
    const toolCallId = String(payload.toolCallId ?? '');
    const partial =
      typeof payload.argsTextDelta === 'string' ? { argsTextDelta: payload.argsTextDelta } : payload;
    return [{ type: 'tool_call_delta', toolCallId, partial }];
  }
  if (type === 'tool-call') {
    const toolCallId = String(payload.toolCallId ?? '');
    const toolName = String(payload.toolName ?? 'tool');
    const args = payload.args ?? {};
    return [{ type: 'tool_call_started', toolCallId, toolName, args }];
  }
  if (type === 'tool-result' || type === 'tool-output') {
    const toolCallId = String(payload.toolCallId ?? '');
    const toolName = String(payload.toolName ?? 'tool');
    const result = payload.result ?? payload.output;
    return [{ type: 'tool_result', toolCallId, toolName, result }];
  }
  if (type === 'finish' || type === 'step-finish') {
    return [];
  }

  if (process.env.AGENT_DEBUG_CHUNKS === '1') {
    return [{ type: 'trace', name: 'chunk', payload: { type, keys: Object.keys(chunk) } }];
  }
  return [];
}

function extractUsageMetadata(metadata: unknown): { anthropic?: Record<string, unknown>; openai?: Record<string, unknown> } {
  if (!metadata || typeof metadata !== 'object') {
    return {};
  }
  const m = metadata as Record<string, Record<string, unknown>>;
  const out: { anthropic?: Record<string, unknown>; openai?: Record<string, unknown> } = {};
  if (m.anthropic) {
    out.anthropic = m.anthropic;
  }
  if (m.openai) {
    out.openai = m.openai;
  }
  return out;
}

export type StreamDashboardChatArgs = {
  ctx: DashboardContext;
  res: Response;
  userId: string;
  threadId: string;
  message: string;
  provider: DashboardAgentProvider;
  requestId: string;
  abortSignal?: AbortSignal;
};

export async function streamDashboardAgentChat(args: StreamDashboardChatArgs): Promise<void> {
  const { ctx, res, userId, threadId, message, provider, requestId, abortSignal } = args;
  assertProviderConfigured(provider);

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const db = getAgentRuntimeDb();
  const traceId = requestId;

  insertTraceEvent(db, {
    traceId,
    spanId: traceId,
    parentSpanId: null,
    requestId,
    userId,
    name: 'agent.chat.start',
    kind: 'span',
    status: 'ok',
    metadataJson: JSON.stringify({ provider, threadId }),
  });

  writeSse(res, {
    type: 'meta',
    requestId,
    threadId,
    userId,
    provider,
    model:
      provider === 'openai'
        ? config.openaiModel
        : provider === 'anthropic'
          ? config.anthropicModel
          : config.qwenModel,
  });

  let systemPreamble: string | undefined;
  if (config.agentTeamMode) {
    try {
      const planner = getPlannerAgent();
      const plan = await planner.generate(
        [{ role: 'user', content: message }],
        { maxSteps: 1, model: buildMastraModelForProvider(provider) },
      );
      systemPreamble = `Planning sketch (internal):\n${plan.text || ''}\n`;
      insertTraceEvent(db, {
        traceId,
        spanId: `${traceId}:planner`,
        parentSpanId: traceId,
        requestId,
        userId,
        name: 'agent.planner',
        kind: 'span',
        status: 'ok',
        outputJson: JSON.stringify({ text: plan.text?.slice(0, 4000) }),
      });
    } catch {
      systemPreamble = undefined;
    }
  }

  const agent = getDashboardAgent(ctx);
  const model = buildMastraModelForProvider(provider);

  const streamOpts: Record<string, unknown> = {
    model,
    memory: {
      thread: threadId,
      resource: userId,
    },
    maxSteps: 12,
    // Mastra accepts scorer instances; typings vary by @mastra/core version.
    scorers: [replyNonEmptyScorer] as any,
    returnScorerData: true,
  };
  if (systemPreamble) {
    streamOpts.system = systemPreamble;
  }
  if (abortSignal) {
    streamOpts.abortSignal = abortSignal;
  }

  const streamResult = await agent.stream([{ role: 'user', content: message }], streamOpts as never);

  try {
    const reader = streamResult.fullStream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value && typeof value === 'object') {
        const chunk = value as Record<string, unknown>;
        if (process.env.AGENT_DEBUG_CHUNKS === '1') {
          insertTraceEvent(db, {
            traceId,
            spanId: `${traceId}:chunk:${String(chunk.type ?? 'unknown')}`,
            parentSpanId: traceId,
            requestId,
            userId,
            name: 'mastra.chunk',
            kind: 'event',
            metadataJson: JSON.stringify({ type: chunk.type }),
          });
        }
        for (const ev of mapChunkToEvents(chunk)) {
          writeSse(res, ev);
        }
      }
    }

    const usage = await streamResult.usage.catch(() => undefined);
    if (usage) {
      const usageEv: AgentSseEvent = { type: 'usage' };
      if (typeof usage.inputTokens === 'number') {
        usageEv.inputTokens = usage.inputTokens;
      }
      if (typeof usage.outputTokens === 'number') {
        usageEv.outputTokens = usage.outputTokens;
      }
      if (typeof usage.totalTokens === 'number') {
        usageEv.totalTokens = usage.totalTokens;
      }
      if (usage.raw !== undefined) {
        usageEv.raw = usage.raw;
      }
      writeSse(res, usageEv);
      insertBudgetLedger(db, {
        requestId,
        userId,
        provider,
        model:
          provider === 'openai'
            ? config.openaiModel
            : provider === 'anthropic'
              ? config.anthropicModel
              : config.qwenModel,
        inputTokens: usage.inputTokens ?? null,
        outputTokens: usage.outputTokens ?? null,
        totalTokens: usage.totalTokens ?? null,
        metadataJson: JSON.stringify({ runId: streamResult.runId }),
      });
    }

    const meta = await streamResult.providerMetadata.catch(() => undefined);
    const ext = extractUsageMetadata(meta);
    const anthCacheRead = ext.anthropic?.cache_read_input_tokens;
    const anthCacheWrite = ext.anthropic?.cache_creation_input_tokens;
    if (typeof anthCacheRead === 'number' || typeof anthCacheWrite === 'number') {
      insertTraceEvent(db, {
        traceId,
        spanId: `${traceId}:cache:anthropic`,
        parentSpanId: traceId,
        requestId,
        userId,
        name: 'provider.cache.anthropic',
        kind: 'event',
        metadataJson: JSON.stringify(ext.anthropic ?? {}),
      });
      writeSse(
        res,
        {
          type: 'cache',
          provider: 'anthropic',
          kind: 'prompt_cache',
          op: typeof anthCacheRead === 'number' && anthCacheRead > 0 ? 'hit' : 'write',
          ...(ext.anthropic ? { metadata: ext.anthropic } : {}),
        } as AgentSseEvent,
      );
    }
    const openaiCached = ext.openai?.cachedPromptTokens ?? usage?.cachedInputTokens;
    if (typeof openaiCached === 'number') {
      writeSse(
        res,
        {
          type: 'cache',
          provider: 'openai',
          kind: 'cached_prompt_tokens',
          op: 'hit',
          metadata: { ...(ext.openai ?? {}), cachedPromptTokens: openaiCached },
        } as AgentSseEvent,
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Stream failed';
    writeSse(res, { type: 'error', message: msg });
    insertTraceEvent(db, {
      traceId,
      spanId: `${traceId}:error`,
      parentSpanId: traceId,
      requestId,
      userId,
      name: 'agent.chat.error',
      kind: 'span',
      status: 'error',
      metadataJson: JSON.stringify({ message: msg }),
    });
    res.end();
    return;
  }

  const finishReason = await streamResult.finishReason.catch(() => undefined);
  const runId = streamResult.runId;

  insertTraceEvent(db, {
    traceId,
    spanId: `${traceId}:done`,
    parentSpanId: traceId,
    requestId,
    userId,
    name: 'agent.chat.finish',
    kind: 'span',
    status: 'ok',
    metadataJson: JSON.stringify({ finishReason, runId }),
  });

  writeSse(
    res,
    {
      type: 'done',
      ...(runId ? { runId } : {}),
      ...(finishReason ? { finishReason } : {}),
    } as AgentSseEvent,
  );
  res.end();
}
