# My IDE

My IDE is a WhatsApp-authenticated web dashboard for working with local projects. The legacy Cursor/Claude orchestrator stack was removed in favor of a clean baseline; an optional **Mastra** dashboard agent (`AGENT_CHAT_ENABLED=1`) provides streaming chat with LibSQL memory, SQLite traces/budgets, and MCP tool wrappers.

The remaining app keeps the useful standalone pieces:

- **WhatsApp** via [Baileys](https://github.com/WhiskeySockets/Baileys), used for linking the account and sending dashboard OTP codes.
- **Dashboard** with file explorer, Monaco editor, source control, terminals, previews, database tools, voice transcription, project switching, and n8n workflow management.
- **Auth** through JWT cookies and WhatsApp OTP restricted to `ALLOWED_NUMBERS`.

## Architecture

```
WhatsApp (OTP) ─┐
                ├─ Bridge Server ─ Dashboard API / WebSocket / SSE
Dashboard UI ───┘
                └─ Local project tools: files, git, terminal, preview, db, n8n
```

## Prerequisites

- Node.js 22+
- WhatsApp account for QR pairing and OTP delivery
- Optional: Docker, Cloudflare Tunnel, n8n, Ollama, Groq/OpenAI voice providers

## Setup

### Docker

```bash
docker compose up
```

On first run, complete setup in the foreground so the bridge can write `.env` and show the WhatsApp QR code. After that, `docker compose up -d` is fine.

Docker exposes the dashboard on `http://localhost:3847`, n8n on the dashboard proxy path `/n8n/`, and stores persistent data in the `bridge-data` volume.

### Local

```bash
npm install
npm run setup
npm run build:dashboard
npm start
```

Scan the QR code with WhatsApp: Settings → Linked Devices → Link a Device.

## Configuration

Set values in `.env` or the environment. See `.env.example` for the full list.

| Variable | Default | Description |
| --- | --- | --- |
| `ALLOWED_NUMBERS` | required | Comma-separated WhatsApp numbers allowed to use OTP login. |
| `DASHBOARD_WORKDIR` | project root | Default project shown in the dashboard. |
| `DASHBOARD_ENABLED` | `0` | Set `1` to enable the web dashboard. |
| `DASHBOARD_PORT` | `3847` | Dashboard HTTP port. |
| `DASHBOARD_SECRET` | generated fallback | JWT signing secret. Set a strong random value in production. |
| `DASHBOARD_CODEBASE_ROOT` | `DASHBOARD_WORKDIR` | `__app__` mirrors this repo; otherwise use an absolute path. |
| `MAX_REPLY_LENGTH` | `4000` | Split long WhatsApp replies. |
| `VOICE_ENABLED` | `1` | Enable voice transcription. |
| `N8N_ENABLED` | `1` | Enable the embedded n8n proxy and workflow manager. |

## Dashboard

The dashboard includes:

- File tree, editor tabs, search, quick open, and safe file operations.
- Git status, diffs, branch tools, and GitHub workflow panels when `GITHUB_TOKEN` is set.
- Terminal sessions and project switching.
- Preview runner for local app workspaces.
- Database visualizer connections.
- n8n and optional LangFuse UI reverse proxies.
- Voice transcription using local Whisper, Groq, or OpenAI.

Build the React dashboard after UI changes:

```bash
npm run build:dashboard
```

## WhatsApp

WhatsApp is preserved for QR pairing, allowed-number checks, and dashboard OTP delivery. Ordinary non-OTP messages no longer dispatch to an agent and receive a short disabled-feature response while the automation stack is rebuilt.

## Health Endpoints

When the dashboard is enabled:

- `GET /health` returns process liveness.
- `GET /ready` returns dashboard readiness.

## Security

- Only numbers in `ALLOWED_NUMBERS` can complete OTP login.
- Mutating `/api` requests require the dashboard CSRF header.
- File APIs validate paths and block sensitive files such as `.env`, credentials, and auth stores.
- Keep `auth_store/`, `bridge-data/`, `.env`, and dashboard secrets private.

## Development

```bash
npm run typecheck:backend
npm run typecheck:client
npm test
```

New automation should live under `src/agent/` (Mastra + provider adapters) and dashboard routes — do not revive deleted Cursor/Claude/orchestrator modules.
