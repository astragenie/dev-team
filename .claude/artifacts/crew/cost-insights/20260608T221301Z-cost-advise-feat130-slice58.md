---
feature: FEAT-130
---
# Cost Advisor

## Performance Grade: B

Target slice: **FEAT130 SLICE58**
Cost: $4.7639 · duration 15.8 min · cache hit 96% · grade avg -

## Baseline (last 9 slices)
- median $: $0.90
- p75 $: $1.60
- median cache hit: 99.4%
- median Opus share: 0.0%

## Per-slice findings
### [MEDIUM] opus-overuse
- Opus accounts for 74.8% of spend — Opus is ~5x Sonnet on every token category.
- **Suggested action:** Switch routine slices to Sonnet via /model. Reserve Opus for design, ambiguous problem framing, or hard refactors.

### [MEDIUM] subagent-overuse
- 4 subagent dispatches.
- **Suggested action:** Subagents cold-start with no cache reuse — each one re-derives session context. Reserve for genuinely independent parallel work.

## Cross-slice trends
### [HIGH] cost-regression
- Current slice cost $4.7639 is 430% above the last-3 median of $0.8988.
- **Suggested action:** Audit what drove the spike: Opus usage, subagent cold-starts, cache busts, or long exploration loops. Mandate Sonnet-default and a written plan before the next similar slice.

