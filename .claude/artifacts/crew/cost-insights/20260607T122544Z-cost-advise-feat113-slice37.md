---
feature: FEAT-113
---
# Cost Advisor

## Performance Grade: C

Target slice: **FEAT113 SLICE37**
Cost: $1.9962 · duration 24.0 min · cache hit 99.2% · grade avg -

## Baseline (last 9 slices)
- median $: $0.97
- p75 $: $1.06
- median cache hit: 99.2%
- median Opus share: 0.0%

## Per-slice findings
### [MEDIUM] subagent-overuse
- 5 subagent dispatches.
- **Suggested action:** Subagents cold-start with no cache reuse — each one re-derives session context. Reserve for genuinely independent parallel work.

### [MEDIUM] exploration-heavy
- Exploration:execution tool ratio is 7.5:1 (Reads/Greps/Bashes vs Edits/Writes).
- **Suggested action:** Lots of looking, little doing. After the second exploration pass, write the plan down and start editing; do not keep grepping. Prefer LSP for code-symbol lookups (see `docs/process/grep-guidance.md` in hero-crew); use Grep only for prose, configs, or regex hunts.

