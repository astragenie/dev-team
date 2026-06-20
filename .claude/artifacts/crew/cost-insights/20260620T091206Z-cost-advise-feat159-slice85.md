---
feature: FEAT-159
---
# Cost Advisor

## Performance Grade: A

Target slice: **FEAT159 SLICE85**
Cost: $51.3457 · duration 3.7 min · cache hit 99.7% · grade avg -

## Baseline (last 9 slices)
- median $: $76.18
- p75 $: $76.18
- median cache hit: 99.6%
- median Opus share: 100.0%

## Per-slice findings
### [HIGH] opus-overuse
- Opus accounts for 100.0% of spend — Opus is ~5x Sonnet on every token category.
- **Suggested action:** Switch routine slices to Sonnet via /model. Reserve Opus for design, ambiguous problem framing, or hard refactors.

## Cross-slice trends
### [HIGH] cost-regression
- Current slice cost $51.3457 is 199% above the last-3 median of $17.1539.
- **Suggested action:** Audit what drove the spike: Opus usage, subagent cold-starts, cache busts, or long exploration loops. Mandate Sonnet-default and a written plan before the next similar slice.

### [MEDIUM] trend-opus
- Median Opus $ share is 100.0% across recent slices.
- **Suggested action:** Default to Sonnet; promote to Opus only on slice-start when the problem is design-shaped.

