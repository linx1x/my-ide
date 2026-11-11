/**
 * Sandbox controller: public API for creating, getting, stopping previews and streaming events.
 * For template-disk / builder-files with templateDisk: use manifest from disk (copy, overlay, launch).
 * Otherwise: use runtime detection + adapters.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { CreatePreviewOptions, SandboxSession, PreviewEvent } from './types.js';
import * as store from './sandbox-session-store.js';
import { subscribe, emit, removeListenersForPreview } from './event-bus.js';
import { resolvePreviewRequest } from './preview-proxy.js';
import { detect, get } from './runtime-registry.js';
import { materialize } from './workspace-manager.js';
import config from '../../config.js';
import {
  getPreviewRoot,
  launchFromManifest,
  stopManagedHandle,
  drainPendingRemovals,
  ensurePortFree,
  type TemplateManifest,
} from '../preview-runner.js';

const PREFIX = 'pv_';

function newPreviewId(): string {
  return PREFIX + randomUUID().replace(/-/g, '').slice(0, 12);
}

function createSession(previewId: string, sessionKey: string, options: CreatePreviewOptions): SandboxSession {
  const now = Date.now();
  return {
    previewId,
    sessionKey,
    source: options.source,
    mode: options.mode ?? 'dev',
    status: 'provisioning',
    previewUrl: `/api/previews/${previewId}/`,
    basePath: null,
    internalPort: null,
    workspacePath: null,
    runtimeId: null,
    runtimeHandle: null,
    cleanup: null,
    packageManager: options.source.type === 'builder-files' ? options.source.packageManager ?? null : null,
    framework: null,
    startedAt: now,
    updatedAt: now,
    lastActivityAt: now,
    error: null,
    logs: [],
  };
}

function emitStatus(previewId: string, status: SandboxSession['status'], payload: Record<string, unknown> = {}): void {
  emit({
    previewId,
    type: status === 'failed' ? 'error' : 'status',
    payload: { status, ...payload },
    at: Date.now(),
  });
}

function appendPreviewLog(previewId: string, line: string): void {
  store.appendLog(previewId, line);
  emit({
    previewId,
    type: 'log',
    payload: { logLine: line },
    at: Date.now(),
  });
}

function useManifestFlow(source: CreatePreviewOptions['source']): boolean {
  if (source.type === 'template-disk') {return true;}
  if (source.type === 'builder-files' && source.templateDisk) {return true;}
  if (source.type === 'builder-files' && source.templateAppId) {return true;}
  return false;
}

function getAddOnsFromSource(source: CreatePreviewOptions['source']): string[] {
  if (source.type === 'template-disk') {return source.addOns ?? [];}
  if (source.type === 'builder-files' && source.templateDisk) {return source.templateDisk.addOns ?? [];}
  if (source.type === 'builder-files' && source.templateAppId) {return [];}
  return [];
}

/**
 * Create a new preview. Returns session immediately (status "provisioning").
 * The heavy pipeline (materialize, install, launch) runs in the background and
 * emits SSE events so the client can track progress via /api/previews/events.
 */
export function createPreview(options: CreatePreviewOptions): SandboxSession {
  const previewId = newPreviewId();
  const session = createSession(previewId, options.sessionKey, options);
  store.set(session);
  emitStatus(previewId, 'provisioning');

  runPreviewPipeline(previewId, options).catch(() => {});

  return session;
}

async function runPreviewPipeline(previewId: string, options: CreatePreviewOptions): Promise<void> {
  try {
    await drainPendingRemovals();
    store.updateStatus(previewId, 'materializing');
    emitStatus(previewId, 'materializing');
    const materializeTimeoutMs = config.previewMaterializeTimeoutMs ?? 120_000;
    const materialized = await Promise.race([
      materialize(options.source, getPreviewRoot(), previewId),
      new Promise<null>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Materialize timed out (copying template took longer than ${Math.round(materializeTimeoutMs / 1000)}s)`)),
          materializeTimeoutMs,
        ),
      ),
    ]);
    if (!materialized) {
      throw new Error('Failed to materialize preview workspace');
    }
    store.patch(previewId, {
      workspacePath: materialized.workspacePath,
      cleanup: materialized.cleanup ?? null,
    });

    const templatePath = join(materialized.workspacePath, 'template.json');
    const manifestPath = join(materialized.workspacePath, 'manifest.json');
    const configPath = existsSync(templatePath) ? templatePath : existsSync(manifestPath) ? manifestPath : null;
    const useManifest =
      useManifestFlow(options.source) ||
      (options.source.type === 'project-path' && configPath !== null);

    if (useManifest && configPath) {
      const manifest = JSON.parse(readFileSync(configPath, 'utf8')) as TemplateManifest;
      const addOns = getAddOnsFromSource(options.source);
      store.patch(previewId, { runtimeId: 'manifest' });
      store.updateStatus(previewId, 'installing');
      emitStatus(previewId, 'installing');
      store.updateStatus(previewId, 'launching');
      emitStatus(previewId, 'launching');
      const { handle, port, basePath } = await launchFromManifest({
        previewId,
        workspacePath: materialized.workspacePath,
        manifest,
        addOns,
        onLog: (line) => appendPreviewLog(previewId, line),
      });
      store.patch(previewId, {
        status: 'ready',
        internalPort: port,
        runtimeHandle: handle,
        basePath: basePath ?? null,
        error: null,
      });
      emit({
        previewId,
        type: 'ready',
        payload: { status: 'ready', previewUrl: `/api/previews/${previewId}/`, previewPort: port },
        at: Date.now(),
      });
      return;
    }

    const detection = await detect(materialized.workspacePath, options.source, options.runtimeHint);
    if (!detection) {
      throw new Error('Could not detect a supported preview runtime');
    }
    const adapter = get(detection.runtimeId);
    if (!adapter) {
      throw new Error(`No adapter registered for runtime ${detection.runtimeId}`);
    }
    const session = store.get(previewId);
    if (!session) {throw new Error(`No session for preview ${previewId}`);}
    const selectedMode = options.mode ?? detection.suggestedMode ?? session.mode;
    store.patch(previewId, {
      runtimeId: detection.runtimeId,
      framework: detection.framework ?? null,
      packageManager:
        detection.packageManager ??
        (options.source.type === 'builder-files' ? options.source.packageManager ?? null : null),
      mode: selectedMode,
    });

    store.updateStatus(previewId, 'installing');
    emitStatus(previewId, 'installing');
    const installResult = await adapter.install(materialized.workspacePath, options.source, {
      previewId,
      packageManager:
        detection.packageManager ??
        (options.source.type === 'builder-files' ? options.source.packageManager ?? null : null),
      onLog: (line) => appendPreviewLog(previewId, line),
    });
    if (!installResult.success) {
      throw new Error(installResult.error || 'Install failed');
    }
    if (installResult.handle) {
      store.patch(previewId, { runtimeHandle: installResult.handle });
    }

    store.updateStatus(previewId, 'launching');
    emitStatus(previewId, 'launching');
    const launchResult = await adapter.launch(materialized.workspacePath, selectedMode, {
      previewId,
      packageManager:
        detection.packageManager ??
        (options.source.type === 'builder-files' ? options.source.packageManager ?? null : null),
      onLog: (line) => appendPreviewLog(previewId, line),
    });
    if (!launchResult.success || typeof launchResult.internalPort !== 'number') {
      throw new Error(launchResult.error || 'Launch failed');
    }
    const ready = await adapter.isReady(materialized.workspacePath, launchResult.internalPort);
    if (!ready) {
      throw new Error('Preview failed its readiness check');
    }
    store.patch(previewId, {
      status: 'ready',
      internalPort: launchResult.internalPort ?? null,
      runtimeHandle: launchResult.handle ?? null,
      error: null,
    });
    emit({
      previewId,
      type: 'ready',
      payload: { status: 'ready', previewUrl: `/api/previews/${previewId}/` },
      at: Date.now(),
    });
  } catch (err) {
    const current = store.get(previewId);
    const message = (err as Error).message || 'Preview failed';
    if (current?.runtimeId === 'manifest' && current.runtimeHandle) {
      await stopManagedHandle(current.runtimeHandle).catch(() => {});
    } else if (current?.runtimeId) {
      const adapter = get(current.runtimeId);
      if (adapter) {
        await adapter.stop(current.workspacePath || '', current.runtimeHandle ?? undefined).catch(() => {});
      }
    }
    if (current?.cleanup) {
      await current.cleanup().catch(() => {});
    }
    store.patch(previewId, { status: 'failed', error: message, runtimeHandle: null });
    emit({
      previewId,
      type: 'error',
      payload: { status: 'failed', error: message },
      at: Date.now(),
    });
  }
}

/**
 * Get current session by previewId. Returns null if not found or not owned by sessionKey.
 */
export function getPreview(previewId: string, sessionKey: string): SandboxSession | null {
  const session = store.get(previewId);
  if (!session || session.sessionKey !== sessionKey) {return null;}
  store.touch(previewId);
  return session;
}

/**
 * Stop a preview and remove it from the store.
 */
export async function stopPreview(previewId: string, sessionKey: string): Promise<boolean> {
  const session = store.get(previewId);
  if (!session || session.sessionKey !== sessionKey) {return false;}
  store.patch(previewId, { status: 'stopping' });
  emitStatus(previewId, 'stopping');
  if (session.runtimeId === 'manifest' && session.runtimeHandle) {
    await stopManagedHandle(session.runtimeHandle).catch(() => {});
    await ensurePortFree(5173).catch(() => {});
    await ensurePortFree(4000).catch(() => {});
  } else if (session.runtimeId) {
    const adapter = get(session.runtimeId);
    if (adapter) {
      await adapter.stop(session.workspacePath || '', session.runtimeHandle ?? undefined).catch(() => {});
    }
  }
  if (session.cleanup) {
    await session.cleanup().catch(() => {});
  }
  store.remove(previewId);
  emit({ previewId, type: 'stopped', payload: {}, at: Date.now() });
  removeListenersForPreview(previewId);
  return true;
}

/**
 * Subscribe to events for a preview (or all if previewId null). Returns unsubscribe.
 */
export function streamPreviewEvents(
  sessionKey: string,
  previewId: string | null,
  onEvent: (event: PreviewEvent) => void
): () => void {
  const unsub = subscribe(previewId, (event) => {
    const session = store.get(event.previewId);
    if (session && session.sessionKey !== sessionKey) {return;}
    onEvent(event);
  });
  return unsub;
}

/**
 * Resolve previewId to proxy target. Caller must verify session ownership first.
 */
export function resolvePreviewTarget(previewId: string): ReturnType<typeof resolvePreviewRequest> {
  return resolvePreviewRequest(previewId);
}

/**
 * Get the active preview for a session (builder or project). Useful for UI to show current.
 */
export function getActivePreviewForSession(sessionKey: string): SandboxSession | null {
  const list = store.listBySession(sessionKey).sort((a, b) => b.startedAt - a.startedAt);
  const ready = list.filter((s) => s.status === 'ready');
  return ready[0] ?? list[0] ?? null;
}

/**
 * Stop all previews for a session (e.g. on logout).
 */
export async function stopAllForSession(sessionKey: string): Promise<void> {
  for (const session of store.listBySession(sessionKey)) {
    await stopPreview(session.previewId, sessionKey).catch(() => {});
  }
}

/**
 * Stop previews that have been idle longer than idleTimeoutMs.
 * Call periodically from the server (e.g. every 60s).
 */
export async function reapIdlePreviews(idleTimeoutMs: number): Promise<number> {
  const now = Date.now();
  const toStop = store.all().filter((s) => now - s.lastActivityAt >= idleTimeoutMs);
  for (const s of toStop) {
    await stopPreview(s.previewId, s.sessionKey).catch(() => {});
  }
  return toStop.length;
}
