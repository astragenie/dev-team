---
feature: FEAT-106
---
# Cost Advisor

## Performance Grade: A

Target slice: **FEAT106 SLICE29**
Cost: $0.8325 · duration 7.6 min · cache hit 98.8% · grade avg -

## Baseline (last 9 slices)
- median $: $0.95
- p75 $: $1.58
- median cache hit: 99.6%
- median Opus share: 0.0%

## Per-slice findings
### [LOW] large-tool-output
- 90th-percentile tool result is 4,151 bytes.
- **Suggested action:** Prefer Grep with head_limit, Bash | head -N, or narrower file Read offsets over broad output. Big tool results inflate cache_create.

