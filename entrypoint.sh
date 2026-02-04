#!/bin/bash
# =============================================================================
# OpenClaw Railway Entrypoint
# Runs as root to fix volume permissions, starts daemons, then drops to openclaw
# =============================================================================

set -e

echo "[entrypoint] Starting OpenClaw Railway..."

# -----------------------------------------------------------------------------
# 1. Create data directories
# -----------------------------------------------------------------------------
mkdir -p /data/.openclaw /data/workspace /data/core /data/tailscale

# Fix ownership - Railway mounts volumes as root
chown -R openclaw:openclaw /data

echo "[entrypoint] Data directories ready"

# -----------------------------------------------------------------------------
# 2. Start Tailscale daemon (runs as root, persists state to volume)
# -----------------------------------------------------------------------------
echo "[entrypoint] Starting tailscaled..."

# Use userspace networking (no /dev/net/tun in containers)
# State persisted to /data/tailscale so auth survives redeploys
tailscaled \
  --tun=userspace-networking \
  --state=/data/tailscale/tailscaled.state \
  --socket=/var/run/tailscale/tailscaled.sock \
  --statedir=/data/tailscale \
  > /data/tailscale/tailscaled.log 2>&1 &

TAILSCALED_PID=$!
echo "[entrypoint] tailscaled started (PID: $TAILSCALED_PID)"

# Wait for socket to be ready
for i in {1..30}; do
  if [ -S /var/run/tailscale/tailscaled.sock ]; then
    echo "[entrypoint] tailscaled socket ready"
    break
  fi
  sleep 0.5
done

# Set operator so openclaw user can manage tailscale serve
tailscale set --operator=openclaw 2>/dev/null || true

# Check if already authenticated (state persisted from previous deploy)
TAILSCALE_READY=false
if tailscale status --json 2>/dev/null | grep -q '"BackendState":"Running"'; then
  echo "[entrypoint] Tailscale already authenticated and running"
  TAILSCALE_READY=true
else
  echo "[entrypoint] Tailscale not authenticated - run 'tailscale up' via SSH"
fi

# -----------------------------------------------------------------------------
# 3. Ensure OpenClaw config has correct Tailscale settings
# -----------------------------------------------------------------------------
CONFIG_FILE="/data/.openclaw/openclaw.json"

start_gateway() {
  echo "[entrypoint] Starting gateway..."

  if [ "$TAILSCALE_READY" = true ]; then
    echo "[entrypoint] Tailscale ready - gateway will enable serve mode"
    su openclaw -c "cd /data/workspace && nohup openclaw gateway run \
      --port 18789 \
      --tailscale serve \
      > /data/.openclaw/gateway.log 2>&1 &"
  else
    echo "[entrypoint] Tailscale not ready - gateway starting without serve"
    su openclaw -c "cd /data/workspace && nohup openclaw gateway run \
      --port 18789 \
      > /data/.openclaw/gateway.log 2>&1 &"
  fi

  sleep 3

  if [ "$TAILSCALE_READY" = true ]; then
    TS_HOSTNAME=$(tailscale status --json 2>/dev/null | jq -r '.Self.DNSName' | sed 's/\.$//')
    echo "[entrypoint] Control UI: https://$TS_HOSTNAME/"
  fi
}

if [ -f "$CONFIG_FILE" ]; then
  echo "[entrypoint] Patching OpenClaw config for Tailscale..."

  jq '
    .gateway.tailscale.mode = "serve" |
    .gateway.auth.allowTailscale = true |
    .gateway.controlUi.allowInsecureAuth = true |
    .gateway.trustedProxies = ["127.0.0.1"]
  ' "$CONFIG_FILE" > /tmp/openclaw.json && mv /tmp/openclaw.json "$CONFIG_FILE"

  chown openclaw:openclaw "$CONFIG_FILE"
  echo "[entrypoint] Config patched"

  start_gateway
else
  echo "[entrypoint] No config found - run 'openclaw onboard' via SSH"
  echo "[entrypoint] Starting config watcher..."

  # Run watcher as completely detached process
  nohup /app/config-watcher.sh > /data/.openclaw/watcher.log 2>&1 &
  disown
fi

# -----------------------------------------------------------------------------
# 4. Start bootstrap server (drops to openclaw user)
# -----------------------------------------------------------------------------
echo "[entrypoint] Starting bootstrap server..."
exec su openclaw -c "cd /app && bun run src/server.js"
