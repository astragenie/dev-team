---
feature: FEAT-130
---
# Cost Advisor

## Performance Grade: B

Target slice: **FEAT130 SLICE58**
Cost: $5.3600 · duration 15.9 min · cache hit 96.2% · grade avg -

## Baseline (last 9 slices)
- median $: $0.90
- p75 $: $1.60
- median cache hit: 99.4%
- median Opus share: 0.0%

## Per-slice findings
### [MEDIUM] opus-overuse
- Opus accounts for 77.1% of spend — Opus is ~5x Sonnet on every token category.
- **Suggested action:** Switch routine slices to Sonnet via /model. Reserve Opus for design, ambiguous problem framing, or hard refactors.

### [MEDIUM] subagent-overuse
- 4 subagent dispatches.
- **Suggested action:** Subagents cold-start with no cache reuse — each one re-derives session context. Reserve for genuinely independent parallel work.

