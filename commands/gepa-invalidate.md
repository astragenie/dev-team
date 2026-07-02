---
description: Soft-delete GEPA trials for an agent. Supports filtering by ISO datetime (--since) and tag (--tag). Writes an audit row to events.jsonl with invalidated_by_pid, invalidated_at, and reason. Invalidated trials are excluded from future recall() calls but preserved on disk (soft-delete semantics).
allowed-tools: Bash
---

# /crew:gepa-invalidate

Soft-delete GEPA trials for a named agent from the trial store. Useful when a batch of trials was collected under bad conditions (judge misconfiguration, eval fixture bug, etc.) and should be excluded from future optimization cycles.

## Usage

```
/crew:gepa-invalidate --agent <name> [--since <iso>] [--tag <tag>]
```

Flags:
- `--agent <name>` — required. Agent name (e.g. `fullstack-dev`).
- `--since <iso>` — only invalidate trials created at or after this ISO datetime (e.g. `2026-06-25T00:00:00Z`).
- `--tag <tag>` — only invalidate trials with this tag (fileStore: filter by tag field).

## Behavior

1. Opens the trial store at `.claude/artifacts/crew/gepa/trials/<agent>.jsonl`.
2. Calls `TrialStore.invalidate({ agent, since?, tag? })` — soft-delete semantics:
   - fileStore: rewrites the JSONL excluding matching rows.
3. Writes an audit row to `.claude/logs/events.jsonl`:
   - `event: "gepa_invalidate"`, `agent`, `since`, `tag`, `invalidated_count`, `invalidated_by_pid`, `invalidated_at`, `reason: "manual kill-switch via gepa-invalidate"`.
4. Prints `invalidated N trials for <agent> since <iso>` to stdout.

## Exit codes

- `0` — invalidation completed (count may be 0 if no rows matched).
- `1` — internal error.
- `2` — bad args (missing `--agent`).

## Example

```bash
# Invalidate all trials for fullstack-dev since June 25
node scripts/crew.ts gepa-invalidate --agent fullstack-dev --since 2026-06-25T00:00:00Z

# Invalidate all trials for fullstack-dev with tag "broken-judge"
node scripts/crew.ts gepa-invalidate --agent fullstack-dev --tag broken-judge
```

## See also

- `commands/gepa-revert.md` — revert a champion promotion.
- `commands/gepa-thaw.md` — thaw a frozen agent.
- `commands/gepa-resume.md` — clear no-winner streak or global pause.
- `scripts/lib/gepa/gepa-killswitch-cmds.ts` — implementation.
