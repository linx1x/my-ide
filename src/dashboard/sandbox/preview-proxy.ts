/**
 * Resolves previewId to the internal proxy target (host:port) for reverse proxying.
 * Used by server to proxy /api/previews/:previewId/* without exposing raw ports.
 */

import config from '../../config.js';
import * as store from './sandbox-session-store.js';

export interface ProxyTarget {
  host: string;
  port: number;
  pathPrefix: string;
  /** When set, proxy must forward the full request path (no strip). Used when dev server has base path (e.g. Vite VITE_BASE). */
  basePath: string | null;
}

/**
 * Resolve previewId to proxy target. Returns null if not found or not ready.
 * Caller must enforce session ownership before using the target.
 */
export function resolvePreviewRequest(previewId: string): ProxyTarget | null {
  const session = store.get(previewId);
  if (!session || session.internalPort === null) {return null;}
  if (session.status !== 'ready' && session.status !== 'launching') {return null;}
  const host = config.previewProxyHost || '127.0.0.1';
  return {
    host,
    port: session.internalPort,
    pathPrefix: '',
    basePath: session.basePath ?? null,
  };
}
