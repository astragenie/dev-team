---
description: Remove an agent from the gepa.config.json champion_frozen list, re-enabling optimization and promotion cycles for that agent. Uses atomic tmp+rename write to prevent partial updates.
allowed-tools: Bash
---

# /crew:gepa-thaw

Remove an agent from the `champion_frozen` list in `gepa.config.json`. After thawing, `/crew:gepa-optimize <agent>` proceeds normally on the next invocation.

## Usage

```
/crew:gepa-thaw <agent>
```

Arguments:
- `<agent>` — required. Agent name to remove from `champion_frozen` (e.g. `inspector`).

## Behavior

1. Reads `gepa.config.json` from the repo root.
2. Checks whether `<agent>` is in `champion_frozen`. If not, exits 0 with a no-op message.
3. Removes `<agent>` from the list.
4. Writes the updated config via **atomic tmp+rename** (no partial-write risk).
5. Emits `gepa_thaw` event to `.claude/logs/events.jsonl` with before/after frozen lists.

## Exit codes

- `0` — agent removed from frozen list (or was already absent — no-op).
- `1` — `gepa.config.json` not found or parse error.
- `2` — bad args (missing agent).

## Example

```bash
# gepa.config.json has champion_frozen: ["inspector", "architect"]
node scripts/crew.ts gepa-thaw inspector
# → champion_frozen becomes ["architect"]
# → subsequent /crew:gepa-optimize inspector proceeds normally
```

## See also

- `commands/gepa-invalidate.md` — invalidate bad trials.
- `commands/gepa-revert.md` — revert a champion promotion.
- `commands/gepa-resume.md` — clear no-winner streak or global pause.
- `scripts/lib/gepa/gepa-killswitch-cmds.ts` — implementation.
