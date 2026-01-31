# OpenClaw Railway Deployment Research

**Created:** 2026-01-31
**Status:** HYPOTHESIS - NEEDS VALIDATION
**Purpose:** Document findings and create testable experiments

---

## Executive Summary

This document captures research findings from OpenClaw's official documentation regarding containerized deployment. Everything in this document is a hypothesis until experimentally validated.

---

## Part 1: Official Documentation Findings

### 1.1 Official Docker Deployment Method

**Source:** https://docs.openclaw.ai/install/docker

**Official approach uses:**
- `./docker-setup.sh` script as the recommended entry point
- Docker Compose with two services: `openclaw-gateway` and `openclaw-cli`
- Base image: `node:22-bookworm`
- Runs as non-root `node` user (uid 1000)

**docker-setup.sh does:**
1. Validates dependencies (Docker and Docker Compose v2)
2. Generates gateway token using OpenSSL or Python
3. Builds Docker image
4. Runs interactive onboarding via `docker compose run`
5. Starts gateway via `docker compose up -d`
6. Outputs connection details and token

**HYPOTHESIS 1.1:** The official docker-setup.sh handles token generation and passes it correctly to the gateway.

---

### 1.2 Official Dockerfile Structure

**Source:** https://github.com/openclaw/openclaw/blob/main/Dockerfile

**Key details:**
- Base: `node:22-bookworm`
- Includes Bun for build scripts
- Uses pnpm with frozen lockfiles
- Builds UI separately
- Runs as non-root `node` user (uid 1000)
- `NODE_ENV=production`

**HYPOTHESIS 1.2:** The official Dockerfile is designed for direct gateway execution, not for a wrapper pattern.

---

### 1.3 Official docker-compose.yml

**Source:** https://github.com/openclaw/openclaw/blob/main/docker-compose.yml

**Gateway service command:**
```
node dist/index.js gateway --bind ${OPENCLAW_GATEWAY_BIND:-lan} --port ${OPENCLAW_GATEWAY_PORT:-18789}
```

**Default binding:** `lan` (not loopback)

**Ports exposed:**
- 18789 (gateway)
- 18790 (bridge)

**Environment variables used:**
- `HOME=/home/node`
- `TERM=xterm-256color`
- `OPENCLAW_GATEWAY_TOKEN`
- `CLAUDE_AI_SESSION_KEY`
- `CLAUDE_WEB_SESSION_KEY`
- `CLAUDE_WEB_COOKIE`

**HYPOTHESIS 1.3:** The official setup binds to LAN by default and relies on network-level security or token auth.

---

### 1.4 Gateway Authentication

**Source:** https://docs.openclaw.ai/gateway/security

**Authentication modes:**

1. **Token-based (Recommended)**
   - Config: `gateway.auth.mode: "token"`
   - Token passed via `connect.params.auth.token` in WebSocket handshake
   - Can be supplied in URL: `?token=xxx`

2. **Password-based**
   - Config: `gateway.auth.mode: "password"`
   - Environment: `OPENCLAW_GATEWAY_PASSWORD`

**Network binding options:**
- `loopback` - Only local connections (127.0.0.1)
- `lan` - Local network access
- `tailnet` - Tailscale integration (recommended for remote)
- Custom interface binding

**HYPOTHESIS 1.4:** When accessing remotely, the token must be passed either in the URL query parameter or in the WebSocket handshake.

---

### 1.5 Control UI Authentication

**Source:** https://docs.openclaw.ai/gateway/configuration

**How Control UI gets the token:**
1. URL parameter: `http://<host>:18789/?token=<token>`
2. Stored in dashboard settings after initial load
3. Sent as `connect.params.auth.token` in WebSocket handshake

**HTTPS requirement:**
- HTTPS required for secure device signature validation
- Fallback: `gateway.controlUi.allowInsecureAuth: true`
- Only use insecure auth for debugging

**HYPOTHESIS 1.5:** The Control UI JavaScript reads the token from the URL query parameter and uses it for the WebSocket connection.

---

### 1.6 Reverse Proxy / trustedProxies Configuration

**Source:** https://docs.openclaw.ai/gateway/configuration

**When behind a reverse proxy:**
```json5
{
  gateway: {
    trustedProxies: ["127.0.0.1"],
    auth: {
      mode: "token",
      token: "<32-byte-hex>"
    }
  }
}
```

**Critical rules:**
1. Proxy must OVERWRITE `X-Forwarded-For` headers (not append)
2. Forward: `X-Forwarded-For`, `X-Forwarded-Proto`, `X-Forwarded-Host`
3. If using Tailscale auth, do NOT forward Tailscale identity headers from proxy

**HYPOTHESIS 1.6:** Railway acts as a reverse proxy, so we need trustedProxies configured correctly.

---

### 1.7 Railway-Specific Requirements

**Source:** https://docs.openclaw.ai/railway

**Required configuration:**
- Volume mounted at `/data`
- `SETUP_PASSWORD` environment variable
- `PORT=8080` (Railway's expected port)
- HTTP Proxy enabled

**The wrapper pattern exists because:**
- Railway exposes one port (typically 8080)
- Gateway runs on internal port (18789)
- Something needs to proxy between them
- `/setup` wizard added for user convenience

**HYPOTHESIS 1.7:** The wrapper is a convenience layer, not a technical requirement. We could expose the gateway directly if Railway allowed port 18789.

---

## Part 2: Our Problem Analysis

### 2.1 What We Built

A wrapper server that:
1. Serves `/setup` web UI for configuration
2. Proxies HTTP requests to internal gateway
3. Proxies WebSocket connections to internal gateway
4. Attempts to inject token into `/openclaw` requests

### 2.2 What Failed

**Token injection for WebSocket:**
- We redirect HTTP requests to add `?token=xxx` to URL
- Control UI loads with token in URL
- Control UI JavaScript makes WebSocket connection to `ws://localhost:8080/`
- WebSocket connection has NO token
- Gateway rejects connection (auth required)
- "Disconnected from gateway" error

### 2.3 Why It Failed (Hypothesis)

**HYPOTHESIS 2.3:** The Control UI JavaScript is NOT reading the token from the URL query parameter when making its WebSocket connection. It connects to the root WebSocket path without authentication.

**Alternative hypothesis:** The Control UI expects the gateway to be on the same origin and uses some browser-based auth (cookies, localStorage) that doesn't work through a proxy.

---

## Part 3: Experimental Validation Plan

### Experiment 1: Verify Control UI Token Handling

**Question:** Does the Control UI read the token from URL and pass it to WebSocket?

**Method:**
1. Run OpenClaw gateway directly (not through proxy) with token auth
2. Access Control UI at `http://localhost:18789/?token=xxx`
3. Use browser dev tools to inspect WebSocket connection
4. Check if WebSocket URL or headers include the token

**Expected result:** WebSocket should include token in handshake if official docs are correct.

**Actual result:**
- **CONFIRMED WORKING** (2026-01-31)
- Onboarding generated token: `2358942105cb6a5f2d219d21a57dc176b2b76157a961c74a`
- Control UI opened at `http://127.0.0.1:18789/?token=xxx`
- Control UI connected successfully, shows "Health Online"
- Token stored in localStorage at `openclaw.control.settings.v1`

**Key findings from onboarding:**
1. Token can be auto-generated (leave blank) or user-provided
2. Token stored in `~/.openclaw/openclaw.json` at `gateway.auth.token`
3. Can also be set via `OPENCLAW_GATEWAY_TOKEN` env var
4. Web UI saves token to localStorage after first visit with `?token=xxx`
5. Command `openclaw dashboard --no-open` outputs the tokenized URL

**NEXT STEP:** Test what happens when accessing through a proxy - does the WebSocket still work?

**CRITICAL DISCOVERY - Token Storage Mechanism:**

Inspected localStorage at `openclaw.control.settings.v1`:
```json
{
  "gatewayUrl": "ws://127.0.0.1:18789",
  "token": "2358942105cb6a5f2d219d21a57dc176b2b76157a961c74a",
  "sessionKey": "agent:main:main",
  ...
}
```

**The flow:**
1. First visit with `?token=xxx` in URL
2. Control UI JavaScript reads token from URL query param
3. Saves token to localStorage (`openclaw.control.settings.v1`)
4. Strips token from URL (security - don't leave in browser history)
5. Future visits read token from localStorage
6. WebSocket handshake uses token from localStorage

**Why proxy fails:**
- localStorage is per-origin (scheme + host + port)
- When proxied through `localhost:8080`, that's a different origin than `localhost:18789`
- Token saved to `localhost:8080` localStorage
- But Control UI might be trying to connect WebSocket to different origin
- Or the gateway at :18789 has no knowledge of the token stored at :8080

**HYPOTHESIS:** The wrapper proxy pattern fails because of localStorage origin isolation. The token gets stored for the wrapper's origin, but the WebSocket connection behavior depends on how the Control UI determines the gateway URL.

---

### Experiment 2: Verify Official Docker Setup

**Question:** Does the official docker-setup.sh work correctly?

**Method:**
1. Clone OpenClaw repo fresh
2. Run `./docker-setup.sh`
3. Complete onboarding
4. Access Control UI
5. Verify WebSocket connects successfully

**Expected result:** Should work out of the box.

**Actual result:** [TO BE FILLED]

---

### Experiment 3: Verify Gateway Binding Modes

**Question:** What happens with different bind modes?

**Method:**
1. Test `--bind loopback` - access from localhost only
2. Test `--bind lan` - access from local network
3. Test with and without `--auth token`

**Expected results:**
- Loopback: Only localhost can connect
- LAN: Network can connect
- Token required when auth enabled

**Actual results:** [TO BE FILLED]

---

### Experiment 4: Verify trustedProxies Behavior

**Question:** Does trustedProxies configuration allow proxy access?

**Method:**
1. Configure `gateway.trustedProxies: ["127.0.0.1"]`
2. Run simple nginx/caddy proxy in front of gateway
3. Access through proxy
4. Check if gateway accepts connection

**Expected result:** Gateway should accept proxied connections.

**Actual result:** [TO BE FILLED]

---

### Experiment 5: Minimal Railway Deployment

**Question:** Can we deploy gateway directly without wrapper?

**Method:**
1. Create minimal Dockerfile that just runs `openclaw gateway run`
2. Deploy to Railway with volume at `/data`
3. SSH in and run `openclaw onboard`
4. Access gateway directly on Railway's port
5. Test Control UI with `?token=xxx`

**Expected result:** Should work if our hypotheses are correct.

**Actual result:** [TO BE FILLED]

---

## Part 4: Configuration Reference

### 4.1 Minimal Secure Configuration (Hypothesized)

```json5
{
  gateway: {
    mode: "local",
    port: 18789,
    bind: "loopback",
    trustedProxies: ["127.0.0.1"],
    auth: {
      mode: "token",
      token: "${OPENCLAW_GATEWAY_TOKEN}"
    }
  },
  agents: {
    defaults: {
      workspace: "/data/workspace"
    }
  },
  channels: {
    // configured per user
  }
}
```

### 4.2 Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `OPENCLAW_GATEWAY_TOKEN` | Gateway authentication | Yes (for remote) |
| `OPENCLAW_STATE_DIR` | Config directory | No (default: ~/.openclaw) |
| `OPENCLAW_WORKSPACE_DIR` | Workspace directory | No (default: ~/.openclaw/workspace) |
| `PORT` | Railway port | Yes (Railway) |

### 4.3 Security Hardening Checklist

From official docs (https://docs.openclaw.ai/security):

- [ ] `gateway.bind: "loopback"` - Don't expose directly
- [ ] `gateway.auth.mode: "token"` - Require authentication
- [ ] `dmPolicy: "pairing"` - Require approval for unknown senders
- [ ] `agents.defaults.sandbox.mode: "all"` - Sandbox tool execution
- [ ] Disable dangerous tools unless needed
- [ ] File permissions: ~/.openclaw at 700, openclaw.json at 600
- [ ] Run `openclaw security audit` regularly

---

## Part 5: Open Questions

1. **Why does Vignesh's template work (reportedly)?**
   - Does it actually work with token auth?
   - Or does it use `--auth none`?
   - Need to test directly.

2. **How does Control UI pass token to WebSocket?**
   - URL parameter?
   - Query string on WebSocket URL?
   - Handshake parameters?
   - Need to inspect actual behavior.

3. **Can Railway expose port 18789 directly?**
   - Without a wrapper proxy?
   - Would simplify everything.

4. **What does `gateway.controlUi.basePath` do?**
   - Can it solve the proxy routing issue?

5. **Is the wrapper pattern fundamentally flawed?**
   - Or are we just implementing it wrong?

6. **IMPORTANT: Remote Gateway Mode**
   - OpenClaw has "remote gateway" setup for clients connecting to a gateway elsewhere
   - This might be the correct pattern for Railway deployments
   - Users deploy gateway on Railway, then configure local CLI as "remote gateway"
   - Needs investigation: How does remote gateway auth work?

7. **IMPORTANT: Tailscale/Tailnet Integration**
   - Official docs recommend Tailscale Serve over LAN binds
   - Tailscale handles auth automatically
   - Encrypted tunnel without public port exposure
   - Questions:
     - How does Tailscale integrate with OpenClaw?
     - Is Tailscale viable on Railway?
     - Could this replace our wrapper entirely?
   - Reference: https://docs.openclaw.ai/gateway/security
   - **NOTE from Experiment 1:** Gateway bind options are Loopback, LAN, Tailnet, Auto, Custom.
     If we use Tailnet on Railway, gateway stays on loopback but Tailscale handles external access.
     This could be the secure alternative to our wrapper proxy pattern.
   - **NOTE from Experiment 1:** Tailscale exposure is a SEPARATE option from bind mode.
     Even with Loopback binding, you can add Tailscale Serve on top.
     Options: Off, Serve (private tailnet), Funnel (public internet).
     This is the layered security model - loopback + Tailscale Serve = secure remote access.

---

## Part 6: Next Steps

1. Run Experiment 1 locally to understand Control UI token behavior
2. Run Experiment 2 to validate official Docker setup works
3. Based on results, either:
   a. Fix our wrapper implementation
   b. Abandon wrapper and use direct gateway deployment
   c. Identify bug in OpenClaw and report upstream

---

## Changelog

- 2026-01-31: Initial document created from research session
