---
feature: FEAT-131
---
# Cost Advisor

## Performance Grade: C

Target slice: **FEAT131 SLICE59**
Cost: $7.7252 · duration 9.3 min · cache hit 96.9% · grade avg -

## Baseline (last 9 slices)
- median $: $0.90
- p75 $: $1.60
- median cache hit: 99.4%
- median Opus share: 0.0%

## Per-slice findings
### [LOW] file-rereads
- 3 redundant Read calls of files already loaded this session.
- **Suggested action:** Trust prior Read results unless the file was edited. Each redundant Read injects fresh tool output that busts the cache.

### [HIGH] compaction
- 4 compaction/meta event(s) — context was summarised mid-slice.
- **Suggested action:** Slice ran past the context window. Checkpoint to a handoff artifact earlier and split the work.

### [LOW] tool-failure-rate
- 5.5% tool failure rate (3/55).
- **Suggested action:** Tool failures are pure waste. Plan the call shape (paths, flags, JSON schemas) before invoking; check pwd / file existence first.

### [MEDIUM] exploration-heavy
- Exploration:execution tool ratio is 7.6:1 (Reads/Greps/Bashes vs Edits/Writes).
- **Suggested action:** Lots of looking, little doing. After the second exploration pass, write the plan down and start editing; do not keep grepping. Prefer LSP for code-symbol lookups (see `docs/process/grep-guidance.md` in hero-crew); use Grep only for prose, configs, or regex hunts.

## Cross-slice trends
### [HIGH] cost-regression
- Current slice cost $7.7252 is 44% above the last-3 median of $5.3600.
- **Suggested action:** Audit what drove the spike: Opus usage, subagent cold-starts, cache busts, or long exploration loops. Mandate Sonnet-default and a written plan before the next similar slice.

