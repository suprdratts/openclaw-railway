# Mission Control v1 (Discord)

A concrete starting point for running multiple OpenClaw agents inside one Railway deployment, with Discord as the control surface.

## What this setup gives you

- `#orchestrator` → `main` agent
- `#heartbeat` → `scheduler` agent
- `#scheduler` → `scheduler` agent
- `#research` → `researcher` agent
- `#tool-log` → tool observer feed
- `#agent-log` → reserved for a future human-readable orchestration feed

This setup is optimized for:

- one Discord-first control panel
- parallel delegation from `main` to specialist agents
- a separate heartbeat lane
- a dedicated tool activity channel

## Included example

This repo now includes:

- `config/examples/mission-control-v1.json`

It is pre-filled with these Discord channel IDs:

- `#orchestrator` → `1494182910205497384`
- `#heartbeat` → `1494182971043741808`
- `#agent-log` → `1494183037217407068`
- `#scheduler` → `1494183350532051064`
- `#research` → `1494183402092363888`
- `#tool-log` → `1494183099033063514`

## Required env vars

You still need your normal Discord bot env vars (`DISCORD_BOT_TOKEN`, `DISCORD_OWNER_ID`) plus the following:

```bash
SECURITY_TIER=2
DISCORD_GUILD_ID=YOUR_GUILD_ID
DISCORD_GUILD_CHANNELS=1494182910205497384,1494182971043741808,1494183037217407068,1494183350532051064,1494183402092363888,1494183099033063514
DISCORD_MENTION_NOT_REQUIRED_CHANNELS=1494182910205497384,1494182971043741808,1494183350532051064,1494183402092363888
DISCORD_THREAD_BINDINGS=1
DISCORD_THREAD_IDLE_HOURS=24
HEARTBEAT_SESSION=agent:scheduler:discord:channel:1494182971043741808
TOOL_OBSERVER_ENABLED=true
TOOL_OBSERVER_CHAT_ID=1494183099033063514
TOOL_OBSERVER_VERBOSITY=normal
```

### Why these matter

- `SECURITY_TIER=2` unlocks the full session/orchestration toolset needed for real delegation
- `HEARTBEAT_SESSION` moves heartbeat into the dedicated scheduler lane
- `TOOL_OBSERVER_*` sends low-level tool activity to `#tool-log`
- `DISCORD_THREAD_BINDINGS=1` gives you thread-scoped work sessions when needed

## Deploying the overlay

This overlay is operator-managed and lives on the Railway volume.

### 1. SSH into the container

```bash
railway ssh
```

### 2. Create the specialist workspaces and state dirs

```bash
mkdir -p \
  /data/workspace-scheduler \
  /data/workspace-researcher \
  /data/.openclaw/agents/scheduler/agent \
  /data/.openclaw/agents/researcher/agent
```

### 3. Copy the example overlay onto the persistent volume

```bash
cp /app/config/examples/mission-control-v1.json /data/config-overlay.json
```

### 4. Redeploy or restart

```bash
railway up
```

The entrypoint will merge `/data/config-overlay.json` into the generated config on startup.

## What the overlay enables

The included overlay config does four things:

1. Defines three agents:
   - `main`
   - `scheduler`
   - `researcher`
2. Binds your Discord channels to those agents
3. Enables cross-agent session visibility:
   - `tools.sessions.visibility = "all"`
4. Enables agent-to-agent routing permissions:
   - `tools.agentToAgent.enabled = true`
   - `tools.agentToAgent.allow = ["main", "scheduler", "researcher"]`

It also sets:

- `main.subagents.allowAgents = ["scheduler", "researcher"]`

That gives the main orchestrator a clean initial delegation target set.

## Current reality / limitations

This gets you a real multi-agent starting point, but two things are still separate:

### `#tool-log` works now
Tool Observer already sends live tool activity into Discord.

### `#agent-log` is not fully wired yet
The repo does **not** yet ship a dedicated orchestration event feed that posts human-readable handoffs like:

- Dispatch
- Started
- Result
- Handoff
- Escalation
- Complete

So for now:

- use `#tool-log` for raw-ish execution visibility
- use `#heartbeat` for ambient operational output
- use the specialist lanes for direct interaction with each agent

## Recommended next step

After this is live, the next practical implementation step is:

1. validate routing in Discord
2. validate `main -> scheduler` and `main -> researcher` delegation behavior
3. add a first-class `#agent-log` event feed

That will turn this from "multi-agent lanes" into a true Mission Control experience.
