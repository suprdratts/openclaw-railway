# Tools Configuration

Local infrastructure and tool configuration for this Railway deployment.

## Environment

- **Platform:** Railway container
- **Workspace:** `/data/workspace`
- **Config:** `/data/.openclaw/openclaw.json`

## Available Tools

Check your current tool access:
- Ask: "What tools do you have access to?"
- Or read the config file

## Unlocking Tools

Tools are controlled via the config file. To unlock more:

1. SSH into Railway: `railway ssh`
2. Edit config: `nano /data/.openclaw/openclaw.json`
3. Modify the `tools.allow` and `tools.deny` arrays
4. Restart gateway: `pkill -f "openclaw gateway" && openclaw gateway run --port 18789 &`

See `docs/TIERS.md` for specific configurations.

## Skills

Skills from ClawHub can extend your capabilities. Install via:

```bash
openclaw skills install <skill-name>
```

Reference installed skills here as you add them.

## Notes

Add tool-specific notes as you discover them:

<!-- Example:
## Web Search
- Enabled: Yes
- Notes: Works well for current events, sometimes slow
-->
