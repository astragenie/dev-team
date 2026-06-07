---
feature: FEAT-124
---
# Cost Advisor

## Performance Grade: D

Target slice: **FEAT124 SLICE46**
Cost: $6.2380 · duration 28.2 min · cache hit 99% · grade avg -

## Baseline (last 9 slices)
- median $: $10.73
- p75 $: $59.94
- median cache hit: 97.7%
- median Opus share: 0.0%

## Per-slice findings
### [HIGH] opus-overuse
- Opus accounts for 100.0% of spend — Opus is ~5x Sonnet on every token category.
- **Suggested action:** Switch routine slices to Sonnet via /model. Reserve Opus for design, ambiguous problem framing, or hard refactors.

### [LOW] tool-failure-rate
- 10.0% tool failure rate (1/10).
- **Suggested action:** Tool failures are pure waste. Plan the call shape (paths, flags, JSON schemas) before invoking; check pwd / file existence first.

