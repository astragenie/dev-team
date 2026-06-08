---
feature: FEAT-134
---
# Cost Advisor

## Performance Grade: A

Target slice: **FEAT134 SLICE61**
Cost: $6.6493 · duration 11.5 min · cache hit 99.2% · grade avg -

## Baseline (last 9 slices)
- median $: $0.90
- p75 $: $5.36
- median cache hit: 99.1%
- median Opus share: 0.0%

## Per-slice findings
### [HIGH] opus-overuse
- Opus accounts for 86.8% of spend — Opus is ~5x Sonnet on every token category.
- **Suggested action:** Switch routine slices to Sonnet via /model. Reserve Opus for design, ambiguous problem framing, or hard refactors.

### [MEDIUM] exploration-heavy
- Exploration:execution tool ratio is 7.0:1 (Reads/Greps/Bashes vs Edits/Writes).
- **Suggested action:** Lots of looking, little doing. After the second exploration pass, write the plan down and start editing; do not keep grepping. Prefer LSP for code-symbol lookups (see `docs/process/grep-guidance.md` in hero-crew); use Grep only for prose, configs, or regex hunts.

