const API = '/api';

type ApiOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
};

type ApiErrorLike = {
  error?: string;
  message?: string;
};

export async function api(path: string, options: ApiOptions = {}): Promise<Response> {
  const { body, ...rest } = options;
  const requestBody = body
    ? JSON.stringify(body)
    : (body as BodyInit | null | undefined);
  const init: RequestInit = {
    ...rest,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'fetch',
      ...options.headers,
    },
  };
  if (requestBody !== undefined) {
    init.body = requestBody;
  }
  return fetch(API + path, init);
}

/** Call api(), parse JSON, throw on !r.ok. Use in queryFn/mutationFn. */
export async function apiJson<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const r = await api(path, options);
  const data = (await r.json().catch(() => ({}))) as ApiErrorLike & T;
  if (!r.ok) {throw new Error(data.error || data.message || `Request failed: ${r.status}`);}
  return data as T;
}

/** Multipart POST (no JSON body). CSRF header only — do not set Content-Type. */
export async function apiPostForm(path: string, formData: FormData): Promise<Response> {
  return fetch(API + path, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'X-Requested-With': 'fetch',
    },
    body: formData,
  });
}

/** For auth/status query: fetch /status, throw if not ok. */
export async function fetchStatus(): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);
  try {
    const r = await fetch(API + '/status', {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'fetch',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = (await r.json().catch(() => ({}))) as ApiErrorLike;
    if (!r.ok) {throw new Error(data.error || data.message || `Request failed: ${r.status}`);}
    return data;
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Server took too long to respond. Check that the bridge is running.');
    }
    throw err;
  }
}

export async function checkAuth(): Promise<boolean> {
  try {
    const r = await api('/status');
    return r.ok;
  } catch {
    return false;
  }
}

/** SSE payloads from POST /api/agent/chat (mirrors src/agent/runtime/sse-events.ts). */
export type AgentChatSseEvent =
  | { type: 'meta'; requestId: string; threadId: string; userId: string; provider: string; model?: string }
  | { type: 'token'; text: string }
  | { type: 'tool_call_started'; toolCallId: string; toolName: string; args?: unknown }
  | { type: 'tool_call_delta'; toolCallId: string; partial: unknown }
  | { type: 'tool_result'; toolCallId: string; toolName: string; result: unknown }
  | { type: 'trace'; name: string; payload: Record<string, unknown> }
  | { type: 'usage'; inputTokens?: number; outputTokens?: number; totalTokens?: number; raw?: unknown }
  | {
      type: 'cache';
      provider: string;
      kind: string;
      op: string;
      metadata?: Record<string, unknown>;
    }
  | { type: 'done'; runId?: string; finishReason?: string }
  | { type: 'error'; message: string; code?: string };

/**
 * Stream agent chat (SSE). Uses fetch directly so Accept can be text/event-stream.
 */
export async function streamAgentChat(
  body: { message: string; threadId?: string; provider?: string },
  onEvent: (ev: AgentChatSseEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const requestBody = JSON.stringify(body);
  const init: RequestInit = {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'fetch',
      Accept: 'text/event-stream',
    },
    body: requestBody,
  };
  if (signal) {
    init.signal = signal;
  }
  const r = await fetch(API + '/agent/chat', init);
  if (!r.ok) {
    const data = (await r.json().catch(() => ({}))) as ApiErrorLike;
    throw new Error(data.error || data.message || `Agent chat failed: ${r.status}`);
  }
  const reader = r.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() ?? '';
    for (const block of blocks) {
      const line = block.split('\n').find((l) => l.startsWith('data: '));
      if (!line) {
        continue;
      }
      const json = line.slice(6).trim();
      if (!json) {
        continue;
      }
      try {
        onEvent(JSON.parse(json) as AgentChatSseEvent);
      } catch {
        // ignore malformed chunk
      }
    }
  }
}
