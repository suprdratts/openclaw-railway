/**
 * Log Bridge — Gateway stdout processor with optional Tool Observer
 *
 * Replaces the bash `grep --line-buffered '\[' | while read` pipe chain with
 * a single Node.js process that:
 *
 * 1. Passes through all gateway log lines to stdout (for Railway logs)
 * 2. When TOOL_OBSERVER_ENABLED, extracts tool call events and batches
 *    them to Telegram/Discord via the bot API
 *
 * Zero dependencies — uses only readline, https, and process.stdin.
 *
 * Gateway output format (consoleStyle: "json", --verbose --compact):
 *   {"time":"...","level":"info","subsystem":"gateway/ws",
 *    "message":"→ event agent tool=call:read call=read:0 meta=/data/workspace/AGENTS.md agent=main ..."}
 *
 * The tool info is embedded in the `message` field as key=value pairs with
 * chalk ANSI color codes. We strip ANSI, then extract tool= and meta= fields.
 *
 * Usage:
 *   openclaw gateway run ... 2>&1 | node log-bridge.js [options]
 *
 * Options (via CLI args):
 *   --observer           Enable tool observer
 *   --channel=telegram   Channel type (telegram|discord)
 *   --token=BOT_TOKEN    Bot token for sending messages
 *   --chat-id=CHAT_ID    Chat/channel ID to send to
 *   --thread-id=ID       Thread/topic ID (optional)
 *   --verbosity=normal   minimal|normal|verbose
 *   --batch-ms=2000      Batch window in ms
 */

import readline from 'node:readline';
import https from 'node:https';

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------
const args = {};
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--')) {
    const eq = arg.indexOf('=');
    if (eq !== -1) {
      args[arg.slice(2, eq)] = arg.slice(eq + 1);
    } else {
      args[arg.slice(2)] = 'true';
    }
  }
}

const OBSERVER_ENABLED = args.observer === 'true';
const CHANNEL = args.channel || 'telegram';
const TOKEN = args.token || '';
const CHAT_ID = args['chat-id'] || '';
const THREAD_ID = args['thread-id'] || '';
const VERBOSITY = args.verbosity || 'normal';
const BATCH_MS = parseInt(args['batch-ms'] || '2000', 10);

// ---------------------------------------------------------------------------
// Tool event icons
// ---------------------------------------------------------------------------
const TOOL_ICONS = {
  read: '\u{1F4D6}',
  write: '\u{270F}\uFE0F',
  edit: '\u{270F}\uFE0F',
  apply_patch: '\u{1FA79}',
  exec: '\u26A1',
  web_fetch: '\u{1F310}',
  web_search: '\u{1F50D}',
  memory_get: '\u{1F9E0}',
  memory_search: '\u{1F9E0}',
  cron: '\u23F0',
  image: '\u{1F5BC}\uFE0F',
  browser: '\u{1F310}',
  process: '\u2699\uFE0F',
  sessions_spawn: '\u{1F504}',
  sessions_yield: '\u{1F504}',
  agents_list: '\u{1F4CB}',
};

// ---------------------------------------------------------------------------
// ANSI escape code stripping
// ---------------------------------------------------------------------------
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*m/g;
function stripAnsi(str) {
  return str.replace(ANSI_RE, '');
}

// ---------------------------------------------------------------------------
// Event batching
// ---------------------------------------------------------------------------
let eventBatch = [];
let batchTimer = null;

function flushBatch() {
  batchTimer = null;
  if (eventBatch.length === 0) return;

  const lines = eventBatch.splice(0);
  const header = '\u{1F527} Tool Activity\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501';
  const body = lines.join('\n');
  const message = `${header}\n${body}`;

  sendMessage(message);
}

function queueEvent(line) {
  eventBatch.push(line);
  if (!batchTimer) {
    batchTimer = setTimeout(flushBatch, BATCH_MS);
  }
}

// ---------------------------------------------------------------------------
// Message sending — Telegram / Discord
// ---------------------------------------------------------------------------
function sendMessage(text) {
  if (CHANNEL === 'telegram') {
    sendTelegram(text);
  } else if (CHANNEL === 'discord') {
    sendDiscord(text);
  }
}

function sendTelegram(text) {
  const payload = JSON.stringify({
    chat_id: CHAT_ID,
    text: text,
    disable_notification: true,
    ...(THREAD_ID ? { message_thread_id: parseInt(THREAD_ID, 10) } : {}),
  });

  const req = https.request({
    hostname: 'api.telegram.org',
    path: `/bot${TOKEN}/sendMessage`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  });

  req.on('error', () => {}); // best-effort, never crash
  req.write(payload);
  req.end();
}

function sendDiscord(text) {
  const hostname = 'discord.com';
  const basePath = `/api/v10/channels/${CHAT_ID}/messages`;
  const payload = JSON.stringify({ content: text });

  const req = https.request({
    hostname,
    path: basePath,
    method: 'POST',
    headers: {
      'Authorization': `Bot ${TOKEN}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  });

  req.on('error', () => {}); // best-effort
  req.write(payload);
  req.end();
}

// ---------------------------------------------------------------------------
// Log line parsing — extract tool events from gateway JSON logs
//
// Gateway format with consoleStyle:"json" + --verbose --compact:
//   {"time":"...","level":"info","subsystem":"gateway/ws",
//    "message":"→ event agent tool=call:read call=read:0 meta=/path/to/file ..."}
//
// The `tool` field has format "phase:name" where phase is "call" or "result".
// The `meta` field (if present) has a one-line summary from the gateway.
// All values may be wrapped in chalk ANSI codes — strip before parsing.
// ---------------------------------------------------------------------------

// Extract key=value pairs from the ws-log message string.
// Values can be bare words or quoted strings. Keys use chalk.dim() so
// they'll have ANSI around them — we strip first.
function extractKV(cleaned) {
  const kv = {};
  // Match key=value where value is either a non-space run or absent
  const re = /(\w+)=(\S+)/g;
  let m;
  while ((m = re.exec(cleaned)) !== null) {
    kv[m[1]] = m[2];
  }
  return kv;
}

function tryParseToolEvent(line) {
  // Only attempt JSON parse on lines that look like JSON objects
  if (!line.startsWith('{')) return null;

  try {
    const obj = JSON.parse(line);

    // Must be a gateway/ws log line with an event message
    if (obj.subsystem !== 'gateway/ws') return null;
    const msg = obj.message;
    if (typeof msg !== 'string') return null;

    const cleaned = stripAnsi(msg);

    // Must be an outbound event with tool info
    // Format: "→ event agent tool=phase:name ..."
    if (!cleaned.includes('tool=')) return null;

    const kv = extractKV(cleaned);
    const toolField = kv.tool; // e.g. "call:read" or "result:read"
    if (!toolField) return null;

    const [phase, toolName] = toolField.split(':');
    if (!toolName) return null;

    // Only report tool calls, not results (to avoid duplicates)
    if (phase !== 'call') return null;

    const icon = TOOL_ICONS[toolName] || '\u{1F527}';

    if (VERBOSITY === 'minimal') {
      return `${icon} ${toolName}`;
    }

    // The `meta` field contains the gateway's one-line summary
    const meta = kv.meta || '';

    if (VERBOSITY === 'verbose') {
      const callId = kv.call || '';
      const extras = [callId].filter(Boolean).join(' ');
      return `${icon} ${toolName}${meta ? ': ' + truncate(meta, 80) : ''}${extras ? ' (' + extras + ')' : ''}`;
    }

    // normal
    return `${icon} ${toolName}${meta ? ': ' + truncate(meta, 80) : ''}`;
  } catch {
    return null;
  }
}

function truncate(str, max) {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + '\u2026';
}

// ---------------------------------------------------------------------------
// Main — read stdin line by line, pass through + optionally observe
// ---------------------------------------------------------------------------
const rl = readline.createInterface({ input: process.stdin, terminal: false });

rl.on('line', (line) => {
  // Always pass through to stdout (Railway logs)
  // Filter like the old grep: only lines containing '['
  if (line.includes('[')) {
    process.stdout.write(`[gateway] ${line}\n`);
  }

  // Observer: parse and queue tool events
  if (OBSERVER_ENABLED && TOKEN && CHAT_ID) {
    const event = tryParseToolEvent(line);
    if (event) {
      queueEvent(event);
    }
  }
});

rl.on('close', () => {
  // Flush any remaining events before exit
  if (batchTimer) {
    clearTimeout(batchTimer);
    batchTimer = null;
  }
  if (eventBatch.length > 0) {
    flushBatch();
  }
});

// Prevent unhandled errors from crashing the bridge (and killing the gateway pipe)
process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});
