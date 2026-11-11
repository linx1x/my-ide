# My IDE Q&A

## What Is My IDE Now?

My IDE is a WhatsApp-authenticated web dashboard for local project tools. It keeps WhatsApp OTP login, file browsing/editing, source control, terminals, previews, database tools, project switching, voice transcription, and n8n workflow management.

## What Was Removed?

The previous Cursor/Claude automation stack was removed: CLI spawning, prompts, queues, sessions, orchestrator, specialist delegation, delegate server glue, dashboard chat, project scaffold agents, agent status, and related tests/docs/scripts.

## Why Does WhatsApp Remain?

Dashboard login still uses WhatsApp OTP. The bridge initializes Baileys, filters allowed numbers, and can send OTP messages without running automation for ordinary text.

## How Do I Run It?

```bash
npm install
npm run setup
npm run build:dashboard
npm start
```

Or with Docker:

```bash
docker compose up
```

## Which Env Vars Matter Most?

- `ALLOWED_NUMBERS`: required for OTP login.
- `DASHBOARD_WORKDIR`: default dashboard project root.
- `DASHBOARD_ENABLED`: set `1` to enable the web dashboard.
- `DASHBOARD_SECRET`: JWT signing secret.
- `DASHBOARD_CODEBASE_ROOT`: optional override for the visible codebase root.

## What Should Future Automation Use?

Start from a fresh design and new modules. Do not depend on the deleted runtime paths or old chat/orchestration contracts.
