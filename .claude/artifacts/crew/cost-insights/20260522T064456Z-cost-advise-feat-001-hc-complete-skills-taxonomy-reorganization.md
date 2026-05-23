# Cost Advisor

Target slice: **FEAT-001 (HC) complete — skills taxonomy reorganization**
Cost: $20.3486 · duration 2.8 min · cache hit 99.9% · grade avg -

## Baseline (last 1 slices)
- median $: $0.00
- p75 $: $0.00
- median cache hit: 0.0%
- median Opus share: 0.0%

## Per-slice findings
### [HIGH] opus-overuse
- Opus accounts for 100.0% of spend — Opus is ~5x Sonnet on every token category.
- **Suggested action:** Switch routine slices to Sonnet via /model. Reserve Opus for design, ambiguous problem framing, or hard refactors.

### [MEDIUM] non-repo-dominant
- Only 0.0% of spend ($0.00 of $20.35) came from the repo-derived session. Bookkeeping is misaligned with where work actually happened.
- **Suggested action:** Either work directly inside the repo's own Claude session, or move the work to its real home. Cross-repo work hides accountability and inflates the next session's context.

