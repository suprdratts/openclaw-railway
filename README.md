# Clawdbot Railway Deployment

Personal Clawdbot instance deployed on Railway.

## Quick Start

1. Deploy to Railway (auto-detects Dockerfile)
2. Set environment variables in Railway dashboard
3. SSH in: `railway ssh`
4. Run: `clawdbot onboard` to complete setup

## Environment Variables

Set these in Railway dashboard:

| Variable | Description |
|----------|-------------|
| `PORT` | Set to `18789` (Railway provides this) |

Authentication is handled via `clawdbot onboard` which saves to persistent volume.

## SSH Access

```bash
railway link  # Link to project
railway ssh   # SSH into container
clawdbot onboard  # Complete setup
```

## Updating

Push to main branch - Railway auto-deploys.
