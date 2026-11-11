# Project Memory

Local memory for this codebase. For stack, routes, and env defaults, prefer `CLAUDE.md`, `README.md`, and `src/config.ts` over duplicating details here.

## Project Overview

- **my-ide**: WhatsApp-authenticated dashboard for local project tools.
- WhatsApp/Baileys remains for QR pairing, allowed-number checks, and dashboard OTP login.
- The legacy Cursor/Claude orchestrator was removed in 2026-05. A new Mastra-based dashboard agent lives under `src/agent/` (LibSQL memory + vectors, SQLite trace/budget tables, SSE chat, MCP stdio tools script).
- Key areas: `src/index.ts`, `src/config.ts`, `src/adapters/`, `src/dashboard/`, `src/services/`, and `src/dashboard/client/`.

## Conventions & Preferences

- Node.js 22+, ESM (`"type": "module"`).
- Config via `.env`; important values include `ALLOWED_NUMBERS`, `DASHBOARD_WORKDIR`, `DASHBOARD_ENABLED`, and `DASHBOARD_SECRET`.
- Dashboard client requests use `src/dashboard/client/src/api.ts`.
- File APIs validate paths and block sensitive files.

## Security Hardening

- **CORS**: Deny by default; `DASHBOARD_CORS_ORIGIN` for allowlist.
- **Rate limits**: Auth, API, search, and voice routes are rate limited.
- **CSRF**: Mutating `/api` requests need `X-Requested-With`; client `api()` sends it.
- **Sensitive paths**: `.env*`, `auth_store/`, credentials, and key patterns are blocked from file APIs and hidden from tree/search.
- **Dashboard secret**: Random fallback if `DASHBOARD_SECRET` is unset; production should set a strong value.
- **Cookie**: Dashboard auth uses secure, same-site JWT cookies where appropriate.

## Dashboard

- `DASHBOARD_ENABLED=1`, port `DASHBOARD_PORT` (default 3847).
- OTP login restricted to `ALLOWED_NUMBERS`.
- Layout: activity bar, sidebar panels, editor/tabs, terminal, status bar.
- Panels include explorer, search, git, docs, settings, more/tools, DB, previews, and n8n where enabled.
- `DASHBOARD_CODEBASE_ROOT`: unset = `DASHBOARD_WORKDIR`; `__app__` = bridge repo itself.
- Projects can be added by Git HTTPS URL or local path and are tracked in `bridge-data/projects.json`.
- Optional editor completions use Ollama (`OLLAMA_BASE_URL`, `OLLAMA_COMPLETION_MODEL`).

## WhatsApp

- Baileys 7.x: prefer `remoteJidAlt` for DMs; self-chat uses `sock.user?.id` or first allowed number.
- Ordinary non-OTP text no longer reaches an agent; it returns a disabled-feature response while automation is rebuilt.
- Voice transcription remains available when `VOICE_ENABLED=1`.

## Lessons Learned

- Dashboard CSS imports live in `src/dashboard/client/src/index.css`; keep `tokens.css` early in the cascade.
- Windows terminal support uses `ComSpec` / `cmd.exe`; avoid bash-only assumptions in server code.
- Screenshots use Puppeteer and wait for `domcontentloaded` instead of `networkidle0` to avoid long-polling hangs.
- Reply splitting prefers newlines, then spaces, to avoid mid-word breaks on mobile.
- Docker stores persistent data in `bridge-data` or `/data` when `DOCKER_DATA_DIR` is set.
- `src/agent/mastra/` wires Mastra `Agent` + `@mastra/memory` (LibSQL); `src/agent/db/` runs versioned migrations on `bridge-data/agent-runtime.db`. Enable chat with `AGENT_CHAT_ENABLED=1` and provider keys.
