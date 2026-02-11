/**
 * Build OpenClaw config from environment variables
 *
 * This script reads environment variables and generates openclaw.json
 * with secure defaults and user-specified settings.
 */

import fs from 'node:fs';
import path from 'node:path';

const CONFIG_PATH = process.env.OPENCLAW_CONFIG_PATH || '/data/.openclaw/openclaw.json';
const DEFAULTS_PATH = '/app/config/defaults.json5';

// Parse JSON5 (strip comments)
function parseJson5(content) {
  // Remove single-line comments
  const noComments = content
    .split('\n')
    .map(line => {
      const commentIndex = line.indexOf('//');
      if (commentIndex === -1) return line;
      // Check if // is inside a string
      const beforeComment = line.substring(0, commentIndex);
      const quotes = (beforeComment.match(/"/g) || []).length;
      if (quotes % 2 === 0) {
        return beforeComment;
      }
      return line;
    })
    .join('\n');

  // Handle trailing commas (simple approach)
  const noTrailing = noComments.replace(/,(\s*[}\]])/g, '$1');

  return JSON.parse(noTrailing);
}

function buildConfig() {
  // Start with defaults if they exist
  let config = {};
  if (fs.existsSync(DEFAULTS_PATH)) {
    const defaults = fs.readFileSync(DEFAULTS_PATH, 'utf-8');
    config = parseJson5(defaults);
  }

  // Ensure structure exists
  config.agents = config.agents || {};
  config.agents.defaults = config.agents.defaults || {};
  config.models = config.models || {};
  config.models.providers = config.models.providers || {};
  config.channels = config.channels || {};
  config.gateway = config.gateway || {};

  // --- LLM Providers ---
  const providers = [
    { env: 'OPENROUTER_API_KEY', name: 'openrouter' },
    { env: 'GROQ_API_KEY', name: 'groq' },
    { env: 'TOGETHER_API_KEY', name: 'together' },
    { env: 'VENICE_API_KEY', name: 'venice' },
    { env: 'GOOGLE_AI_API_KEY', name: 'google' },
    { env: 'MISTRAL_API_KEY', name: 'mistral' },
    { env: 'OPENAI_API_KEY', name: 'openai' },
    { env: 'ANTHROPIC_API_KEY', name: 'anthropic' },
    { env: 'XAI_API_KEY', name: 'xai' },
    { env: 'DEEPSEEK_API_KEY', name: 'deepseek' },
    { env: 'CLOUDFLARE_API_KEY', name: 'cloudflare' },
  ];

  for (const { env, name } of providers) {
    const key = process.env[env];
    if (key) {
      config.models.providers[name] = config.models.providers[name] || {};
      config.models.providers[name].apiKey = key;
    }
  }

  // Generic fallback
  if (process.env.LLM_API_KEY && !Object.keys(config.models.providers).length) {
    config.models.providers.default = { apiKey: process.env.LLM_API_KEY };
  }

  // --- Model Selection ---
  if (process.env.LLM_PRIMARY_MODEL) {
    config.agents.defaults.model = config.agents.defaults.model || {};
    config.agents.defaults.model.primary = process.env.LLM_PRIMARY_MODEL;
  }

  if (process.env.LLM_HEARTBEAT_MODEL) {
    config.agents.defaults.heartbeat = config.agents.defaults.heartbeat || {};
    config.agents.defaults.heartbeat.model = process.env.LLM_HEARTBEAT_MODEL;
  }

  if (process.env.LLM_SUBAGENT_MODEL) {
    config.agents.defaults.subagents = config.agents.defaults.subagents || {};
    config.agents.defaults.subagents.model = process.env.LLM_SUBAGENT_MODEL;
  }

  if (process.env.LLM_FALLBACK_MODELS) {
    config.agents.defaults.model = config.agents.defaults.model || {};
    config.agents.defaults.model.fallbacks = process.env.LLM_FALLBACK_MODELS.split(',').map(s => s.trim());
  }

  // --- Telegram ---
  if (process.env.TELEGRAM_BOT_TOKEN) {
    config.channels.telegram = config.channels.telegram || {};
    config.channels.telegram.enabled = true;
    config.channels.telegram.botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (process.env.TELEGRAM_OWNER_ID) {
      config.channels.telegram.dm = config.channels.telegram.dm || {};
      config.channels.telegram.dm.allowFrom = config.channels.telegram.dm.allowFrom || [];
      const ownerId = parseInt(process.env.TELEGRAM_OWNER_ID, 10);
      if (!config.channels.telegram.dm.allowFrom.includes(ownerId)) {
        config.channels.telegram.dm.allowFrom.push(ownerId);
      }
      // If owner is set, use allowlist mode instead of pairing
      config.channels.telegram.dmPolicy = 'allowlist';
    }
  }

  // --- Discord ---
  if (process.env.DISCORD_BOT_TOKEN) {
    config.channels.discord = config.channels.discord || {};
    config.channels.discord.enabled = true;
    config.channels.discord.token = process.env.DISCORD_BOT_TOKEN;

    if (process.env.DISCORD_OWNER_ID) {
      config.channels.discord.dm = config.channels.discord.dm || {};
      config.channels.discord.dm.allowFrom = config.channels.discord.dm.allowFrom || [];
      if (!config.channels.discord.dm.allowFrom.includes(process.env.DISCORD_OWNER_ID)) {
        config.channels.discord.dm.allowFrom.push(process.env.DISCORD_OWNER_ID);
      }
      config.channels.discord.dmPolicy = 'allowlist';
    }
  }

  // --- Slack ---
  if (process.env.SLACK_BOT_TOKEN) {
    config.channels.slack = config.channels.slack || {};
    config.channels.slack.enabled = true;
    config.channels.slack.botToken = process.env.SLACK_BOT_TOKEN;

    if (process.env.SLACK_APP_TOKEN) {
      config.channels.slack.appToken = process.env.SLACK_APP_TOKEN;
    }

    if (process.env.SLACK_OWNER_ID) {
      config.channels.slack.dm = config.channels.slack.dm || {};
      config.channels.slack.dm.allowFrom = config.channels.slack.dm.allowFrom || [];
      if (!config.channels.slack.dm.allowFrom.includes(process.env.SLACK_OWNER_ID)) {
        config.channels.slack.dm.allowFrom.push(process.env.SLACK_OWNER_ID);
      }
      config.channels.slack.dmPolicy = 'allowlist';
    }
  }

  // --- Gateway ---
  config.gateway.bind = 'loopback';
  config.gateway.auth = config.gateway.auth || {};
  config.gateway.auth.mode = 'token';

  if (process.env.GATEWAY_TOKEN) {
    config.gateway.auth.token = process.env.GATEWAY_TOKEN;
  }

  // --- Agent Name ---
  if (process.env.AGENT_NAME) {
    config.agents.defaults.identity = config.agents.defaults.identity || {};
    config.agents.defaults.identity.name = process.env.AGENT_NAME;
  }

  // --- Gateway Mode (required for headless start) ---
  config.gateway.mode = 'local';

  return config;
}

function main() {
  // Skip if config already exists (don't overwrite user changes)
  if (fs.existsSync(CONFIG_PATH)) {
    console.log('[build-config] Config already exists, skipping generation');
    return;
  }

  // Check for minimum requirements
  const hasLLM = [
    'LLM_API_KEY',
    'OPENROUTER_API_KEY',
    'GROQ_API_KEY',
    'TOGETHER_API_KEY',
    'VENICE_API_KEY',
    'GOOGLE_AI_API_KEY',
    'MISTRAL_API_KEY',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'XAI_API_KEY',
    'DEEPSEEK_API_KEY',
    'CLOUDFLARE_API_KEY',
  ].some(key => process.env[key]);

  const hasChannel = [
    'TELEGRAM_BOT_TOKEN',
    'DISCORD_BOT_TOKEN',
    'SLACK_BOT_TOKEN',
  ].some(key => process.env[key]);

  if (!hasLLM) {
    console.log('[build-config] WARNING: No LLM provider API key set');
    console.log('[build-config] Set at least one of: OPENROUTER_API_KEY, GROQ_API_KEY, etc.');
  }

  if (!hasChannel) {
    console.log('[build-config] WARNING: No channel configured');
    console.log('[build-config] Set at least one of: TELEGRAM_BOT_TOKEN, DISCORD_BOT_TOKEN, SLACK_BOT_TOKEN');
  }

  const config = buildConfig();

  // Ensure directory exists
  const configDir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
  }

  // Write config with secure permissions
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
  console.log('[build-config] Generated config at', CONFIG_PATH);
}

main();
