---
feature: FEAT-163
---
# Cost Advisor

## Performance Grade: A

Target slice: **FEAT163 SLICE71**
Cost: $8.0785 · duration 9.5 min · cache hit 98.6% · grade avg -

## Baseline (last 9 slices)
- median $: $22.64
- p75 $: $699.91
- median cache hit: 99.1%
- median Opus share: 98.8%

## Per-slice findings
### [HIGH] opus-overuse
- Opus accounts for 100.0% of spend — Opus is ~5x Sonnet on every token category.
- **Suggested action:** Switch routine slices to Sonnet via /model. Reserve Opus for design, ambiguous problem framing, or hard refactors.

### [MEDIUM] large-tool-output
- 90th-percentile tool result is 8,654 bytes.
- **Suggested action:** Prefer Grep with head_limit, Bash | head -N, or narrower file Read offsets over broad output. Big tool results inflate cache_create.

## Cross-slice trends
### [MEDIUM] trend-opus
- Median Opus $ share is 98.8% across recent slices.
- **Suggested action:** Default to Sonnet; promote to Opus only on slice-start when the problem is design-shaped.

