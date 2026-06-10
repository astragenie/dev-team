---
feature: FEAT-136
---
# Cost Advisor

## Performance Grade: B

Target slice: **FEAT136 SLICE64**
Cost: $1.8816 · duration 11.6 min · cache hit 99.1% · grade avg -

## Baseline (last 9 slices)
- median $: $80.58
- p75 $: $102.23
- median cache hit: 99.9%
- median Opus share: 100.0%

## Per-slice findings
### [LOW] large-tool-output
- 90th-percentile tool result is 7,930 bytes.
- **Suggested action:** Prefer Grep with head_limit, Bash | head -N, or narrower file Read offsets over broad output. Big tool results inflate cache_create.

### [LOW] subagent-overuse
- 3 subagent dispatches.
- **Suggested action:** Subagents cold-start with no cache reuse — each one re-derives session context. Reserve for genuinely independent parallel work.

## Cross-slice trends
### [MEDIUM] trend-opus
- Median Opus $ share is 100.0% across recent slices.
- **Suggested action:** Default to Sonnet; promote to Opus only on slice-start when the problem is design-shaped.

