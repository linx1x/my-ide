/**
 * In-memory store for sandbox preview sessions keyed by previewId.
 * Session ownership is by sessionKey; proxy and API enforce ownership.
 */

import type { SandboxSession } from './types.js';

const sessions = new Map<string, SandboxSession>();

/** Max log lines to keep per session (ring buffer). */
const MAX_LOG_LINES = 200;

export function get(previewId: string): SandboxSession | null {
  return sessions.get(previewId) ?? null;
}

export function getBySession(sessionKey: string): SandboxSession | null {
  for (const s of sessions.values()) {
    if (s.sessionKey === sessionKey) {return s;}
  }
  return null;
}

export function set(session: SandboxSession): void {
  const existing = sessions.get(session.previewId);
  const logs = existing?.logs ?? [];
  session.logs = logs;
  session.cleanup = session.cleanup ?? existing?.cleanup ?? null;
  session.updatedAt = Date.now();
  sessions.set(session.previewId, session);
}

export function patch(previewId: string, partial: Partial<SandboxSession>): SandboxSession | null {
  const session = sessions.get(previewId);
  if (!session) {return null;}
  Object.assign(session, partial);
  session.updatedAt = Date.now();
  if (partial.status && partial.status !== 'failed' && partial.status !== 'stopped') {
    session.lastActivityAt = Date.now();
  }
  return session;
}

export function updateStatus(
  previewId: string,
  status: SandboxSession['status'],
  error?: string | null,
  previewUrl?: string | null,
  internalPort?: number | null
): void {
  const s = sessions.get(previewId);
  if (!s) {return;}
  s.status = status;
  s.updatedAt = Date.now();
  s.lastActivityAt = Date.now();
  if (error != null) {s.error = error;}
  if (previewUrl != null) {s.previewUrl = previewUrl;}
  if (internalPort != null) {s.internalPort = internalPort;}
}

export function appendLog(previewId: string, line: string): void {
  const s = sessions.get(previewId);
  if (!s) {return;}
  s.logs = [...s.logs, line].slice(-MAX_LOG_LINES);
  s.updatedAt = Date.now();
}

export function remove(previewId: string): void {
  sessions.delete(previewId);
}

export function touch(previewId: string): void {
  const s = sessions.get(previewId);
  if (s) {
    s.lastActivityAt = Date.now();
    s.updatedAt = Date.now();
  }
}

export function listBySession(sessionKey: string): SandboxSession[] {
  return [...sessions.values()].filter((s) => s.sessionKey === sessionKey);
}

export function all(): SandboxSession[] {
  return [...sessions.values()];
}
