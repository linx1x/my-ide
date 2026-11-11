# Sandbox Security and Scaling

## Isolation boundaries

- **Current (host-side adapters)**: Preview processes run as host processes under the same user as the bridge. Builder previews use materialized temp workspaces; project previews use the real project path. Isolation is at the process and path level, not the container boundary.
- **Target (containerized)**: Each preview runs in a container with:
  - Non-root user
  - Read/write mount only for the sandbox workspace
  - Shared dependency caches mounted read-only or with explicit cache keys
  - No host project bind mounts outside the workspace
  - Resource limits (CPU, memory, process count) per preview
  - Network: install phase may have controlled egress; runtime phase default to loopback-only, with app port only via the authenticated proxy

## Proxy and auth model

- **Identity**: Preview identity is an opaque `previewId`. Ports are never exposed to the client.
- **Authorization**: Every proxy request to `/api/previews/:previewId/*` is gated by `authMiddleware` and a session-ownership check: `getPreview(previewId, sessionKey)` must return the session. The server resolves the target only after ownership is verified.
- **No raw port in URLs**: Client only sees `/api/previews/pv_xxx/`. The server maps that to `host:port` internally.

## Cache strategy

- **Node (host-side today)**: package manager uses the workspace-local install path and any host/global caches already configured by npm, pnpm, or yarn.
- **Python (host-side today)**: `requirements.txt` installs into `.preview-python-site` inside the materialized workspace when needed.
- **Container target**: move caches outside the workspace and key them by runtime version + dependency lockfile hash.

## Quotas and limits

- **Per preview**: Launch timeout, install timeout, idle TTL (use `previewIdleTimeoutMs`). Optional: CPU/memory caps when using containers.
- **Per session**: Preview ownership is per `previewId`; the frontend typically drives one active builder preview and one active IDE preview, but the backend contract no longer depends on fixed session slots.
- **Global**: Max concurrent previews (e.g. port range or container pool size). Backpressure: return 503 when at capacity.

## Observability

- **Structured events**: `PreviewEvent` (status, log, error, ready, stopped) over SSE and in-memory bus.
- **Ring-buffer logs**: Per-session logs in `SandboxSession.logs` (max lines).
- **Idle TTL cleanup**: Periodic job stops previews where `Date.now() - lastActivityAt > previewIdleTimeoutMs`. `lastActivityAt` is updated on proxy requests via `getPreview` (touch).
- **Windows teardown**: host runtime stop kills preview-owned subprocess trees before temp-dir cleanup, reducing `EBUSY` temp-dir failures.
- **Audit**: Log preview create/stop/fail (previewId, sessionKey, reason) for security and ops.

## Implementation status

- Proxy auth: done (session ownership in server before proxy).
- Touch on proxy: done (`getPreview` calls `store.touch`).
- Idle TTL cleanup: server periodically calls `reapIdlePreviews()`.
- Runtime detection: host-side adapter detection is active for node, static, and python runtimes.
- Terminal-coupled preview stubs removed; preview-runner now provides only host runtime utilities used by the sandbox (port allocation, process/static handles, temp-dir cleanup).
