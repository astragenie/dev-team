---
feature: FEAT-103
---
# Cost Advisor

## Performance Grade: B

Target slice: **FEAT103 SLICE21**
Cost: $2.0244 · duration 3.8 min · cache hit 99.6% · grade avg -

## Baseline (last 9 slices)
- median $: $0.74
- p75 $: $1.58
- median cache hit: 99.6%
- median Opus share: 0.0%

## Per-slice findings
### [MEDIUM] file-rereads
- 5 redundant Read calls of files already loaded this session.
- **Suggested action:** Trust prior Read results unless the file was edited. Each redundant Read injects fresh tool output that busts the cache.

## Cross-slice trends
### [HIGH] cost-regression
- Current slice cost $2.0244 is 29% above the last-3 median of $1.5754.
- **Suggested action:** Audit what drove the spike: Opus usage, subagent cold-starts, cache busts, or long exploration loops. Mandate Sonnet-default and a written plan before the next similar slice.

