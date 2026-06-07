---
feature: FEAT-107
---
# Cost Advisor

## Performance Grade: C

Target slice: **FEAT107 SLICE30**
Cost: $0.9686 · duration 9.0 min · cache hit 99.2% · grade avg -

## Baseline (last 9 slices)
- median $: $0.83
- p75 $: $1.32
- median cache hit: 99.6%
- median Opus share: 0.0%

## Per-slice findings
### [LOW] tool-failure-rate
- 7.1% tool failure rate (1/14).
- **Suggested action:** Tool failures are pure waste. Plan the call shape (paths, flags, JSON schemas) before invoking; check pwd / file existence first.

