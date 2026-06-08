---
feature: FEAT-126
---
# Cost Advisor

## Performance Grade: C

Target slice: **FEAT126 SLICE49**
Cost: $8.0370 · duration 12.0 min · cache hit 99.3% · grade avg -

## Baseline (last 9 slices)
- median $: $12.45
- p75 $: $19.12
- median cache hit: 97.7%
- median Opus share: 0.0%

## Per-slice findings
### [HIGH] opus-overuse
- Opus accounts for 100.0% of spend — Opus is ~5x Sonnet on every token category.
- **Suggested action:** Switch routine slices to Sonnet via /model. Reserve Opus for design, ambiguous problem framing, or hard refactors.

### [LOW] tool-failure-rate
- 7.1% tool failure rate (1/14).
- **Suggested action:** Tool failures are pure waste. Plan the call shape (paths, flags, JSON schemas) before invoking; check pwd / file existence first.

