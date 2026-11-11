# My IDE — two commands: local dev (n8n + bridge) and cloudflared tunnel
# Install Just: https://just.systems/  (optional; npm scripts still work)

set dotenv-load := true

# Derived: DASHBOARD_BASE_URL from .env (or localhost fallback)
dashboard_port := env_var_or_default("DASHBOARD_PORT", "3848")
dashboard_base := env_var_or_default("DASHBOARD_BASE_URL", "http://localhost:" + dashboard_port)
n8n_public_path := env_var_or_default("N8N_PUBLIC_PATH", "/n8n")

# Default: local dev
default: local

# Local dev: start n8n in Docker (detached) with persistent data, then the bridge in watch mode
local:
  docker run --name n8n --rm -d -p 5678:5678 \
    -v n8n_data:/home/node/.n8n \
    -e WEBHOOK_URL={{dashboard_base}}{{n8n_public_path}}/ \
    -e N8N_EDITOR_BASE_URL={{dashboard_base}}{{n8n_public_path}}/ \
    -e N8N_PROXY_HOPS=1 \
    -e N8N_DIAGNOSTICS_ENABLED=false \
    n8nio/n8n
  npm run dev

# Production with tunnel: expose dashboard via cloudflared (bridge must be running: npm start)
# Port 3848 matches n8n env; set DASHBOARD_PORT in .env if your app uses another port.
# Does NOT start n8n or the bridge — run those separately (or use 'tunnel' below).
cloudflared:
  cloudflared tunnel --name my-ide --url http://localhost:{{dashboard_port}}

# Tunnel with n8n: start n8n + cloudflared.
# Bridge must already be running (npm start) on DASHBOARD_PORT.
# Uses DASHBOARD_BASE_URL from .env for webhook display URLs;
# telemetry disabled so both localhost and tunnel work without CORS errors.
tunnel:
  docker run --name n8n --rm -d -p 5678:5678 \
    -v n8n_data:/home/node/.n8n \
    -e WEBHOOK_URL={{dashboard_base}}{{n8n_public_path}}/ \
    -e N8N_EDITOR_BASE_URL={{dashboard_base}}{{n8n_public_path}}/ \
    -e N8N_PROXY_HOPS=1 \
    -e N8N_DIAGNOSTICS_ENABLED=false \
    n8nio/n8n
  cloudflared tunnel --name my-ide --url http://localhost:{{dashboard_port}}
