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

# Check if already authenticated (state persisted from previous deploy)
if tailscale status --json 2>/dev/null | grep -q '"BackendState":"Running"'; then
  echo "[entrypoint] Tailscale already authenticated and running"
else
  echo "[entrypoint] Tailscale not authenticated - run 'tailscale up' via SSH"
fi

# -----------------------------------------------------------------------------
# 3. Start OpenClaw gateway (if configured)
# -----------------------------------------------------------------------------
CONFIG_FILE="/data/.openclaw/openclaw.json"

if [ -f "$CONFIG_FILE" ]; then
  echo "[entrypoint] OpenClaw config found, starting gateway..."

  # Run gateway as openclaw user, bound to loopback only
  su openclaw -c "cd /data/workspace && openclaw gateway run \
    --port 18789 \
    --bind 127.0.0.1 \
    > /data/.openclaw/gateway.log 2>&1 &"

  echo "[entrypoint] Gateway starting on 127.0.0.1:18789"

  # Give it a moment to start
  sleep 2

  # Set up Tailscale serve if authenticated (provides HTTPS for Control UI)
  if tailscale status --json 2>/dev/null | grep -q '"BackendState":"Running"'; then
    echo "[entrypoint] Setting up Tailscale serve for HTTPS..."
    tailscale serve --bg --https=443 http://127.0.0.1:18789 2>/dev/null || true
    echo "[entrypoint] Control UI available at https://$(tailscale ip -4 2>/dev/null || echo '<tailscale-ip>'):443"
  fi
else
  echo "[entrypoint] No config found - run 'openclaw onboard' via SSH"
fi

# -----------------------------------------------------------------------------
# 4. Start bootstrap server (drops to openclaw user)
# -----------------------------------------------------------------------------
echo "[entrypoint] Starting bootstrap server..."
exec su openclaw -c "cd /app && bun run src/server.js"
