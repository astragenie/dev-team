# Cost Advisor

Target slice: **SLICE-01**
Cost: $1.8352 · duration 0.3 min · cache hit 98.1% · grade avg -

## Baseline (last 3 slices)
- median $: $61.29
- p75 $: $102.23
- median cache hit: 99.9%
- median Opus share: 100.0%

## Per-slice findings
### [HIGH] opus-overuse
- Opus accounts for 100.0% of spend — Opus is ~5x Sonnet on every token category.
- **Suggested action:** Switch routine slices to Sonnet via /model. Reserve Opus for design, ambiguous problem framing, or hard refactors.

## Cross-slice trends
### [MEDIUM] trend-opus
- Median Opus $ share is 100.0% across recent slices.
- **Suggested action:** Default to Sonnet; promote to Opus only on slice-start when the problem is design-shaped.

