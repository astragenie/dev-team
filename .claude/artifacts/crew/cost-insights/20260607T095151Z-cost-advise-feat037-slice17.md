---
feature: FEAT-037
---
# Cost Advisor

## Performance Grade: A

Target slice: **FEAT037 SLICE17**
Cost: $1.9280 · duration 9.2 min · cache hit 99.5% · grade avg -

## Baseline (last 9 slices)
- median $: $30.96
- p75 $: $48.76
- median cache hit: 98.4%
- median Opus share: 74.5%

## Per-slice findings
### [HIGH] exploration-heavy
- Exploration:execution tool ratio is 21.0:1 (Reads/Greps/Bashes vs Edits/Writes).
- **Suggested action:** Lots of looking, little doing. After the second exploration pass, write the plan down and start editing; do not keep grepping. Prefer LSP for code-symbol lookups (see `docs/process/grep-guidance.md` in hero-crew); use Grep only for prose, configs, or regex hunts.

## Cross-slice trends
### [MEDIUM] trend-opus
- Median Opus $ share is 74.5% across recent slices.
- **Suggested action:** Default to Sonnet; promote to Opus only on slice-start when the problem is design-shaped.

