---
feature: FEAT-046
---
# Cost Advisor

## Performance Grade: A

Target slice: **FEAT046 SLICE18**
Cost: $0.9526 · duration 7.0 min · cache hit 99.5% · grade avg -

## Baseline (last 9 slices)
- median $: $3.04
- p75 $: $3.43
- median cache hit: 98.5%
- median Opus share: 0.0%

## Per-slice findings
### [HIGH] exploration-heavy
- Exploration:execution tool ratio is 9.0:1 (Reads/Greps/Bashes vs Edits/Writes).
- **Suggested action:** Lots of looking, little doing. After the second exploration pass, write the plan down and start editing; do not keep grepping. Prefer LSP for code-symbol lookups (see `docs/process/grep-guidance.md` in hero-crew); use Grep only for prose, configs, or regex hunts.

