# Skills — Adding Tools to Your Agent

OpenClaw has a skills system that extends your agent with third-party tools. On Railway, skills that need external binaries require a one-time SSH setup — after that, everything persists across redeploys automatically.

## How It Works

The template's `EXEC_EXTRA_COMMANDS` and `EXTRA_ENV_KEYS` env vars handle custom binary wiring. Some baseline runtime vars (for example `TZ`, `XDG_CONFIG_HOME`, and `GOG_KEYRING_PASSWORD`) are now first-class template settings and do not need `EXTRA_ENV_KEYS`.

1. You SSH in and install a binary to `/data/bin/` (persists on the Railway volume)
2. You set env vars in the Railway dashboard
3. On every deploy, the entrypoint automatically:
   - Sets permissions on `/data/bin/*` (root:openclaw 750)
   - Symlinks binaries into `/usr/local/bin/` for skill discovery
   - Adds each binary to exec-approvals (Tier 0-1)
   - Passes env vars through to the gateway process
   - Adds `/data/bin/` to the gateway's PATH and trusted dirs

No Homebrew needed. No `openclaw onboard`. Just the binary + env vars.

## General Pattern

### Railway env vars

| Variable | What to set | Example |
|----------|-------------|---------|
| `EXEC_EXTRA_COMMANDS` | Comma-separated binary names | `core-edge,gog` |
| `EXTRA_ENV_KEYS` | Comma-separated env var names the custom binary needs at runtime | `MY_API_KEY,MY_CONFIG_DIR` |

Use `EXTRA_ENV_KEYS` for genuinely custom integrations. Built-in runtime vars that the template already understands should be set directly in Railway instead.

### SSH install steps

```bash
# Download the binary (may be a tarball — check the release page)
curl -sL <release-url> -o /tmp/tool.tar.gz
tar -xzf /tmp/tool.tar.gz -C /tmp <binary-name>
mv /tmp/<binary-name> /data/bin/<name>
rm /tmp/tool.tar.gz
chmod 750 /data/bin/<name>
chown root:openclaw /data/bin/<name>

# Run any one-time auth/config the tool needs
/data/bin/<name> auth ...

# Verify it works
/data/bin/<name> --version
```

Then redeploy. The agent can now exec the binary.

### Skill files

If the tool has an OpenClaw skill (`openclaw skills install <name>`), the install may fail on Railway because there's no Homebrew. That's fine — the skill system discovers binaries via PATH, so the symlink into `/usr/local/bin/` is enough. The agent gets the skill context automatically once the binary is discoverable.

If the skill doesn't auto-activate, you can place a skill instruction file in the workspace manually. Check the skill's documentation for what context the agent needs.

---

## Google Calendar (gog)

Give your agent read-only access to Google Calendar. Useful for morning briefing cron jobs, scheduling awareness, or "what's on my calendar today?" questions.

### Prerequisites

1. A Google Cloud project with the **Google Calendar API** enabled
2. OAuth client credentials (Desktop app type) — download the `client_secret.json` from the Google Cloud Console

### Step 1: Railway env vars

Add or update these in your Railway dashboard:

| Variable | Value |
|----------|-------|
| `EXEC_EXTRA_COMMANDS` | `gog` (or append: `core-edge,gog` if you have existing entries) |
| `GOG_KEYRING_PASSWORD` | A strong password (gog encrypts tokens at rest with this) |
| `XDG_CONFIG_HOME` | `/data/.config` |

`GOG_KEYRING_PASSWORD` and `XDG_CONFIG_HOME` are now first-class runtime env vars in the template — you do **not** need to add them to `EXTRA_ENV_KEYS`.

`XDG_CONFIG_HOME` tells gog to store its config and encrypted keyring on the `/data` volume instead of `/home/openclaw/.config/` (which gets wiped on every deploy).

**Don't redeploy yet** — do the SSH setup first.

### Step 2: SSH setup (one-time)

```bash
railway ssh
```

Once inside the container:

```bash
# Create persistent config directory
mkdir -p /data/.config/gogcli
chown openclaw:openclaw /data/.config /data/.config/gogcli

# Download gog binary (tarball — extract the binary)
curl -sL https://github.com/steipete/gogcli/releases/latest/download/gogcli_0.12.0_linux_amd64.tar.gz -o /tmp/gog.tar.gz
tar -xzf /tmp/gog.tar.gz -C /tmp gog
mv /tmp/gog /data/bin/gog
rm /tmp/gog.tar.gz
chmod 750 /data/bin/gog
chown root:openclaw /data/bin/gog

# Set up file-based keyring (required — no system keychain in containers)
GOG_KEYRING_PASSWORD=<your-password> XDG_CONFIG_HOME=/data/.config /data/bin/gog auth keyring file

# Store your Google OAuth credentials
# Option A: paste the JSON inline
cat > /tmp/client_secret.json << 'CEOF'
<paste your client_secret.json contents here>
CEOF
GOG_KEYRING_PASSWORD=<your-password> XDG_CONFIG_HOME=/data/.config /data/bin/gog auth credentials /tmp/client_secret.json
rm /tmp/client_secret.json

# Authorize — calendar only, read-only, headless flow
GOG_KEYRING_PASSWORD=<your-password> XDG_CONFIG_HOME=/data/.config /data/bin/gog auth add you@gmail.com --services calendar --readonly --manual
```

The `--manual` flag prints a URL. Open it in your browser, authorize, then paste the callback URL back into the terminal.

```bash
# Verify it works
GOG_KEYRING_PASSWORD=<your-password> XDG_CONFIG_HOME=/data/.config /data/bin/gog calendar events --all --today
```

You should see today's calendar events. Exit the SSH session.

### Step 3: Redeploy

Redeploy from the Railway dashboard (or `railway redeploy --yes`). The entrypoint picks up the new env vars and wires everything automatically.

### What the agent can do

After setup, the agent can run commands like:

```bash
gog calendar events --all --today          # today's schedule
gog calendar events --all --week           # this week
gog calendar events primary --from monday --to friday
```

The `--readonly` scope means the agent **cannot** create, modify, or delete events — only read them. This is enforced at the Google API level, not just client-side.

### Using it in a cron job

If your agent has a morning briefing cron, it can add calendar data to its routine:

```
gog calendar events --all --today --json
```

The `--json` flag gives structured output that's easy for the agent to parse and summarize.

### Upgrading to read-write

When you're ready for the agent to create events:

```bash
railway ssh
GOG_KEYRING_PASSWORD=<your-password> XDG_CONFIG_HOME=/data/.config /data/bin/gog auth add you@gmail.com --services calendar --force-consent --manual
```

Drop the `--readonly` flag and add `--force-consent` to re-authorize with write scopes.

### Troubleshooting

**"keyring is locked" or decryption errors**
- `GOG_KEYRING_PASSWORD` env var is missing or doesn't match the password used during setup
- Check: the Railway env var `GOG_KEYRING_PASSWORD` is set correctly

**Token gone after redeploy**
- `XDG_CONFIG_HOME` isn't set to `/data/.config` — gog is writing to `/home/openclaw/.config/` which gets wiped
- Check: the Railway env var `XDG_CONFIG_HOME=/data/.config` is set

**"command denied" when agent tries to run gog**
- `EXEC_EXTRA_COMMANDS` doesn't include `gog`
- At Tier 2+ this doesn't apply (exec is unrestricted)

**OAuth token expired**
- Google OAuth refresh tokens are long-lived but can expire if unused for 6 months, or if you revoke access in Google Account settings
- Re-run the `gog auth add` command via SSH to re-authorize

**Skill not detected by OpenClaw**
- The entrypoint symlinks `/data/bin/gog` → `/usr/local/bin/gog` automatically
- If the skill still doesn't activate, the binary may need to be on PATH before the gateway starts — redeploy to trigger the entrypoint

---

## Other Skills

The same pattern works for any skill that needs an external binary:

1. Download binary to `/data/bin/`
2. Add to `EXEC_EXTRA_COMMANDS`
3. Pass any custom env vars the binary needs via `EXTRA_ENV_KEYS`
4. Redeploy

Check [OpenClaw Skills Documentation](https://docs.openclaw.ai/skills) for available skills and their requirements.
