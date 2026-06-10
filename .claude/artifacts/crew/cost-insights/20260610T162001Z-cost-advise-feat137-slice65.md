---
feature: FEAT-137
---
# Cost Advisor

## Performance Grade: F

Target slice: **FEAT137 SLICE65**
Cost: $3.2182 · duration 15.4 min · cache hit 99.5% · grade avg -

## Baseline (last 9 slices)
- median $: $76.77
- p75 $: $102.23
- median cache hit: 99.9%
- median Opus share: 100.0%

## Per-slice findings
### [MEDIUM] subagent-overuse
- 6 subagent dispatches.
- **Suggested action:** Subagents cold-start with no cache reuse — each one re-derives session context. Reserve for genuinely independent parallel work.

### [MEDIUM] tool-failure-rate
- 20.0% tool failure rate (2/10).
- **Suggested action:** Tool failures are pure waste. Plan the call shape (paths, flags, JSON schemas) before invoking; check pwd / file existence first.

## Cross-slice trends
### [MEDIUM] trend-opus
- Median Opus $ share is 100.0% across recent slices.
- **Suggested action:** Default to Sonnet; promote to Opus only on slice-start when the problem is design-shaped.

