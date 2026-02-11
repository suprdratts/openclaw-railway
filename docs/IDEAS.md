# Content Ideas

Future use cases and examples to build after the core template is complete.

## Use Case Categories

### Immediate Value (Easy Wins)
- **Morning Briefing** - Calendar + weather + emails + news → Telegram
- **PR Review from Phone** - Review code, run tests, merge via chat
- **Email Triage** - Bulk cleanup and categorization
- **Grocery + Meal Planning** - Automated shopping lists with meal suggestions

### Financial / Bookkeeping
- **Receipt Reconciliation** - Gmail receipts matched to bank transactions
- **Expense Categorization** - Auto-categorize for tax purposes
- **Notion as Ledger** - Structured database for manual + automated entry
- **Wise Webhooks** - Transaction notifications trigger reconciliation
- Potential integrations: Plaid (bank data), Gmail Pub/Sub (receipts), Notion API

### Smart Home
- **Roborock Vacuum** - Natural language control
- **Home Assistant** - Full home automation
- **Philips Hue / Elgato** - Lighting control

### Developer Workflows
- **iOS App via Telegram** - Deploy to TestFlight through chat
- **Multi-Agent Orchestration** - Specialized agents coordinated by Opus
- **Monitoring Skills** - Track platform releases, CI status

### Learning
- **Language Tutor** - Pronunciation feedback, vocabulary building
- **Semantic Bookmarks** - Vector search over saved content

## Resources

- **Official Showcase**: https://docs.openclaw.ai/start/showcase
- **ClawHub Registry**: https://github.com/openclaw/clawhub (3,000+ skills)
- **Awesome OpenClaw Skills**: https://github.com/VoltAgent/awesome-openclaw-skills (1,715+ curated)

## Notes

The bookkeeping use case is particularly interesting because:
- No existing Xero/QuickBooks integrations in the ecosystem
- Plaid and Bankr skills exist for bank data
- Gmail Pub/Sub can capture receipt emails
- Notion has full CRUD API support
- Would need custom reconciliation logic
- HMAC signature validation needed for Wise/Stripe webhooks
