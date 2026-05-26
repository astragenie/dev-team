---
description: Internal setup/debug command to inspect whether the Crew harness is already present.
---

# Audit Repo For Crew

Use this workflow before adopting when you want to understand the current repo state.

Workflow:

1. Run the installer audit command:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" audit --repo "$PWD"`
2. Report whether the repo already has:
   - `CLAUDE.md`
   - `.claude/`
   - `.claude/settings.json`
   - `.claude/artifacts/crew/`
   - `.claude/state/crew/`
   - global Crew memory in `~/.claude/crew/`
3. If the harness is incomplete, recommend either:
   - `/crew:adopt` for adoption into this repo
   - `/crew:init` for a fresh repo instead

Deliverable:

- a short state report
- the recommended next step
