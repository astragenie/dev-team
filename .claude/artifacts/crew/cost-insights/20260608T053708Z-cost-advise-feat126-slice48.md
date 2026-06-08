---
feature: FEAT-126
---
# Cost Advisor

## Performance Grade: C

Target slice: **FEAT126 SLICE48**
Cost: $55.2276 · duration 64.6 min · cache hit 98.4% · grade avg -

## Baseline (last 9 slices)
- median $: $10.73
- p75 $: $19.12
- median cache hit: 98.8%
- median Opus share: 80.3%

## Per-slice findings
### [HIGH] opus-overuse
- Opus accounts for 90.7% of spend — Opus is ~5x Sonnet on every token category.
- **Suggested action:** Switch routine slices to Sonnet via /model. Reserve Opus for design, ambiguous problem framing, or hard refactors.

### [LOW] file-rereads
- 4 redundant Read calls of files already loaded this session.
- **Suggested action:** Trust prior Read results unless the file was edited. Each redundant Read injects fresh tool output that busts the cache.

### [HIGH] compaction
- 5 compaction/meta event(s) — context was summarised mid-slice.
- **Suggested action:** Slice ran past the context window. Checkpoint to a handoff artifact earlier and split the work.

## Cross-slice trends
### [HIGH] cost-regression
- Current slice cost $55.2276 is 587% above the last-3 median of $8.0370.
- **Suggested action:** Audit what drove the spike: Opus usage, subagent cold-starts, cache busts, or long exploration loops. Mandate Sonnet-default and a written plan before the next similar slice.

### [MEDIUM] trend-opus
- Median Opus $ share is 80.3% across recent slices.
- **Suggested action:** Default to Sonnet; promote to Opus only on slice-start when the problem is design-shaped.

