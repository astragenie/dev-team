---
description: Install a Crew commit bridge so commits and signal-file edits produce Crew artifacts in this repo.
---

# Install Commit Bridge

Use this when the current repo has its own evidence convention (commit message
prefixes, slice docs, CHANGELOG appends, etc.) and you want Crew's brief-me,
wake-up, and artifact memory buckets to reflect that activity instead of
staying empty.

The bridge has two halves:

- **git post-commit hook** — any commit whose subject matches the configured
  pattern writes a Crew `review-result` artifact.
- **PostToolUse hook** — when Claude edits a file whose name ends with the
  configured trigger filename, writes a Crew `final-synthesis` artifact.

Both hooks are best-effort. They silently no-op on failure and never block a
commit or a tool call.

## Choosing a preset

Built-in presets:

- `wiggin-loop` (default) — `SLICE_NN` / `slice-NN` / "all N slices" commit pattern; `completed-slices.md` trigger file.
- `conventional-commits` — `feat|fix|refactor|perf` commit prefix; `CHANGELOG.md` trigger file.

List them at any time:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" list-bridge-presets
```

## Workflow

1. Verify the current workspace path:
   - `pwd`
2. Decide which preset to use (or specify explicit fields). Confirm the repo
   has a recognizable signal — don't install a bridge for a repo that doesn't
   need one.
3. Install the bridge:
   ```bash
   set -euo pipefail
   # default preset (wiggin-loop):
   node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" install-commit-bridge --repo "$PWD"
   # or with an explicit preset:
   node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" install-commit-bridge --repo "$PWD" --preset conventional-commits
   # or with custom values that override the preset:
   node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" install-commit-bridge --repo "$PWD" \
     --commit-pattern '^EPIC_[0-9]+' \
     --trigger-filename 'epics-done.md' \
     --reviewer-label 'epic-tracker'
   ```
4. Report which files were written and which configuration is active. The
   bridge writes its current settings into `.claude/hooks/README.md` so they
   stay inspectable.
5. If the repo already has commit history that predates this install, offer a
   one-time backfill so historical matching commits become Crew review
   artifacts:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" backfill-commit-bridge --repo "$PWD" --preset <same-preset>
   ```

## Configuration overrides

Explicit flags override the preset values. Useful when a preset is *almost*
right:

- `--commit-pattern <regex>` — case-insensitive ERE matched against `git log -1 --pretty=%s`
- `--trigger-filename <name>` — case-insensitive suffix match against the edited file path
- `--reviewer-label <name>` — string written into the `reviewer` field of the review artifact

The installer is idempotent. Re-running with new values overwrites the
generated hook scripts and updates `.claude/hooks/README.md` accordingly.

## Don't install where it doesn't fit

The bridge is observability, not enforcement. Don't install it in a repo
whose commit messages are too noisy or whose authors haven't agreed on a
convention. A bridge that fires on every other commit just produces artifact
spam.
