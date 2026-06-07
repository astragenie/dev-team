---
feature: FEAT-108
---
# Cost Advisor

## Performance Grade: A

Target slice: **FEAT108 SLICE32**
Cost: $0.6536 · duration 7.0 min · cache hit 99% · grade avg -

## Baseline (last 9 slices)
- median $: $1.01
- p75 $: $1.32
- median cache hit: 99.4%
- median Opus share: 0.0%

## Per-slice findings
### [MEDIUM] large-tool-output
- 90th-percentile tool result is 10,528 bytes.
- **Suggested action:** Prefer Grep with head_limit, Bash | head -N, or narrower file Read offsets over broad output. Big tool results inflate cache_create.

