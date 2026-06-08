---
feature: FEAT-125
---
# Cost Advisor

## Performance Grade: A

Target slice: **FEAT125 SLICE51**
Cost: $1.6293 · duration 5.5 min · cache hit 98.8% · grade avg -

## Baseline (last 9 slices)
- median $: $10.93
- p75 $: $55.23
- median cache hit: 98.6%
- median Opus share: 90.7%

## Per-slice findings
### [MEDIUM] large-tool-output
- 90th-percentile tool result is 9,937 bytes.
- **Suggested action:** Prefer Grep with head_limit, Bash | head -N, or narrower file Read offsets over broad output. Big tool results inflate cache_create.

### [HIGH] exploration-heavy
- Exploration:execution tool ratio is 15.0:1 (Reads/Greps/Bashes vs Edits/Writes).
- **Suggested action:** Lots of looking, little doing. After the second exploration pass, write the plan down and start editing; do not keep grepping. Prefer LSP for code-symbol lookups (see `docs/process/grep-guidance.md` in hero-crew); use Grep only for prose, configs, or regex hunts.

## Cross-slice trends
### [MEDIUM] trend-opus
- Median Opus $ share is 90.7% across recent slices.
- **Suggested action:** Default to Sonnet; promote to Opus only on slice-start when the problem is design-shaped.

