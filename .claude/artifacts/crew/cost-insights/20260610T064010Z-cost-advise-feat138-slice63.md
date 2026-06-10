---
feature: FEAT-138
---
# Cost Advisor

## Performance Grade: A

Target slice: **FEAT138 SLICE63**
Cost: $102.2312 · duration 12.2 min · cache hit 99.9% · grade avg -

## Baseline (last 9 slices)
- median $: $76.77
- p75 $: $102.23
- median cache hit: 99.9%
- median Opus share: 100.0%

## Per-slice findings
### [HIGH] opus-overuse
- Opus accounts for 100.0% of spend — Opus is ~5x Sonnet on every token category.
- **Suggested action:** Switch routine slices to Sonnet via /model. Reserve Opus for design, ambiguous problem framing, or hard refactors.

### [MEDIUM] non-repo-dominant
- Only 0.0% of spend ($0.00 of $102.23) came from the repo-derived session. Bookkeeping is misaligned with where work actually happened.
- **Suggested action:** Either work directly inside the repo's own Claude session, or move the work to its real home. Cross-repo work hides accountability and inflates the next session's context.

## Cross-slice trends
### [MEDIUM] trend-opus
- Median Opus $ share is 100.0% across recent slices.
- **Suggested action:** Default to Sonnet; promote to Opus only on slice-start when the problem is design-shaped.

