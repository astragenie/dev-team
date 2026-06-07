---
feature: FEAT-101
---
# Cost Advisor

## Performance Grade: A

Target slice: **FEAT101 SLICE19**
Cost: $1.5754 · duration 2.9 min · cache hit 99.6% · grade avg -

## Baseline (last 9 slices)
- median $: $0.95
- p75 $: $2.28
- median cache hit: 99.6%
- median Opus share: 0.0%

## Per-slice findings
- No rules fired. This slice is within healthy bounds.
## Cross-slice trends
### [HIGH] cost-regression
- Current slice cost $1.5754 is 2180% above the last-3 median of $0.0691.
- **Suggested action:** Audit what drove the spike: Opus usage, subagent cold-starts, cache busts, or long exploration loops. Mandate Sonnet-default and a written plan before the next similar slice.

