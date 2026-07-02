---
description: Clear a GEPA no-winner streak for a specific agent (re-enabling optimization after 3 consecutive no-winner cycles), OR clear the global optimize.paused flag in gepa.config.json. With an agent name: clears the streak. Without an agent name: clears the global pause.
allowed-tools: Bash
---

# /crew:gepa-resume

Clear the GEPA no-winner streak for a named agent, or clear the global `optimize.paused` flag to re-enable all optimization cycles.

## Usage

```
/crew:gepa-resume [<agent>]
```

Arguments:
- `<agent>` (optional) — agent name whose no-winner streak to clear (e.g. `fullstack-dev`). When omitted, clears the global `optimize.paused: true` in `gepa.config.json`.

## Behavior

### With agent name

1. Resets the no-winner streak counter for `<agent>` to 0 in `.claude/artifacts/crew/gepa/no-winner-streak.json`.
2. Emits `gepa_resume` event to `.claude/logs/events.jsonl` with `agent` and `resumed_at`.
3. The next `/crew:gepa-optimize <agent>` call will proceed normally (streak check passes).

### Without agent name (global resume)

1. Reads `gepa.config.json`.
2. Sets `optimize.paused: false`.
3. Writes via atomic tmp+rename.
4. Emits `gepa_resume` event with `global: true` and `was_paused`.

## Exit codes

- `0` — streak cleared or global pause cleared.
- `1` — `gepa.config.json` not found or parse error (global mode only).
- `2` — bad args (agent name looks like a flag).

## Example

```bash
# Clear no-winner streak for fullstack-dev (blocked after 3 consecutive no-winner cycles)
node scripts/crew.ts gepa-resume fullstack-dev

# Clear global pause (gepa.config.json optimize.paused: true)
node scripts/crew.ts gepa-resume
```

## Relationship to /crew:gepa-optimize

The no-winner streak is incremented on each cycle where no Pareto rank-1 winner is found.
At streak = 3, `/crew:gepa-optimize` exits with code 3. Running `/crew:gepa-resume <agent>` resets
the counter and re-enables the next optimize call.

## See also

- `commands/gepa-invalidate.md` — invalidate bad trials.
- `commands/gepa-revert.md` — revert a champion promotion.
- `commands/gepa-thaw.md` — thaw a frozen agent.
- `scripts/lib/gepa/no-winner-streak-tracker.ts` — streak tracker.
- `scripts/lib/gepa/gepa-killswitch-cmds.ts` — implementation.
