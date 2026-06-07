---
feature: FEAT-105
---
# Cost Advisor

## Performance Grade: C

Target slice: **FEAT105 SLICE28**
Cost: $2.6256 · duration 6.2 min · cache hit 99.4% · grade avg -

## Baseline (last 9 slices)
- median $: $2.33
- p75 $: $3.39
- median cache hit: 99.4%
- median Opus share: 0.0%

## Per-slice findings
### [MEDIUM] file-rereads
- 9 redundant Read calls of files already loaded this session.
- **Suggested action:** Trust prior Read results unless the file was edited. Each redundant Read injects fresh tool output that busts the cache.

### [MEDIUM] exploration-heavy
- Exploration:execution tool ratio is 4.3:1 (Reads/Greps/Bashes vs Edits/Writes).
- **Suggested action:** Lots of looking, little doing. After the second exploration pass, write the plan down and start editing; do not keep grepping. Prefer LSP for code-symbol lookups (see `docs/process/grep-guidance.md` in hero-crew); use Grep only for prose, configs, or regex hunts.

## Cross-slice trends
### [HIGH] cost-regression
- Current slice cost $2.6256 is 176% above the last-3 median of $0.9526.
- **Suggested action:** Audit what drove the spike: Opus usage, subagent cold-starts, cache busts, or long exploration loops. Mandate Sonnet-default and a written plan before the next similar slice.

