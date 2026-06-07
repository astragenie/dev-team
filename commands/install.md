---
description: Preferred short entry point for installing or updating the managed global framework memory.
---

# Install Global Crew Memory

Install or update the managed global Crew memory files.

Use this after installing or updating the plugin when framework memory changes.

This command writes one global managed copy:

- `~/.claude/crew/constitution.md`
- `~/.claude/crew/workflow.md`
- `~/.claude/crew/metadata.json`

It also ensures global `~/.claude/CLAUDE.md` imports the constitution and workflow.

Run:

```bash
set -euo pipefail
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" install-global
```

Then report:

- which files changed
- whether global memory is installed
- the installed global memory version
- whether the user should run `/reload-plugins`

End with a short welcome message:

- congratulate the user on the excellent life choice of installing Crew
- keep it brief and slightly tongue-in-cheek
- remind them of the next useful commands: `/crew:init`, `/crew:adopt`, and `/crew:brief-me`

Do not delegate this to another command name or skill reference. `/crew:install` is the primary user-facing command.
