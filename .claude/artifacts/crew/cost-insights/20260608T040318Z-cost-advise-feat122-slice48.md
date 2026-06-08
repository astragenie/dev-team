---
feature: FEAT-122
---
# Cost Advisor

## Performance Grade: B

Target slice: **FEAT122 SLICE48**
Cost: $15.2434 · duration 13.6 min · cache hit 95% · grade avg -

## Baseline (last 9 slices)
- median $: $12.45
- p75 $: $59.94
- median cache hit: 98.3%
- median Opus share: 0.0%

## Per-slice findings
### [HIGH] opus-overuse
- Opus accounts for 100.0% of spend — Opus is ~5x Sonnet on every token category.
- **Suggested action:** Switch routine slices to Sonnet via /model. Reserve Opus for design, ambiguous problem framing, or hard refactors.

### [LOW] large-tool-output
- 90th-percentile tool result is 4,993 bytes.
- **Suggested action:** Prefer Grep with head_limit, Bash | head -N, or narrower file Read offsets over broad output. Big tool results inflate cache_create.

### [MEDIUM] compaction
- 2 compaction/meta event(s) — context was summarised mid-slice.
- **Suggested action:** Slice ran past the context window. Checkpoint to a handoff artifact earlier and split the work.

