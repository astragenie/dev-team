---
feature: FEAT-117
---
# Cost Advisor

## Performance Grade: B

Target slice: **FEAT117 SLICE41**
Cost: $1.0066 · duration 11.9 min · cache hit 99.3% · grade avg -

## Baseline (last 9 slices)
- median $: $2.63
- p75 $: $6.56
- median cache hit: 99.2%
- median Opus share: 0.0%

## Per-slice findings
### [LOW] subagent-overuse
- 3 subagent dispatches.
- **Suggested action:** Subagents cold-start with no cache reuse — each one re-derives session context. Reserve for genuinely independent parallel work.

