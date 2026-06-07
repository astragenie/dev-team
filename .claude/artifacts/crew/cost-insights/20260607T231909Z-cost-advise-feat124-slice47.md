---
feature: FEAT-124
---
# Cost Advisor

## Performance Grade: A

Target slice: **FEAT124 SLICE47**
Cost: $19.1155 · duration 13.7 min · cache hit 99.3% · grade avg -

## Baseline (last 9 slices)
- median $: $10.73
- p75 $: $59.94
- median cache hit: 97.7%
- median Opus share: 0.0%

## Per-slice findings
### [HIGH] opus-overuse
- Opus accounts for 100.0% of spend — Opus is ~5x Sonnet on every token category.
- **Suggested action:** Switch routine slices to Sonnet via /model. Reserve Opus for design, ambiguous problem framing, or hard refactors.

