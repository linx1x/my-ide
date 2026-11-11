# My IDE — Agent Instructions

## Hard Rules

1. **ESM only** — use `import`/`export`; never use `require()`.
2. **Config** — all env access goes through `src/config.ts`. Do not read `process.env` directly elsewhere except bootstrap/setup code.
3. **Dashboard API calls** — client code must use `src/dashboard/client/src/api.ts`; do not use raw `fetch()` outside that helper.
4. **Mutating routes** — mutating Express routes under `/api` must be protected by the dashboard CSRF guard.
5. **Path safety** — user-supplied file paths must go through `safePath()` and respect the sensitive-file blocklist.
6. **Secrets** — never log API keys, `DASHBOARD_SECRET`, OTPs, or auth tokens.
7. **Git hygiene** — never commit `.env`, `auth_store/`, `bridge-data/`, or credentials.

## Architecture

Node.js 22+, Express 5, React 18 + Vite + TypeScript. WhatsApp via Baileys is kept for QR pairing and dashboard OTP login. The Cursor/Claude agent stack, orchestrator, delegate MCP server, dashboard chat, and scaffold agent surfaces have been removed.

### Request Flow

```
WhatsApp OTP / Dashboard
  → src/index.ts and src/dashboard/server.ts
  → dashboard routes, WebSockets, previews, file/git/terminal/db/n8n tools
```

### Key Files

| Purpose | Location |
| --- | --- |
| Entry point | `src/index.ts` |
| All config/env | `src/config.ts` |
| WhatsApp adapter | `src/adapters/whatsapp.ts` |
| Dashboard server | `src/dashboard/server.ts` |
| Dashboard context/path safety | `src/dashboard/context.ts` |
| Dashboard auth/OTP | `src/dashboard/auth.ts` |
| Dashboard client | `src/dashboard/client/` |
| Dashboard API helper | `src/dashboard/client/src/api.ts` |
| Architecture deep-dive | `docs/Project_Architecture_Blueprint.md` |

## Patterns

### Adding A Dashboard Route

1. Add the route in `src/dashboard/routes/<area>.ts` or `src/dashboard/server.ts`.
2. Require `authMiddleware` for authenticated dashboard APIs.
3. Let global `/api` CSRF handling protect mutating routes, or add explicit route-level CSRF where appropriate.
4. Validate user paths with `safePath()`.

### Fetching From The Client

```ts
import { api } from '../api';

const response = await api('/thing', { method: 'POST', body: { value } });
const data = await response.json();
if (!response.ok) {
  throw new Error(data.error || 'Failed');
}
```

### Adding An Env Variable

1. Add it to `src/config.ts`.
2. Document it in `.env.example`.
3. Access it through the config object.

## Current Baseline

Non-OTP WhatsApp messages intentionally do not run automation (concise disabled-feature response). Optional **dashboard** agent chat uses Mastra (`AGENT_CHAT_ENABLED=1`, `POST /api/agent/chat` SSE, `src/agent/`). WhatsApp agent surfacing stays off until explicitly wired.
