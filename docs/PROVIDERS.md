# LLM Provider Setup

This guide covers how to configure LLM providers for OpenClaw.

## Anthropic (Recommended)

The most reliable option for OpenClaw.

### Option 1: API Key (Simplest)

1. Get API key from [console.anthropic.com](https://console.anthropic.com)
2. In Railway Dashboard → Variables, add:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
3. During `openclaw onboard`, select Anthropic and it will use the env var

### Option 2: Claude Code CLI

If you have Claude Pro/Max subscription:

```bash
# In Railway SSH
npm install -g @anthropic-ai/claude-code
claude setup-token
```

Follow the prompts to authenticate.

## Google Gemini

### Option 1: API Key (Simplest)

1. Get API key from [aistudio.google.com](https://aistudio.google.com)
2. In Railway Dashboard → Variables, add:
   ```
   GEMINI_API_KEY=your-key-here
   ```

### Option 2: Google Antigravity OAuth (Recommended for OAuth)

```bash
# Enable the plugin
openclaw plugins enable google-antigravity-auth

# Authenticate
openclaw models auth login --provider google-antigravity --set-default
```

Opens browser for Google login. After approval, you'll see "authentication completed".

### Option 3: Gemini CLI OAuth

**Note:** There's a known issue where this fails due to missing `client_secret`. Use Antigravity OAuth or API key instead.

```bash
# This may not work - known issue #4585
openclaw plugins enable google-gemini-cli-auth
openclaw models auth login --provider google-gemini-cli
```

### Gemini Quota Notes

- Quotas are tracked per model (e.g., `gemini-3-pro` vs `gemini-3-flash`)
- OAuth doesn't support cached content - long prompts burn quota fast
- For paid quotas, set `OPENCODE_GEMINI_PROJECT_ID` environment variable

## OpenAI

### API Key

1. Get API key from [platform.openai.com](https://platform.openai.com)
2. In Railway Dashboard → Variables, add:
   ```
   OPENAI_API_KEY=sk-...
   ```

## OpenRouter (Multi-Provider)

Access multiple models through one API:

1. Get API key from [openrouter.ai](https://openrouter.ai)
2. In Railway Dashboard → Variables, add:
   ```
   OPENROUTER_API_KEY=sk-or-v1-...
   ```

Models available: Claude, GPT-4, Gemini, Llama, Mistral, and more.

## Groq (Fast Inference)

1. Get API key from [console.groq.com](https://console.groq.com)
2. In Railway Dashboard → Variables, add:
   ```
   GROQ_API_KEY=gsk_...
   ```

## Local Models (Ollama)

For self-hosted models:

```json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434"
    }
  }
}
```

## Setting Default Model

During `openclaw onboard`, or manually:

```bash
openclaw configure --section models
```

Or in `openclaw.json`:

```json
{
  "agents": {
    "defaults": {
      "model": "anthropic/claude-opus-4-5"
    }
  }
}
```

## Model Format

Models are specified as `provider/model-name`:

| Provider | Example Model |
|----------|---------------|
| Anthropic | `anthropic/claude-opus-4-5` |
| OpenAI | `openai/gpt-4o` |
| Google | `google/gemini-3-pro` |
| OpenRouter | `openrouter/anthropic/claude-3-opus` |
| Groq | `groq/llama-3.3-70b-versatile` |
| Ollama | `ollama/llama3` |

## Troubleshooting

### "API key not found"

Ensure the environment variable is set in Railway Dashboard, not just locally.

### OAuth browser doesn't open

In Railway SSH, OAuth requires a browser. Use API key method instead, or run OAuth locally then copy credentials.

### "Rate limited"

You've hit the provider's rate limit. Wait, or upgrade your plan.

### Gemini CLI OAuth fails

Known issue. Use Google Antigravity OAuth or API key instead.
