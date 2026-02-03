# OpenClaw Railway Deployment - Threat Model

## Executive Summary

This document maps the complete security architecture for deploying OpenClaw on Railway. It covers every component, every attack surface, and every control.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              THE INTERNET                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         RAILWAY EDGE NETWORK                                 │
│  • HTTPS termination (automatic SSL via LetsEncrypt)                        │
│  • Adds X-Real-IP, X-Forwarded-Proto headers                                │
│  • 4 global edge locations (anycast routing)                                │
│  • Rate limit: ~11k req/sec, 10k concurrent connections                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         RAILWAY CONTAINER                                    │
│                                                                              │
│   PUBLIC PORT 8080 ─────────────────────────────────────────────────────┐   │
│   │                                                                      │   │
│   │  Bootstrap Server (Bun)                                             │   │
│   │  • /login - password auth                                           │   │
│   │  • / - status page (read-only)                                      │   │
│   │  • /healthz - health check                                          │   │
│   │                                                                      │   │
│   └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   LOOPBACK ONLY (127.0.0.1:18789) ──────────────────────────────────────┐   │
│   │                                                                      │   │
│   │  OpenClaw Gateway (Node.js)                                         │   │
│   │  • Control UI (WebSocket)                                           │   │
│   │  • Channel handlers (Telegram, Discord, etc.)                       │   │
│   │  • LLM routing                                                       │   │
│   │  • Tool execution                                                    │   │
│   │                                                                      │   │
│   └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   VOLUME: /data ────────────────────────────────────────────────────────┐   │
│   │  /.openclaw/openclaw.json  (config, tokens, API keys) [CRITICAL]    │   │
│   │  /.openclaw/credentials/   (channel auth data) [CRITICAL]           │   │
│   │  /.openclaw/agents/        (sessions, transcripts)                  │   │
│   │  /workspace/               (files created by agent)                  │   │
│   └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL SERVICES                                    │
│                                                                              │
│   LLM Providers          Channel Platforms         Your Tailnet             │
│   • Anthropic API        • Telegram Bot API        • Tailscale mesh         │
│   • OpenAI API           • Discord API             • Your devices           │
│   • Google AI            • Slack API                                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Components Explained

### 1. Railway Edge Network

**What it is:** Railway's global proxy layer that sits in front of your container.

**What it does:**
- Terminates HTTPS (your container only sees HTTP)
- Adds headers: `X-Real-IP`, `X-Forwarded-Proto`, `X-Railway-Edge`
- Routes traffic to nearest edge, then to your container
- Enforces rate limits (11k req/sec, 10k connections)

**What it does NOT do:**
- No WAF (Web Application Firewall)
- No IP allowlisting/blocklisting
- No request inspection

**Security implication:** You must implement your own rate limiting and input validation.

---

### 2. Bootstrap Server (Port 8080)

**What it is:** A minimal Bun server that shows setup status.

**What it does:**
- Shows whether OpenClaw is configured
- Shows whether Tailscale is connected
- Shows the Control UI URL when ready
- Protected by `SETUP_PASSWORD`

**What it does NOT do:**
- Does NOT proxy to the gateway
- Does NOT run any CLI commands
- Does NOT modify configuration
- Pure read-only status page

**Security implication:** Low attack surface. Only risk is password brute-force (mitigated by rate limiting).

---

### 3. OpenClaw Gateway (Port 18789)

**What it is:** The core OpenClaw process that handles everything.

**What it does:**
- Serves Control UI (web dashboard)
- Handles WebSocket connections
- Manages channel integrations (Telegram, Discord, etc.)
- Routes messages to LLMs
- Executes tools (if enabled)

**Binding:**
- Bound to `127.0.0.1` (loopback only)
- NOT accessible from the internet directly
- Only accessible via Tailscale or SSH tunnel

**Authentication:**
- Token-based auth required (32-byte hex)
- Token stored in `~/.openclaw/openclaw.json`
- Auto-generated if not provided

**Security implication:** Not exposed to internet. Access requires Tailscale or SSH.

---

### 4. Volume (/data)

**What it is:** Persistent storage that survives container restarts.

**What it contains:**

| Path | Contents | Sensitivity |
|------|----------|-------------|
| `/.openclaw/openclaw.json` | Config, gateway token, API keys | **CRITICAL** |
| `/.openclaw/credentials/` | Channel auth (WhatsApp sessions, etc.) | **CRITICAL** |
| `/.openclaw/agents/*/auth-profiles.json` | OAuth tokens, API keys | **CRITICAL** |
| `/.openclaw/agents/*/sessions/` | Message history, transcripts | HIGH |
| `/workspace/` | Files created by the agent | MEDIUM |

**Security implication:** Anyone with container access can read all secrets.

---

## Attack Surfaces

### Attack Surface 1: Public Railway URL

**Exposure:** `https://your-app.up.railway.app`

**What's exposed:**
- Bootstrap server (port 8080)
- `/login` - login page
- `/` - status page (after auth)
- `/healthz` - health check (no auth)

**Attack vectors:**

| Vector | Risk | Mitigation |
|--------|------|------------|
| Password brute-force | Medium | Rate limiting (30 req/min) |
| Session hijacking | Low | HttpOnly, Secure, SameSite cookies |
| Information disclosure | Low | Status page shows minimal info |

**NOT exposed:**
- Gateway (18789) - loopback only
- Volume contents - no file serving

---

### Attack Surface 2: Control UI (via Tailscale)

**Exposure:** `http://<tailscale-ip>:18789`

**What's exposed:**
- Full OpenClaw dashboard
- Chat interface
- Configuration editor
- Channel management
- Log viewer

**Attack vectors:**

| Vector | Risk | Mitigation |
|--------|------|------------|
| Unauthorized access | High | Tailscale auth + gateway token |
| Session hijacking | Medium | Device pairing required |
| Prompt injection via UI | Medium | Model-level defenses |

**Requirements for access:**
1. Must be on your Tailnet (authenticated)
2. Must have gateway token
3. Must complete device pairing

---

### Attack Surface 3: Channel Messages (Telegram, Discord, etc.)

**Exposure:** Anyone who knows your bot username can message it.

**What's exposed:**
- Message input to the AI
- Potential tool execution
- Session history

**Attack vectors:**

| Vector | Risk | Mitigation |
|--------|------|------------|
| Spam/abuse | Medium | Pairing requirement |
| Prompt injection | High | Model defenses, tool restrictions |
| Resource exhaustion | Medium | Rate limiting, session limits |

**Default protections:**
- `dmPolicy: pairing` - must approve each user
- `groupPolicy: allowlist` - must approve each group
- `nodes.run.enabled: false` - no command execution

---

### Attack Surface 4: SSH Access

**Exposure:** `railway ssh` from anyone with Railway project access.

**What's exposed:**
- Full shell access to container
- All files including secrets
- Ability to run any command

**Attack vectors:**

| Vector | Risk | Mitigation |
|--------|------|------------|
| Malicious project member | Critical | Limit Railway team access |
| Credential theft | Critical | Limit who has CLI access |

**Security implication:** Railway project members have god-mode access.

---

### Attack Surface 5: Environment Variables

**Exposure:** Visible in Railway dashboard and API.

**What's exposed:**
- `SETUP_PASSWORD`
- Any API keys stored as env vars

**Attack vectors:**

| Vector | Risk | Mitigation |
|--------|------|------------|
| Dashboard exposure | Medium | Use sealed variables |
| API exposure | Medium | Use sealed variables |
| PR environment copying | Medium | Sealed vars don't copy |

**Recommendation:** Use Railway's sealed variables for secrets.

---

## Trust Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│ TRUST LEVEL 0: Public Internet                                  │
│ • Anyone can access Railway public URL                          │
│ • Anyone can message your Telegram/Discord bot                  │
│ • NO trust - verify everything                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (SETUP_PASSWORD)
┌─────────────────────────────────────────────────────────────────┐
│ TRUST LEVEL 1: Authenticated Bootstrap                          │
│ • Can see setup status                                          │
│ • Can see Tailscale IP and gateway token                        │
│ • Read-only access                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (Tailscale + Gateway Token)
┌─────────────────────────────────────────────────────────────────┐
│ TRUST LEVEL 2: Control UI Access                                │
│ • Can configure channels                                        │
│ • Can view logs and sessions                                    │
│ • Can approve pairings                                          │
│ • Can chat with the AI                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (Pairing Approval)
┌─────────────────────────────────────────────────────────────────┐
│ TRUST LEVEL 3: Approved Channel Users                           │
│ • Can chat with the AI via Telegram/Discord                     │
│ • Limited by tool restrictions                                  │
│ • Session isolated per user                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (Railway Project Access)
┌─────────────────────────────────────────────────────────────────┐
│ TRUST LEVEL 4: Infrastructure Admin                             │
│ • Full SSH access                                               │
│ • Can read all secrets                                          │
│ • Can modify anything                                           │
│ • GOD MODE                                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Security Controls

### Control 1: SETUP_PASSWORD

**What it protects:** Bootstrap server access

**Requirements:**
- Minimum 16 characters
- Set in Railway environment variables
- Should use sealed variable

**What it does NOT protect:**
- Gateway access (separate token)
- Channel access (separate pairing)
- SSH access (Railway auth)

---

### Control 2: Gateway Token

**What it protects:** Control UI and WebSocket API

**How it works:**
- 32-byte hex token
- Auto-generated by OpenClaw if not set
- Stored in `~/.openclaw/openclaw.json`
- Passed in URL: `?token=<hex>`

**What it does NOT protect:**
- Bootstrap server (separate password)
- Channel messages (separate pairing)

---

### Control 3: Channel Pairing

**What it protects:** Who can message your bot

**How it works:**
1. Unknown user messages bot
2. Bot replies with pairing code
3. You approve code via Control UI or CLI
4. User added to allowlist

**Policies:**
- `pairing` (default) - require approval
- `allowlist` - only pre-approved users
- `open` - anyone can message (DANGEROUS)

---

### Control 4: Tool Restrictions

**What it protects:** What the AI can do

**Critical setting:**
```json
{
  "nodes": {
    "run": {
      "enabled": false  // DEFAULT - no shell commands
    }
  }
}
```

**When enabled:** AI can run arbitrary shell commands on container.

**Recommendation:** NEVER enable for public bots.

---

### Control 5: Tailscale Network

**What it protects:** Control UI from public internet

**How it works:**
- Gateway binds to loopback only
- Tailscale creates encrypted tunnel
- Only your devices can access gateway

**Requirements:**
- Tailscale daemon running in container
- Your devices on same Tailnet
- Initial auth via SSH

---

## Data Flow Diagrams

### Flow 1: Initial Setup

```
You                    Railway              Container
 │                        │                     │
 │─── Deploy ────────────▶│                     │
 │                        │──── Start ─────────▶│
 │                        │                     │
 │◀── Public URL ─────────│                     │
 │                        │                     │
 │─── Visit /login ───────────────────────────▶│
 │◀── Login page ─────────────────────────────│
 │                        │                     │
 │─── POST password ──────────────────────────▶│
 │◀── Session cookie ─────────────────────────│
 │                        │                     │
 │─── Visit / ────────────────────────────────▶│
 │◀── "Not configured" ───────────────────────│
 │                        │                     │
 │─── railway ssh ───────▶│                     │
 │                        │──── SSH session ───▶│
 │                        │                     │
 │─── openclaw onboard ───────────────────────▶│
 │◀── Interactive setup ──────────────────────│
 │                        │                     │
 │─── tailscale up ───────────────────────────▶│
 │◀── Auth URL ───────────────────────────────│
 │                        │                     │
 │─── Approve in browser ─▶│ (Tailscale)        │
 │                        │                     │
 │◀── Connected ──────────────────────────────│
```

### Flow 2: Accessing Control UI

```
You (Mac)              Tailscale           Container
 │                        │                     │
 │─── tailscale up ──────▶│                     │
 │◀── Connected ─────────│                     │
 │                        │                     │
 │─── HTTP to 100.x.x.x:18789 ────────────────▶│
 │                        │    (encrypted)      │
 │                        │                     │
 │◀── Control UI ─────────────────────────────│
 │    (requires ?token=)  │                     │
```

### Flow 3: Telegram Message

```
User                   Telegram           Container           LLM
 │                        │                   │                 │
 │─── Message ───────────▶│                   │                 │
 │                        │─── Webhook ──────▶│                 │
 │                        │                   │                 │
 │                        │                   │── (if not paired)
 │                        │◀── Pairing code ──│                 │
 │◀── Pairing code ──────│                   │                 │
 │                        │                   │                 │
 │         [You approve pairing via Control UI]                 │
 │                        │                   │                 │
 │─── Message ───────────▶│                   │                 │
 │                        │─── Webhook ──────▶│                 │
 │                        │                   │─── API call ───▶│
 │                        │                   │◀── Response ────│
 │                        │◀── Reply ─────────│                 │
 │◀── Reply ─────────────│                   │                 │
```

---

## Configuration Reference

### Environment Variables

| Variable | Required | Sensitive | Purpose |
|----------|----------|-----------|---------|
| `SETUP_PASSWORD` | Yes | Yes | Bootstrap server auth |
| `PORT` | No | No | Railway sets automatically |
| `OPENCLAW_STATE_DIR` | No | No | Config directory (default: `/data/.openclaw`) |
| `OPENCLAW_WORKSPACE_DIR` | No | No | Workspace (default: `/data/workspace`) |

### OpenClaw Config (`~/.openclaw/openclaw.json`)

```json
{
  "gateway": {
    "port": 18789,
    "bind": "loopback",
    "auth": {
      "mode": "token",
      "token": "<auto-generated-32-byte-hex>"
    },
    "trustedProxies": []
  },

  "channels": {
    "telegram": {
      "enabled": true,
      "botToken": "<from-botfather>",
      "dmPolicy": "pairing",
      "groupPolicy": "allowlist"
    }
  },

  "nodes": {
    "run": {
      "enabled": false
    }
  },

  "agents": {
    "defaults": {
      "model": "anthropic/claude-sonnet-4-20250514"
    }
  }
}
```

---

## Hardened Defaults

Our template enforces these security defaults:

| Setting | Value | Why |
|---------|-------|-----|
| `gateway.bind` | `loopback` | Not accessible from internet |
| `gateway.auth.mode` | `token` | Requires authentication |
| `nodes.run.enabled` | `false` | No arbitrary command execution |
| `dmPolicy` | `pairing` | Must approve each user |
| `groupPolicy` | `allowlist` | Must approve each group |
| Container user | `openclaw (1001)` | Non-root |
| Bootstrap rate limit | 30/min | Prevent brute force |

---

## What Persists vs What's Ephemeral

### Persists (survives redeploy)

- `/data/.openclaw/openclaw.json` - configuration
- `/data/.openclaw/credentials/` - channel auth
- `/data/.openclaw/agents/` - sessions, transcripts
- `/data/workspace/` - agent-created files
- Tailscale auth state (in `/var/lib/tailscale/`)

### Ephemeral (lost on redeploy)

- Running processes (gateway, tailscaled)
- In-memory sessions
- Temporary files outside /data

### Implication

After every redeploy, you must:
1. Gateway auto-starts (if we configure entrypoint correctly)
2. Tailscale daemon must restart
3. Tailscale re-authenticates automatically (state persisted)

---

## The Tailscale Problem

### Why Tailscale is needed

The Control UI requires either:
- `localhost` access, OR
- `HTTPS` connection

Railway provides HTTPS on public URL, but the WebSocket auth breaks through their proxy (bug in OpenClaw's proxy detection).

Tailscale provides:
- Direct encrypted tunnel to gateway
- HTTPS via `tailscale serve`
- No proxy in the middle

### The daemon problem

Tailscale needs `tailscaled` running continuously. Railway containers have no systemd.

**Solution:** Start `tailscaled` in entrypoint script:
```bash
tailscaled --tun=userspace-networking --state=/data/tailscale &
```

### First-time setup

User must SSH in once to authenticate Tailscale:
```bash
railway ssh
tailscale up
# Click auth link
```

After that, Tailscale auto-reconnects on container restart.

---

## Onboarding Flow (User Perspective)

### Step 1: Deploy Template

1. Click "Deploy" on Railway template
2. Set `SETUP_PASSWORD` in variables
3. Wait for build (~5 minutes)

### Step 2: Initial Configuration

1. Visit Railway public URL
2. Login with setup password
3. See "Not Configured" status

### Step 3: SSH Setup

```bash
# On your local machine
railway login
railway link    # select project
railway ssh

# Inside container
openclaw onboard
# Follow prompts to configure LLM provider

tailscale up
# Click auth link to join your Tailnet
```

### Step 4: Install Tailscale Locally

1. Download Tailscale for your OS
2. Sign in with same account
3. Now you can access the Control UI

### Step 5: Access Control UI

1. Refresh Railway public URL
2. Copy the Control UI link
3. Open in browser (from any Tailscale device)

### Step 6: Configure Channels

1. In Control UI, go to Channels
2. Add Telegram bot token
3. Test by messaging bot
4. Approve pairing code

---

## Lessons for Users

### Lesson 1: Trust Ladder

More access = more trust required:
1. **Internet** → Nothing
2. **Setup password** → Status only
3. **Tailscale + token** → Control UI
4. **Pairing code** → Channel access
5. **Railway access** → Everything

### Lesson 2: Secrets Live in the Volume

Everything sensitive is in `/data/.openclaw/`. Anyone with SSH access can read it all.

### Lesson 3: Command Execution is the Biggest Risk

`nodes.run.enabled: true` lets the AI run shell commands. This is powerful but dangerous. Keep it disabled unless you trust all approved users AND the AI.

### Lesson 4: Pairing is Your First Line of Defense

Even if someone finds your bot, they can't use it without your approval. Always use `dmPolicy: pairing`.

### Lesson 5: Tailscale is Not Optional

The Control UI doesn't work securely without it. Accept this complexity or skip the web UI entirely.

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────┐
│                    OPENCLAW SECURITY                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  SETUP PASSWORD     → Bootstrap server access               │
│  GATEWAY TOKEN      → Control UI access                     │
│  PAIRING CODES      → Channel user access                   │
│  RAILWAY ACCESS     → Full admin (god mode)                 │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  SAFE DEFAULTS:                                              │
│  ✓ gateway.bind = loopback                                  │
│  ✓ nodes.run.enabled = false                                │
│  ✓ dmPolicy = pairing                                       │
│  ✓ groupPolicy = allowlist                                  │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  DANGER ZONE:                                                │
│  ✗ nodes.run.enabled = true  (AI can run commands)         │
│  ✗ dmPolicy = open           (anyone can message)          │
│  ✗ gateway.bind = lan        (exposed to network)          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```
