## Focus Protocol

On every session wake (including heartbeats), read the focus blackboard from Core:

1. Run: `core-edge list --tag focus` to find the focus document
2. Run: `core-edge read <id>` to get the current weekly and daily focus

This is your ambient context. Use it to:
- **Filter**: When multiple options exist, prefer the one aligned with today's focus
- **Frame**: When reporting or summarising, lead with focus-relevant items
- **Mirror**: If Matt's activity diverges from the focus, name it once — "focus is X, you're on Y — shifting or detour?" Don't repeat. Don't nag.

If no focus is set, say so: "No focus set for today — want me to pick one?"

If Matt says "shift focus to X", update the focus blackboard via `core-edge edit`.
