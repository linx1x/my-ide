#!/bin/sh
set -e
if [ -n "$CLOUDFLARE_TUNNEL_TOKEN" ]; then
  exec cloudflared tunnel run --token "$CLOUDFLARE_TUNNEL_TOKEN"
elif [ -n "$TUNNEL_ID" ] && [ -f "/etc/cloudflared/credentials/$TUNNEL_ID.json" ]; then
  echo "Using local tunnel $TUNNEL_ID -> http://bridge:${DASHBOARD_PORT:-3847} ($TUNNEL_HOSTNAME)"
  printf 'tunnel: %s\ncredentials-file: /etc/cloudflared/credentials/%s.json\ningress:\n  - hostname: %s\n    service: http://bridge:%s\n  - service: http_status:404\n' "$TUNNEL_ID" "$TUNNEL_ID" "$TUNNEL_HOSTNAME" "${DASHBOARD_PORT:-3847}" > /tmp/config.yml
  exec cloudflared tunnel --config /tmp/config.yml run
else
  echo "No tunnel configured. Set TUNNEL_ID + CLOUDFLARE_CREDENTIALS_DIR (local tunnel) or CLOUDFLARE_TUNNEL_TOKEN for https://dashboard.example.com"
  exec sleep infinity
fi
