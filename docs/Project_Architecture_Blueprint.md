# Project Architecture Blueprint

## Current Scope

My IDE is now a WhatsApp-authenticated dashboard for local project operations. The previous Cursor/Claude agent runtime, multi-agent orchestration, delegate MCP server, dashboard chat, scaffold pipeline, and agent-specific status/session state have been removed.

WhatsApp remains because dashboard login depends on OTP delivery through Baileys.

## Runtime Shape

```
src/index.ts
  ├─ WhatsApp adapter (Baileys)
  ├─ dashboard server bootstrap
  └─ optional voice/screenshot helpers

src/dashboard/server.ts
  ├─ auth and OTP routes
  ├─ file/search/git/project routes
  ├─ terminal and dashboard WebSockets
  ├─ preview/database/n8n routes
  └─ static dashboard client
```

## Layers

### Entry Point

- `src/index.ts` initializes config, WhatsApp, and the dashboard server.
- Ordinary WhatsApp text no longer starts automation. It returns a disabled-feature message while the agent stack is rebuilt.

### Configuration

- `src/config.ts` is the only place runtime environment variables are read.
- `DASHBOARD_WORKDIR` is the default project root.
- `DASHBOARD_CODEBASE_ROOT` can point to a separate path or `__app__`.

### Dashboard Backend

- `src/dashboard/server.ts` wires middleware, auth, routes, static assets, and WebSockets.
- `src/dashboard/context.ts` centralizes shared dependencies and path safety.
- Route modules in `src/dashboard/routes/` own individual API surfaces.

### Auth

- `src/dashboard/auth.ts` handles OTP flow and JWT cookies.
- `src/dashboard/auth-db.ts` stores revoked tokens in SQLite.
- WhatsApp socket access is retained only for OTP delivery.

### Dashboard Client

- React 18 + Vite + TypeScript under `src/dashboard/client/`.
- All API requests go through `src/dashboard/client/src/api.ts`.
- The UI keeps standalone panels: explorer, search, git, docs, settings, terminal, previews, database tools, projects, and n8n.

### Services

- `src/services/projects.ts` tracks project roots and clone jobs.
- Preview, database, voice, screenshot, and tunnel helpers remain where they support standalone dashboard features.

## Removed Boundaries

The following areas are intentionally absent:

- Cursor CLI and Claude CLI spawning.
- Agent provider abstraction and prompts.
- Single-agent sessions, queues, review state, and accept/reject agent flow.
- Multi-agent orchestrator and specialist delegation.
- Delegate MCP server glue.
- Dashboard chat, slash commands, create-app chat, scaffold agents, and pipeline agent activity.
- Agent-specific n8n workflows and internal callbacks.
- LangFuse SDK traces and Google Stitch generation.

Future automation should be implemented as a new design rather than by restoring these deleted modules.

## Verification Expectations

After significant changes, run:

```bash
npm run typecheck:backend
npm run typecheck:client
npm run build:dashboard
npm test
```

Use text searches for stale imports from deleted agent modules before shipping.
