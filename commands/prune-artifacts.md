---
description: Delete crew artifact files older than a configurable age threshold.
---

# Prune Artifacts

Use this command to remove stale crew artifacts from `.claude/artifacts/crew/`
subdirectories. Run in `--dry-run` mode first to see what would be deleted before
committing to a destructive pass.

Workflow:

1. Identify the target repo and desired retention window (default: 90 days).
2. Run a dry-run pass to preview files that would be deleted:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/prune-artifacts.ts" --dry-run --older-than <days> --repo "$PWD"`
3. If the list looks correct, run the destructive pass (omit `--dry-run`):
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/prune-artifacts.ts" --older-than <days> --repo "$PWD"`
4. Report the count of deleted files and any errors.

Flags:

- `--older-than <days>` — Age threshold in whole days (default: 90). Must be a
  positive integer. Rejects NaN, zero, and negative values with exit code 1.
- `--dry-run` — List matching files without deleting. Always safe to run.
- `--repo <path>` — Repository root path (default: current working directory).

Deliverable:

- a summary line: `deleted: N file(s) older than D day(s)` (or `dry-run:` prefix)
- any per-file lines written to stdout during the run
