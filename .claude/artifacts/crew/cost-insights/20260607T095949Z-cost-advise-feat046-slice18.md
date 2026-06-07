---
feature: FEAT-046
---
# Cost Advisor

## Performance Grade: A

Target slice: **FEAT046 SLICE18**
Cost: $0.7425 · duration 6.7 min · cache hit 99.4% · grade avg -

## Baseline (last 9 slices)
- median $: $3.39
- p75 $: $39.04
- median cache hit: 98.4%
- median Opus share: 0.0%

## Per-slice findings
### [LOW] large-tool-output
- 90th-percentile tool result is 4,399 bytes.
- **Suggested action:** Prefer Grep with head_limit, Bash | head -N, or narrower file Read offsets over broad output. Big tool results inflate cache_create.

