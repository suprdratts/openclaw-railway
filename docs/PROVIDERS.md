# LLM Providers

Configure your preferred LLM provider via environment variables.

## Setting Up a Provider

1. Get an API key from your chosen provider
2. Set the corresponding environment variable in Railway
3. Optionally set `LLM_PRIMARY_MODEL` to specify which model to use

## Supported Providers

| Provider | Environment Variable | Example Model Format |
|----------|---------------------|---------------------|
| OpenRouter | `OPENROUTER_API_KEY` | `openrouter/provider/model` |
| Groq | `GROQ_API_KEY` | `groq/model-name` |
| Together AI | `TOGETHER_API_KEY` | `together/org/model` |
| Venice AI | `VENICE_API_KEY` | `venice/model-name` |
| Google AI | `GOOGLE_AI_API_KEY` | `google/model-name` |
| Mistral | `MISTRAL_API_KEY` | `mistral/model-name` |
| OpenAI | `OPENAI_API_KEY` | `openai/model-name` |
| Anthropic | `ANTHROPIC_API_KEY` | `anthropic/model-name` |
| xAI | `XAI_API_KEY` | `xai/model-name` |
| DeepSeek | `DEEPSEEK_API_KEY` | `deepseek/model-name` |
| Cloudflare | `CLOUDFLARE_API_KEY` | `cloudflare/model-name` |

## Model Configuration

### Primary Model

Set via environment variable:
```
LLM_PRIMARY_MODEL=provider/model-name
```

### Task-Specific Models

Use different models for different tasks to optimize cost/performance:

```
LLM_PRIMARY_MODEL=provider/smart-model
LLM_HEARTBEAT_MODEL=provider/cheap-model
LLM_SUBAGENT_MODEL=provider/balanced-model
```

### Fallback Models

Comma-separated list of fallbacks if primary fails:

```
LLM_FALLBACK_MODELS=provider1/model1,provider2/model2
```

## Multiple Providers

You can set multiple provider API keys. The agent will use whichever provider matches the model you specify.

## Cost Considerations

- Check your provider's pricing before use
- Set spending limits in your provider's dashboard
- Consider using different models for different tasks (cheap for heartbeat, smart for main work)

## Troubleshooting

### "API key not found"
Ensure the environment variable is set in Railway Dashboard.

### "Model not found"
Check the model name format matches your provider's expectations.

### Switching providers
Update the environment variable and redeploy, or SSH in and update the config.

## Further Reading

- [OpenClaw Providers Docs](https://docs.openclaw.ai/providers)
- [OpenClaw Configuration](https://docs.openclaw.ai/gateway/configuration)
