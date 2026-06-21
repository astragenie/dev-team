---
description: Seed or update the crew.json features block (cost-hygiene, redundant-read-stop, shell-preflight, subagent-inline-warn). Idempotent.
---

# Cost Setup

Configure the crew plugin's cost-hygiene and gating features for this repo.

This command writes `.claude/crew.json` with a `features` block that mirrors the
defaults declared in the plugin's `FEATURES` registry. Features default to
**on**. To disable one, pass `--features <name>=off`.

Replaces the legacy env-var toggles (`CREW_COST_HYGIENE`,
`CREW_TOOL_PREFLIGHT`, `CREW_SUBAGENT_INLINE_THRESHOLD`). Those env vars are
gone — control is config-only now.

## Usage

1. Run the setup (idempotent — safe to re-run):
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" cost-setup --repo "$PWD"
   ```

2. To override one or more feature defaults at the same time:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" cost-setup --repo "$PWD" --features "cost-hygiene=off,shell-preflight=off"
   ```

3. To inspect the current registry without writing:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" features-list
   ```

## Output

JSON with three fields:

- `configPath` — absolute path to `.claude/crew.json`
- `written` — `true` if the file was changed, `false` if already current
- `features` — `[{ name, enabled, default }]` for every registered feature

## After running

Verify hooks pick up the change immediately — open a new tool call (Read, Edit,
Bash, etc.) and check the `[features] <name>: enabled|disabled` line on stderr.
No restart needed.

## What gets written

A `features` block in `.claude/crew.json`:

```json
{
  "features": {
    "cost-hygiene":         { "enabled": true },
    "redundant-read-stop":  { "enabled": true },
    "shell-preflight":      { "enabled": true },
    "subagent-inline-warn": { "enabled": true }
  }
}
```

User-set values for fields outside `features` are preserved.
