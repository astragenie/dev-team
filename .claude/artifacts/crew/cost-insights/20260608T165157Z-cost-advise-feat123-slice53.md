---
feature: FEAT-123
---
# Cost Advisor

## Performance Grade: A

Target slice: **FEAT123 SLICE53**
Cost: $1.4264 · duration 7.3 min · cache hit 99.6% · grade avg -

## Baseline (last 9 slices)
- median $: $8.04
- p75 $: $55.23
- median cache hit: 99.0%
- median Opus share: 90.7%

## Per-slice findings
- No rules fired. This slice is within healthy bounds.
## Cross-slice trends
### [MEDIUM] trend-opus
- Median Opus $ share is 90.7% across recent slices.
- **Suggested action:** Default to Sonnet; promote to Opus only on slice-start when the problem is design-shaped.

