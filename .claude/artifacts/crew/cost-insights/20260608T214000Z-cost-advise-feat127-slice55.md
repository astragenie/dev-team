---
feature: FEAT-127
---
# Cost Advisor

## Performance Grade: A

Target slice: **FEAT127 SLICE55**
Cost: $0.1806 · duration 4.9 min · cache hit 99.5% · grade avg -

## Baseline (last 9 slices)
- median $: $3.17
- p75 $: $19.12
- median cache hit: 99.3%
- median Opus share: 73.9%

## Per-slice findings
- No rules fired. This slice is within healthy bounds.
## Cross-slice trends
### [MEDIUM] trend-opus
- Median Opus $ share is 73.9% across recent slices.
- **Suggested action:** Default to Sonnet; promote to Opus only on slice-start when the problem is design-shaped.

