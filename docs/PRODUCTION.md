# Production Deployment

Checklist and recommendations for running the bridge in production.

## Required Environment Variables

Set these when `NODE_ENV=production`:

| Variable | When required | Notes |
| --- | --- | --- |
| `DASHBOARD_SECRET` | Always when `DASHBOARD_ENABLED=1` | Strong random value, for example `openssl rand -hex 32`. |
| `ALLOWED_NUMBERS` | WhatsApp OTP login | Comma-separated phone numbers allowed to log in. |

Optional but recommended: `DASHBOARD_WORKDIR`, `CUSTOM_DOMAIN` or `DASHBOARD_BASE_URL`, `PROTECTED_BRANCHES`, and `ALLOWED_PUSH_PREFIXES`.

## Health And Readiness

- `GET /health` — liveness.
- `GET /ready` — readiness.

## Persistent Data And Backup

Persistent state lives under `bridge-data` or `/data` when `DOCKER_DATA_DIR=/data`:

- `auth_store/` — WhatsApp session; back this up to avoid relinking.
- `auth.db` under the configured data dir — dashboard auth token revocation.
- `projects.json`, `workspaces/` — registered projects and cloned repos.

Back up the data directory on a schedule.

## HTTPS And Reverse Proxy

Run the dashboard behind HTTPS through Cloudflare Tunnel, nginx, Caddy, or similar. Set `CUSTOM_DOMAIN` or `DASHBOARD_BASE_URL` to the public URL so CORS and proxied tools use the correct origin.

## Production Docker

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Ensure the mounted `.env` contains `DASHBOARD_SECRET` and `ALLOWED_NUMBERS`.

## Single Process And Scaling

The bridge runs as a single Node process. Auth, previews, project switching, DB visualizer connections, and terminal sessions use local or in-memory state. Run one dashboard instance per deployment unless you add external session coordination.
