# OpenClaw Railway Setup Guide

Complete guide to deploying OpenClaw on Railway.

## Prerequisites

- [Railway account](https://railway.app)
- [Railway CLI](https://docs.railway.app/guides/cli) installed locally
- API key for your LLM provider (Anthropic, OpenAI, etc.)
- Bot token for your channel (Telegram, Discord, etc.)

## Windows Users

### Option A: WSL (Recommended)

If you have Windows Subsystem for Linux installed, open your Ubuntu/Debian terminal and follow the instructions below exactly as written. You'll have the same experience as Mac/Linux users.

To install WSL: Open PowerShell as Administrator and run:
```powershell
wsl --install
```

Restart your computer, then open "Ubuntu" from the Start menu.

### Option B: PowerShell

If you don't want to use WSL:

1. Install [Node.js](https://nodejs.org) (LTS version)
2. Open PowerShell
3. Install Railway CLI:
   ```powershell
   npm install -g @railway/cli
   ```
4. Continue with the steps below - commands are the same

**Note:** WSL is recommended because some Railway CLI features work more reliably in a Linux environment.

## Step 1: Deploy to Railway

### Option A: One-Click Deploy

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/openclaw)

### Option B: From GitHub

1. Fork this repository
2. In Railway, create new project → Deploy from GitHub repo
3. Select your fork

## Step 2: Set Environment Variables

In Railway Dashboard → Your Service → Variables, add:

**Required:**
```
ANTHROPIC_API_KEY=sk-ant-...
```

**For Telegram:**
```
TELEGRAM_BOT_TOKEN=123456:ABC-...
```

**For Discord:**
```
DISCORD_BOT_TOKEN=...
```

See [PROVIDERS.md](PROVIDERS.md) for other LLM providers.

## Step 3: Wait for Deploy

Railway will build the container (takes 5-10 minutes first time).

Check the deployment logs for:
```
[entrypoint] Starting OpenClaw Railway...
[entrypoint] No config found - run 'openclaw onboard' via SSH
[openclaw] Health server on :8080
```

## Step 4: SSH and Configure

```bash
# Login to Railway CLI
railway login

# Link to your project
railway link

# SSH into the container
railway ssh
```

## Step 5: Run Onboard

Inside the container:

```bash
openclaw onboard
```

The wizard will ask:

1. **LLM Provider** → Select your provider (Anthropic, OpenAI, etc.)
2. **API Key** → It should auto-detect from environment variable
3. **Gateway bind** → Select `Loopback (127.0.0.1)`
4. **Gateway auth** → Select `Token`
5. **Gateway token** → Leave blank to auto-generate
6. **Channels** → Configure Telegram/Discord/etc.

## Step 6: Verify Gateway Started

```bash
ps aux | grep gateway
```

Should show `openclaw-gateway` running.

If not, check logs:
```bash
cat /data/.openclaw/gateway.log
```

## Step 7: Message Your Bot

Open Telegram/Discord and message your bot. First message triggers pairing.

## Step 8: Approve Pairing

The bot will reply with a pairing code. Approve it:

```bash
openclaw pairing approve telegram <code>
```

## Step 9: Harden Security

Run the security audit:

```bash
openclaw security audit --deep --fix
```

See [SECURITY.md](SECURITY.md) for full hardening guide.

## Done!

Your bot is now running. You can exit SSH:

```bash
exit
```

The bot continues running in Railway.

---

## Common Issues

### Bot doesn't respond

1. Check gateway is running: `ps aux | grep gateway`
2. Check gateway logs: `cat /data/.openclaw/gateway.log`
3. Verify bot token is correct in Railway variables

### "API key not found"

Ensure environment variable is set in Railway Dashboard, not just in config file.

### Gateway won't start

Check logs for specific error:
```bash
cat /data/.openclaw/gateway.log
```

Common causes:
- Missing API key
- Invalid bot token
- Port already in use

### Pairing code not appearing

1. Make sure you're messaging the bot directly (not in a group)
2. Check `dmPolicy` is set to `pairing` not `disabled`

### Container keeps restarting

Check health endpoint is responding:
```bash
curl http://localhost:8080/healthz
```

Should return `OK`.

---

## Updating OpenClaw

SSH in and run:

```bash
openclaw update
```

Then restart the gateway:

```bash
pkill -f "openclaw gateway"
openclaw gateway run --port 18789 &
```

---

## Useful Commands

```bash
# View gateway status
ps aux | grep gateway

# View gateway logs
cat /data/.openclaw/gateway.log

# View config
cat /data/.openclaw/openclaw.json

# Restart gateway
pkill -f "openclaw gateway"
openclaw gateway run --port 18789 &

# List approved users
cat /data/.openclaw/credentials/*-allowFrom.json

# Security audit
openclaw security audit --deep

# Update OpenClaw
openclaw update
```
