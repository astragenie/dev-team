---
feature: FEAT-003
---
# Cost Advisor

## Performance Grade: A

Target slice: **FEAT003 SLICE07**
Cost: $2.5641 · duration 1.0 min · cache hit 99.8% · grade avg -

## Baseline (last 9 slices)
- median $: $11.63
- p75 $: $23.51
- median cache hit: 98.4%
- median Opus share: 92.6%

## Per-slice findings
### [HIGH] opus-overuse
- Opus accounts for 93.9% of spend — Opus is ~5x Sonnet on every token category.
- **Suggested action:** Switch routine slices to Sonnet via /model. Reserve Opus for design, ambiguous problem framing, or hard refactors.

### [MEDIUM] compaction
- 1 compaction/meta event(s) — context was summarised mid-slice.
- **Suggested action:** Slice ran past the context window. Checkpoint to a handoff artifact earlier and split the work.

## Cross-slice trends
### [MEDIUM] trend-opus
- Median Opus $ share is 92.6% across recent slices.
- **Suggested action:** Default to Sonnet; promote to Opus only on slice-start when the problem is design-shaped.

