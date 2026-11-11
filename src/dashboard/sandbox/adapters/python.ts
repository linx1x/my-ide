/**
 * Python runtime adapter with host-side best-effort launch support.
 */

import type { IRuntimeAdapter, AdapterInstallResult, AdapterLaunchResult } from '../runtime-adapter.js';
import type { PreviewSource, RuntimeDetectionResult } from '../types.js';
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import {
  findFreePreviewPort,
  getHandleOutput,
  getPythonDepsPath,
  resolvePythonCommand,
  runManagedCommand,
  startManagedProcess,
  stopManagedHandle,
  waitForPortReady,
} from '../../preview-runner.js';

function readText(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

function findPythonEntry(workspacePath: string): { type: 'streamlit' | 'fastapi' | 'flask' | 'django' | 'script'; file: string; module?: string } | null {
  const candidates = ['streamlit_app.py', 'app.py', 'main.py', 'server.py', 'manage.py'];
  for (const filename of candidates) {
    const fullPath = join(workspacePath, filename);
    if (!existsSync(fullPath)) {continue;}
    const content = readText(fullPath);
    if (/import\s+streamlit|from\s+streamlit\s+import/i.test(content)) {
      return { type: 'streamlit', file: filename };
    }
    if (/FastAPI\s*\(/.test(content) && /\bapp\s*=\s*FastAPI/.test(content)) {
      return { type: 'fastapi', file: filename, module: basename(filename, '.py') };
    }
    if (/Flask\s*\(/.test(content) && /\bapp\s*=\s*Flask/.test(content)) {
      return { type: 'flask', file: filename };
    }
    if (filename === 'manage.py') {
      return { type: 'django', file: filename };
    }
    return { type: 'script', file: filename };
  }
  return null;
}

function buildPythonEnv(workspacePath: string, port: number): Record<string, string | undefined> {
  const depsPath = getPythonDepsPath(workspacePath);
  const currentPythonPath = process.env.PYTHONPATH || '';
  return {
    ...process.env,
    PORT: String(port),
    HOST: '127.0.0.1',
    PYTHONPATH: existsSync(depsPath)
      ? [depsPath, currentPythonPath].filter(Boolean).join(process.platform === 'win32' ? ';' : ':')
      : currentPythonPath || undefined,
  };
}

export const pythonAdapter: IRuntimeAdapter = {
  runtimeId: 'python',

  async detect(workspacePath: string, source: PreviewSource): Promise<RuntimeDetectionResult | null> {
    if (source.type === 'builder-files') {
      const hasPy = source.files.some((f) => f.path.endsWith('.py'));
      const hasReq = source.files.some((f) => f.path === 'requirements.txt' || f.path === 'pyproject.toml');
      if (hasPy || hasReq) {return { runtimeId: 'python', suggestedMode: 'dev' };}
      return null;
    }
    const path = await import('node:path');
    const fs = await import('node:fs');
    if (
      fs.existsSync(path.join(workspacePath, 'requirements.txt')) ||
      fs.existsSync(path.join(workspacePath, 'pyproject.toml'))
    ) {
      return { runtimeId: 'python', suggestedMode: 'dev' };
    }
    return null;
  },

  async install(
    workspacePath: string,
    _source: PreviewSource,
    options: { previewId: string; packageManager?: string | null; onLog?: (line: string) => void }
  ): Promise<AdapterInstallResult> {
    const requirementsPath = join(workspacePath, 'requirements.txt');
    if (!existsSync(requirementsPath)) {
      return { success: true };
    }
    const depsPath = getPythonDepsPath(workspacePath);
    await runManagedCommand({
      previewId: options.previewId,
      cwd: workspacePath,
      command: resolvePythonCommand(),
      args: ['-m', 'pip', 'install', '--target', depsPath, '-r', requirementsPath],
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
    const entry = findPythonEntry(workspacePath);
    if (!entry) {
      return { success: false, error: 'No supported Python preview entrypoint found' };
    }
    const port = await findFreePreviewPort(options.preferredPort ?? null);
    const env = buildPythonEnv(workspacePath, port);
    let args: string[];
    if (entry.type === 'streamlit') {
      args = [
        '-m',
        'streamlit',
        'run',
        entry.file,
        '--server.port',
        String(port),
        '--server.address',
        '127.0.0.1',
        '--server.headless',
        'true',
        '--browser.gatherUsageStats',
        'false',
      ];
    } else if (entry.type === 'fastapi') {
      args = ['-m', 'uvicorn', `${entry.module}:app`, '--host', '127.0.0.1', '--port', String(port)];
    } else if (entry.type === 'flask') {
      env.FLASK_APP = entry.file;
      args = ['-m', 'flask', 'run', '--host', '127.0.0.1', '--port', String(port)];
    } else if (entry.type === 'django') {
      args = [entry.file, 'runserver', `127.0.0.1:${port}`];
    } else {
      args = [entry.file];
    }
    const launch = startManagedProcess({
      previewId: options.previewId,
      cwd: workspacePath,
      command: resolvePythonCommand(),
      args,
      env,
      ...(options.onLog ? { onLog: options.onLog } : {}),
      port,
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
      return true;
    } catch {
      return false;
    }
  },
};
