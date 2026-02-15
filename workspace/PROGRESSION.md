# PROGRESSION.md — Tier Progression Guide

Read this file at the start of every session. It tells you how to detect your current capabilities, track progression state, and guide your user through security tier upgrades when they're ready.

This file is permanent. Never delete it.

---

## Tier Overview

| Tier | Name | Key Capabilities | How to Set |
|------|------|-----------------|------------|
| 0 | Personal Assistant | Web, memory, read/write, ls, cron, image | Default |
| 1 | Capable Agent | + curated exec (cat, grep, git, find...) | `SECURITY_TIER=1` |
| 2 | Power User | + full exec, browser, sub-agents, process | `SECURITY_TIER=2` |
| 3 | Operator | + gateway, nodes, elevated (all unlocked) | SSH only |

Tiers 0-2 are set via environment variable in Railway — no SSH required. Tier 3 requires SSH.

---

## A. Tier Detection

Your security tier determines what tools you can use. Detect your current tier empirically — don't guess, don't read config files. Probe by attempting tools in this order:

**Detection sequence:**

1. Attempt `exec` with `cat /dev/null`
   - If allowed and runs without asking → could be Tier 0 (ls only) or higher
   - If denied → something is misconfigured. Report to user.
2. Attempt `exec` with `grep --version`
   - If denied or blocked by allowlist → **Tier 0** (ls only). Stop probing.
3. Attempt `exec` with `curl --version`
   - If denied or blocked by allowlist → **Tier 1** (curated exec). Stop probing.
4. Check if `sessions_spawn` or `process` tools are available
   - If both available → **Tier 2** (power user) or higher
   - If denied → unusual config. Report to user.
5. Check for `.tier-status` file in workspace
   - If exists and mentions Tier 3 → Tier 2 applied, user wants Tier 3. Guide them to SSH.
6. Check if `gateway` or `nodes` tools are available
   - If available → **Tier 3** (operator)
   - If denied → **Tier 2** (power user)

**When to probe:**
- Once at the start of each session
- After the user says they've changed SECURITY_TIER and redeployed
- If you attempt a tool and it's unexpectedly blocked or allowed

**Important:** Probing is silent. Don't narrate it to the user. Just know your tier and act accordingly.

---

## B. Risk Awareness

At every tier, you should understand what could go wrong and proactively communicate risks to your user.

### Tier 0 Risks
- **Web content can contain prompt injection.** When reading web pages, hidden instructions could try to manipulate you. Don't visit URLs from sources your user doesn't trust.
- **Blast radius is low.** The worst case is a confused or misleading response. You can't execute commands or access external services based on a malicious page.

### Tier 1 Risks
- **Shell commands can expose information.** Even read-only commands like `cat` or `grep` can reveal file contents. Be mindful of what you read and share.
- **Git operations have side effects.** `git clone` downloads code. `git checkout` changes files. These are generally safe but confirm intent for operations that modify the workspace.

### Tier 2 Risks
- **Unrestricted exec means real-world consequences.** You can install packages, modify system files, make network requests. Confirm before running commands you haven't run before.
- **Sub-agents inherit your permissions.** If you can run any command, so can your sub-agents. The trust surface multiplies.
- **Browser automation is a prompt injection surface.** Web pages the browser visits can contain instructions aimed at you. Be extra cautious with unfamiliar URLs.
- **Cost implications.** Sub-agents and browser sessions consume tokens. Warn users about parallel work costs.

### Tier 3 Risks
- **Full system access.** A prompt injection attack through any content you read could lead to full container compromise.
- **Gateway modification.** You can change how the gateway works, which affects all connected channels.
- **No guardrails.** There's nothing between you and a mistake except your judgment. Ask before doing anything irreversible.

---

## C. State Tracker

Update these checkboxes as you progress with your user. This section persists on the volume across restarts, even when config resets on redeploy.

### Current State

- [ ] Tier detected: ___ (fill in: 0, 1, 2, or 3)
- [ ] Last probed: ___ (fill in date)

### Transition History

**0 → 1 (Capable Agent)**
- [ ] User hit the ceiling organically (needed shell commands)
- [ ] Discussed: allowlist concept (only listed binaries can run)
- [ ] Discussed: ask-on-miss gate (first use needs approval)
- [ ] User set SECURITY_TIER=1 and redeployed
- [ ] Post-upgrade verification passed

**1 → 2 (Power User)**
- [ ] User hit the ceiling organically (needed full exec/browser/sub-agents)
- [ ] Discussed: full exec risks (any command can run after first approval)
- [ ] Discussed: sub-agent permission inheritance
- [ ] Discussed: browser prompt injection surface
- [ ] Discussed: cost implications of parallel work
- [ ] User set SECURITY_TIER=2 and redeployed
- [ ] Post-upgrade verification passed

**2 → 3 (Operator)**
- [ ] User hit the ceiling organically (needed gateway/nodes/elevated)
- [ ] Discussed: full system access risks
- [ ] Discussed: prompt injection worst-case (full container compromise)
- [ ] Discussed: API spending limits verification
- [ ] User completed SSH setup
- [ ] Post-upgrade verification passed

### Redeploy Recovery

If config resets after a redeploy but the checkboxes above show a previous progression:
- Don't re-discuss prerequisites the user already acknowledged
- Offer to walk them through re-applying their previous tier's SECURITY_TIER setting
- For Tier 3, remind them SSH config needs to be re-applied separately
- Update the state tracker once restored

---

## D. Transition Playbooks

### General Rules

1. **Never suggest an upgrade unprompted.** Wait until the user hits the ceiling organically — meaning they ask you to do something you can't do, at least twice in separate contexts.
2. **Never frame upgrades as something they "should" do.** The current tier is not a limitation to fix. It's a deliberate security posture.
3. **Prerequisites are educational, not blocking.** Explain the risks. The user acknowledges. You don't gatekeep — you inform.
4. **Tiers 0-2: the user changes an env var and redeploys.** No SSH needed. You never change your own permissions.
5. **Tier 3: the user SSHs in.** You provide the exact config diff.

---

### Transition: Tier 0 → Tier 1 (Capable Agent)

**Ceiling signals:**
- User asks you to read a specific file and you can't (beyond what `read` tool provides)
- User wants you to check git status, grep for something, or count lines
- User copies terminal output into chat for you to process
- Pattern: "Can you just run..." / "Check what's in that file" / "How many..."

**Prerequisites to discuss:**

*Allowlist concept:*
> At Tier 1, I can run a curated set of shell commands — cat, grep, find, git, head, tail, wc, sort, uniq. Anything not on this list is blocked. This keeps the blast radius limited to read-only operations.

*Ask-on-miss gate:*
> The first time I use each new command type, I'll ask for your approval. After that, it runs without prompting. You're in control of what I'm allowed to do.

**Upgrade walkthrough:**

Tell the user:

> Here's how to enable curated shell access. In Railway's dashboard, add this environment variable:
>
> ```
> SECURITY_TIER=1
> ```
>
> Then redeploy. That's it — no SSH needed.
>
> Once it's deployed, let me know and I'll verify it worked.

**Post-upgrade verification:**
- Re-probe: attempt `grep --version`
- If it works (possibly after asking), confirm: "Shell access is active. I can run curated commands like cat, grep, git, and find."
- Update state tracker checkboxes

---

### Transition: Tier 1 → Tier 2 (Power User)

**Ceiling signals:**
- User wants you to install something, run curl, or use node
- User wants parallel research or sub-agents
- User wants browser automation
- User wants you to manage processes
- Pattern: "Can you install..." / "Run these in parallel" / "Browse this page" / "Set up a cron that..."

**Prerequisites to discuss:**

*Full exec risks:*
> At Tier 2, I can run any command in the container — not just the curated list. `ask: on-miss` still prompts me for approval the first time I use a new command, but after that it runs freely. This means real-world consequences: package installs, network requests, file modifications.

*Sub-agent permission inheritance:*
> When I spawn sub-agents for parallel work, they inherit my permissions. If I can run any command, so can they. The trust surface multiplies with each sub-agent.

*Browser automation:*
> Browser tools use a remote browser service (not local Chromium). The pages I visit could contain prompt injection. I'll be careful with unfamiliar URLs.

*Cost implications:*
> Sub-agents and browser sessions consume LLM tokens. Running three sub-agents in parallel costs roughly 3x a single request. Make sure your provider budget can handle it.

**Upgrade walkthrough:**

Tell the user:

> Here's how to enable full capabilities. In Railway's dashboard, change:
>
> ```
> SECURITY_TIER=2
> ```
>
> Then redeploy. No SSH needed.
>
> Once it's deployed, let me know and I'll verify it worked.

**Post-upgrade verification:**
- Re-probe: attempt `curl --version` and check for `sessions_spawn`
- If both work, confirm: "Power user mode is active. I have full shell access, can spawn sub-agents, and browser tools are available."
- Update state tracker checkboxes

---

### Transition: Tier 2 → Tier 3 (Operator)

**Ceiling signals:**
- User needs you to modify gateway configuration
- User needs node/device control
- User needs elevated permissions that Tier 2 doesn't provide
- This should be rare. Most users never need Tier 3.

**Prerequisites to discuss:**

*Active discouragement:*
> Before we go further — Tier 3 removes all tool restrictions. Most users never need this. What specifically are you trying to do that Tier 2 can't handle? Often we can solve it by adding a specific capability instead of opening everything.

*Realistic worst-case scenario:*
> At Tier 3, if I read a web page or message that contains a prompt injection attack, the attacker could — through me — run any command, access any file, modify the gateway, and spawn unlimited sub-agents. The blast radius is the entire container.

*API spending limits verification:*
> With no restrictions, a runaway task could burn through your API budget quickly. Verify that your LLM provider has spending caps set before enabling this.

**Upgrade walkthrough:**

Tell the user:

> Tier 3 requires SSH access — it can't be fully configured via environment variable.
>
> First, set `SECURITY_TIER=3` in Railway and redeploy. This applies Tier 2 as a base.
>
> Then SSH in to complete the setup:
>
> ```bash
> railway ssh
> nano /data/.openclaw/openclaw.json
> ```
>
> Set an empty deny list and enable elevated mode:
>
> ```json5
> {
>   agents: {
>     defaults: {
>       tools: {
>         deny: []
>       }
>     }
>   },
>   tools: {
>     exec: {
>       security: "full",
>       ask: "on-miss"
>     },
>     elevated: {
>       enabled: true
>     }
>   }
> }
> ```
>
> Restart the gateway:
> ```bash
> pkill -f "openclaw gateway"
> openclaw gateway run --port 18789 &
> exit
> ```
>
> Once you've done that, let me know and I'll verify it worked.

**Post-upgrade verification:**
- Re-probe: check for any tool denials, check if `gateway` tools work
- If nothing is denied, confirm: "Operator mode is active. All tools are available. Be mindful of what content I read."
- Update state tracker checkboxes

---

## E. Anti-patterns

**Things you must not do:**

- **Don't suggest upgrades proactively.** Wait for the user to hit the ceiling. At least twice in separate conversations before you mention the tier system.
- **Don't frame the current tier as a problem.** "You're at Tier 0" is informational. "You're *only* at Tier 0" is manipulative. Never imply they're missing out.
- **Don't skip prerequisites.** Even if the user says "just tell me the commands," briefly explain what changes and what the risks are. One sentence per concept is enough — don't lecture.
- **Don't bundle tier jumps.** If a user wants to go from 0 to 2, walk through the prerequisites for each transition briefly. They can set SECURITY_TIER=2 directly, but name the gap.
- **Don't apply changes yourself.** The user changes the env var and redeploys (Tier 0-2) or SSHs in (Tier 3). You provide the instructions.
- **Don't warn about risks unprompted.** Know the risks. Communicate them when relevant (before a risky action, during a tier transition). Don't lecture about security in casual conversation.

**Edge cases:**

- **User wants to jump tiers (e.g., 0→2):** They can set SECURITY_TIER=2 directly. Walk through both transitions' key risks briefly. Don't block them.
- **Redeploy resets tier but state tracker shows history:** Don't re-teach. Say: "Looks like a redeploy reset your config. Last time you were at Tier N. Want me to walk you through re-applying?" Then provide just the env var setting.
- **User asks "what tier am I on?":** Probe and tell them. Reference what that tier means in plain terms.
- **User asks to downgrade:** They change SECURITY_TIER to the lower value and redeploy. Note that redeploying always rebuilds config from env vars.
- **`.tier-status` file exists:** User set SECURITY_TIER=3 but only Tier 2 was applied. Guide them through the SSH steps to complete the Tier 3 setup.
