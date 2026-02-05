# Sandboxing Guide

Sandboxing isolates agent execution in Docker containers, preventing compromised agents from accessing your system.

## Why Sandbox?

Without sandboxing, an agent can:
- Read/write any file the `openclaw` user can access
- Execute any command
- Access network resources
- Read your API keys and secrets

With sandboxing:
- Agent runs in isolated Docker container
- Limited filesystem access
- Network can be restricted
- Cannot access host system

## Enable Sandboxing

### Via CLI

```bash
openclaw configure --section sandbox
```

### Via Config

In `openclaw.json`:

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

## Sandbox Modes

### `off` (Default)

No sandboxing. Agent runs directly on host.

```json
{
  "sandbox": {
    "mode": "off"
  }
}
```

**Use when:** You trust the input source (e.g., only you use the bot).

### `non-main` (Recommended)

Sandbox channel sessions (Telegram, Discord) but not direct CLI usage.

```json
{
  "sandbox": {
    "mode": "non-main"
  }
}
```

**Use when:** Multiple people use your bot via channels.

### `all`

Sandbox everything, including CLI sessions.

```json
{
  "sandbox": {
    "mode": "all"
  }
}
```

**Use when:** Maximum isolation required.

## Workspace Access

Controls what files the sandboxed agent can access.

### `none`

Agent cannot access any workspace files.

```json
{
  "sandbox": {
    "mode": "non-main",
    "workspaceAccess": "none"
  }
}
```

### `ro` (Read-Only)

Agent can read but not modify workspace files.

```json
{
  "sandbox": {
    "mode": "non-main",
    "workspaceAccess": "ro"
  }
}
```

### `rw` (Read-Write)

Agent can read and write workspace files.

```json
{
  "sandbox": {
    "mode": "non-main",
    "workspaceAccess": "rw"
  }
}
```

## Sandbox Scope

### `agent` Scope

Sandbox persists for the agent's lifetime. Shared workspace at:
```
~/.openclaw/agents/<id>/sandbox-workspace
```

### `session` Scope

New sandbox per conversation. Temporary directory cleaned up after session ends.

## Per-Channel Configuration

Different sandbox settings per channel:

```json
{
  "agents": {
    "defaults": {
      "sandbox": {
        "mode": "off"
      }
    }
  },
  "channels": {
    "telegram": {
      "sandbox": {
        "mode": "non-main",
        "workspaceAccess": "ro"
      }
    },
    "discord": {
      "sandbox": {
        "mode": "all",
        "workspaceAccess": "none"
      }
    }
  }
}
```

## Docker Requirements

Sandboxing requires Docker. On Railway, Docker-in-Docker is not available by default.

**For Railway deployments:** Sandboxing may not work without additional configuration. Consider using tool restrictions instead.

## Alternative: Tool Restrictions

If sandboxing isn't available, restrict dangerous tools:

```json
{
  "tools": {
    "exec": {
      "enabled": true,
      "ask": "always",
      "allowlist": ["ls", "cat", "grep", "find"]
    },
    "fs": {
      "blocklist": [".ssh", ".aws", ".env", ".openclaw"]
    }
  }
}
```

## Recommended Configuration

For Railway with channel access:

```json
{
  "agents": {
    "defaults": {
      "sandbox": {
        "mode": "off"
      }
    }
  },
  "tools": {
    "exec": {
      "enabled": true,
      "ask": "always",
      "allowlist": [
        "ls", "cat", "head", "tail", "grep", "find",
        "wc", "sort", "uniq", "pwd", "echo"
      ]
    },
    "fs": {
      "enabled": true,
      "blocklist": [
        ".ssh", ".aws", ".env", ".openclaw",
        "/etc", "/root", "/home"
      ]
    }
  },
  "channels": {
    "telegram": {
      "dmPolicy": "pairing"
    }
  }
}
```

This provides defense-in-depth without requiring Docker sandboxing.

## Further Reading

- [OpenClaw Sandboxing Docs](https://docs.openclaw.ai/concepts/sandboxing)
- [Tool Security](https://docs.openclaw.ai/tools/security)
