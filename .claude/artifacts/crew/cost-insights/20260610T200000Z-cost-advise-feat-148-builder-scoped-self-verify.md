# Cost Advisor

## Performance Grade: A

Target slice: **FEAT-148 builder scoped self-verify**
Cost: $25.2677 · duration 4.1 min · cache hit 99.5% · grade avg -

## Baseline (last 9 slices)
- median $: $76.77
- p75 $: $80.58
- median cache hit: 99.5%
- median Opus share: 100.0%

## Per-slice findings
### [HIGH] opus-overuse
- Opus accounts for 100.0% of spend — Opus is ~5x Sonnet on every token category.
- **Suggested action:** Switch routine slices to Sonnet via /model. Reserve Opus for design, ambiguous problem framing, or hard refactors.

### [MEDIUM] compaction
- 1 compaction/meta event(s) — context was summarised mid-slice.
- **Suggested action:** Slice ran past the context window. Checkpoint to a handoff artifact earlier and split the work.

## Cross-slice trends
### [HIGH] cost-regression
- Current slice cost $25.2677 is 26% above the last-3 median of $20.0208.
- **Suggested action:** Audit what drove the spike: Opus usage, subagent cold-starts, cache busts, or long exploration loops. Mandate Sonnet-default and a written plan before the next similar slice.

### [MEDIUM] trend-opus
- Median Opus $ share is 100.0% across recent slices.
- **Suggested action:** Default to Sonnet; promote to Opus only on slice-start when the problem is design-shaped.

