/**
 * Host-side preview runtime utilities shared by sandbox adapters.
 * This replaces the old session-slot preview runner with previewId-owned handles.
 */
import { exec, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer as createNetServer, createConnection } from 'node:net';
import { createServer as createHttpServer } from 'node:http';
import {
  createReadStream,
  existsSync,
  cpSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  rm,
  rmSync,
  statSync,
} from 'node:fs';
import {
  extname,
  join,
  normalize,
  resolve,
} from 'node:path';
import { randomUUID } from 'node:crypto';
import config from '../config.js';

const IS_WIN = process.platform === 'win32';
const BRIDGE_DATA = config.bridgeDataDir
  ? resolve(config.bridgeDataDir)
  : resolve(process.cwd(), 'bridge-data');
const PREVIEW_ROOT = config.previewTempDir
  ? resolve(config.previewTempDir)
  : join(BRIDGE_DATA, 'preview');
const PORT_MIN = Math.max(3000, config.previewPortMin ?? 5173);
const PORT_MAX = Math.min(65535, config.previewPortMax ?? 5199);
const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.mjs', 'application/javascript; charset=utf-8'],
  ['.cjs', 'application/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

type ManagedProcess = ReturnType<typeof spawn> & { lastOutput?: string };

interface ProcessHandleState {
  kind: 'process';
  previewId: string;
  child: ManagedProcess;
  cwd: string;
  port: number | null;
  startedAt: number;
  lastOutput: string;
}

interface StaticHandleState {
  kind: 'static';
  previewId: string;
  server: ReturnType<typeof createHttpServer>;
  rootPath: string;
  port: number;
  startedAt: number;
}

interface CompositeHandleState {
  kind: 'composite';
  previewId: string;
  childHandles: string[];
  startedAt: number;
}

type HandleState = ProcessHandleState | StaticHandleState | CompositeHandleState;

const handles = new Map<string, HandleState>();
const pendingRemoval = new Set<string>();
let nextPort = PORT_MIN;

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

/**
 * True when path exists and is a real directory (not a symlink). Symlinks can fail
 * at runtime (e.g. Vite in node_modules/.vite-temp cannot resolve 'vite' on Windows).
 */
function packageDirIsReal(nm: string, pkgName: string): boolean {
  const pkgPath = join(nm, pkgName);
  try {
    return existsSync(join(pkgPath, 'package.json')) && !lstatSync(pkgPath).isSymbolicLink();
  } catch {
    return false;
  }
}

/**
 * True when node_modules exists and contains the package required by the dev command
 * as a real directory (not a symlink). On Windows, copied or linked node_modules can
 * fail at runtime with MODULE_NOT_FOUND; we only skip install when the key package
 * is present and not a symlink. When devCmd is generic (e.g. "npm run dev"), we infer
 * from package.json scripts.
 */
function nodeModulesHasRequiredPackage(cwd: string, devCmd: string): boolean {
  const nm = join(cwd, 'node_modules');
  if (!existsSync(nm)) {return false;}
  let needsVite = /\bvite\b/.test(devCmd.trim());
  let needsNext = /\bnext\b/.test(devCmd.trim());
  if (!needsVite && !needsNext) {
    const pkg = readPackageJson(cwd);
  const devScript = typeof (pkg as any)?.scripts?.dev === 'string' ? (pkg as any).scripts.dev : '';
    if (/\bvite\b/.test(devScript)) {needsVite = true;}
    if (/\bnext\b/.test(devScript)) {needsNext = true;}
  }
  if (needsVite && !packageDirIsReal(nm, 'vite')) {return false;}
  if (needsNext && !packageDirIsReal(nm, 'next')) {return false;}
  return true;
}

/**
 * On Windows, npm may install vite/next as a symlink or junction, which can cause
 * ERR_MODULE_NOT_FOUND when Vite's compiled config in node_modules/.vite-temp
 * tries to import 'vite'. Replace symlinked package dirs with real copies.
 * When devCmd is generic (e.g. "npm run dev"), infers from package.json scripts.
 */
function materializeSymlinkedPackages(cwd: string, devCmd: string): void {
  const nm = join(cwd, 'node_modules');
  if (!existsSync(nm)) {return;}
  let needsVite = /\bvite\b/.test(devCmd);
  let needsNext = /\bnext\b/.test(devCmd);
  if (!needsVite && !needsNext) {
    const pkg = readPackageJson(cwd);
    const devScript = typeof (pkg as any)?.scripts?.dev === 'string' ? (pkg as any).scripts.dev : '';
    if (/\bvite\b/.test(devScript)) {needsVite = true;}
    if (/\bnext\b/.test(devScript)) {needsNext = true;}
  }
  const toCheck: string[] = [];
  if (needsVite) {toCheck.push('vite');}
  if (needsNext) {toCheck.push('next');}
  for (const pkgName of toCheck) {
    const pkgPath = join(nm, pkgName);
    try {
      if (!existsSync(pkgPath) || !lstatSync(pkgPath).isSymbolicLink()) {continue;}
    } catch {
      continue;
    }
    const tmpDir = join(nm, `.${pkgName}-materialize-tmp`);
    try {
      mkdirSync(tmpDir, { recursive: true });
      cpSync(pkgPath, join(tmpDir, pkgName), { recursive: true, dereference: true });
      rmSync(pkgPath, { recursive: true, force: true });
      cpSync(join(tmpDir, pkgName), pkgPath, { recursive: true });
    } finally {
      try {
        rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
    }
  }
}

function ensurePreviewRoot(): string {
  if (!existsSync(PREVIEW_ROOT)) {mkdirSync(PREVIEW_ROOT, { recursive: true });}
  return PREVIEW_ROOT;
}

export function getPreviewRoot(): string {
  return ensurePreviewRoot();
}

/** Root for overlay session dirs: bridge-data/sessions/<previewId>/{upper,work,merged}. */
export function getSessionsRoot(): string {
  const root = join(BRIDGE_DATA, 'sessions');
  if (!existsSync(root)) {mkdirSync(root, { recursive: true });}
  return root;
}

/** True if path is inside the preview temp dir (materialized builder workspace). */
export function isUnderPreviewRoot(workspacePath: string): boolean {
  const root = normalize(resolve(getPreviewRoot())) + (process.platform === 'win32' ? '\\' : '/');
  const path = normalize(resolve(workspacePath)) + (process.platform === 'win32' ? '\\' : '/');
  return path.startsWith(root);
}

export function getPythonDepsPath(workspacePath: string): string {
  return join(workspacePath, '.preview-python-site');
}

/** Commands that on Windows must run via shell (they are .cmd batch scripts). */
const WIN_SHELL_COMMANDS = new Set([
  'npm',
  'npx',
  'pnpm',
  'yarn',
  'bun',
  'deno',
  'npm.cmd',
  'npx.cmd',
  'pnpm.cmd',
  'yarn.cmd',
  'bun.cmd',
  'deno.cmd',
]);

function needsShellOnWindows(command: string): boolean {
  if (!IS_WIN) {return false;}
  const base = command.includes('\\')
    ? (command.split('\\').pop() ?? command)
    : command.split('/').pop() || command;
  return WIN_SHELL_COMMANDS.has(base);
}

function normalizeCommand(command: string): string {
  if (!IS_WIN) {return command;}
  if (command.includes('/') || command.includes('\\')) {return command;}
  const mapped = {
    npm: 'npm.cmd',
    npx: 'npx.cmd',
    pnpm: 'pnpm.cmd',
    yarn: 'yarn.cmd',
    bun: 'bun.cmd',
    deno: 'deno.cmd',
  } as Record<string, string>;
  return mapped[command] || command;
}

async function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolvePort) => {
    const server = createNetServer();
    server.unref();
    server.once('error', () => resolvePort(false));
    server.listen(port, '127.0.0.1', () => {
      server.close(() => resolvePort(true));
    });
  });
}

export async function findFreePreviewPort(
  preferredPort?: number | null,
  reservedPorts?: Set<number>,
): Promise<number> {
  const inUse = new Set<number>(reservedPorts);
  for (const state of handles.values()) {
    const maybePort = (state as any).port;
    if (maybePort !== null && maybePort !== undefined) {inUse.add(maybePort);}
  }
  const candidates =
    preferredPort !== null && preferredPort !== undefined
      ? [
        preferredPort,
        ...Array.from(
          { length: PORT_MAX - PORT_MIN + 1 },
          (_, idx) => PORT_MIN + idx,
        ),
      ]
      : Array.from(
        { length: PORT_MAX - PORT_MIN + 1 },
        (_, idx) =>
          PORT_MIN +
            ((nextPort - PORT_MIN + idx) % (PORT_MAX - PORT_MIN + 1)),
      );
  for (const port of candidates) {
    if (port < PORT_MIN || port > PORT_MAX) {continue;}
    if (inUse.has(port)) {continue;}
    if (await isPortFree(port)) {
      nextPort = port + 1;
      if (nextPort > PORT_MAX) {nextPort = PORT_MIN;}
      return port;
    }
  }
  throw new Error(
    `No free preview port available in range ${PORT_MIN}-${PORT_MAX}`,
  );
}

const execAsync = promisify(exec);

/**
 * True if any token looks like a local address bound to targetPort (IPv4 0.0.0.0:port, IPv6 [::]:port or :::port).
 */
function lineHasPort(parts: string[], targetPortStr: string): boolean {
  return parts.some(
    (p) =>
      p.endsWith(':' + targetPortStr) || p.includes(']:' + targetPortStr),
  );
}

/**
 * If something is listening on the port, kill that process so the port is free.
 * Used before starting preview so static ports (e.g. 5173, 4000) are available.
 * Only one preview runs at a time, so flushing is safe.
 * On Windows, parses netstat so only processes on the exact port are killed (IPv4 and IPv6).
 */
export async function ensurePortFree(port: number): Promise<void> {
  const free = await isPortFree(port);
  if (free) {return;}
  let pids: number[];
  if (IS_WIN) {
    try {
      const { stdout } = await execAsync('netstat -ano | findstr LISTENING', {
        encoding: 'utf8',
        timeout: 5000,
      });
      const targetPortStr = String(port);
      pids = [...new Set(
        stdout.split(/\r?\n/).map((line) => {
          const parts = line.trim().split(/\s+/).filter(Boolean);
          if (parts.length < 2) {return 0;}
          const pid = parseInt(parts[parts.length - 1] ?? '0', 10);
          if (Number.isNaN(pid) || pid <= 0) {return 0;}
          if (!lineHasPort(parts, targetPortStr)) {return 0;}
          return pid;
        }).filter((pid) => pid > 0),
      )];
    } catch (err) {
      console.warn(
        `[Preview] Could not list processes on port ${port}; port may still be in use.`,
        (err as Error).message,
      );
      throw new Error(
        `Port ${port} is in use. Could not list processes to free it. Close the other app or stop the previous preview, then try again.`,
      );
    }
  } else {
    try {
      const { stdout } = await execAsync(`lsof -ti :${port}`, {
        encoding: 'utf8',
        timeout: 5000,
      });
      pids = stdout
        .split(/\r?\n/)
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !Number.isNaN(n) && n > 0);
    } catch (err) {
      console.warn(
        `[Preview] Could not list processes on port ${port}; port may still be in use.`,
        (err as Error).message,
      );
      throw new Error(
        `Port ${port} is in use. Could not list processes to free it. Close the other app or stop the previous preview, then try again.`,
      );
    }
  }
  for (const pid of pids) {
    try {
      if (IS_WIN) {
        await execAsync(`taskkill /PID ${pid} /F`, { timeout: 3000 });
      } else {
        await execAsync(`kill ${pid}`, { timeout: 3000 });
      }
    } catch {
      // Ignore if process already exited
    }
  }
  await sleep(IS_WIN ? 800 : 500);

  const nowFree = await isPortFree(port);
  if (!nowFree) {
    throw new Error(
      `Port ${port} is still in use after attempting to free it. Close the other app or stop the previous preview, then try again.`,
    );
  }
}

function tryConnect(host: string, port: number): Promise<void> {
  return new Promise((resolveConn, rejectConn) => {
    const socket = createConnection({ host, port });
    socket.once('connect', () => {
      socket.destroy();
      resolveConn();
    });
    socket.once('error', rejectConn);
    socket.setTimeout(2000, () => {
      socket.destroy();
      rejectConn(new Error('timeout'));
    });
  });
}

export async function waitForPortReady(
  port: number,
  options: {
    timeoutMs?: number;
    getFailureOutput?: () => string;
    isStopped?: () => boolean;
  } = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? config.previewReadyTimeoutMs;
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (options.isStopped?.()) {
      const detail = options.getFailureOutput?.()?.trim();
      const msg = detail
        ? `Preview process exited before it became ready. Output: ${detail.slice(0, 800)}${detail.length > 800 ? '…' : ''}`
        : 'Preview process exited before it became ready.';
      throw new Error(msg);
    }
    try {
      await Promise.any([
        tryConnect('127.0.0.1', port),
        tryConnect('::1', port),
      ]);
      return;
    } catch {
      await sleep(300);
    }
  }
  const detail = options.getFailureOutput?.()?.trim();
  if (detail) {
    const looksLikeStreamOrJson =
      /"tag"\s*:\s*"|"attrs"\s*:|stream:error/i.test(detail);
    const timeoutSec = Math.round(timeoutMs / 1000);
    const snippet = detail.slice(0, looksLikeStreamOrJson ? 200 : 500);
    const suffix = detail.length > snippet.length ? '…' : '';
    const hint = looksLikeStreamOrJson
      ? ' (output looks like stream/JSON — was the correct project path used?)'
      : '';
    const msg = `Preview did not start on port ${port} within ${timeoutSec}s. Output: ${snippet}${suffix}${hint}`;
    throw new Error(msg);
  }
  throw new Error(
    `Preview did not start listening on port ${port} within ${Math.round(timeoutMs / 1000)}s`,
  );
}

/** Wait until GET path returns 200 (or 304). Used so we only mark preview ready when the dev server actually serves the page, not just listens. */
export async function waitForHttpReady(
  port: number,
  options: {
    timeoutMs?: number;
    intervalMs?: number;
    host?: string;
    path?: string;
  } = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 120000;
  const intervalMs = options.intervalMs ?? 2000;
  const host = options.host ?? '127.0.0.1';
  const path = options.path ?? '/';
  const pathWithLeading = path.startsWith('/') ? path : `/${path}`;
  const url = `http://${host}:${port}${pathWithLeading}`;
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const res = await fetch(url, {
        headers: { Host: `${host}:${port}` },
        signal: AbortSignal.timeout(5000),
      });
      if (res.status === 200 || res.status === 304) {return;}
    } catch {
      // retry
    }
    await sleep(intervalMs);
  }
  throw new Error(
    `Preview at ${url} did not respond with 200 within ${Math.round(timeoutMs / 1000)}s`,
  );
}

function waitForChildClose(
  child: ManagedProcess,
  timeoutMs = 8000,
): Promise<void> {
  return new Promise((resolveClose) => {
    let settled = false;
    const finish = () => {
      if (settled) {return;}
      settled = true;
      resolveClose();
    };
    child.once('close', finish);
    if (child.exitCode !== null && child.exitCode !== undefined) {finish();}
    setTimeout(finish, timeoutMs);
  });
}

async function terminateChildTree(child: ManagedProcess): Promise<void> {
  const pid = child.pid;
  if (!pid) {return;}
  if (IS_WIN) {
    await new Promise((resolveKill) => {
      const killer = spawn('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
        shell: false,
        windowsHide: true,
        stdio: 'ignore',
      });
      killer.on('close', () => resolveKill(undefined));
      killer.on('error', () => resolveKill(undefined));
    });
    await waitForChildClose(child, 8000);
    return;
  }
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    try {
      child.kill('SIGTERM');
    } catch {}
  }
  await waitForChildClose(child, 3000);
  if (child.exitCode === null || child.exitCode === undefined) {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      try {
        child.kill('SIGKILL');
      } catch {}
    }
    await waitForChildClose(child, 3000);
  }
}

/**
 * Remove directory with retry. Two-layer retry: fs.rm(..., maxRetries: 3) handles
 * transient locks; on failure we retry the whole rm (outer loop) after a delay,
 * more times on Windows (8) to handle locked files from dev servers. Failed
 * paths are added to pendingRemoval; call drainPendingRemovals() before new
 * previews or on a timer to retry cleanup.
 */
export async function removeDirWithRetry(
  path: string,
  retries = 0,
): Promise<void> {
  if (!path || !existsSync(path)) {return;}
  const maxRetries = IS_WIN ? 8 : 3;
  const delayMs = IS_WIN ? 1200 : 250;
  const result = await new Promise<Error | null>((resolveRm) => {
    rm(path, { recursive: true, force: true, maxRetries: 3 }, (err) =>
      resolveRm(err ?? null),
    );
  });
  if (result && retries < maxRetries) {
    await sleep(delayMs);
    return removeDirWithRetry(path, retries + 1);
  }
  if (result) {
    pendingRemoval.add(path);
    throw result;
  }
  pendingRemoval.delete(path);
}

export async function drainPendingRemovals(): Promise<void> {
  for (const path of [...pendingRemoval]) {
    if (!existsSync(path)) {
      pendingRemoval.delete(path);
      continue;
    }
    try {
      await removeDirWithRetry(path);
    } catch {}
  }
}

function appendOutput(
  target: { lastOutput: string },
  chunk: string,
  onLog?: (line: string) => void,
): void {
  const text = String(chunk || '');
  if (!text) {return;}
  target.lastOutput = [target.lastOutput, text]
    .filter(Boolean)
    .join('')
    .slice(-4000);
  const trimmed = text.trim();
  if (trimmed) {onLog?.(trimmed);}
}

export function readPackageScript(
  workspacePath: string,
  scriptName: string,
): string | null {
  const pkgPath = join(workspacePath, 'package.json');
  if (!existsSync(pkgPath)) {return null;}
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    const scripts = pkg.scripts || {};
    return typeof scripts[scriptName] === 'string' ? scripts[scriptName] : null;
  } catch {
    return null;
  }
}

export function readPackageJson(
  workspacePath: string,
): Record<string, unknown> | null {
  const pkgPath = join(workspacePath, 'package.json');
  if (!existsSync(pkgPath)) {return null;}
  try {
    return JSON.parse(readFileSync(pkgPath, 'utf8'));
  } catch {
    return null;
  }
}

export function resolvePackageManager(
  workspacePath: string,
  preferred?: string | null,
): string {
  const value = (preferred || '').toLowerCase();
  if (value === 'pnpm' || value === 'yarn' || value === 'npm') {return value;}
  if (existsSync(join(workspacePath, 'pnpm-lock.yaml'))) {return 'pnpm';}
  if (existsSync(join(workspacePath, 'yarn.lock'))) {return 'yarn';}
  const pkg = readPackageJson(workspacePath);
  const pkgMgr =
    typeof pkg?.packageManager === 'string'
      ? String(pkg.packageManager).split('@')[0]
      : '';
  if (pkgMgr === 'pnpm' || pkgMgr === 'yarn' || pkgMgr === 'npm') {return pkgMgr;}
  return 'npm';
}

export function getNodeInstallSpec(
  workspacePath: string,
  packageManager?: string | null,
): { command: string; args: string[] } {
  const pm = resolvePackageManager(workspacePath, packageManager);
  if (pm === 'pnpm')
  {return { command: 'pnpm', args: ['install', '--prod', 'false'] };}
  if (pm === 'yarn') {return { command: 'yarn', args: ['install'] };}
  return { command: 'npm', args: ['install', '--include=dev', '--legacy-peer-deps'] };
}

function normalizeInstallCommand(
  cwd: string,
  installCmd?: string | null,
): { command: string; args: string[] } | null {
  const trimmed = (installCmd ?? '').trim();
  if (!trimmed) {return null;}
  const parts = trimmed.split(/\s+/);
  const command = parts[0];
  let args = parts.slice(1);
  if (command === 'npm' || command === 'npm.cmd') {
    const spec = getNodeInstallSpec(cwd, 'npm');
    return { command: spec.command, args: spec.args };
  }
  if (command === 'pnpm' || command === 'pnpm.cmd') {
    const spec = getNodeInstallSpec(cwd, 'pnpm');
    return { command: spec.command, args: spec.args };
  }
  if (command === 'yarn' || command === 'yarn.cmd') {
    const spec = getNodeInstallSpec(cwd, 'yarn');
    return { command: spec.command, args: spec.args };
  }
  if (command === 'bun' || command === 'bun.cmd') {
    if (!args.length) {args = ['install'];}
    return { command, args };
  }
  if (command === 'deno' || command === 'deno.cmd') {
    if (!args.length) {return null;}
    return { command, args };
  }
  return { command: command ?? '', args };
}

function createInstallEnv(env?: Record<string, string>): Record<string, string | undefined> {
  return {
    ...process.env,
    ...env,
    NODE_ENV: 'development',
    npm_config_production: 'false',
    NPM_CONFIG_PRODUCTION: 'false',
  };
}

export function getNodePreviewCommand(
  workspacePath: string,
  port: number,
  packageManager?: string | null,
): { command: string; args: string[] } {
  const devScript =
    readPackageScript(workspacePath, 'dev') ||
    readPackageScript(workspacePath, 'start') ||
    '';
  const trimmed = devScript.trim();
  const pm = resolvePackageManager(workspacePath, packageManager);
  if (!trimmed) {
    throw new Error('No dev/start script found in package.json');
  }
  if (trimmed.includes('next')) {
    return pm === 'npm'
      ? {
        command: 'npm',
        args: [
          'run',
          'dev',
          '--',
          '-p',
          String(port),
          '--hostname',
          '127.0.0.1',
        ],
      }
      : {
        command: pm,
        args: [
          'run',
          'dev',
          '--',
          '-p',
          String(port),
          '--hostname',
          '127.0.0.1',
        ],
      };
  }
  return {
    command: pm,
    args: [
      'run',
      'dev',
      '--',
      '--port',
      String(port),
      '--strictPort',
      '--host',
      '127.0.0.1',
    ],
  };
}

export function resolvePythonCommand(): string {
  return IS_WIN ? 'py' : 'python3';
}

export function startManagedProcess(options: {
  previewId: string;
  cwd: string;
  command: string;
  args: string[];
  env?: Record<string, string | undefined>;
  port?: number | null;
  onLog?: (line: string) => void;
}): { handle: string; child: ManagedProcess } {
  const handle = `proc_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const state: ProcessHandleState = {
    kind: 'process',
    previewId: options.previewId,
    child: null as unknown as ManagedProcess,
    cwd: options.cwd,
    port: options.port ?? null,
    startedAt: Date.now(),
    lastOutput: '',
  };
  const useShell = needsShellOnWindows(options.command);
  const cmd = useShell ? options.command : normalizeCommand(options.command);
  const child = spawn(cmd, options.args, {
    cwd: options.cwd,
    env: options.env,
    shell: useShell,
    windowsHide: true,
    detached: !IS_WIN && !useShell,
    stdio: ['ignore', 'pipe', 'pipe'],
  }) as ManagedProcess;
  state.child = child;
  handles.set(handle, state);
  child.stdout?.setEncoding('utf8');
  child.stderr?.setEncoding('utf8');
  child.stdout?.on('data', (chunk) =>
    appendOutput(state, chunk, options.onLog),
  );
  child.stderr?.on('data', (chunk) =>
    appendOutput(state, chunk, options.onLog),
  );
  child.on('close', () => {
    // Defer delete so runManagedCommand's close handler can read lastOutput before cleanup
    setImmediate(() => {
      if (handles.get(handle) === state) {handles.delete(handle);}
    });
  });
  return { handle, child };
}

export async function runManagedCommand(options: {
  previewId: string;
  cwd: string;
  command: string;
  args: string[];
  env?: Record<string, string | undefined>;
  onLog?: (line: string) => void;
}): Promise<void> {
  const { handle, child } = startManagedProcess(options);
  await new Promise<void>((resolveRun, rejectRun) => {
    child.on('error', rejectRun);
    child.on('close', (code) => {
      if (code === 0) {
        resolveRun();
        return;
      }
      const output = getHandleOutput(handle);
      const summary = output.trim()
        ? `${options.command} exited with code ${code}\n\n${output.trim().slice(-3000)}`
        : `${options.command} exited with code ${code}`;
      rejectRun(new Error(summary));
    });
  }).finally(() => {
    handles.delete(handle);
  });
}

export function getHandleOutput(handle?: string | null): string {
  if (!handle) {return '';}
  const state = handles.get(handle);
  if (!state || state.kind !== 'process') {return '';}
  return state.lastOutput || '';
}

export async function launchProcessPreview(options: {
  previewId: string;
  cwd: string;
  command: string;
  args: string[];
  env?: Record<string, string | undefined>;
  preferredPort?: number | null;
  timeoutMs?: number;
  onLog?: (line: string) => void;
}): Promise<{ handle: string; port: number }> {
  await drainPendingRemovals();
  const port = await findFreePreviewPort(options.preferredPort ?? null);
  const env = {
    ...process.env,
    ...options.env,
    PORT: String(port),
    HOST: '127.0.0.1',
  };
  const { handle, child } = startManagedProcess({
    previewId: options.previewId,
    cwd: options.cwd,
    command: options.command,
    args: options.args,
    env,
    port,
    ...(options.onLog ? { onLog: options.onLog } : {}),
  });
  try {
    await waitForPortReady(port, {
      ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
      getFailureOutput: () => getHandleOutput(handle),
      isStopped: () => child.exitCode !== null && child.exitCode !== undefined,
    });
    return { handle, port };
  } catch (err) {
    await stopManagedHandle(handle);
    throw err;
  }
}

function staticRootCandidates(workspacePath: string): string[] {
  return ['dist', 'build', 'public'].map((dir) => join(workspacePath, dir));
}

export function resolveStaticRoot(workspacePath: string): string | null {
  for (const candidate of staticRootCandidates(workspacePath)) {
    if (existsSync(candidate) && statSync(candidate).isDirectory())
    {return candidate;}
  }
  if (existsSync(join(workspacePath, 'index.html'))) {return workspacePath;}
  return null;
}

export async function startStaticPreview(options: {
  previewId: string;
  workspacePath: string;
  preferredPort?: number | null;
  /** Default file when "/" is requested (e.g. "pages/index.html"). If not set, uses "index.html". */
  defaultDocument?: string | null;
}): Promise<{ handle: string; port: number }> {
  let rootPath: string;
  if (existsSync(options.workspacePath) && statSync(options.workspacePath).isDirectory()) {
    rootPath = resolve(options.workspacePath);
  } else {
    const resolved = resolveStaticRoot(options.workspacePath);
    if (!resolved)
    {throw new Error(
      'No static root found (expected dist/, build/, public/, or index.html)',
    );}
    rootPath = resolved;
  }
  const port = await findFreePreviewPort(options.preferredPort ?? null);
  const handle = `static_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const defaultDoc = options.defaultDocument?.replace(/^\/+/, '') || 'index.html';
  const server = createHttpServer((req, res) => {
    const rawPath = decodeURIComponent((req.url || '/').split('?')[0] || '/');
    const relative =
      rawPath === '/' ? defaultDoc : rawPath.replace(/^\/+/, '');
    const filePath = resolve(rootPath, relative);
    const normalizedRoot = normalize(
      rootPath + (rootPath.endsWith('\\') || rootPath.endsWith('/') ? '' : '/'),
    );
    const normalizedFile = normalize(filePath);
    if (
      !normalizedFile.startsWith(normalizedRoot) &&
      normalizedFile !== normalize(rootPath)
    ) {
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }
    let targetPath = filePath;
    if (
      !existsSync(targetPath) ||
      (existsSync(targetPath) && statSync(targetPath).isDirectory())
    ) {
      const indexPath = join(rootPath, defaultDoc);
      const fallbackIndex = join(rootPath, 'index.html');
      if (existsSync(indexPath)) {
        targetPath = indexPath;
      } else if (existsSync(fallbackIndex)) {
        targetPath = fallbackIndex;
      } else {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }
    }
    const mimeType =
      MIME_TYPES.get(extname(targetPath).toLowerCase()) ||
      'application/octet-stream';
    res.setHeader('Content-Type', mimeType);
    createReadStream(targetPath).pipe(res);
  });
  await new Promise<void>((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(port, '127.0.0.1', () => resolveListen());
  });
  handles.set(handle, {
    kind: 'static',
    previewId: options.previewId,
    server,
    rootPath,
    port,
    startedAt: Date.now(),
  });
  return { handle, port };
}

/** One service in a multi-service manifest (frontend + backend). */
export interface ManifestService {
  name: string;
  cwd?: string;
  install?: string;
  dev: string;
  defaultPort?: number;
  env?: Record<string, string>;
}

/** Manifest from bridge-data/templates/<id>/manifest.json */
export interface TemplateManifest {
  runtime: string;
  install?: string;
  dev?: string;
  defaultPort?: number;
  readyPath?: string;
  staticRoot?: string;
  cwd?: string;
  addOnDeps?: Record<string, string[]>;
  env?: Record<string, string>;
  /** When set, launch multiple services in parallel (e.g. frontend + backend). */
  services?: ManifestService[];
  /** Index into services[] for the port to expose as preview (default 0). */
  previewServiceIndex?: number;
}

async function launchFromManifestMultiService(options: {
  previewId: string;
  workspacePath: string;
  manifest: TemplateManifest;
  addOns?: string[];
  onLog?: (line: string) => void;
}): Promise<{ handle: string; port: number; basePath: string | null }> {
  const { previewId, workspacePath, manifest, onLog } = options;
  const services = manifest.services ?? [];
  const previewIdx = Math.min(
    manifest.previewServiceIndex ?? 0,
    services.length - 1,
  );

  const ports: number[] = services.map((svc) => svc.defaultPort ?? 5173);
  for (const port of ports) {
    await ensurePortFree(port);
  }

  const runOneRebuild = async (svc: ManifestService) => {
    const cwd = join(workspacePath, svc.cwd ?? '.');
    const nodeModulesPath = join(cwd, 'node_modules');
    const isDenoInstall = svc.install?.trim().startsWith('deno ');
    if (isDenoInstall || !existsSync(nodeModulesPath)) {return;}
    onLog?.(`[${svc.name}] Rebuilding native modules for this platform...`);
    try {
      const pm = resolvePackageManager(cwd);
      const args = pm === 'yarn' ? ['install'] : ['rebuild'];
      await runManagedCommand({
        previewId,
        cwd,
        command: normalizeCommand(pm),
        args,
        env: createInstallEnv(svc.env),
        onLog: (line) => onLog?.(`[${svc.name}] ${line}`),
      });
    } catch {
      onLog?.(`[${svc.name}] Rebuild skipped or failed (non-fatal)`);
    }
  };

  const runOneInstall = async (svc: ManifestService) => {
    const cwd = join(workspacePath, svc.cwd ?? '.');
    const nodeModulesPath = join(cwd, 'node_modules');
    const denoLockPath = join(cwd, 'deno.lock');
    const isDenoInstall = svc.install?.trim().startsWith('deno ');
    const alreadyCached =
      (isDenoInstall && existsSync(denoLockPath)) ||
      (existsSync(nodeModulesPath) && nodeModulesHasRequiredPackage(cwd, svc.dev ?? ''));
    if (!svc.install || alreadyCached) {
      if (alreadyCached && svc.install)
      {onLog?.(`[${svc.name}] Using cached dependencies`);}
      return;
    }
    const installSpec = normalizeInstallCommand(cwd, svc.install);
    if (!installSpec) {return;}
    onLog?.(`[${svc.name}] Installing ${svc.name}...`);
    await runManagedCommand({
      previewId,
      cwd,
      command: installSpec.command,
      args: installSpec.args,
      env: createInstallEnv(svc.env),
      onLog: (line) => onLog?.(`[${svc.name}] ${line}`),
    });
  };

  const installPromises = services.map((svc) => runOneInstall(svc));
  await Promise.all(installPromises);

  const rebuildPromises = services.map((svc) => runOneRebuild(svc));
  await Promise.all(rebuildPromises);

  const startOneService = (svc: ManifestService, port: number) => {
    const cwd = join(workspacePath, svc.cwd ?? '.');
    const devCmd = svc.dev.replace(/\{port\}/g, String(port)).replace(/\{python\}/g, resolvePythonCommand()).trim();
    if (!devCmd) {throw new Error(`Service ${svc.name} has no dev command`);}
    if (IS_WIN) {materializeSymlinkedPackages(cwd, devCmd);}
    const parts = devCmd.split(/\s+/);
    let command = parts[0] ?? '';
    let args = parts.slice(1);
    if (
      (command === 'vite' || command === 'next') &&
      !command.includes('/') &&
      !command.includes('\\')
    ) {
      command = 'npx';
      args = [parts[0] ?? 'vite', ...args];
    }
    const env: Record<string, string | undefined> = {
      ...process.env,
      ...svc.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      VITE_BASE: `/api/previews/${previewId}/`,
    };
    if (/\bvite\b/.test(devCmd) || /\bnext\b/.test(devCmd)) {
      env.NODE_PATH = join(cwd, 'node_modules');
    }
    const { handle, child } = startManagedProcess({
      previewId,
      cwd,
      command,
      args,
      env,
      port,
      onLog: (line) => onLog?.(`[${svc.name}] ${line}`),
    });
    return { handle, child, port };
  };

  const started: Array<{ handle: string; child: ManagedProcess; port: number }> = [];
  for (let i = 0; i < services.length; i++) {
    await ensurePortFree(ports[i]!);
    await sleep(IS_WIN ? 200 : 100);
    started.push(startOneService(services[i]!, ports[i]!));
  }
  const childHandles = started.map((s) => s.handle);
  const previewPort = ports[previewIdx]!;
  const previewHandle = started[previewIdx]!.handle;
  const previewChild = started[previewIdx]!.child;

  try {
    await waitForPortReady(previewPort, {
      timeoutMs: config.previewReadyTimeoutMs,
      getFailureOutput: () => getHandleOutput(previewHandle),
      isStopped: () => previewChild.exitCode !== null && previewChild.exitCode !== undefined,
    });
  } catch (err) {
    const compositeHandle = `comp_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    handles.set(compositeHandle, {
      kind: 'composite',
      previewId,
      childHandles,
      startedAt: Date.now(),
    });
    await stopManagedHandle(compositeHandle);
    const output = getHandleOutput(previewHandle);
    if (output && /EADDRINUSE|address already in use/i.test(output)) {
      const hint =
        ' Another process may be using the port. Close other previews or terminals running the same app, then try again.';
      throw err instanceof Error
        ? new Error(err.message + hint)
        : new Error(String(err) + hint);
    }
    throw err;
  }

  const compositeHandle = `comp_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  handles.set(compositeHandle, {
    kind: 'composite',
    previewId,
    childHandles,
    startedAt: Date.now(),
  });
  const basePath = `/api/previews/${previewId}/`;
  return { handle: compositeHandle, port: previewPort!, basePath };
}

/**
 * Launch a preview from a template manifest (copy already materialized).
 * For runtime "node": optional incremental install for addOns, then run dev with {port}.
 * For runtime "static": serve staticRoot (or resolveStaticRoot).
 */
export async function launchFromManifest(options: {
  previewId: string;
  workspacePath: string;
  manifest: TemplateManifest;
  addOns?: string[];
  onLog?: (line: string) => void;
}): Promise<{ handle: string; port: number; basePath: string | null }> {
  const { previewId, workspacePath, manifest, addOns = [], onLog } = options;
  const port = await findFreePreviewPort(manifest.defaultPort ?? null);
  const _readyPath = manifest.readyPath ?? '/';

  if (manifest.runtime === 'flutter') {
    throw new Error(
      'Flutter preview is not supported in the builder. Run the project locally with Flutter.',
    );
  }

  if (manifest.runtime === 'static') {
    const root = manifest.staticRoot
      ? join(workspacePath, manifest.staticRoot)
      : (resolveStaticRoot(workspacePath) ?? workspacePath);
    if (!existsSync(root)) {throw new Error(`Static root not found: ${root}`);}
    const defaultDoc =
      manifest.readyPath !== null && manifest.readyPath !== undefined && manifest.readyPath !== '/'
        ? manifest.readyPath.replace(/^\/+/, '')
        : undefined;
    const result = await startStaticPreview({
      previewId,
      workspacePath: root,
      preferredPort: port,
      ...(defaultDoc ? { defaultDocument: defaultDoc } : {}),
    });
    return { ...result, basePath: null };
  }

  if (manifest.services && manifest.services.length > 0) {
    return launchFromManifestMultiService({
      previewId,
      workspacePath,
      manifest,
      addOns,
      ...(onLog ? { onLog } : {}),
    });
  }

  const cwd = manifest.cwd ? join(workspacePath, manifest.cwd) : workspacePath;
  const nodeModulesPath = join(cwd, 'node_modules');
  const denoLockPath = join(cwd, 'deno.lock');
  const isDenoInstall = manifest.install?.trim().startsWith('deno ');
  const hasCachedDeps =
    (isDenoInstall && existsSync(denoLockPath)) ||
    (existsSync(nodeModulesPath) && nodeModulesHasRequiredPackage(cwd, manifest.dev ?? ''));
  const needsFullInstall = !hasCachedDeps;

  if (needsFullInstall && manifest.install) {
    onLog?.('Installing dependencies (template not warmed yet)...');
    const installSpec = normalizeInstallCommand(cwd, manifest.install);
    if (installSpec) {
      await runManagedCommand({
        previewId,
        cwd,
        command: installSpec.command,
        args: installSpec.args,
        env: createInstallEnv(manifest.env),
        ...(onLog ? { onLog } : {}),
      });
    }
  } else if (!needsFullInstall && manifest.install) {
    onLog?.('Using cached dependencies');
  }

  const packagesToAdd: string[] = [];
  if (manifest.addOnDeps && addOns.length > 0) {
    for (const key of addOns) {
      const deps = manifest.addOnDeps[key];
      if (Array.isArray(deps)) {packagesToAdd.push(...deps);}
    }
  }
  if (packagesToAdd.length > 0) {
    const npm = IS_WIN ? 'npm.cmd' : 'npm';
    const args = [
      'install',
      '--include=dev',
      '--legacy-peer-deps',
      ...packagesToAdd,
    ];
    onLog?.(`Running ${npm} install ${packagesToAdd.join(' ')}...`);
    await runManagedCommand({
      previewId,
      cwd,
      command: npm,
      args,
      ...(onLog ? { onLog } : {}),
    });
  }

  let devCmd = (manifest.dev ?? '').replace(/\{port\}/g, String(port)).trim();
  if (!devCmd) {devCmd = `npm run dev -- --port ${port} --host 127.0.0.1`.trim();}
  if (!devCmd) {throw new Error('Manifest has no dev command');}
  if (IS_WIN) {materializeSymlinkedPackages(cwd, devCmd);}
  const parts = devCmd.split(/\s+/);
  const command = parts[0] ?? '';
  const args = parts.slice(1);
  const env = {
    ...process.env,
    ...manifest.env,
    PORT: String(port),
    HOST: '127.0.0.1',
    VITE_BASE: `/api/previews/${previewId}/`,
  } as Record<string, string>;
  if (/\bvite\b/.test(devCmd) || /\bnext\b/.test(devCmd)) {
    env.NODE_PATH = join(cwd, 'node_modules');
  }
  const { handle, child } = startManagedProcess({
    previewId,
    cwd,
    command,
    args,
    env,
    port,
    ...(onLog ? { onLog } : {}),
  });
  try {
    await waitForPortReady(port, {
      timeoutMs: config.previewReadyTimeoutMs,
      getFailureOutput: () => getHandleOutput(handle),
      isStopped: () => child.exitCode !== null && child.exitCode !== undefined,
    });
    const basePath = `/api/previews/${previewId}/`;
    return { handle, port, basePath };
  } catch (err) {
    await stopManagedHandle(handle);
    throw err;
  }
}

export async function stopManagedHandle(handle?: string | null): Promise<void> {
  if (!handle) {return;}
  const state = handles.get(handle);
  if (!state) {return;}
  handles.delete(handle);
  if (state.kind === 'static') {
    await new Promise<void>((resolveClose) =>
      state.server.close(() => resolveClose()),
    );
    return;
  }
  if (state.kind === 'composite') {
    for (const childHandle of state.childHandles) {
      const childState = handles.get(childHandle);
      if (childState && childState.kind === 'process') {
        await terminateChildTree(childState.child);
      }
      handles.delete(childHandle);
    }
    return;
  }
  await terminateChildTree(state.child);
}

export function getRunCommandForPath(
  path: string,
  port: number,
  packageManager: string | null,
): string {
  const isWin = process.platform === 'win32';
  const pathEscaped = isWin
    ? path.replace(/"/g, '""')
    : path.replace(/"/g, '\\"');
  const hasPackageJson = existsSync(join(path, 'package.json'));
  if (!hasPackageJson) {
    return `cd "${pathEscaped}" && echo "No package.json; run your app manually (e.g. python main.py, cargo run)."`;
  }
  const pm = resolvePackageManager(path, packageManager);
  const devScript =
    readPackageScript(path, 'dev') || readPackageScript(path, 'start') || '';
  const trimmed = devScript.trim();
  if (!trimmed) {
    return `cd "${pathEscaped}" && echo "Add a dev script to package.json (e.g. vite, next dev) then run again."`;
  }
  const runPart = trimmed.includes('next')
    ? `${pm} run dev -- -p ${port} --hostname 127.0.0.1`
    : `${pm} run dev -- --port ${port} --strictPort --host 127.0.0.1`;
  return `cd "${pathEscaped}" && ${runPart}`;
}
