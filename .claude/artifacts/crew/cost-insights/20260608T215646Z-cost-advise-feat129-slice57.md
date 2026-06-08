---
feature: FEAT-129
---
# Cost Advisor

## Performance Grade: D

Target slice: **FEAT129 SLICE57**
Cost: $0.8988 · duration 8.9 min · cache hit 87.1% · grade avg -

## Baseline (last 9 slices)
- median $: $1.43
- p75 $: $1.63
- median cache hit: 99.4%
- median Opus share: 0.0%

## Per-slice findings
### [LOW] cache-busted
- Cache hit 87.1% is below the 95% amortisation sweet spot. Below 85% = cache rebuilds dominate cost.
- **Suggested action:** Front-load file reads in the first 1-2 turns then iterate; avoid interleaving big Bash output with code edits since fresh tool results invalidate the cache.

### [LOW] large-tool-output
- 90th-percentile tool result is 5,035 bytes.
- **Suggested action:** Prefer Grep with head_limit, Bash | head -N, or narrower file Read offsets over broad output. Big tool results inflate cache_create.

## Cross-slice trends
### [HIGH] cost-regression
- Current slice cost $0.8988 is 344% above the last-3 median of $0.2025.
- **Suggested action:** Audit what drove the spike: Opus usage, subagent cold-starts, cache busts, or long exploration loops. Mandate Sonnet-default and a written plan before the next similar slice.

