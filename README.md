# OpenClaw Railway Template

Minimal, secure OpenClaw deployment for Railway.

## Features

- **Non-root container** - Runs as uid 1001
- **Gateway on loopback** - Never exposed publicly
- **Secure file permissions** - 700/600 on sensitive files
- **No dependencies** - Health server is ~30 lines of code
- **Environment variable secrets** - API keys never stored in config files

## Quick Start

1. Deploy to Railway
2. SSH in: `railway ssh`
3. Run: `openclaw onboard`
4. Message your bot on Telegram/Discord

## Documentation

| Guide | Description |
|-------|-------------|
| [Setup Guide](docs/SETUP.md) | Step-by-step deployment instructions |
| [Security Guide](docs/SECURITY.md) | Hardening and best practices |
| [Provider Setup](docs/PROVIDERS.md) | LLM provider configuration |
| [Sandboxing](docs/SANDBOXING.md) | Agent isolation options |

## Environment Variables

Set these in Railway Dashboard → Variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes* | Anthropic API key |
| `TELEGRAM_BOT_TOKEN` | For Telegram | From @BotFather |
| `DISCORD_BOT_TOKEN` | For Discord | From Developer Portal |

*Or another LLM provider's key. See [Provider Setup](docs/PROVIDERS.md).

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                 RAILWAY CONTAINER                    │
│                                                      │
│  Health Server (:8080)     Gateway (:18789)         │
│  - /healthz endpoint       - Runs on loopback       │
│  - No sensitive info       - Handles channels       │
│                            - Runs agents            │
│                                                      │
│  Volume: /data/.openclaw                            │
└─────────────────────────────────────────────────────┘
```

## Security Model

| Layer | Protection |
|-------|------------|
| API Keys | Stored in Railway env vars (encrypted at rest) |
| Gateway | Bound to loopback only |
| Channels | Pairing required by default |
| Config | 600 permissions (user read/write only) |

## Useful Commands

```bash
# SSH into container
railway ssh

# Check gateway status
ps aux | grep gateway

# View logs
cat /data/.openclaw/gateway.log

# Security audit
openclaw security audit --deep --fix

# Approve pairing
openclaw pairing approve telegram <code>

# Update OpenClaw
openclaw update
```

## License

MIT
