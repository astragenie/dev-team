---
feature: FEAT-135
---
# Cost Advisor

## Performance Grade: A

Target slice: **FEAT135 SLICE62**
Cost: $0.6471 · duration 2.3 min · cache hit 99.5% · grade avg -

## Baseline (last 9 slices)
- median $: $4.76
- p75 $: $5.77
- median cache hit: 99.1%
- median Opus share: 47.9%

## Per-slice findings
### [MEDIUM] opus-overuse
- Opus accounts for 68.1% of spend — Opus is ~5x Sonnet on every token category.
- **Suggested action:** Switch routine slices to Sonnet via /model. Reserve Opus for design, ambiguous problem framing, or hard refactors.

### [MEDIUM] compaction
- 1 compaction/meta event(s) — context was summarised mid-slice.
- **Suggested action:** Slice ran past the context window. Checkpoint to a handoff artifact earlier and split the work.

## Cross-slice trends
### [MEDIUM] trend-opus
- Median Opus $ share is 47.9% across recent slices.
- **Suggested action:** Default to Sonnet; promote to Opus only on slice-start when the problem is design-shaped.

