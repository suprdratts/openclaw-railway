# Security Tiers

This template ships with a locked-down default configuration. You can progressively unlock more capabilities as your trust and needs grow.

## Tier 0: Conversation Only (Default)

**What it can do:**
- Chat via Telegram/Discord/Slack
- Read and write files in workspace (markdown notes, memory)
- Search and retrieve memories

**What's blocked:**
- Shell commands (`exec`)
- Web browsing (`browser`)
- Web fetching (`web_fetch`, `web_search`)
- Process management (`process`)
- Node/device control (`nodes`)
- Subagent spawning (`sessions_spawn`)
- Gateway access (`gateway`)

**Config:**
```json5
{
  agents: {
    defaults: {
      tools: {
        allow: ["read", "write", "edit", "memory_search", "memory_get"],
        deny: ["exec", "process", "browser", "nodes", "web_search", "web_fetch", "gateway", "agents_list", "sessions_spawn"]
      }
    }
  }
}
```

---

## Tier 1: Research Assistant

Enable web search and fetching so your agent can look things up.

**Additional capabilities:**
- Search the web
- Fetch and read web pages

**How to enable:**

SSH in and edit the config:
```bash
railway ssh
nano /data/.openclaw/openclaw.json
```

Remove `web_search` and `web_fetch` from the deny list:
```json5
{
  agents: {
    defaults: {
      tools: {
        allow: ["read", "write", "edit", "memory_search", "memory_get", "web_search", "web_fetch"],
        deny: ["exec", "process", "browser", "nodes", "gateway", "agents_list", "sessions_spawn"]
      }
    }
  }
}
```

Restart the gateway:
```bash
pkill -f "openclaw gateway"
openclaw gateway run --port 18789 &
```

---

## Tier 2: Developer Tools

Enable restricted shell access for development tasks.

**Additional capabilities:**
- Run whitelisted shell commands (ls, cat, grep, git, etc.)
- Work with code repositories

**How to enable:**

Update the config:
```json5
{
  agents: {
    defaults: {
      tools: {
        allow: ["read", "write", "edit", "memory_search", "memory_get", "web_search", "web_fetch", "exec"],
        deny: ["process", "browser", "nodes", "gateway", "agents_list", "sessions_spawn"]
      }
    }
  },
  tools: {
    exec: {
      security: "allowlist",
      ask: "always",
      allowlist: [
        "/usr/bin/ls",
        "/usr/bin/cat",
        "/usr/bin/head",
        "/usr/bin/tail",
        "/usr/bin/grep",
        "/usr/bin/find",
        "/usr/bin/wc",
        "/usr/bin/sort",
        "/usr/bin/uniq",
        "/usr/bin/git"
      ]
    }
  }
}
```

**Important:** The allowlist uses resolved binary paths. Commands not in the list will be blocked. Chaining (`;`, `&&`, `||`) and redirections are blocked in allowlist mode.

---

## Tier 3: Automation

Enable skills, cron jobs, and more advanced features.

**Additional capabilities:**
- Run skills from ClawHub
- Schedule cron jobs
- Spawn subagents for parallel work

**How to enable:**

Update the config:
```json5
{
  agents: {
    defaults: {
      tools: {
        allow: ["read", "write", "edit", "memory_search", "memory_get", "web_search", "web_fetch", "exec", "sessions_spawn"],
        deny: ["process", "browser", "nodes", "gateway", "agents_list"]
      },
      subagents: {
        model: "groq/llama-3.1-8b-instant",  // Use cheaper model for subagents
        maxConcurrent: 2
      }
    }
  }
}
```

---

## Tier 4: Full Trust

Remove all restrictions. Only do this if you fully understand the risks.

**What's unlocked:**
- Everything

**Risks:**
- Agent can run any command
- Agent can access browser sessions
- Agent can spawn unlimited subagents
- Agent can modify gateway configuration
- If compromised via prompt injection, attacker has full access

**How to enable:**

```json5
{
  agents: {
    defaults: {
      tools: {
        deny: []  // Nothing blocked
      }
    }
  },
  tools: {
    exec: {
      security: "full",
      ask: "on-miss"  // Only ask for new commands
    },
    elevated: {
      enabled: true
    }
  }
}
```

---

## Per-Channel Overrides

You can set different tiers for different channels. For example, Telegram gets Tier 2 but Discord stays at Tier 0:

```json5
{
  agents: {
    defaults: {
      tools: {
        deny: ["exec", "browser", "process", "nodes", "web_search", "web_fetch"]
      }
    }
  },
  channels: {
    telegram: {
      tools: {
        allow: ["exec", "web_search", "web_fetch"]
      }
    }
  }
}
```

---

## Per-User Overrides

You can give specific users elevated access:

```json5
{
  tools: {
    elevated: {
      enabled: true,
      allowFrom: {
        telegram: [123456789],  // Only this user can use elevated mode
        discord: ["987654321"]
      }
    }
  }
}
```

---

## Checking Current Config

SSH in and view the current configuration:

```bash
railway ssh
cat /data/.openclaw/openclaw.json
```

Or ask your bot: "What tools do you have access to?"
