---
feature: FEAT-114
---
# Cost Advisor

## Performance Grade: C

Target slice: **FEAT114 SLICE38**
Cost: $2.2867 · duration 33.2 min · cache hit 97.1% · grade avg -

## Baseline (last 9 slices)
- median $: $1.01
- p75 $: $1.11
- median cache hit: 99.2%
- median Opus share: 0.0%

## Per-slice findings
### [MEDIUM] subagent-overuse
- 6 subagent dispatches.
- **Suggested action:** Subagents cold-start with no cache reuse — each one re-derives session context. Reserve for genuinely independent parallel work.

## Cross-slice trends
### [MEDIUM] subagent-creep
- Subagent dispatch count has grown across the last 3 slices: 4 → 5 → 6. Each cold-start re-derives session context.
- **Suggested action:** Bundle review + validation into a single subagent when scope is small. Reserve parallel dispatches for genuinely independent parallel work.

