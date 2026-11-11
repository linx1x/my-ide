/**
 * Workspace manager: creates isolated workspace snapshots for builder (virtual files)
 * and real project paths for host-side adapters. Supports template-disk: copy
 * pre-installed template dirs from bridge-data/templates then overlay files.
 * Launch config comes from template.json (single source); framework+backend merged at materialize.
 */

import { mkdirSync, writeFileSync, existsSync, cpSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';
import { platform } from 'node:os';
import _config from '../../config.js';
import type { PreviewSource } from './types.js';
import { getPreviewRoot, getSessionsRoot, removeDirWithRetry } from '../preview-runner.js';
import {
  readTemplateConfig,
  mergeFrameworkBackendConfig,
  getTemplatesRootPath,
} from '../template-registry.js';

const IS_LINUX = platform() === 'linux';

export interface MaterializeResult {
  workspacePath: string;
  /** Cleanup function to remove ephemeral workspace when done. */
  cleanup?: () => Promise<void>;
}

/** Reject path segments that could escape workspace (no "..", no absolute). */
function safePath(segment: string): boolean {
  if (!segment || segment.includes('..') || segment.startsWith('/') || /^[A-Za-z]:/.test(segment)) {
    return false;
  }
  return true;
}

/** Copy options: dereference symlinks so node_modules works when copied (e.g. on Windows). */
const COPY_OPTS = { recursive: true as const, dereference: true };

/**
 * Try to materialize using OverlayFS (Linux only). Returns null on failure or non-Linux.
 * Session dir: sessions/<previewId>/{upper,work,merged}. Lower = framework (and backend copyDir merged in).
 */
function tryOverlayMaterialize(
  previewId: string,
  frameworkId: string,
  backendId: string | null | undefined,
  overlayFiles: Array<{ path: string; content: string }>
): MaterializeResult | null {
  if (!IS_LINUX) {return null;}
  const templatesRoot = getTemplatesRootPath();
  const frameworkDir = join(templatesRoot, frameworkId);
  if (!existsSync(frameworkDir)) {return null;}
  const sessionDir = join(getSessionsRoot(), previewId);
  const upperDir = join(sessionDir, 'upper');
  const workDir = join(sessionDir, 'work');
  const mergedDir = join(sessionDir, 'merged');
  try {
    mkdirSync(upperDir, { recursive: true });
    mkdirSync(workDir, { recursive: true });
    mkdirSync(mergedDir, { recursive: true });
    const lowerDir = resolve(frameworkDir);
    const upperAbs = resolve(upperDir);
    const workAbs = resolve(workDir);
    const mergedAbs = resolve(mergedDir);
    execSync(
      `mount -t overlay overlay -o lowerdir=${lowerDir},upperdir=${upperAbs},workdir=${workAbs} ${mergedAbs}`,
      { stdio: 'pipe' }
    );
  } catch {
    try {
      if (existsSync(mergedDir)) {execSync(`umount "${resolve(mergedDir)}"`, { stdio: 'pipe' });}
    } catch {}
    removeDirWithRetry(sessionDir).catch(() => {});
    return null;
  }
  if (backendId) {
    const backendDir = join(templatesRoot, 'backends', backendId);
    if (existsSync(backendDir)) {
      const backendCfg = readTemplateConfig(backendDir);
      const copyDir = backendCfg?.copyDir ?? 'server';
      if (safePath(copyDir)) {
        const src = join(backendDir, copyDir);
        const dest = join(mergedDir, copyDir);
        if (existsSync(src)) {cpSync(src, dest, COPY_OPTS);}
      }
      const frameworkCfg = readTemplateConfig(frameworkDir);
      if (frameworkCfg && backendCfg) {
        const merged = mergeFrameworkBackendConfig(frameworkCfg, backendCfg);
        writeFileSync(join(mergedDir, 'template.json'), JSON.stringify(merged, null, 2), 'utf8');
      }
    }
  }
  for (const file of overlayFiles) {
    let path = file.path;
    if (path.includes('..') || path.startsWith('/') || /^[A-Za-z]:/.test(path)) {continue;}
    path = path.replace(/\\/g, '/');
    if (path === 'template.json' || path === 'manifest.json') {continue;}
    if (path === 'src/store/auth.store.ts' || path.endsWith('/auth.store.ts')) {
      const oldPath = join(mergedDir, file.path);
      if (existsSync(oldPath)) {
        try {
          unlinkSync(oldPath);
        } catch {}
      }
      path = path.replace(/auth\.store\.ts$/, 'auth.store.tsx');
    }
    const fullPath = join(mergedDir, path);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, file.content, 'utf8');
  }
  return {
    workspacePath: mergedDir,
    cleanup: async () => {
      try {
        execSync(`umount "${resolve(mergedDir)}"`, { stdio: 'pipe' });
      } catch {}
      await removeDirWithRetry(sessionDir).catch(() => {});
    },
  };
}

/**
 * Copy single app template from bridge-data/templates/apps/<appId>, then overlay files.
 * No framework+backend merge; template.json stays as-is for launch.
 */
function materializeFromAppTemplate(
  appId: string,
  overlayFiles: Array<{ path: string; content: string }>,
  workspacePath: string
): void {
  const templatesRoot = getTemplatesRootPath();
  const appDir = join(templatesRoot, 'apps', appId);
  if (!existsSync(appDir)) {
    throw new Error(`App template not found: ${appId}`);
  }
  if (!safePath(appId)) {
    throw new Error(`Invalid app template id: ${appId}`);
  }
  cpSync(appDir, workspacePath, COPY_OPTS);
  for (const file of overlayFiles) {
    let path = file.path;
    if (path.includes('..') || path.startsWith('/') || /^[A-Za-z]:/.test(path)) {continue;}
    path = path.replace(/\\/g, '/');
    if (path === 'template.json' || path === 'manifest.json') {continue;}
    const fullPath = join(workspacePath, path);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, file.content, 'utf8');
  }
}

/**
 * Copy template from disk (framework + optional backend), then overlay files.
 * Uses dereference: true so node_modules is copied as real files (no broken symlinks);
 * pre-warmed templates can then skip install and start faster.
 * When backendId is set, writes merged template.json for launch (framework + backend config).
 */
function materializeFromTemplate(
  frameworkId: string,
  backendId: string | null | undefined,
  overlayFiles: Array<{ path: string; content: string }>,
  workspacePath: string
): void {
  const templatesRoot = getTemplatesRootPath();
  const frameworkDir = join(templatesRoot, frameworkId);
  if (!existsSync(frameworkDir)) {
    throw new Error(`Template not found: ${frameworkId}`);
  }
  cpSync(frameworkDir, workspacePath, COPY_OPTS);
  if (backendId) {
    const backendDir = join(templatesRoot, 'backends', backendId);
    if (existsSync(backendDir)) {
      const backendCfg = readTemplateConfig(backendDir);
      const copyDir = backendCfg?.copyDir ?? 'server';
      if (!safePath(copyDir)) {
        throw new Error(`Invalid backend copyDir for ${backendId}`);
      }
      const src = join(backendDir, copyDir);
      const dest = join(workspacePath, copyDir);
      if (existsSync(src)) {
        cpSync(src, dest, COPY_OPTS);
      }
      const frameworkCfg = readTemplateConfig(frameworkDir);
      if (frameworkCfg && backendCfg) {
        const merged = mergeFrameworkBackendConfig(frameworkCfg, backendCfg);
        writeFileSync(
          join(workspacePath, 'template.json'),
          JSON.stringify(merged, null, 2),
          'utf8'
        );
      }
    }
  }
  for (const file of overlayFiles) {
    let path = file.path;
    if (path.includes('..') || path.startsWith('/') || /^[A-Za-z]:/.test(path)) {
      throw new Error(`Invalid overlay path: ${path}`);
    }
    path = path.replace(/\\/g, '/');
    if (path === 'template.json' || path === 'manifest.json') {continue;}
    if (path === 'src/store/auth.store.ts' || path.endsWith('/auth.store.ts')) {
      const oldPath = join(workspacePath, file.path);
      if (existsSync(oldPath)) {
        try {
          unlinkSync(oldPath);
        } catch {}
      }
      path = path.replace(/auth\.store\.ts$/, 'auth.store.tsx');
    }
    const fullPath = join(workspacePath, path);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, file.content, 'utf8');
  }
}

/**
 * Materialize a workspace for the given source. For project-path, returns the path as-is.
 * For template-disk or builder-files with templateDisk: tries OverlayFS when previewId
 * is provided (Linux); otherwise or on failure copies template then overlay files.
 */
export async function materialize(
  source: PreviewSource,
  baseDir: string,
  previewId?: string
): Promise<MaterializeResult | null> {
  if (source.type === 'project-path') {
    const workspacePath = resolve(source.projectPath);
    if (!existsSync(workspacePath)) {
      throw new Error('Project path does not exist');
    }
    const bridgeRoot = resolve(process.cwd());
    const a = bridgeRoot.toLowerCase();
    const b = workspacePath.toLowerCase();
    if (a === b) {
      throw new Error(
        'Preview cannot use the bridge root or server directory as project path. Use a separate project directory.',
      );
    }
    if (a.startsWith(b + sep) || a.startsWith(b + '/')) {
      throw new Error(
        'Preview cannot use a parent of the bridge root as project path. Use a separate project directory.',
      );
    }
    return { workspacePath };
  }

  const useTemplate =
    source.type === 'template-disk' ||
    (source.type === 'builder-files' && source.templateDisk);
  if (useTemplate && previewId && !(source.type === 'builder-files' && source.templateAppId)) {
    const frameworkId =
      source.type === 'template-disk' ? source.frameworkId : (source.templateDisk?.frameworkId ?? '');
    const backendId =
      source.type === 'template-disk' ? source.backendId ?? null : (source.templateDisk?.backendId ?? null);
    const overlayFiles =
      source.type === 'template-disk' ? source.overlayFiles ?? [] : source.files;
    const overlayResult = tryOverlayMaterialize(previewId, frameworkId, backendId, overlayFiles);
    if (overlayResult) {return overlayResult;}
  }

  const root = resolve(baseDir || getPreviewRoot());
  const workspacePath = join(root, `builder-${randomUUID().replace(/-/g, '').slice(0, 8)}`);
  mkdirSync(workspacePath, { recursive: true });

  if (source.type === 'builder-files' && source.templateAppId) {
    materializeFromAppTemplate(source.templateAppId, source.files ?? [], workspacePath);
  } else if (source.type === 'template-disk') {
    materializeFromTemplate(
      source.frameworkId,
      source.backendId ?? null,
      source.overlayFiles ?? [],
      workspacePath,
    );
  } else if (source.type === 'builder-files' && source.templateDisk) {
    materializeFromTemplate(
      source.templateDisk.frameworkId,
      source.templateDisk.backendId ?? null,
      source.files,
      workspacePath,
    );
  } else {
    for (const file of source.files) {
      const fullPath = join(workspacePath, file.path);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, file.content, 'utf8');
    }
  }

  return {
    workspacePath,
    cleanup: async () => {
      await removeDirWithRetry(workspacePath).catch(() => {});
    },
  };
}
