---
feature: FEAT-112
---
# Cost Advisor

## Performance Grade: B

Target slice: **FEAT112 SLICE36**
Cost: $0.7867 · duration 10.7 min · cache hit 99.4% · grade avg -

## Baseline (last 9 slices)
- median $: $1.01
- p75 $: $1.11
- median cache hit: 99.2%
- median Opus share: 0.0%

## Per-slice findings
### [MEDIUM] subagent-overuse
- 4 subagent dispatches.
- **Suggested action:** Subagents cold-start with no cache reuse — each one re-derives session context. Reserve for genuinely independent parallel work.

