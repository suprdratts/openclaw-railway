# Security Model

This template ships with secure defaults. This document explains what's protected and how.

## The Three Security Layers

OpenClaw has three complementary security mechanisms:

| Layer | What It Does | Works on Railway? |
|-------|--------------|-------------------|
| **Tool Policy** | Controls which tools agents can use | Yes |
| **Sandbox** | Isolates execution in Docker containers | No (requires Docker-in-Docker) |
| **Elevated Mode** | Escape hatch for host exec when sandboxed | Yes (disabled by default) |

Since Railway doesn't support Docker-in-Docker, this template relies on **Tool Policy** and **Linux File Permissions** as the primary security mechanisms.

## Default Configuration (Tier 0)

Out of the box, your agent can:
- Chat via messaging channels
- Read/write files in the workspace
- Fetch and read web pages
- Search memories (auto-configured with OpenRouter/OpenAI)
- List directories (`ls` only)
- Schedule cron jobs

Everything else is blocked:

```json5
{
  agents: {
    defaults: {
      tools: {
        allow: ["read", "write", "edit", "memory_get", "memory_search", "web_search", "web_fetch", "exec", "cron"],
        deny: ["process", "browser", "nodes", "gateway", "agents_list", "sessions_spawn"]
      }
    }
  }
}
```

### Filesystem Protection

This template uses two complementary mechanisms to protect sensitive files:

#### 1. Workspace-Only Sandbox (`tools.fs.workspaceOnly`)

The agent's `read`, `write`, and `edit` tools are restricted to the workspace directory (`/data/workspace/`). Any attempt to access files outside the workspace is rejected by the gateway with "Path escapes sandbox root."

```json5
{
  tools: {
    fs: {
      workspaceOnly: true
    }
  }
}
```

This blocks:
- Reading `/proc/self/environ` (API keys, tokens)
- Reading `/data/.openclaw/openclaw.json` (config with secrets)
- Writing to `/home/openclaw/.openclaw/exec-approvals.json` (exec policy)
- Any file access outside `/data/workspace/`

#### 2. Linux File Permissions (defense in depth)

The entrypoint also hardens file ownership as a second layer. Even if `workspaceOnly` were bypassed, OS permissions prevent writes to critical files:

| Path | Owner | Perms | Purpose |
|------|-------|-------|---------|
| `/data/.openclaw/openclaw.json` | root:openclaw | 640 | Config — gateway reads, agent can't write |
| `/data/.openclaw/` directory | root:openclaw | 750 | Agent can't create new files |
| `/home/openclaw/.openclaw/` | root:openclaw | 750 | Agent can't create new files |
| `exec-approvals.json` | root:openclaw | 660 | Gateway needs write for metadata |
| `/data/workspace/AGENTS.md` etc. | root:openclaw | 440 | Shipped templates — read-only |
| `/data/workspace/MEMORY.md` etc. | openclaw:openclaw | 644 | User files — read/write |

Behavioral template files (`AGENTS.md`, `TOOLS.md`, `PROGRESSION.md`, `PROJECTS.md`) are locked to `root:openclaw 440` and forcibly restored from the container image on every startup. This prevents a prompt injection from persistently rewriting the agent's safety instructions.

## What Each Blocked Tool Does

These tools are blocked at Tier 0 (default). See [TIERS.md](docs/TIERS.md) for what each tier unlocks.

| Tool | Risk | Why It's Blocked |
|------|------|------------------|
| `process` | Critical | Manage background processes, bypass approval |
| `browser` | High | Access logged-in sessions, run JavaScript |
| `nodes` | High | Camera/screen capture, device control |
| `gateway` | Critical | Modify gateway configuration |
| `agents_list` | Medium | Enumerate other agents |
| `sessions_spawn` | Medium | Create unlimited subagents |

**Allowed at Tier 0** (with restrictions): `read`, `write`, `edit`, `exec` (ls only), `memory_get`, `memory_search`, `web_search`, `web_fetch`, `cron`.

## Access Control

### Owner Allowlist

When you set `TELEGRAM_OWNER_ID` (or Discord/Slack equivalent), you're added to the allowlist. You can message the bot immediately without pairing.

### Pairing for Others

Anyone else who messages the bot gets a pairing code. They must share it with you, and you approve via SSH:

```bash
openclaw pairing approve telegram <CODE>
```

Or set `dmPolicy: "allowlist"` and manually add user IDs.

### Session Isolation

Each user gets their own conversation context:

```json5
{
  session: {
    dmScope: "per-channel-peer"
  }
}
```

User A cannot see User B's conversation history.

## Gateway Security

The gateway is bound to loopback only:

```json5
{
  gateway: {
    bind: "loopback",
    auth: { mode: "token" }
  }
}
```

This means:
- Gateway is not accessible from outside the container
- Token authentication required for any connection
- Health endpoint (`/healthz`) reveals nothing sensitive

## What Railway Protects

Railway's container provides hard boundaries:

| Protection | Description |
|------------|-------------|
| Container isolation | Agent cannot escape to Railway host |
| Network isolation | No access to other Railway services |
| Volume isolation | `/data` is your persistent storage only |
| Secret injection | Env vars injected at runtime, not stored in image |

## What Railway Cannot Protect

| Risk | Mitigation |
|------|------------|
| Prompt injection | Tool policy limits blast radius |
| API key theft | `workspaceOnly` blocks reads outside workspace; config write-locked; `env -i` on gateway process |
| Data exfiltration via `web_fetch` | `web_fetch` is GET-only (limits payload size); no URL allowlist exists yet (PR #18584 reverted) |
| Data exfiltration via `exec` | Exec allowlist at Tiers 0-1; `env -i` prevents env var leaks; OC-09 fix blocks `$VAR` injection |
| Resource exhaustion | Railway's resource limits apply |

## Upstream Security Hardening (v2026.2.12–2026.2.17)

OpenClaw v2026.2.12 through v2026.2.17 included several security fixes that strengthen this template's defenses. These are built into the base image — no configuration needed.

| Fix | Versions | What It Does |
|-----|----------|-------------|
| **OC-09: Exec credential theft** | v2026.2.14, .17 | Blocks `$VAR` injection in exec scripts, fixes `safeBins` shell expansion bypass, removes `node_modules/.bin` from PATH |
| **SSRF hardening** | v2026.2.12, .13, .14 | `web_fetch` blocks loopback/internal hostnames, IPv4-mapped IPv6 bypass patched, private network blocking |
| **Session transcript permissions** | v2026.2.14, .17 | New transcripts created with `0o600` (user-only) permissions |
| **`$include` config traversal** | v2026.2.14, .17 | Config includes confined to config directory, symlink checks hardened |
| **Sandbox Docker injection** | v2026.2.13, .15 | Blocks dangerous Docker config (bind mounts, host networking) |
| **High-risk tools via HTTP** | v2026.2.13 | `sessions_spawn` etc. blocked from `/tools/invoke` HTTP endpoint |
| **`apply_patch` traversal** | v2026.2.14 | Enforces workspace-root path bounds |

**Not yet available:** URL allowlists for `web_fetch`/`web_search` (PR #18584 was reverted). Data exfiltration via `web_fetch` GET parameters remains an open vector — mitigated by behavioral templates.

### Defense-in-Depth Summary

This template combines upstream gateway hardening with its own security layers:

1. **`tools.fs.workspaceOnly: true`** — Blocks file access outside workspace
2. **`env -i` process isolation** — No secrets in `/proc/self/environ`
3. **Linux file permissions** — Config 640, dirs 750, behavioral templates 440
4. **Exec allowlist** — Tier-appropriate command restrictions
5. **Behavioral templates** — Locked and force-restored on every startup
6. **Upstream SSRF guards** — Gateway blocks private/internal hostnames
7. **Upstream OC-09 fix** — Exec env var injection patched at gateway level

## Skills and Plugins

OpenClaw's extension ecosystem ([ClawHub](https://clawhub.ai/)) is gated by the tier system through exec access:

| Tier | Skill Installation | Skill Usage |
|------|-------------------|-------------|
| 0-1 | Blocked (no exec access to `openclaw` or `clawhub` binaries) | Pre-installed and HTTP-based skills work |
| 2-3 | Available via `openclaw skills install` or `clawhub install` | All skills work |

**What this means for security:**

- **Tiers 0-1 are safe from skill-based attacks.** The agent cannot install new skills because it lacks exec access to the installation binaries. Pre-installed skills (placed in `/data/workspace/skills/` by the operator) work fine.
- **Tier 2+ can self-install skills.** If the agent is socially engineered into running `openclaw skills install <malicious-skill>`, full exec mode means no approval gate — commands run immediately. Treat this the same as the general "full exec" risk at Tier 2.
- **No skill-level allowlist exists.** There's no gateway config to restrict which skills can load. You can disable specific skills with `skills.entries.<name>.enabled: false`, but there's no allowlist equivalent.
- **HTTP-based skills bypass exec restrictions.** A skill that teaches the agent to call an external HTTP API works at Tier 0 via `web_fetch`. This is by design — the skill itself is just instructions, and `web_fetch` is already allowed. The security boundary for these skills is on the external service (authentication, rate limiting, read-only keys).

**Recommendations:**
- Pre-install trusted skills at image build time or via SSH, rather than letting the agent install them at runtime
- Audit ClawHub skills before installation: `openclaw skill audit <skill-name>`
- For external service integrations at Tier 0, use the HTTP API pattern — the agent calls endpoints with `web_fetch`, and the external service enforces its own access control

See [TIERS.md](docs/TIERS.md) for the full skills-by-tier breakdown.

## Unlocking More Capabilities

See [TIERS.md](docs/TIERS.md) for how to progressively enable more agent capabilities.

## Security Audit

SSH in and run:

```bash
openclaw security audit --deep
```

This checks for common misconfigurations.

## Dangerous Configurations

**Never do these:**

| Configuration | Risk |
|---------------|------|
| `gateway.bind: "lan"` | Exposes gateway to network |
| `gateway.bind: "0.0.0.0"` | Exposes gateway to internet |
| `dmPolicy: "open"` | Anyone can use your bot |
| `tools.deny: []` | All tools available |
| `elevated.enabled: true` | Host exec escape available |
| API keys in config file | Stored on disk, potentially leaked |

## Environment Variables

API keys and tokens should always be set as Railway environment variables, not in `openclaw.json`. Railway encrypts these at rest and injects them at runtime.

See [config/environment.md](config/environment.md) for the full list.

## Further Reading

- [OpenClaw Security Docs](https://docs.openclaw.ai/gateway/security)
- [Tool Policy vs Sandbox vs Elevated](https://docs.openclaw.ai/gateway/sandbox-vs-tool-policy-vs-elevated)
- [Threat Model](docs/THREAT-MODEL.md)
