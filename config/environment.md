# Environment Variables

This document lists all environment variables the template supports. Set these in Railway's dashboard before deploying.

## Required (at least one LLM provider)

You need at least one LLM provider API key for the agent to function.

| Variable | Description |
|----------|-------------|
| `LLM_API_KEY` | Generic fallback - used if no specific provider key is set |

### Provider-Specific Keys

Set the key for your preferred provider(s). You can set multiple if you want fallbacks or different models for different tasks.

| Variable | Provider |
|----------|----------|
| `OPENROUTER_API_KEY` | OpenRouter |
| `GROQ_API_KEY` | Groq |
| `TOGETHER_API_KEY` | Together AI |
| `VENICE_API_KEY` | Venice AI |
| `GOOGLE_AI_API_KEY` | Google AI Studio |
| `MISTRAL_API_KEY` | Mistral |
| `OPENAI_API_KEY` | OpenAI |
| `ANTHROPIC_API_KEY` | Anthropic |
| `XAI_API_KEY` | xAI (Grok) |
| `DEEPSEEK_API_KEY` | DeepSeek |
| `CLOUDFLARE_API_KEY` | Cloudflare AI |

## Model Selection

Configure which models to use for different tasks. Format: `provider/model-name`

| Variable | Purpose | Example |
|----------|---------|---------|
| `LLM_PRIMARY_MODEL` | Main thinking model | `openrouter/anthropic/claude-sonnet-4` |
| `LLM_HEARTBEAT_MODEL` | Cheap model for periodic check-ins | `groq/llama-3.1-8b-instant` |
| `LLM_SUBAGENT_MODEL` | Model for delegated tasks | `openrouter/meta-llama/llama-3.1-70b` |
| `LLM_FALLBACK_MODELS` | Comma-separated fallback list | `groq/llama-3.1-70b,openrouter/meta-llama/llama-3.1-8b` |

## Channels

### Telegram

| Variable | Description |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather |
| `TELEGRAM_OWNER_ID` | Your Telegram user ID (get from @userinfobot) - skips pairing |

### Discord

| Variable | Description |
|----------|-------------|
| `DISCORD_BOT_TOKEN` | Discord bot token |
| `DISCORD_OWNER_ID` | Your Discord user ID - skips pairing |

### Slack

| Variable | Description |
|----------|-------------|
| `SLACK_BOT_TOKEN` | Slack bot token (xoxb-...) |
| `SLACK_APP_TOKEN` | Slack app token (xapp-...) |
| `SLACK_OWNER_ID` | Your Slack user ID - skips pairing |

## Gateway

| Variable | Description | Default |
|----------|-------------|---------|
| `GATEWAY_TOKEN` | Authentication token for gateway | Auto-generated |
| `GATEWAY_PORT` | Port for gateway (internal) | `18789` |

## Optional

| Variable | Description |
|----------|-------------|
| `AGENT_NAME` | Display name for your agent |
| `WORKSPACE_DIR` | Workspace directory path |

---

## Quick Start Examples

### Minimal (Groq + Telegram)

```
GROQ_API_KEY=gsk_...
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_OWNER_ID=987654321
```

### Multi-Provider (Smart primary, cheap heartbeat)

```
OPENROUTER_API_KEY=sk-or-...
GROQ_API_KEY=gsk_...
LLM_PRIMARY_MODEL=openrouter/anthropic/claude-sonnet-4
LLM_HEARTBEAT_MODEL=groq/llama-3.1-8b-instant
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_OWNER_ID=987654321
```

### Multiple Channels

```
OPENROUTER_API_KEY=sk-or-...
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_OWNER_ID=987654321
DISCORD_BOT_TOKEN=MTIz...
DISCORD_OWNER_ID=123456789012345678
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
SLACK_OWNER_ID=U01234567
```
