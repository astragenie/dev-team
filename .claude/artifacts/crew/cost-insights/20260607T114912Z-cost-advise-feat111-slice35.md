---
feature: FEAT-111
---
# Cost Advisor

## Performance Grade: C

Target slice: **FEAT111 SLICE35**
Cost: $2.2265 · duration 26.8 min · cache hit 97.5% · grade avg -

## Baseline (last 9 slices)
- median $: $1.01
- p75 $: $1.11
- median cache hit: 99.2%
- median Opus share: 0.0%

## Per-slice findings
### [LOW] file-rereads
- 4 redundant Read calls of files already loaded this session.
- **Suggested action:** Trust prior Read results unless the file was edited. Each redundant Read injects fresh tool output that busts the cache.

### [LOW] large-tool-output
- 90th-percentile tool result is 5,010 bytes.
- **Suggested action:** Prefer Grep with head_limit, Bash | head -N, or narrower file Read offsets over broad output. Big tool results inflate cache_create.

### [MEDIUM] subagent-overuse
- 5 subagent dispatches.
- **Suggested action:** Subagents cold-start with no cache reuse — each one re-derives session context. Reserve for genuinely independent parallel work.

## Cross-slice trends
### [HIGH] cost-regression
- Current slice cost $2.2265 is 100% above the last-3 median of $1.1112.
- **Suggested action:** Audit what drove the spike: Opus usage, subagent cold-starts, cache busts, or long exploration loops. Mandate Sonnet-default and a written plan before the next similar slice.

