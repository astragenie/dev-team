---
feature: FEAT-107
---
# Cost Advisor

## Performance Grade: D

Target slice: **FEAT107 SLICE30**
Cost: $1.0086 · duration 9.1 min · cache hit 99.3% · grade avg -

## Baseline (last 9 slices)
- median $: $0.97
- p75 $: $1.32
- median cache hit: 99.6%
- median Opus share: 0.0%

## Per-slice findings
### [MEDIUM] tool-failure-rate
- 13.3% tool failure rate (2/15).
- **Suggested action:** Tool failures are pure waste. Plan the call shape (paths, flags, JSON schemas) before invoking; check pwd / file existence first.

