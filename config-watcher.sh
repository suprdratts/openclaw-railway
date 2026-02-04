#!/bin/bash
# Config watcher - starts gateway when onboard creates config
# Runs as a detached background process

CONFIG_FILE="/data/.openclaw/openclaw.json"
LOG="/data/.openclaw/watcher.log"

echo "[watcher] Starting config watcher..." >> "$LOG"

# Wait for config file to be created by onboard
while [ ! -f "$CONFIG_FILE" ]; do
  sleep 2
done

echo "[watcher] Config detected!" >> "$LOG"

# Give onboard a moment to finish writing
sleep 2

# Patch config with Tailscale settings
echo "[watcher] Patching config..." >> "$LOG"
jq '
  .gateway.tailscale.mode = "serve" |
  .gateway.auth.allowTailscale = true |
  .gateway.controlUi.allowInsecureAuth = true |
  .gateway.trustedProxies = ["127.0.0.1"]
' "$CONFIG_FILE" > /tmp/openclaw.json && mv /tmp/openclaw.json "$CONFIG_FILE"
chown openclaw:openclaw "$CONFIG_FILE"

# Always start with --tailscale serve
# The gateway handles Tailscale setup automatically
echo "[watcher] Starting gateway with Tailscale serve..." >> "$LOG"
su openclaw -c "cd /data/workspace && nohup openclaw gateway run \
  --port 18789 \
  --tailscale serve \
  > /data/.openclaw/gateway.log 2>&1 &"

sleep 3
TS_HOSTNAME=$(tailscale status --json 2>/dev/null | jq -r '.Self.DNSName' | sed 's/\.$//')
echo "[watcher] Control UI: https://$TS_HOSTNAME/" >> "$LOG"
echo "[watcher] Done" >> "$LOG"
