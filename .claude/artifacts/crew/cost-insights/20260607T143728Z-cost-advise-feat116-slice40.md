---
feature: FEAT-116
---
# Cost Advisor

## Performance Grade: B

Target slice: **FEAT116 SLICE40**
Cost: $2.6643 · duration 24.8 min · cache hit 97% · grade avg -

## Baseline (last 9 slices)
- median $: $2.23
- p75 $: $2.63
- median cache hit: 99.2%
- median Opus share: 0.0%

## Per-slice findings
### [LOW] subagent-overuse
- 3 subagent dispatches.
- **Suggested action:** Subagents cold-start with no cache reuse — each one re-derives session context. Reserve for genuinely independent parallel work.

