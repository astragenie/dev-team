---
description: Compatibility alias for /crew:install-commit-bridge with the wiggin-loop preset.
---

# Install Wiggin Loop Bridge

See `/crew:install-commit-bridge`. This command installs the `wiggin-loop`
preset (`SLICE_NN` commit pattern + `completed-slices.md` trigger file).

```bash
set -euo pipefail
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" install-commit-bridge --repo "$PWD" --preset wiggin-loop
```

If the repo has prior SLICE history, follow up with the backfill:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" backfill-commit-bridge --repo "$PWD" --preset wiggin-loop
```

For repos that follow a different convention, use `/crew:install-commit-bridge`
directly with a different preset or explicit `--commit-pattern` / `--trigger-filename`.
