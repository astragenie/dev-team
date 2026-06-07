---
feature: FEAT-118
---
# Cost Advisor

## Performance Grade: F

Target slice: **FEAT118 SLICE42**
Cost: $8.6700 · duration 49.4 min · cache hit 97.5% · grade avg -

## Baseline (last 9 slices)
- median $: $6.56
- p75 $: $52.96
- median cache hit: 98.7%
- median Opus share: 0.0%

## Per-slice findings
### [HIGH] file-rereads
- 38 redundant Read calls of files already loaded this session.
- **Suggested action:** Trust prior Read results unless the file was edited. Each redundant Read injects fresh tool output that busts the cache.

### [LOW] large-tool-output
- 90th-percentile tool result is 4,287 bytes.
- **Suggested action:** Prefer Grep with head_limit, Bash | head -N, or narrower file Read offsets over broad output. Big tool results inflate cache_create.

### [MEDIUM] subagent-overuse
- 4 subagent dispatches.
- **Suggested action:** Subagents cold-start with no cache reuse — each one re-derives session context. Reserve for genuinely independent parallel work.

