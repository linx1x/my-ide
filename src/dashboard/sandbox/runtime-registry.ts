/**
 * Runtime registry: maps runtime detection to host-side adapters.
 */

import type { PreviewSource, RuntimeDetectionResult } from './types.js';
import type { IRuntimeAdapter } from './runtime-adapter.js';
import { nodeAdapter } from './adapters/node.js';
import { staticAdapter } from './adapters/static.js';
import { pythonAdapter } from './adapters/python.js';

const adapters = new Map<string, IRuntimeAdapter>();

function registerDefaultAdapters(): void {
  register(nodeAdapter);
  register(staticAdapter);
  register(pythonAdapter);
}
registerDefaultAdapters();

export function register(adapter: IRuntimeAdapter): void {
  adapters.set(adapter.runtimeId, adapter);
}

export function get(runtimeId: string): IRuntimeAdapter | null {
  return adapters.get(runtimeId) ?? null;
}

function adapterPriority(runtimeHint?: string | null): string[] {
  const hint = String(runtimeHint || '').toLowerCase();
  if (hint.includes('python') || hint.includes('streamlit') || hint.includes('fastapi') || hint.includes('flask')) {
    return ['python', 'node', 'static'];
  }
  if (hint.includes('static') || hint.includes('html')) {
    return ['static', 'node', 'python'];
  }
  return ['node', 'static', 'python'];
}

export async function detect(
  workspacePath: string,
  source: PreviewSource,
  runtimeHint?: string | null
): Promise<RuntimeDetectionResult | null> {
  const ordered = adapterPriority(runtimeHint)
    .map((runtimeId) => adapters.get(runtimeId))
    .filter(Boolean) as IRuntimeAdapter[];
  for (const adapter of ordered) {
    const result = await adapter.detect(workspacePath, source);
    if (result) {return result;}
  }
  for (const adapter of adapters.values()) {
    if (ordered.includes(adapter)) {continue;}
    const result = await adapter.detect(workspacePath, source);
    if (result) {return result;}
  }
  return null;
}

export function listRuntimeIds(): string[] {
  return [...adapters.keys()];
}
