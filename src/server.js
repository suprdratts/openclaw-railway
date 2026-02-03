/**
 * OpenClaw Railway Bootstrap Server
 *
 * Minimal status page that shows setup instructions.
 * All actual configuration happens via SSH + CLI.
 */

import crypto from "node:crypto";
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import express from "express";
import cookieParser from "cookie-parser";

// =============================================================================
// Configuration
// =============================================================================

const PORT = Number.parseInt(process.env.PORT ?? "8080", 10);
const STATE_DIR = process.env.OPENCLAW_STATE_DIR?.trim() || path.join(os.homedir(), ".openclaw");
const SETUP_PASSWORD = process.env.SETUP_PASSWORD?.trim();

// =============================================================================
// Session Management
// =============================================================================

const SESSION_COOKIE = "oc_session";
const SESSION_MAX_AGE = 24 * 60 * 60 * 1000;
const sessions = new Map();

function createSession() {
  const id = crypto.randomBytes(32).toString("hex");
  sessions.set(id, { createdAt: Date.now() });
  return id;
}

function validSession(id) {
  const s = sessions.get(id);
  if (!s) return false;
  if (Date.now() - s.createdAt > SESSION_MAX_AGE) {
    sessions.delete(id);
    return false;
  }
  return true;
}

// =============================================================================
// Status Helpers
// =============================================================================

function configPath() {
  return path.join(STATE_DIR, "openclaw.json");
}

function isConfigured() {
  try {
    return fs.existsSync(configPath());
  } catch {
    return false;
  }
}

function getGatewayToken() {
  try {
    const cfg = JSON.parse(fs.readFileSync(configPath(), "utf8"));
    return cfg?.gateway?.auth?.token || null;
  } catch {
    return null;
  }
}

function getTailscaleStatus() {
  try {
    const output = execSync("tailscale status --json 2>/dev/null", { encoding: "utf8", timeout: 5000 });
    const status = JSON.parse(output);
    return {
      running: true,
      ip: status.Self?.TailscaleIPs?.[0] || null,
      hostname: status.Self?.HostName || null,
      online: status.Self?.Online || false,
    };
  } catch {
    return { running: false, ip: null, hostname: null, online: false };
  }
}

function getStatus() {
  const configured = isConfigured();
  const token = configured ? getGatewayToken() : null;
  const tailscale = getTailscaleStatus();

  let state = "not_configured";
  if (configured && tailscale.online) {
    state = "ready";
  } else if (configured) {
    state = "needs_tailscale";
  }

  return { state, configured, token, tailscale };
}

// =============================================================================
// Express App
// =============================================================================

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", true);
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Security headers
app.use((_req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "DENY");
  next();
});

// Health check (no auth)
app.get("/healthz", (_req, res) => {
  const { state, tailscale } = getStatus();
  res.json({ ok: true, state, tailscale: tailscale.online });
});

// Login
app.get("/login", (_req, res) => {
  res.type("html").send(renderLogin());
});

app.post("/login", (req, res) => {
  if (!SETUP_PASSWORD) {
    return res.status(500).send("SETUP_PASSWORD not set");
  }
  if (req.body?.password === SETUP_PASSWORD) {
    const id = createSession();
    res.cookie(SESSION_COOKIE, id, { httpOnly: true, secure: req.secure, sameSite: "strict", maxAge: SESSION_MAX_AGE });
    return res.redirect("/");
  }
  res.type("html").send(renderLogin("Invalid password"));
});

// Auth middleware
app.use((req, res, next) => {
  if (!SETUP_PASSWORD) {
    return res.status(500).send("SETUP_PASSWORD not set");
  }
  if (!validSession(req.cookies?.[SESSION_COOKIE])) {
    return res.redirect("/login");
  }
  next();
});

// Main page
app.get("/", (_req, res) => {
  res.type("html").send(renderStatus(getStatus()));
});

// API for JS refresh
app.get("/api/status", (_req, res) => {
  res.json(getStatus());
});

// =============================================================================
// HTML Rendering
// =============================================================================

function renderLogin(error = null) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OpenClaw</title>
  <style>${css()}</style>
</head>
<body>
  <div class="center">
    <h1>OpenClaw</h1>
    <p class="muted">Railway Bootstrap</p>
    <form method="POST" action="/login">
      <input type="password" name="password" placeholder="Setup Password" required autofocus>
      <button type="submit">Login</button>
    </form>
    ${error ? `<p class="error">${error}</p>` : ""}
  </div>
</body>
</html>`;
}

function renderStatus(status) {
  const { state, token, tailscale } = status;

  let content = "";

  if (state === "ready") {
    const url = `https://${tailscale.hostname}.tail<wbr>scale.net/${token ? `?token=${token}` : ""}`;
    const altUrl = `https://${tailscale.ip}/${token ? `?token=${token}` : ""}`;
    content = `
      <div class="card success">
        <h2>Ready</h2>
        <p>OpenClaw is configured and Tailscale is connected.</p>
        <div class="info">
          <p><strong>Control UI:</strong></p>
          <code class="block">${url}</code>
          <p class="muted">Or use IP: <code>${altUrl}</code></p>
        </div>
      </div>

      <div class="card">
        <h2>Details</h2>
        <table>
          <tr><td>Tailscale Hostname</td><td><code>${tailscale.hostname}</code></td></tr>
          <tr><td>Tailscale IP</td><td><code>${tailscale.ip}</code></td></tr>
          <tr><td>Gateway Token</td><td><code>${token ? token.substring(0, 12) + "..." : "not set"}</code></td></tr>
        </table>
      </div>

      <div class="card">
        <h2>Next Steps</h2>
        <ol>
          <li>Open the Control UI link above from any device on your Tailnet</li>
          <li>Configure channels (Telegram, Discord) in the Control UI</li>
          <li>Message your bot to start a pairing request</li>
          <li>Approve pairing in Control UI or via CLI: <code>openclaw pairing approve telegram CODE</code></li>
        </ol>
      </div>
    `;
  } else if (state === "needs_tailscale") {
    content = `
      <div class="card warning">
        <h2>Tailscale Not Connected</h2>
        <p>OpenClaw is configured but Tailscale isn't running or connected.</p>
      </div>

      <div class="card">
        <h2>Connect Tailscale</h2>
        <p>SSH into the container:</p>
        <code class="block">railway login
railway link
railway ssh</code>
        <p>Then inside the container:</p>
        <code class="block">tailscale up</code>
        <p class="muted">Follow the auth link to connect to your Tailnet</p>
      </div>

      ${token ? `
      <div class="card">
        <h2>Gateway Token</h2>
        <p>You'll need this to access the Control UI:</p>
        <code class="block">${token}</code>
      </div>
      ` : ""}
    `;
  } else {
    content = `
      <div class="card warning">
        <h2>Not Configured</h2>
        <p>OpenClaw hasn't been set up yet.</p>
      </div>

      <div class="card">
        <h2>Step 1: Connect via SSH</h2>
        <p>First, install the Railway CLI and connect:</p>
        <code class="block">railway login
railway link
railway ssh</code>
        <p class="muted">Select this project when prompted</p>
      </div>

      <div class="card">
        <h2>Step 2: Run Onboarding</h2>
        <p>Inside the container, run the setup wizard:</p>
        <code class="block">openclaw onboard</code>
        <p class="muted">This will configure your LLM provider and generate a gateway token</p>
      </div>

      <div class="card">
        <h2>Step 3: Connect Tailscale</h2>
        <p>Still in the SSH session:</p>
        <code class="block">tailscale up</code>
        <p class="muted">Follow the auth link to connect to your Tailnet</p>
      </div>

      <div class="card">
        <h2>Step 4: Access Control UI</h2>
        <p>Once both are done, refresh this page to get your Control UI link.</p>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OpenClaw</title>
  <style>${css()}</style>
</head>
<body>
  <div class="container">
    <header>
      <h1>OpenClaw</h1>
      <span class="badge ${state}">${state.replace("_", " ")}</span>
    </header>
    ${content}
    <p class="muted center-text">
      <button onclick="location.reload()" class="link">Refresh</button>
    </p>
  </div>
</body>
</html>`;
}

function css() {
  return `
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0a0a0a;
      color: #e5e5e5;
      margin: 0;
      min-height: 100vh;
      line-height: 1.6;
    }
    .center {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    .center-text { text-align: center; }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 2rem 1rem;
    }
    header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 2rem;
    }
    h1 {
      margin: 0;
      font-size: 1.75rem;
      color: #f97316;
    }
    h2 {
      margin: 0 0 1rem;
      font-size: 1rem;
      color: #e5e5e5;
    }
    .badge {
      padding: 0.25rem 0.75rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge.ready { background: #166534; color: #bbf7d0; }
    .badge.needs_tailscale { background: #854d0e; color: #fef08a; }
    .badge.not_configured { background: #7f1d1d; color: #fecaca; }
    .card {
      background: #141414;
      border: 1px solid #262626;
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1rem;
    }
    .card.success { border-color: #166534; }
    .card.warning { border-color: #854d0e; }
    .info {
      background: #0a0a0a;
      border-radius: 8px;
      padding: 1rem;
      margin-top: 1rem;
    }
    input {
      width: 100%;
      max-width: 300px;
      padding: 0.75rem;
      background: #141414;
      border: 1px solid #333;
      border-radius: 8px;
      color: #e5e5e5;
      font-size: 1rem;
    }
    input:focus { outline: none; border-color: #f97316; }
    button {
      padding: 0.75rem 1.5rem;
      background: #f97316;
      border: none;
      border-radius: 8px;
      color: white;
      font-weight: 600;
      cursor: pointer;
      margin-top: 1rem;
    }
    button:hover { background: #ea580c; }
    button.link {
      background: none;
      color: #60a5fa;
      padding: 0;
      margin: 0;
      font-weight: normal;
    }
    button.link:hover { text-decoration: underline; }
    code {
      background: #262626;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-size: 0.875rem;
    }
    code.block {
      display: block;
      padding: 0.75rem 1rem;
      margin: 0.5rem 0;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .muted { color: #666; font-size: 0.875rem; }
    .error { color: #ef4444; }
    table { width: 100%; }
    td { padding: 0.5rem 0; }
    td:first-child { color: #888; }
    ol { padding-left: 1.25rem; margin: 0.5rem 0; }
    li { margin: 0.5rem 0; }
    a { color: #60a5fa; }
  `;
}

// =============================================================================
// Start
// =============================================================================

if (!SETUP_PASSWORD) {
  console.error("[FATAL] SETUP_PASSWORD not set");
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[openclaw] Bootstrap server on :${PORT}`);
  const status = getStatus();
  console.log(`[openclaw] State: ${status.state}`);
  if (status.tailscale.ip) {
    console.log(`[openclaw] Tailscale IP: ${status.tailscale.ip}`);
  }
});
