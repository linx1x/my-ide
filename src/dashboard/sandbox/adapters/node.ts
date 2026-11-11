/**
 * Node runtime adapter backed by host-side package manager and dev server processes.
 */

import type { IRuntimeAdapter, AdapterInstallResult, AdapterLaunchResult } from '../runtime-adapter.js';
import type { PreviewSource, RuntimeDetectionResult } from '../types.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  findFreePreviewPort,
  ensurePortFree,
  getNodeInstallSpec,
  getNodePreviewCommand,
  getHandleOutput,
  readPackageJson,
  resolvePackageManager,
  runManagedCommand,
  startManagedProcess,
  stopManagedHandle,
  waitForPortReady,
  waitForHttpReady,
} from '../../preview-runner.js';
import config from '../../../config.js';

function detectFramework(pkg: Record<string, unknown> | null): string | undefined {
  if (!pkg) {return undefined;}
  const deps = {
    ...(pkg.dependencies as Record<string, string> | undefined),
    ...(pkg.devDependencies as Record<string, string> | undefined),
  };
  if (deps.next) {return 'next';}
  if (deps.vite) {return 'vite';}
  if (deps.react) {return 'react';}
  if (deps.vue) {return 'vue';}
  if (deps.svelte) {return 'svelte';}
  return undefined;
}

export const nodeAdapter: IRuntimeAdapter = {
  runtimeId: 'node',

  async detect(workspacePath: string, source: PreviewSource): Promise<RuntimeDetectionResult | null> {
    if (source.type === 'builder-files') {
      const hasPkg = source.files.some((f) => f.path === 'package.json');
      if (hasPkg) {
        const packageManager = source.packageManager ?? null;
        const result: RuntimeDetectionResult = { runtimeId: 'node', suggestedMode: 'dev' };
        if (packageManager) {result.packageManager = packageManager;}
        return result;
      }
      return null;
    }
    const pkgPath = join(workspacePath, 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = readPackageJson(workspacePath);
      const result: RuntimeDetectionResult = {
        runtimeId: 'node',
        suggestedMode: 'dev',
        packageManager: resolvePackageManager(workspacePath, null),
      };
      const framework = detectFramework(pkg);
      if (framework) {result.framework = framework;}
      return result;
    }
    return null;
  },

  async install(
    workspacePath: string,
    source: PreviewSource,
    options: { previewId: string; packageManager?: string | null; onLog?: (line: string) => void }
  ): Promise<AdapterInstallResult> {
    const pkgPath = join(workspacePath, 'package.json');
    if (!existsSync(pkgPath)) {
      return { success: false, error: 'package.json required for Node preview' };
    }
    const shouldInstall =
      source.type === 'builder-files' ||
      !existsSync(join(workspacePath, 'node_modules'));
    if (!shouldInstall) {return { success: true };}
    const spec = getNodeInstallSpec(workspacePath, options.packageManager);
    await runManagedCommand({
      previewId: options.previewId,
      cwd: workspacePath,
      command: spec.command,
      args: spec.args,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        npm_config_production: 'false',
        NPM_CONFIG_PRODUCTION: 'false',
      },
      ...(options.onLog ? { onLog: options.onLog } : {}),
    });
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
    const port = await findFreePreviewPort(options.preferredPort ?? null);
    const preferredPort = config.previewPortMin ?? 5173;
    if (port === preferredPort) {
      await ensurePortFree(port).catch(() => {});
    }
    const spec = getNodePreviewCommand(workspacePath, port, options.packageManager);
    const launch = startManagedProcess({
      previewId: options.previewId,
      cwd: workspacePath,
      command: spec.command,
      args: spec.args,
      env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' },
      ...(options.onLog ? { onLog: options.onLog } : {}),
    });
    try {
      await waitForPortReady(port, {
        timeoutMs: 90000,
        getFailureOutput: () => getHandleOutput(launch.handle),
        isStopped: () => launch.child.exitCode !== null,
      });
      return { success: true, internalPort: port, handle: launch.handle };
    } catch (err) {
      await stopManagedHandle(launch.handle);
      throw err;
    }
  },

  async stop(_workspacePath: string, handle?: string): Promise<void> {
    await stopManagedHandle(handle);
  },

  async isReady(_workspacePath: string, internalPort?: number): Promise<boolean> {
    if (!internalPort) {return false;}
    try {
      await waitForPortReady(internalPort, { timeoutMs: 1500 });
      // Wait until GET / returns 200 so first iframe load gets a valid page (avoids Next/Vite 500 on cold compile)
      await waitForHttpReady(internalPort, { timeoutMs: 90000, intervalMs: 2000 });
      return true;
    } catch {
      return false;
    }
  },
};
