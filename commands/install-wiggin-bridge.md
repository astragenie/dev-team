---
description: Install the Wiggin Loop bridge so SLICE commits and completed-slices.md edits produce Crew artifacts in this repo.
---

# Install Wiggin Loop Bridge

Use this when the current repo follows the Wiggin Loop methodology (SLICE-prefixed
commits, `docs/.../completed-slices.md`) and you want Crew's brief-me, wake-up, and
artifact memory buckets to surface that activity instead of staying empty.

What gets installed:

- `.git/hooks/post-commit` — git hook. Any commit subject matching a SLICE pattern
  (`SLICE_NN`, `slice-NN`, "all N slices") writes a Crew `review-result` artifact.
- `.claude/hooks/wiggin_loop_bridge.sh` — PostToolUse hook. When Claude edits any
  file ending in `completed-slices.md`, writes a Crew `final-synthesis` artifact.
- `.claude/hooks/README.md` — explains what the hooks do.
- Updates `.claude/settings.json` — registers the PostToolUse hook (preserves any
  existing PostToolUse entries the user has).

Both hooks are best-effort: they silently no-op on failure and never block a commit
or a tool call.

Workflow:

1. Verify the current workspace path:
   - `pwd`
2. Confirm the repo is the intended target (Wiggin Loop repos only — this bridge
   is specific to LoopBrain-style methodology and not appropriate for arbitrary
   repos).
3. Run the installer:
   ```bash
   set -euo pipefail
   node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" install-wiggin-bridge --repo "$PWD"
   ```
4. Report which files were written.
5. If the repo already has Wiggin Loop commit history that predates this install,
   offer to run a one-time backfill so historical SLICE commits become Crew
   review artifacts:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" backfill-wiggin-bridge --repo "$PWD"
   ```
6. Briefly explain that forward-firing commits and `completed-slices.md` edits
   will now produce Crew artifacts automatically, and link to
   `.claude/hooks/README.md` for the details.

Do not install this in repos that do not follow the Wiggin Loop methodology — the
SLICE regex and the `completed-slices.md` filename are deliberately specific.
