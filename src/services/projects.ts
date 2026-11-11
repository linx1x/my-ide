/**
 * Project management: add projects via local path or Git HTTPS URL.
 * Cloned repos go into workspaces/ directory.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import config from '../config.js';
import type { AddProjectOptions, ProjectRecord, ProjectsStore } from '../types/projects.js';

function getBridgeDataDir(): string {
  if (config.bridgeDataDir) {return resolve(config.bridgeDataDir);}
  return resolve(process.cwd(), 'bridge-data');
}

const BRIDGE_DATA = getBridgeDataDir();
const PROJECTS_FILE = join(BRIDGE_DATA, 'projects.json');
const WORKSPACES_DIR = join(BRIDGE_DATA, 'workspaces');

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {mkdirSync(dir, { recursive: true });}
}

function loadRaw(): ProjectsStore {
  ensureDir(BRIDGE_DATA);
  if (!existsSync(PROJECTS_FILE)) {
    return { projects: [], activeProjectId: null };
  }
  try {
    const raw = readFileSync(PROJECTS_FILE, 'utf8');
    const data = JSON.parse(raw);
    return {
      projects: Array.isArray(data.projects) ? data.projects : [],
      activeProjectId: data.activeProjectId || null,
    };
  } catch {
    return { projects: [], activeProjectId: null };
  }
}

function saveRaw(data: ProjectsStore): void {
  ensureDir(BRIDGE_DATA);
  writeFileSync(PROJECTS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Keep projects.json aligned with disk: drop entries whose paths are gone, dedupe by path,
 * and register any bridge-data/workspaces/* dirs not yet listed (matches Skills → Workspaces).
 * @returns {boolean} whether data was mutated
 */
function syncProjectsWithFilesystem(data: ProjectsStore): boolean {
  let changed = false;

  const valid = data.projects.filter(
    (p) => p && typeof p.path === 'string' && existsSync(resolve(p.path)),
  );
  if (valid.length !== data.projects.length) {
    data.projects = valid;
    changed = true;
  }

  const seen = new Set();
  const deduped = [];
  for (const p of data.projects) {
    const abs = resolve(p.path);
    if (seen.has(abs)) {continue;}
    seen.add(abs);
    deduped.push(p);
  }
  if (deduped.length !== data.projects.length) {
    data.projects = deduped;
    changed = true;
  }

  const pathSet = new Set(data.projects.map((p) => resolve(p.path)));
  if (existsSync(WORKSPACES_DIR)) {
    for (const entry of readdirSync(WORKSPACES_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) {continue;}
      const abs = resolve(join(WORKSPACES_DIR, entry.name));
      if (pathSet.has(abs)) {continue;}
      pathSet.add(abs);
      data.projects.push({
        id: randomUUID(),
        path: abs,
        name: entry.name,
        gitUrl: null,
      });
      changed = true;
    }
  }

  const ids = new Set(data.projects.map((p) => p.id));
  if (data.activeProjectId && !ids.has(data.activeProjectId)) {
    data.activeProjectId = data.projects[0]?.id ?? null;
    changed = true;
  }

  return changed;
}

/**
 * Derive folder name from Git URL.
 * e.g. https://github.com/user/repo.git → repo
 */
function repoNameFromUrl(gitUrl: string): string {
  const u = gitUrl.trim().replace(/\.git$/, '');
  const parts = u.split('/');
  return parts[parts.length - 1] || 'repo';
}

/**
 * Validate Git URL format (basic HTTPS check).
 */
function isValidGitUrl(url: string): boolean {
  if (typeof url !== 'string' || !url.trim()) {return false;}
  const trimmed = url.trim();
  return (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('git@')
  );
}

function runGitCommand(args: string[], opts: { cwd?: string; onProgress?: (text: string) => void } = {}): Promise<void> {
  const { cwd, onProgress } = opts;
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn('git', args, {
      cwd,
      shell: false,
      windowsHide: true,
    });
    let stderr = '';
    child.stdout.on('data', (d) => {
      const text = d.toString();
      onProgress?.(text);
    });
    child.stderr.on('data', (d) => {
      const text = d.toString();
      stderr += text;
      onProgress?.(text);
    });
    child.on('error', (err) => rejectPromise(err));
    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(new Error(stderr.trim() || `git ${args.join(' ')} failed with code ${code}`));
    });
  });
}

/**
 * Clone a Git repo into workspaces/<repoName>.
 * @returns {Promise<string>} absolute path to cloned directory
 */
async function cloneRepo(gitUrl: string, onProgress?: (text: string) => void): Promise<string> {
  ensureDir(WORKSPACES_DIR);
  const name = repoNameFromUrl(gitUrl);
  const dest = join(WORKSPACES_DIR, name);
  if (existsSync(dest)) {
    throw new Error(`Directory already exists: ${name}. Remove it or use a different clone path.`);
  }
  onProgress?.(`[projects] cloning ${gitUrl.trim()} into ${dest}\n`);
  await runGitCommand(
    ['clone', gitUrl.trim(), dest],
    onProgress ? { onProgress } : {},
  );
  return resolve(dest);
}

/**
 * @returns {{ projects: Array<{id, path, gitUrl?, name}>, activeProjectId: string|null }}
 */
export function getProjects() {
  const data = loadRaw();
  let dirty = syncProjectsWithFilesystem(data);
  // Ensure the configured dashboard workdir is always in the list as default project.
  const defaultPath = resolve(config.codebaseWorkDir);
  const hasDefault = data.projects.some((p) => resolve(p.path) === defaultPath);
  if (!hasDefault && existsSync(defaultPath)) {
    const defaultProject = {
      id: 'default',
      path: defaultPath,
      name: defaultPath.split(/[/\\]/).pop() || 'workspace',
      gitUrl: null,
    };
    data.projects.unshift(defaultProject);
    if (!data.activeProjectId) {data.activeProjectId = 'default';}
    dirty = true;
  }
  if (dirty) {saveRaw(data);}
  return data;
}

/**
 * Add a project by path or Git URL.
 * @param {{ path?: string, gitUrl?: string }} opts
 * @returns {Promise<{ id: string, path: string, name: string }>}
 */
export async function addProject(opts: AddProjectOptions, onProgress?: (text: string) => void): Promise<ProjectRecord> {
  const { path: inputPath, gitUrl } = opts || {};
  let absolutePath;
  let name;
  let gitUrlFinal = null;

  if (gitUrl && isValidGitUrl(gitUrl)) {
    absolutePath = await cloneRepo(gitUrl, onProgress);
    name = repoNameFromUrl(gitUrl);
    gitUrlFinal = gitUrl.trim();
  } else if (inputPath && typeof inputPath === 'string') {
    absolutePath = resolve(inputPath.trim());
    if (!existsSync(absolutePath)) {
      throw new Error(`Path does not exist: ${absolutePath}`);
    }
    name = absolutePath.split(/[/\\]/).pop() || 'project';
  } else {
    throw new Error('Provide path (existing directory) or gitUrl (HTTPS to clone)');
  }

  const data = loadRaw();
  const existing = data.projects.find((p) => resolve(p.path) === absolutePath);
  if (existing) {
    return existing;
  }

  const id = randomUUID();
  const project = { id, path: absolutePath, name, gitUrl: gitUrlFinal };
  data.projects.push(project);
  if (!data.activeProjectId) {data.activeProjectId = id;}
  saveRaw(data);
  return project;
}

/**
 * Pull latest changes for a managed project.
 * @param {string} id
 * @param {(text: string) => void} [onProgress]
 */
export async function pullProject(id: string, onProgress?: (text: string) => void): Promise<ProjectRecord> {
  const data = loadRaw();
  const project = data.projects.find((p) => p.id === id);
  if (!project) {throw new Error('Project not found');}
  if (!existsSync(project.path)) {throw new Error(`Project path does not exist: ${project.path}`);}
  onProgress?.(`[projects] pulling ${project.name}\n`);
  await runGitCommand(
    ['pull', '--ff-only'],
    onProgress ? { cwd: project.path, onProgress } : { cwd: project.path },
  );
  return project;
}

/**
 * Remove a project. If it was cloned (has gitUrl), optionally delete the directory.
 * @param {string} id
 * @param {{ deleteFiles?: boolean }} opts
 */
export function removeProject(id: string, opts: { deleteFiles?: boolean } = {}): void {
  const data = loadRaw();
  const idx = data.projects.findIndex((p) => p.id === id);
  if (idx < 0) {throw new Error('Project not found');}
  const project = data.projects[idx];
  if (!project) {throw new Error('Project not found');}
  if (id === 'default') {throw new Error('Cannot remove the default project');}

  if (opts.deleteFiles && project.gitUrl && existsSync(project.path)) {
    try {
      rmSync(project.path, { recursive: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.warn('[Projects] Could not delete cloned dir:', message);
    }
  }

  data.projects.splice(idx, 1);
  if (data.activeProjectId === id) {
    data.activeProjectId = data.projects[0]?.id || null;
  }
  saveRaw(data);
}

/**
 * Set the active project used for the dashboard codebase root.
 * @param {string|null} id
 */
export function setActiveProject(id: string | null): void {
  const data = loadRaw();
  if (id === null) {
    data.activeProjectId = null;
    saveRaw(data);
    return;
  }
  const project = data.projects.find((p) => p.id === id);
  if (!project) {throw new Error('Project not found');}
  data.activeProjectId = id;
  saveRaw(data);
}

/**
 * Get the active project's path.
 * @returns {{ path: string, id: string } | null}
 */
export function getActiveProject() {
  const data = loadRaw();
  if (!data.activeProjectId) {return null;}
  const project = data.projects.find((p) => p.id === data.activeProjectId);
  if (!project) {return null;}
  if (!existsSync(project.path)) {return null;}
  return { path: resolve(project.path), id: project.id };
}
