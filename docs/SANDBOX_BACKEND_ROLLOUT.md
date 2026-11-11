# Sandbox Backend Rollout Sequence

This document now tracks the host-side adapter architecture and the remaining steps toward optional containerization.

## Current state

- **SandboxController** owns the lifecycle for every preview: materialize, detect, install, launch, readiness check, stop.
- **Preview identity** is `previewId`-based across API, storage, proxying, and teardown.
- **WorkspaceManager** materializes builder previews into isolated temp directories under `bridge-data/preview`.
- **RuntimeRegistry** asks registered adapters to detect the runtime, with `runtimeHint` influencing adapter order.
- **Runtime adapters** are host-side today:
  - `node` for package-managed apps
  - `static` for `dist/`, `build/`, `public/`, or plain HTML
  - `python` for best-effort Streamlit/FastAPI/Flask/Django/script launch
- **preview-runner.ts** is no longer the preview controller. It now provides shared host runtime utilities such as port allocation, direct subprocess spawning, process-tree stop, static serving, and temp-dir cleanup.

## Sequence

### Phase 1 – Frontend switched to sandbox API

- Builder preview uses `POST /api/previews` with `source.type = "builder-files"`.
- IDE preview uses `POST /api/previews` with `source.type = "project-path"`.
- Preview startup no longer depends on terminal command injection.

### Phase 2 – Host-side runtime controller

- `SandboxController` creates a session first, then drives runtime detection and adapter execution.
- Stop is adapter-driven by `previewId`, not by session-slot keys like `builder:${sessionKey}` or `ide:${sessionKey}`.
- Preview logs and lifecycle events are stored with the preview session itself.

### Phase 3 – Windows reliability

- Replace `shell: true` preview process management with direct command spawning.
- Stop preview-owned process trees explicitly on Windows.
- Defer temp-dir cleanup until the subprocess tree has exited.

### Phase 4 – Broaden non-Node host runtimes

- `StaticAdapter` validates the runtime-agnostic path without any package manager dependency.
- `PythonAdapter` provides a first host-side non-Node runtime path for common Python app shapes.

### Phase 5 – Optional containerized runtimes

- Add a container runtime layer for stronger isolation, cache mounts, and resource caps.
- Let adapters choose between host execution and containers behind the same `/api/previews` contract.

### Phase 6 – Remove remaining legacy shims

- Remove deprecated terminal-coupled preview helpers once nothing depends on them.
- **Done**: Terminal-coupled preview helpers removed from preview-runner (prepareBuilderPreview, getProjectPreviewRunCommand, setTerminalPreviewPort, clearTerminalPreviewPort, isPortAllowedForSession, getProxyPort).
- Remove Sandpack proxy only when the browser-side fallback is no longer required.
- **Done**: Helmet bypass for `/api/preview-proxy/` removed (path was never registered; live proxy is `/api/previews/:previewId/*`).

## Implementation notes

- **Runtime registry**: returns the first matching adapter after applying runtime-hint ordering.
- **Workspace manager**: builder-files always get an isolated temp workspace; project-path uses the existing project directory.
- **Host runtime cleanup**: temp-dir cleanup uses retries because Windows can briefly hold file handles after process exit.
- **Idle TTL**: the server periodically calls `stopPreview` for idle sessions, and proxy reads refresh `lastActivityAt`.
