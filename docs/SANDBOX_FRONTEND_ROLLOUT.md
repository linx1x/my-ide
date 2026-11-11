# Sandbox Frontend Rollout

Frontend now uses the sandbox preview API; terminal command injection for preview is no longer used.

## Changes made

- **usePreview** (`src/dashboard/client/src/hooks/usePreview.ts`): Calls `POST /api/previews` with `source: { type: "project-path", projectPath, projectId }`. Subscribes to `GET /api/previews/events?previewId=xxx` (EventSource) for provisioning / installing / launching / ready / failed; shows `statusMsg` in the IDE preview panel. Stop calls `POST /api/previews/:previewId/stop`. No `injectTerminalCommand`.
- **BuilderCodePreview** (`src/dashboard/client/src/components/BuilderCodePreview.tsx`): Calls `POST /api/previews` with `source: { type: "builder-files", ... }`. Subscribes to the same events stream for progress and log lines. Iframe loads `previewUrl` when ready. On tab switch or unmount, calls `POST /api/previews/:previewId/stop`. Sandpack and `srcDoc` fallbacks have been removed; preview is sandbox-only.
- **EditorArea**: Uses `usePreview()` including `statusMsg` to show "Provisioning…", "Installing…", "Launching…" while the preview is starting.

## Optional next steps

- **LayoutContext**: `injectTerminalCommand` is still used by other features (e.g. custom run); only preview startup no longer uses it. Future work could migrate those features off terminal injection if desired.
