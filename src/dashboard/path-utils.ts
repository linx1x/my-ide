/**
 * Path safety helpers for dashboard file operations. Resolve paths against a root and block sensitive files.
 * Used by dashboard context and route handlers.
 */
import { resolve } from 'node:path';

const SENSITIVE_PATTERNS = [
  /(?:^|\/)\.env(?:\.|$)/i,
  /(?:^|\/)auth_store(?:\/|$)/i,
  /(?:^|\/)chat_history(?:\/|$)/i,
  /\.(?:pem|key)$/i,
  /(?:^|\/)(?:credentials|secrets?)(?:\.|\/|$)/i,
  /(?:^|\/)\.cursor\/mcp\.json$/i,
  /(?:^|\/)\.npmrc$/i,
  /(?:^|\/)\.gitconfig$/i,
  /\.sqlite(?:3)?$/i,
  /(?:^|\/)bridge-data(?:\/|$)/i,
];

/**
 * Resolve a relative path against root and ensure the result is inside root (no traversal).
 * @param relPath - Relative path (user input).
 * @param root - Absolute root directory.
 * @returns Resolved absolute path, or null if traversal detected.
 */
export function safePathResolve(relPath: string, root: string): string | null {
  const base = resolve(root);
  const full = resolve(base, relPath || '.');
  if (!full.startsWith(base)) {return null;}
  return full;
}

/**
 * Returns true if the path matches sensitive patterns (env, auth_store, keys, etc.).
 */
export function isSensitivePath(relPath: string): boolean {
  if (!relPath) {return false;}
  return SENSITIVE_PATTERNS.some((re) => re.test(relPath));
}
