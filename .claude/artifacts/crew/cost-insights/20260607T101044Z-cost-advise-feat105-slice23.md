---
feature: FEAT-105
---
# Cost Advisor

## Performance Grade: F

Target slice: **FEAT105 SLICE23**
Cost: $0.0691 · duration 0.3 min · cache hit 99.7% · grade avg -

## Baseline (last 9 slices)
- median $: $1.93
- p75 $: $2.33
- median cache hit: 99.5%
- median Opus share: 0.0%

## Per-slice findings
- No rules fired. This slice is within healthy bounds.
## Cross-slice trends
### [HIGH] cost-regression
- Current slice cost $0.0691 is 99% above the last-3 median of $0.0347.
- **Suggested action:** Audit what drove the spike: Opus usage, subagent cold-starts, cache busts, or long exploration loops. Mandate Sonnet-default and a written plan before the next similar slice.

