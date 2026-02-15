# Security Tiers

> **For agents:** Your progression guide is at `PROGRESSION.md` in your workspace. It has tier detection, prerequisite checklists, and upgrade walkthroughs.

This template ships with a locked-down default configuration. You can progressively unlock more capabilities as your trust and needs grow.

Tiers 0-2 are configurable via the `SECURITY_TIER` environment variable in Railway — no SSH required. Tier 3 requires SSH access for elevated permissions.

## Setting Your Tier

In Railway's dashboard, add the environment variable:

```
SECURITY_TIER=0   # Personal Assistant (default)
SECURITY_TIER=1   # Capable Agent
SECURITY_TIER=2   # Power User
SECURITY_TIER=3   # Operator (applies Tier 2, guides you to SSH for the rest)
```

Redeploy after changing. The config regenerates automatically.

---

## Tier 0: Personal Assistant (Default)

**What it can do:**
- Chat via Telegram/Discord/Slack
- Read and write files in workspace (markdown notes, memory)
- Search the web and fetch web pages
- Semantic memory search (auto-configured if your provider supports embeddings)
- List directory contents (`ls` only — no other shell commands)
- Schedule cron jobs and reminders
- Apply patches and work with images

**What this looks like in practice:**
- "Help me think through this decision" — agent builds a framework, tracks your reasoning over time
- "What's the latest on X?" — agent searches the web and summarizes findings
- "Research competitors in this space" — agent compiles a report from multiple sources
- "Organize my project notes" — agent creates structured markdown, cross-links ideas
- "Remember that I decided X because of Y" — agent stores it, finds it semantically later
- "Set a reminder for tomorrow at 9am" — agent creates a cron job

**When this is enough:** You want a thinking partner, research assistant, or personal knowledge base that can look things up on the web and remember things semantically.

**What's blocked:**
- Shell commands beyond `ls` (exec allowlisted to `ls` only)
- Browser automation (`browser`)
- Process management (`process`)
- Node/device control (`nodes`)
- Sub-agent spawning (`sessions_spawn`)
- Gateway access (`gateway`)

**Config:**

**openclaw.json:**
```json5
{
  tools: {
    allow: ["read", "write", "edit", "memory_get", "memory_search", "web_search", "web_fetch", "exec", "image", "cron", "apply_patch"],
    deny: ["process", "browser", "nodes", "gateway", "agents_list", "sessions_spawn"],
    exec: {
      host: "gateway",
      security: "allowlist",
      ask: "off"
    }
  }
}
```

**exec-approvals.json** (deployed to `~/.openclaw/exec-approvals.json`):
```json5
{
  version: 1,
  agents: {
    main: {
      security: "allowlist",
      ask: "off",
      askFallback: "deny",
      allowlist: [
        { pattern: "/usr/bin/ls" },
        { pattern: "/bin/ls" }
      ]
    }
  }
}
```

---

## Tier 1: Capable Agent

Everything in Tier 0, plus curated shell commands with user approval.

**Additional capabilities:**
- Run curated shell commands: `cat`, `head`, `tail`, `grep`, `find`, `wc`, `sort`, `uniq`, `git`
- Agent asks for approval on first use of each new command (`ask: on-miss`)

**What this looks like in practice:**
- "Clone this repo and explain the architecture" — agent runs git, reads code, maps the structure
- "Find all TODO comments in this project" — agent greps through files
- "Show me the last 20 lines of this log" — agent runs tail on the file
- "How many lines of code are in this project?" — agent uses wc and find

**When to upgrade from Tier 0:** You're working on code or technical projects and keep wishing the agent could just read files or run basic commands instead of telling you what to run.

**How to enable:**
```
SECURITY_TIER=1
```

Redeploy. That's it.

**What changes:**
- Exec allowlist expands from `ls` only to the curated list above
- `ask: on-miss` means the agent prompts for approval the first time it runs each command, then remembers

**exec-approvals.json** (deployed automatically):
```json5
{
  version: 1,
  agents: {
    main: {
      security: "allowlist",
      ask: "on-miss",
      askFallback: "deny",
      allowlist: [
        { pattern: "/usr/bin/ls" },
        { pattern: "/bin/ls" },
        { pattern: "/usr/bin/cat" },
        { pattern: "/usr/bin/head" },
        { pattern: "/usr/bin/tail" },
        { pattern: "/usr/bin/grep" },
        { pattern: "/usr/bin/find" },
        { pattern: "/usr/bin/wc" },
        { pattern: "/usr/bin/sort" },
        { pattern: "/usr/bin/uniq" },
        { pattern: "/usr/bin/git" }
      ]
    }
  }
}
```

**Important:** The allowlist uses resolved binary paths. Commands not in the list are blocked. Chaining (`;`, `&&`, `||`) and redirections are blocked in allowlist mode.

---

## Tier 2: Power User

Everything in Tier 1, plus unrestricted shell, browser, sub-agents, and process management.

**Additional capabilities:**
- Full shell access (any command, with `ask: on-miss` approval)
- Browser automation (remote only — no local Chromium)
- Sub-agent spawning for parallel work
- Process management
- `curl`, `node`, and any other installed binary

**What this looks like in practice:**
- "Set up this project" — agent clones, installs dependencies, configures
- "Research these three topics in parallel" — agent spawns sub-agents
- "Every morning, check my project board and summarize" — agent creates a cron with sub-agent
- "Browse this documentation site and compile a guide" — agent uses remote browser

**When to upgrade from Tier 1:** You're comfortable with what the agent does and want it to work independently — running arbitrary commands, using a browser, or doing parallel work.

**How to enable:**
```
SECURITY_TIER=2
```

Redeploy.

**What changes:**
- `process`, `browser`, `sessions_spawn`, `agents_list` moved from deny to allow
- Exec switches from allowlist to full mode
- No exec-approvals file deployed (not needed in full mode)
- `ask: on-miss` still requires approval for new commands

**Browser automation:**

At Tier 2, browser automation uses a remote browser service — no local Chromium is installed in the container. To enable browser tools, you'll need a cloud browser provider. Options include:

- **Browserbase** — `BROWSERBASE_API_KEY` + `BROWSERBASE_PROJECT_ID`
- **Steel** — `STEEL_API_KEY`
- Other remote browser services that provide a WebSocket endpoint

Set the appropriate env vars and the agent will connect to the remote browser automatically.

**Risks to understand:**
- The agent can run any command in the container
- Sub-agents inherit the parent's permissions — if the parent has full exec, so do sub-agents
- Browser automation can interact with web pages (potential prompt injection surface)
- `ask: on-miss` only prompts the first time; after approval, that command runs freely

---

## Tier 3: Operator

Everything in Tier 2, plus elevated permissions, node control, and gateway access. **Requires SSH.**

**Additional capabilities:**
- Elevated tool permissions
- Node/device control
- Gateway configuration access
- Everything — no tool restrictions

**When to consider this:** You're running in a fully isolated environment, you understand prompt injection risks, and you need the agent to have unrestricted access. This is for advanced users who are treating the agent as a full system operator.

**How to enable:**

Setting `SECURITY_TIER=3` via env var applies Tier 2 and writes a `.tier-status` marker to the workspace. The agent reads this and guides you through the SSH steps.

To complete Tier 3 setup, SSH in:

```bash
railway ssh
nano /data/.openclaw/openclaw.json
```

Set an empty deny list and enable elevated mode:

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
      ask: "on-miss"
    },
    elevated: {
      enabled: true
    }
  }
}
```

Restart the gateway:
```bash
pkill -f "openclaw gateway"
openclaw gateway run --port 18789 &
exit
```

**Risks:**
- Agent can run any command, access browser sessions, spawn unlimited sub-agents
- Agent can modify gateway configuration
- If compromised via prompt injection, attacker has full container access
- API spending has no automatic cap — verify your provider has limits set

---

## Per-Channel Overrides

You can set different capabilities for different channels. For example, Telegram gets Tier 2 capabilities but Discord stays at defaults:

```json5
{
  agents: {
    defaults: {
      tools: {
        deny: ["process", "browser", "nodes", "gateway", "agents_list", "sessions_spawn"]
      }
    }
  },
  channels: {
    telegram: {
      tools: {
        allow: ["process", "browser", "sessions_spawn"]
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

Ask your bot: "What tools do you have access to?" or "What tier am I on?"

Or SSH in and view directly:
```bash
railway ssh
cat /data/.openclaw/openclaw.json
```

---

## Recovery Paths

Things go wrong. Here's how to fix them.

### "I changed SECURITY_TIER and something broke"

Set `SECURITY_TIER=0` (or remove it entirely) and redeploy. Config regenerates to safe defaults.

### "I did SSH config edits and now things are broken"

Redeploy the container. The entrypoint regenerates `openclaw.json` from your environment variables on every startup. Whatever you changed via SSH gets replaced.

### "I enabled Tier 3 and want to go back"

Set `SECURITY_TIER=0` and redeploy. Config regenerates at Tier 0 defaults.

### "The agent is doing something I didn't expect"

1. Check what tools are active: ask the agent "What tools do you have access to?"
2. Review workspace changes via SSH: `ls -la /data/workspace/`
3. Lower the tier or redeploy to reset

### "I want to start completely fresh"

Delete the volume in Railway dashboard and redeploy. This wipes everything — config, workspace, agent memory, identity. You're back to the first-time experience.

---

## Safety Guardrails

**Tier 0 (web access):**
- The agent can read any public web page. It cannot log into services or access private content.
- Be cautious about asking it to visit URLs from untrusted sources — web content can contain prompt injection attempts.
- The worst case is a confused or misleading response. The agent can't take real-world action based on a malicious page.

**Tier 1 (curated shell):**
- The allowlist restricts which commands the agent can run. Only read-only tools are included.
- `ask: on-miss` means the agent prompts for approval before running a new command type.
- Chaining (`;`, `&&`, `||`) and redirections are blocked.

**Tier 2 (full shell + browser):**
- The agent can run any command in the container. `ask: on-miss` still requires first-time approval.
- Sub-agents inherit permissions. If the parent has full exec, so do sub-agents.
- Browser automation can interact with web pages — be mindful of prompt injection.
- Never add secrets to workspace files the agent can read.

**Tier 3 (operator):**
- Prompt injection is your main risk. Any content the agent reads could contain instructions it follows.
- Consider whether Tier 2 with targeted additions would suffice before going full operator.
- Verify your LLM provider has spending caps configured.
