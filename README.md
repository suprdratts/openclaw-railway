# OpenClaw Railway Template

Deploy an AI assistant to Railway. No SSH required.

## Quick Start

1. **Deploy to Railway** - Fork this repo or use the deploy button
2. **Set environment variables:**
   - One LLM provider API key
   - One channel token (Telegram, Discord, or Slack)
   - Your user ID for that channel
3. **Deploy** - Message your bot and start chatting

## Environment Variables

See [config/environment.md](config/environment.md) for the complete reference.

### Required

| Variable | Description |
|----------|-------------|
| `*_API_KEY` | At least one LLM provider key |
| `*_BOT_TOKEN` | At least one channel token |
| `*_OWNER_ID` | Your user ID for instant access |

### Example

```
OPENROUTER_API_KEY=sk-or-...
TELEGRAM_BOT_TOKEN=123456789:ABC...
TELEGRAM_OWNER_ID=987654321
```

## What You Get

**Default Security:**
- Conversation and note-taking only
- No shell access, no web browsing
- Session isolation per user
- Owner pre-approved, others require pairing

**Unlock More:** See [docs/TIERS.md](docs/TIERS.md)

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                 RAILWAY CONTAINER                    │
│                                                      │
│  Health Server (:8080)     Gateway (:18789)         │
│  - /healthz endpoint       - Loopback only          │
│  - Public facing           - Handles channels       │
│                                                      │
│  Config: /data/.openclaw/openclaw.json              │
│  Workspace: /data/workspace                         │
└─────────────────────────────────────────────────────┘
```

## Documentation

| Guide | Description |
|-------|-------------|
| [Environment Variables](config/environment.md) | All supported env vars |
| [Setup Guide](docs/SETUP.md) | Step-by-step deployment |
| [Security Tiers](docs/TIERS.md) | Unlocking capabilities |
| [Security Model](docs/SECURITY.md) | How protection works |
| [Providers](docs/PROVIDERS.md) | LLM provider configuration |
| [Threat Model](docs/THREAT-MODEL.md) | What can go wrong |

## Updating

Redeploy the container:

```bash
railway up
```

## License

MIT
