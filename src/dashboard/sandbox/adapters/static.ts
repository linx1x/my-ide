/**
 * Static runtime adapter backed by an in-process HTTP file server.
 */

import type { IRuntimeAdapter, AdapterInstallResult, AdapterLaunchResult } from '../runtime-adapter.js';
import type { PreviewSource, RuntimeDetectionResult } from '../types.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { resolveStaticRoot, startStaticPreview, stopManagedHandle } from '../../preview-runner.js';

export const staticAdapter: IRuntimeAdapter = {
  runtimeId: 'static',

  async detect(workspacePath: string, source: PreviewSource): Promise<RuntimeDetectionResult | null> {
    if (source.type === 'builder-files') {
      const hasHtml = source.files.some((f) => f.path.endsWith('.html'));
      const noPkg = !source.files.some((f) => f.path === 'package.json');
      if (hasHtml && noPkg) {return { runtimeId: 'static', suggestedMode: 'build' };}
    }
    if (resolveStaticRoot(workspacePath)) {
      return {
        runtimeId: 'static',
        suggestedMode: existsSync(join(workspacePath, 'index.html')) ? 'dev' : 'build',
      };
    }
    return null;
  },

  async install(
    _workspacePath: string,
    _source: PreviewSource,
    _options: { previewId: string; packageManager?: string | null; onLog?: (line: string) => void }
  ): Promise<AdapterInstallResult> {
    return { success: true };
  },

  async launch(
    workspacePath: string,
    _mode: 'dev' | 'build',
    options: {
      previewId: string;
      packageManager?: string | null;
      preferredPort?: number;
      onLog?: (line: string) => void;
    }
  ): Promise<AdapterLaunchResult> {
    const launch = await startStaticPreview({
      previewId: options.previewId,
      workspacePath,
      preferredPort: options.preferredPort ?? null,
    });
    options.onLog?.(`Serving static files from ${resolveStaticRoot(workspacePath)}`);
    return { success: true, internalPort: launch.port, handle: launch.handle };
  },

  async stop(_workspacePath: string, handle?: string): Promise<void> {
    await stopManagedHandle(handle);
  },

  async isReady(workspacePath: string, _internalPort?: number): Promise<boolean> {
    return !!resolveStaticRoot(workspacePath);
  },
};
