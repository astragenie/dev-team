---
feature: FEAT-002
---
# Cost Advisor

## Performance Grade: B

Target slice: **FEAT002 SLICE06**
Cost: $4.9903 · duration 1.1 min · cache hit 99.5% · grade avg -

## Baseline (last 9 slices)
- median $: $23.17
- p75 $: $167.74
- median cache hit: 98.4%
- median Opus share: 90.5%

## Per-slice findings
### [HIGH] opus-overuse
- Opus accounts for 100.0% of spend — Opus is ~5x Sonnet on every token category.
- **Suggested action:** Switch routine slices to Sonnet via /model. Reserve Opus for design, ambiguous problem framing, or hard refactors.

### [MEDIUM] compaction
- 2 compaction/meta event(s) — context was summarised mid-slice.
- **Suggested action:** Slice ran past the context window. Checkpoint to a handoff artifact earlier and split the work.

## Cross-slice trends
### [MEDIUM] trend-opus
- Median Opus $ share is 90.5% across recent slices.
- **Suggested action:** Default to Sonnet; promote to Opus only on slice-start when the problem is design-shaped.

