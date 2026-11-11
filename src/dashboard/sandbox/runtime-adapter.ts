/**
 * Runtime adapter interface for multi-runtime sandbox execution.
 * Each adapter handles install, launch, readiness, and optional build for one runtime family.
 */

import type { PreviewSource, PreviewMode, RuntimeDetectionResult } from './types.js';

export interface AdapterInstallResult {
  success: boolean;
  error?: string;
  /** Path to cache key for content-addressed cache (optional). */
  cacheKey?: string;
  /** Optional adapter-owned handle while install is running. */
  handle?: string;
}

export interface AdapterLaunchResult {
  success: boolean;
  internalPort?: number;
  error?: string;
  /** Optional PID or container id for teardown. */
  handle?: string;
}

export interface IRuntimeAdapter {
  readonly runtimeId: string;

  /**
   * Detect runtime from workspace (e.g. package.json, requirements.txt).
   * Return null if this adapter does not apply.
   */
  detect(workspacePath: string, source: PreviewSource): Promise<RuntimeDetectionResult | null>;

  /**
   * Install dependencies in the workspace.
   */
  install(
    workspacePath: string,
    source: PreviewSource,
    options: {
      previewId: string;
      packageManager?: string | null;
      onLog?: (line: string) => void;
    }
  ): Promise<AdapterInstallResult>;

  /**
   * Launch the dev server or build-and-serve. Adapter chooses command and port.
   */
  launch(
    workspacePath: string,
    mode: PreviewMode,
    options: {
      previewId: string;
      packageManager?: string | null;
      preferredPort?: number;
      onLog?: (line: string) => void;
    }
  ): Promise<AdapterLaunchResult>;

  /**
   * Stop the running process (e.g. kill by handle or port).
   */
  stop(workspacePath: string, handle?: string): Promise<void>;

  /**
   * Check if the app is ready (e.g. port responding, or build output exists).
   */
  isReady(workspacePath: string, internalPort?: number): Promise<boolean>;
}
