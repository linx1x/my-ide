/**
 * Sandbox preview domain types.
 * Lifecycle: detect -> materialize -> install -> launch -> health-check -> stream -> idle -> teardown.
 */

export type PreviewSourceType = 'builder-files' | 'project-path' | 'template-disk';

export type SandboxStatus =
  | 'provisioning'
  | 'materializing'
  | 'installing'
  | 'launching'
  | 'ready'
  | 'stopping'
  | 'failed'
  | 'expired'
  | 'stopped';

export type PreviewMode = 'dev' | 'build';

export interface BuilderFilesSource {
  type: 'builder-files';
  files: Array<{ path: string; content: string }>;
  packageManager?: string | null;
  /** Optional hint from builder UI (e.g. "react-vite", "vue-vite"). */
  runtimeHint?: string | null;
  /** When set, materialize by copying this template from disk then overlaying files. */
  templateDisk?: { frameworkId: string; backendId?: string | null; addOns?: string[] } | null;
  /** When set, materialize by copying single app template from bridge-data/templates/apps/<templateAppId> then overlaying files. */
  templateAppId?: string | null;
}

export interface ProjectPathSource {
  type: 'project-path';
  projectPath: string;
  /** Optional project id for association. */
  projectId?: string | null;
}

export interface TemplateDiskSource {
  type: 'template-disk';
  frameworkId: string;
  backendId?: string | null;
  addOns?: string[];
  /** Overlay files (e.g. add-on config) written on top of copied template. */
  overlayFiles?: Array<{ path: string; content: string }>;
}

export type PreviewSource = BuilderFilesSource | ProjectPathSource | TemplateDiskSource;

export interface CreatePreviewOptions {
  source: PreviewSource;
  sessionKey: string;
  mode?: PreviewMode;
  runtimeHint?: string | null;
}

export interface SandboxSession {
  previewId: string;
  sessionKey: string;
  source: PreviewSource;
  mode: PreviewMode;
  status: SandboxStatus;
  /** Base URL for the preview (e.g. /api/previews/pv_xxx/). */
  previewUrl: string | null;
  /** When set, the dev server (e.g. Vite) serves under this path; proxy must forward the full URL without stripping. */
  basePath: string | null;
  /** Internal port or target; not exposed to client. */
  internalPort: number | null;
  /** Workspace path on host (for compatibility backend). */
  workspacePath: string | null;
  /** Detected runtime id (e.g. "node", "python", "static"). */
  runtimeId: string | null;
  /** Adapter-owned opaque handle for teardown. */
  runtimeHandle?: string | null;
  /** Materialized workspace cleanup callback for ephemeral previews. */
  cleanup?: (() => Promise<void>) | null;
  /** Detected package manager, when relevant to the runtime. */
  packageManager?: string | null;
  /** Detected framework or launcher hint. */
  framework?: string | null;
  startedAt: number;
  updatedAt: number;
  /** Last activity timestamp for idle TTL. */
  lastActivityAt: number;
  error: string | null;
  /** Ring buffer of recent log lines. */
  logs: string[];
}

export interface PreviewEvent {
  previewId: string;
  type: 'status' | 'log' | 'error' | 'ready' | 'stopped';
  payload: {
    status?: SandboxStatus;
    message?: string;
    logLine?: string;
    error?: string;
    previewUrl?: string;
    previewPort?: number;
  };
  at: number;
}

export interface RuntimeDetectionResult {
  runtimeId: string;
  /** e.g. "vite", "next", "fastapi". */
  framework?: string;
  packageManager?: string;
  /** Suggested mode when not specified. */
  suggestedMode?: PreviewMode;
}
