---
feature: FEAT-115
---
# Cost Advisor

## Performance Grade: D

Target slice: **FEAT115 SLICE39**
Cost: $6.5604 · duration 35.4 min · cache hit 99.3% · grade avg -

## Baseline (last 9 slices)
- median $: $1.01
- p75 $: $2.00
- median cache hit: 99.2%
- median Opus share: 0.0%

## Per-slice findings
### [HIGH] file-rereads
- 22 redundant Read calls of files already loaded this session.
- **Suggested action:** Trust prior Read results unless the file was edited. Each redundant Read injects fresh tool output that busts the cache.

### [LOW] subagent-overuse
- 3 subagent dispatches.
- **Suggested action:** Subagents cold-start with no cache reuse — each one re-derives session context. Reserve for genuinely independent parallel work.

## Cross-slice trends
### [HIGH] cost-regression
- Current slice cost $6.5604 is 187% above the last-3 median of $2.2867.
- **Suggested action:** Audit what drove the spike: Opus usage, subagent cold-starts, cache busts, or long exploration loops. Mandate Sonnet-default and a written plan before the next similar slice.

