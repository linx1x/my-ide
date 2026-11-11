/**
 * Simple event bus for preview lifecycle and log events.
 * Used by SandboxController to stream events to clients.
 */

import type { PreviewEvent } from './types.js';

type Listener = (event: PreviewEvent) => void;

const listenersByPreview = new Map<string, Set<Listener>>();
const globalListeners = new Set<Listener>();

export function subscribe(previewId: string | null, listener: Listener): () => void {
  if (previewId) {
    let set = listenersByPreview.get(previewId);
    if (!set) {
      set = new Set();
      listenersByPreview.set(previewId, set);
    }
    set.add(listener);
    return () => {
      if (set) {
        set.delete(listener);
        if (set.size === 0) {listenersByPreview.delete(previewId);}
      }
    };
  }
  globalListeners.add(listener);
  return () => {
    globalListeners.delete(listener);
  };
}

export function emit(event: PreviewEvent): void {
  const set = listenersByPreview.get(event.previewId);
  if (set) {
    set.forEach((fn) => {
      try {
        fn(event);
      } catch (e) {
        console.warn('[Sandbox] Event listener error:', (e as Error).message);
      }
    });
  }
  globalListeners.forEach((fn) => {
    try {
      fn(event);
    } catch (e) {
      console.warn('[Sandbox] Global listener error:', (e as Error).message);
    }
  });
}

export function removeListenersForPreview(previewId: string): void {
  listenersByPreview.delete(previewId);
}
