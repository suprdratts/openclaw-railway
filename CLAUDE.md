# OpenClaw Railway Template

## Overview

Secure OpenClaw deployment for Railway. Zero SSH required - configure entirely via environment variables.

## Quick Start

1. Deploy to Railway
2. Set environment variables:
   - `GROQ_API_KEY` (or other LLM provider)
   - `TELEGRAM_BOT_TOKEN` (or Discord/Slack)
   - `TELEGRAM_OWNER_ID` (your user ID)
3. Deploy - bot is ready

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                 RAILWAY CONTAINER                    │
│                                                      │
│  Health Server (:8080)     Gateway (:18789)         │
│  - /healthz for Railway    - Runs on loopback       │
│  - No sensitive info       - Handles channels       │
│                            - Runs agents            │
│                                                      │
│  Config: /data/.openclaw/openclaw.json (600)        │
│  Workspace: /data/workspace                         │
└─────────────────────────────────────────────────────┘
```

## How It Works

1. Container starts
2. `entrypoint.sh` runs `build-config.js`
3. Config generated from environment variables
4. Secure defaults applied (Tier 0)
5. Gateway starts automatically
6. Owner pre-approved in allowlist

## Security Model

**Default (Tier 0):**
- Tools: Only read/write/edit/memory
- Blocked: exec, browser, process, nodes, web
- Gateway: Loopback only, token auth
- Sessions: Isolated per user
- Access: Owner allowlisted, others pair

**See:** docs/TIERS.md for unlocking more capabilities

## Files

```
openclaw-railway/
├── Dockerfile           # Single-stage, npm install
├── railway.toml         # Railway config
├── entrypoint.sh        # Builds config, starts gateway
├── config-watcher.sh    # Fallback for manual onboard
├── package.json         # No dependencies
├── src/
│   ├── server.js        # Health check (~30 lines)
│   └── build-config.js  # Env vars → config
└── config/
    ├── defaults.json5   # Secure base config
    └── environment.md   # Env var reference
```

## Environment Variables

See config/environment.md for full list.

**Required:**
- One LLM provider key
- One channel token
- Owner ID for that channel

**Optional:**
- Model selection (primary, heartbeat, subagent)
- Multiple channels
- Gateway token override

## Commands (SSH)

Only needed for debugging or manual config:

```bash
# View logs
cat /data/.openclaw/gateway.log

# Security audit
openclaw security audit --deep

# Restart gateway
pkill -f "openclaw gateway"
openclaw gateway run --port 18789 &
```

## Updating

Redeploy the container:
```bash
railway up
```

Never run `openclaw update` inside the container.

## Key Docs

- https://docs.openclaw.ai/gateway/security
- https://docs.openclaw.ai/gateway/configuration
- https://docs.openclaw.ai/tools
