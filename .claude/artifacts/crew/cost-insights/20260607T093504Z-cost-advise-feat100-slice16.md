---
feature: FEAT-100
---
# Cost Advisor

## Performance Grade: C

Target slice: **FEAT100 SLICE16**
Cost: $3.4315 · duration 9.8 min · cache hit 98.5% · grade avg -

## Baseline (last 9 slices)
- median $: $30.96
- p75 $: $48.76
- median cache hit: 98.4%
- median Opus share: 77.1%

## Per-slice findings
### [LOW] tool-failure-rate
- 7.0% tool failure rate (3/43).
- **Suggested action:** Tool failures are pure waste. Plan the call shape (paths, flags, JSON schemas) before invoking; check pwd / file existence first.

### [HIGH] exploration-heavy
- Exploration:execution tool ratio is 9.5:1 (Reads/Greps/Bashes vs Edits/Writes).
- **Suggested action:** Lots of looking, little doing. After the second exploration pass, write the plan down and start editing; do not keep grepping. Prefer LSP for code-symbol lookups (see `docs/process/grep-guidance.md` in hero-crew); use Grep only for prose, configs, or regex hunts.

## Cross-slice trends
### [MEDIUM] trend-opus
- Median Opus $ share is 77.1% across recent slices.
- **Suggested action:** Default to Sonnet; promote to Opus only on slice-start when the problem is design-shaped.

