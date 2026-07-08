---
feature: FEAT-196
---
# Cost Advisor

## Performance Grade: B

Target slice: **FEAT196 SLICE110**
Cost: $5.9494 · duration 14.1 min · cache hit 98.2% · grade avg -

## Baseline (last 9 slices)
- median $: $1232.20
- p75 $: $4026.67
- median cache hit: 98.6%
- median Opus share: 99.5%

## Per-slice findings
### [HIGH] opus-overuse
- Opus accounts for 100.0% of spend — Opus is ~5x Sonnet on every token category.
- **Suggested action:** Switch routine slices to Sonnet via /model. Reserve Opus for design, ambiguous problem framing, or hard refactors.

### [MEDIUM] large-tool-output
- 90th-percentile tool result is 10,733 bytes.
- **Suggested action:** Prefer Grep with head_limit, Bash | head -N, or narrower file Read offsets over broad output. Big tool results inflate cache_create.

### [LOW] subagent-overuse
- 3 subagent dispatches.
- **Suggested action:** Subagents cold-start with no cache reuse — each one re-derives session context. Reserve for genuinely independent parallel work.

## Cross-slice trends
### [MEDIUM] trend-opus
- Median Opus $ share is 99.5% across recent slices.
- **Suggested action:** Default to Sonnet; promote to Opus only on slice-start when the problem is design-shaped.

