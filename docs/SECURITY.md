# OpenClaw Security Guide

This guide covers how to harden your OpenClaw Railway deployment.

## Quick Hardening Checklist

Run after `openclaw onboard`:

```bash
# Run the built-in security audit
openclaw security audit --deep --fix
```

This automatically fixes common security issues.

## Environment Variables (Railway)

**Never store API keys in the config file.** Use Railway's environment variables instead.

In Railway Dashboard → Variables, add:

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `OPENAI_API_KEY` | Your OpenAI API key (if using) |
| `GEMINI_API_KEY` | Your Google Gemini API key (if using) |
| `TELEGRAM_BOT_TOKEN` | From @BotFather |
| `DISCORD_BOT_TOKEN` | From Discord Developer Portal |

Railway encrypts these at rest. They're injected at runtime, never written to disk.

## Sandboxing

Sandbox mode isolates agent execution in Docker containers. This prevents a compromised agent from accessing your system.

### Configuration

In `openclaw.json` (or via `openclaw configure`):

```json
{
  "agents": {
    "defaults": {
      "sandbox": {
        "mode": "non-main",
        "workspaceAccess": "rw"
      }
    }
  }
}
```

### Sandbox Modes

| Mode | Description |
|------|-------------|
| `off` | No sandboxing (default) |
| `non-main` | Sandbox channels (Telegram, Discord) but not direct CLI |
| `all` | Sandbox everything including CLI |

### Workspace Access

| Setting | Description |
|---------|-------------|
| `none` | Agent cannot access workspace files |
| `ro` | Read-only access to workspace |
| `rw` | Read-write access to workspace |

**Recommendation:** Use `mode: "non-main"` with `workspaceAccess: "rw"` for channels.

## Tool Permissions

Restrict which tools agents can use.

### Tool Profiles

```json
{
  "tools": {
    "profile": "coding"
  }
}
```

| Profile | Tools Included |
|---------|----------------|
| `minimal` | Only `session_status` |
| `coding` | File system, runtime, sessions, memory |
| `messaging` | Messaging and session tools |
| `full` | All tools (default) |

### Allowlist Specific Commands

```json
{
  "tools": {
    "exec": {
      "enabled": true,
      "security": "sandbox",
      "ask": "always",
      "allowlist": [
        "ls", "cat", "grep", "find", "head", "tail"
      ]
    }
  }
}
```

### Block Sensitive Paths

```json
{
  "tools": {
    "fs": {
      "enabled": true,
      "blocklist": [".ssh", ".aws", ".env", ".openclaw"]
    }
  }
}
```

## Channel Security

### Pairing (Recommended)

Require approval before anyone can message your bot:

```json
{
  "channels": {
    "telegram": {
      "dmPolicy": "pairing",
      "groupPolicy": "allowlist"
    }
  }
}
```

When someone messages your bot:
1. Bot sends them a pairing code
2. They share the code with you
3. You approve: `openclaw pairing approve telegram <code>`

### DM Policies

| Policy | Description |
|--------|-------------|
| `pairing` | Require approval (recommended) |
| `allowlist` | Only pre-approved users |
| `open` | Anyone can message (dangerous) |
| `disabled` | Ignore all DMs |

## Session Isolation

Prevent conversation context leaking between users:

```json
{
  "sessions": {
    "dmScope": "per-channel-peer"
  }
}
```

| Scope | Description |
|-------|-------------|
| `per-channel-peer` | Each user gets isolated context (recommended) |
| `global` | All users share context (dangerous) |

## Gateway Security

The gateway should never be exposed publicly:

```json
{
  "gateway": {
    "bind": "loopback",
    "auth": {
      "mode": "token"
    }
  }
}
```

## File Permissions

OpenClaw stores sensitive data in `~/.openclaw/`. Ensure proper permissions:

```bash
chmod 700 ~/.openclaw
chmod 600 ~/.openclaw/*.json
chmod 700 ~/.openclaw/credentials
```

The entrypoint script handles this automatically for Railway.

## Regular Maintenance

```bash
# Monthly security audit
openclaw security audit --deep

# Check for updates
openclaw update

# Review pairing allowlists
cat ~/.openclaw/credentials/*-allowFrom.json
```

## Dangerous Configurations

**Never do these:**

- `gateway.bind: "lan"` or `"0.0.0.0"` - Exposes gateway to network
- `channels.*.dmPolicy: "open"` - Anyone can use your bot
- `sandbox.mode: "off"` with untrusted channels
- Store API keys in `openclaw.json` instead of env vars
- Share your `openclaw.json` file

## Further Reading

- [OpenClaw Security Docs](https://docs.openclaw.ai/gateway/security)
- [Sandboxing Guide](https://docs.openclaw.ai/concepts/sandboxing)
- [Tool Security](https://docs.openclaw.ai/tools/security)
