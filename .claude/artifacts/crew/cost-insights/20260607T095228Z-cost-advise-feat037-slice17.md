---
feature: FEAT-037
---
# Cost Advisor

## Performance Grade: A

Target slice: **FEAT037 SLICE17**
Cost: $2.3259 · duration 9.8 min · cache hit 99.6% · grade avg -

## Baseline (last 9 slices)
- median $: $3.43
- p75 $: $48.76
- median cache hit: 98.4%
- median Opus share: 0.0%

## Per-slice findings
### [HIGH] exploration-heavy
- Exploration:execution tool ratio is 13.0:1 (Reads/Greps/Bashes vs Edits/Writes).
- **Suggested action:** Lots of looking, little doing. After the second exploration pass, write the plan down and start editing; do not keep grepping. Prefer LSP for code-symbol lookups (see `docs/process/grep-guidance.md` in hero-crew); use Grep only for prose, configs, or regex hunts.

