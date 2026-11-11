/**
 * Provider-neutral SSE payloads for dashboard agent chat (plan contract).
 */
export type AgentSseEvent =
  | { type: 'meta'; requestId: string; threadId: string; userId: string; provider: string; model?: string }
  | { type: 'token'; text: string }
  | { type: 'tool_call_started'; toolCallId: string; toolName: string; args?: unknown }
  | { type: 'tool_call_delta'; toolCallId: string; partial: unknown }
  | { type: 'tool_result'; toolCallId: string; toolName: string; result: unknown }
  | { type: 'trace'; name: string; payload: Record<string, unknown> }
  | { type: 'usage'; inputTokens?: number; outputTokens?: number; totalTokens?: number; raw?: unknown }
  | { type: 'cache'; provider: string; kind: string; op: 'hit' | 'write' | 'miss'; metadata?: Record<string, unknown> }
  | { type: 'done'; runId?: string; finishReason?: string }
  | { type: 'error'; message: string; code?: string };

export function formatSseData(event: AgentSseEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}
