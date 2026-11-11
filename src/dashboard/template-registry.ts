/**
 * Template registry: single source of truth from disk.
 * Scans bridge-data/templates/ and backends for template.json, expands editable
 * globs, and returns FeatureTemplate[] for the builder UI and config for launch.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import fg from 'fast-glob';
import config from '../config.js';

export interface TemplateFile {
  path: string;
  content: string;
  when?: string;
}

export interface FeatureTemplate {
  id: string;
  category: string;
  files: TemplateFile[];
}

/** One service in a multi-service template (frontend + backend). */
export interface TemplateManifestService {
  name: string;
  cwd?: string;
  install?: string;
  dev: string;
  defaultPort?: number;
  env?: Record<string, string>;
}

/**
 * template.json shape on disk. Used for launch (runtime, install, dev, services)
 * and for derivation (editable globs, features/addOnDeps).
 */
export interface TemplateConfig {
  id: string;
  category: string;
  runtime: string;
  /** App templates only: dashboard | blog | marketing | landing | docs | saas */
  appType?: string;
  install?: string;
  dev?: string;
  defaultPort?: number;
  readyPath?: string;
  staticRoot?: string;
  cwd?: string;
  /** Glob patterns relative to template root for files to include in builder UI. */
  editable?: string[];
  /** Add-on feature id -> { deps, files }. Used for optional install and file overlay. */
  features?: Record<string, { deps?: string[]; files?: string[] }>;
  /** Alias for features.*.deps for launch: addOnDeps[key] = deps for add-on. */
  addOnDeps?: Record<string, string[]>;
  env?: Record<string, string>;
  services?: TemplateManifestService[];
  previewServiceIndex?: number;
  /** Backend only: directory to merge into workspace (e.g. "server", "api"). */
  copyDir?: string;
}

function getTemplatesRoot(): string {
  const base = config.bridgeDataDir || resolve(process.cwd(), 'bridge-data');
  return join(base, 'templates');
}

/**
 * Read template.json from a directory. Prefer template.json; fall back to manifest.json.
 */
export function readTemplateConfig(dir: string): TemplateConfig | null {
  const templatePath = join(dir, 'template.json');
  const manifestPath = join(dir, 'manifest.json');
  const path = existsSync(templatePath) ? templatePath : existsSync(manifestPath) ? manifestPath : null;
  if (!path) {return null;}
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
    const editable = Array.isArray(raw.editable) ? (raw.editable as string[]) : undefined;
    const features = raw.features && typeof raw.features === 'object' ? (raw.features as Record<string, { deps?: string[]; files?: string[] }>) : undefined;
    const addOnDeps = raw.addOnDeps && typeof raw.addOnDeps === 'object' ? (raw.addOnDeps as Record<string, string[]>) : undefined;
    const services = Array.isArray(raw.services) ? (raw.services as TemplateManifestService[]) : undefined;
    const cfg: TemplateConfig = {
      id: String(raw.id ?? ''),
      category: String(raw.category ?? 'framework'),
      runtime: String(raw.runtime ?? 'node'),
      editable: editable ?? [],
    };
    if (raw.appType != null) {cfg.appType = String(raw.appType);}
    if (raw.install != null) {cfg.install = String(raw.install);}
    if (raw.dev != null) {cfg.dev = String(raw.dev);}
    if (typeof raw.defaultPort === 'number') {cfg.defaultPort = raw.defaultPort;}
    if (raw.readyPath != null) {cfg.readyPath = String(raw.readyPath);}
    if (raw.staticRoot != null) {cfg.staticRoot = String(raw.staticRoot);}
    if (raw.cwd != null) {cfg.cwd = String(raw.cwd);}
    if (editable) {cfg.editable = editable;}
    if (features) {cfg.features = features;}
    if (addOnDeps) {cfg.addOnDeps = addOnDeps;}
    if (raw.env && typeof raw.env === 'object') {cfg.env = raw.env as Record<string, string>;}
    if (services) {cfg.services = services;}
    if (typeof raw.previewServiceIndex === 'number') {cfg.previewServiceIndex = raw.previewServiceIndex;}
    if (raw.copyDir != null) {cfg.copyDir = String(raw.copyDir);}
    return cfg;
  } catch {
    return null;
  }
}

/**
 * Expand editable globs in dir and return file paths (relative to dir).
 */
function expandEditable(dir: string, editable: string[]): string[] {
  const _normalizedDir = resolve(dir).replace(/\\/g, '/');
  const files = fg.sync(editable, {
    cwd: dir,
    absolute: false,
    onlyFiles: true,
    dot: false,
  });
  return files.map((p) => p.replace(/\\/g, '/'));
}

/**
 * Build FeatureTemplate from a template directory: read template.json (or manifest.json),
 * expand editable globs, read file contents.
 */
export function deriveFeatureTemplate(dir: string, id: string, category: string): FeatureTemplate | null {
  const cfg = readTemplateConfig(dir);
  if (!cfg) {return null;}
  const editable = cfg.editable && cfg.editable.length > 0 ? cfg.editable : ['**/*'];
  const paths = expandEditable(dir, editable);
  const files: TemplateFile[] = [];
  for (const rel of paths) {
    const normalized = rel.replace(/\\/g, '/');
    if (normalized === 'template.json' || normalized === 'manifest.json') {continue;}
    const full = join(dir, rel);
    if (!existsSync(full)) {continue;}
    try {
      const content = readFileSync(full, 'utf8');
      files.push({ path: rel, content });
    } catch {
      // skip binary or unreadable
    }
  }
  return { id: cfg.id || id, category: cfg.category || category, files };
}

/**
 * Scan templates root and return all framework, backend, and app FeatureTemplates
 * plus a map of template id -> config for launch.
 */
export function scanTemplates(): {
  frameworks: FeatureTemplate[];
  backends: FeatureTemplate[];
  apps: FeatureTemplate[];
  configById: Map<string, TemplateConfig>;
  } {
  const root = getTemplatesRoot();
  const frameworks: FeatureTemplate[] = [];
  const backends: FeatureTemplate[] = [];
  const apps: FeatureTemplate[] = [];
  const configById = new Map<string, TemplateConfig>();

  if (!existsSync(root)) {
    return { frameworks, backends, apps, configById };
  }

  const frameworkDirs = readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== 'backends' && d.name !== 'apps')
    .map((d) => ({ name: d.name, path: join(root, d.name) }));

  for (const { name, path } of frameworkDirs) {
    const cfg = readTemplateConfig(path);
    if (cfg) {configById.set(name, cfg);}
    const tpl = deriveFeatureTemplate(path, name, 'framework');
    if (tpl) {frameworks.push(tpl);}
  }

  const backendsRoot = join(root, 'backends');
  if (existsSync(backendsRoot)) {
    const backendDirs = readdirSync(backendsRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => ({ name: d.name, path: join(backendsRoot, d.name) }));
    for (const { name, path } of backendDirs) {
      const cfg = readTemplateConfig(path);
      if (cfg) {configById.set(`backends/${name}`, cfg);}
      const tpl = deriveFeatureTemplate(path, name, 'backend');
      if (tpl) {backends.push(tpl);}
    }
  }

  const appsRoot = join(root, 'apps');
  if (existsSync(appsRoot)) {
    const appDirs = readdirSync(appsRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => ({ name: d.name, path: join(appsRoot, d.name) }));
    for (const { name, path } of appDirs) {
      const cfg = readTemplateConfig(path);
      if (cfg) {configById.set(`apps/${name}`, cfg);}
      const tpl = deriveFeatureTemplate(path, name, 'app');
      if (tpl) {apps.push(tpl);}
    }
  }

  return { frameworks, backends, apps, configById };
}

let cached: ReturnType<typeof scanTemplates> | null = null;

/**
 * Get derived templates and config. Cached until clearTemplateRegistryCache().
 */
export function getTemplateRegistry(): ReturnType<typeof scanTemplates> {
  if (!cached) {cached = scanTemplates();}
  return cached;
}

export function clearTemplateRegistryCache(): void {
  cached = null;
}

export function getTemplatesRootPath(): string {
  return getTemplatesRoot();
}

/**
 * Merge framework and backend template configs into a single launch config (multi-service).
 * Used when materializing workspace with framework + backend; write result to workspacePath/template.json.
 */
export function mergeFrameworkBackendConfig(
  frameworkConfig: TemplateConfig,
  backendConfig: TemplateConfig
): TemplateConfig {
  const frontendSvc: TemplateManifestService = {
    name: 'frontend',
    cwd: frameworkConfig.cwd ?? '.',
    dev: frameworkConfig.dev ?? 'npm run dev',
    defaultPort: frameworkConfig.defaultPort ?? 5173,
  };
  if (frameworkConfig.install) {frontendSvc.install = frameworkConfig.install;}
  const backendSvc: TemplateManifestService = {
    name: 'backend',
    cwd: backendConfig.cwd ?? 'server',
    dev: backendConfig.dev ?? 'npm run dev',
    defaultPort: backendConfig.defaultPort ?? 4000,
  };
  if (backendConfig.install) {backendSvc.install = backendConfig.install;}
  if (backendConfig.env) {backendSvc.env = backendConfig.env;}
  const merged: TemplateConfig = {
    id: frameworkConfig.id,
    category: 'framework',
    runtime: 'node',
    readyPath: '/',
    services: [frontendSvc, backendSvc],
    previewServiceIndex: 0,
  };
  if (frameworkConfig.addOnDeps) {merged.addOnDeps = frameworkConfig.addOnDeps;}
  if (frameworkConfig.features) {merged.features = frameworkConfig.features;}
  return merged;
}
