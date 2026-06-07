---
feature: FEAT-109
---
# Cost Advisor

## Performance Grade: A

Target slice: **FEAT109 SLICE33**
Cost: $1.1112 · duration 9.1 min · cache hit 99.2% · grade avg -

## Baseline (last 9 slices)
- median $: $1.01
- p75 $: $1.32
- median cache hit: 99.3%
- median Opus share: 0.0%

## Per-slice findings
### [LOW] large-tool-output
- 90th-percentile tool result is 4,439 bytes.
- **Suggested action:** Prefer Grep with head_limit, Bash | head -N, or narrower file Read offsets over broad output. Big tool results inflate cache_create.

