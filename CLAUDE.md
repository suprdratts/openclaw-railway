# OpenClaw Railway Template

## Overview

Minimal, secure OpenClaw deployment for Railway. The bootstrap server is just a status page - all configuration happens via SSH.

**Architecture:**
- Bootstrap server (Bun) → Shows setup instructions and status
- OpenClaw gateway (Node) → Runs on loopback, accessed via Tailscale
- Tailscale → Secure tunnel for Control UI access

---

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    RAILWAY CONTAINER                         │
│                                                              │
│  Bootstrap Server (:8080)     OpenClaw Gateway (:18789)     │
│  - Login page                 - Control UI                   │
│  - Status display             - WebSocket API                │
│  - Setup instructions         - Channel handlers             │
│                               - LLM routing                  │
│                                                              │
│  Tailscale ─────────────────► Gateway (loopback only)       │
│                                                              │
│  Volume: /data/.openclaw                                     │
└─────────────────────────────────────────────────────────────┘
```

The bootstrap server does **nothing** except show you:
1. Whether OpenClaw is configured
2. Whether Tailscale is connected
3. The Control UI URL when ready

All actual setup happens via `railway shell` + CLI commands.

---

## Deployment

### 1. Deploy to Railway

Set environment variable:
```
SETUP_PASSWORD=<your-password>
```

### 2. Visit the bootstrap page

Go to your Railway URL, login with the password. You'll see "Not Configured".

### 3. SSH and configure

```bash
railway shell
```

Inside the container:
```bash
# Run OpenClaw setup wizard
openclaw onboard

# Connect Tailscale
tailscale up
# Follow the auth URL
```

### 4. Access Control UI

Refresh the bootstrap page. It will show your Tailscale IP and the full Control UI URL:
```
http://<tailscale-ip>:18789/?token=<gateway-token>
```

Open this from any device on your Tailnet.

---

## Security Model

| Layer | Protection |
|-------|------------|
| Bootstrap page | Password-protected, read-only |
| Gateway | Bound to loopback only |
| Control UI | Tailscale-only access |
| Channels | Pairing required for each user |

The gateway is **never** exposed to the public internet. Tailscale provides end-to-end encryption.

---

## File Structure

```
openclaw-railway/
├── CLAUDE.md         # This file
├── Dockerfile        # Container build
├── railway.toml      # Railway config
├── package.json      # Dependencies (express, cookie-parser)
├── entrypoint.sh     # Permission setup
└── src/
    └── server.js     # Bootstrap server (~300 lines)
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETUP_PASSWORD` | Yes | Protects bootstrap page |
| `PORT` | No | Railway sets this automatically |

---

## Endpoints

| Path | Auth | Purpose |
|------|------|---------|
| `/healthz` | No | Health check for Railway |
| `/login` | No | Login form |
| `/` | Yes | Status page |
| `/api/status` | Yes | JSON status for refresh |

---

## States

The bootstrap page shows one of three states:

1. **not_configured** → Run `openclaw onboard`
2. **needs_tailscale** → Run `tailscale up`
3. **ready** → Shows Control UI URL

---

## Session Log

### 2026-01-31

- Simplified to minimal bootstrap server
- Removed all API endpoints that modify config
- Status page only - all setup via SSH
- ~300 lines of code total
