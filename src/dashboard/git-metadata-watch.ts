/**
 * Singleton fs.watch on .git metadata (HEAD, index, refs) with debounced broadcast
 * to SSE subscribers. One watcher set per process; ref-counted subscribers.
 */
import { existsSync, watch } from 'node:fs';
import { join } from 'node:path';
import type { FSWatcher } from 'node:fs';
import { isGitRepo } from '../core/git-utils.js';
import { logger } from '../logger.js';

const DEBOUNCE_MS = 300;

type NotifyFn = () => void;

const subscribers = new Set<NotifyFn>();
let watchers: FSWatcher[] = [];
let watchedRoot: string | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
function stopWatchers(): void {
  for (const w of watchers) {
    try {
      w.close();
    } catch {
      /* ignore */
    }
  }
  watchers = [];
  watchedRoot = null;
}

function flushNotify(): void {
  debounceTimer = null;
  for (const fn of subscribers) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
}

function scheduleNotify(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(flushNotify, DEBOUNCE_MS);
}

function startWatchers(root: string): void {
  const gitDir = join(root, '.git');
  if (!existsSync(gitDir)) {
    return;
  }

  const candidates: string[] = [
    join(gitDir, 'HEAD'),
    join(gitDir, 'index'),
    join(gitDir, 'refs', 'heads'),
    join(gitDir, 'refs', 'remotes'),
  ];

  for (const p of candidates) {
    if (!existsSync(p)) {
      continue;
    }
    try {
      const w = watch(p, { persistent: true }, () => scheduleNotify());
      w.on('error', (err) => {
        logger.warn({ err: String(err), path: p }, 'git-metadata-watch: watcher error');
      });
      watchers.push(w);
    } catch (err) {
      logger.warn({ err: String(err), path: p }, 'git-metadata-watch: failed to watch');
    }
  }

  watchedRoot = root;
}

/** Ensure watchers match getRoot(); no-op if not a git repo. */
function syncGitMetadataWatcher(getRoot: () => string): void {
  const root = getRoot();
  if (!isGitRepo(root)) {
    stopWatchers();
    return;
  }
  if (watchedRoot === root && watchers.length > 0) {
    return;
  }
  stopWatchers();
  startWatchers(root);
}

/**
 * Register for debounced notifications when .git metadata changes.
 * @returns unsubscribe
 */
export function subscribeGitMetadataChanges(
  getRoot: () => string,
  onChange: NotifyFn,
): () => void {
  subscribers.add(onChange);
  syncGitMetadataWatcher(getRoot);

  return () => {
    subscribers.delete(onChange);
    if (subscribers.size === 0) {
      stopWatchers();
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
    }
  };
}
