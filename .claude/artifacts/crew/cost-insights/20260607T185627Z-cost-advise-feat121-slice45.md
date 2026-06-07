---
feature: FEAT-121
---
# Cost Advisor

## Performance Grade: C

Target slice: **FEAT121 SLICE45**
Cost: $10.5385 · duration 12.8 min · cache hit 97.4% · grade avg -

## Baseline (last 9 slices)
- median $: $8.65
- p75 $: $59.94
- median cache hit: 98.3%
- median Opus share: 0.0%

## Per-slice findings
### [MEDIUM] file-rereads
- 11 redundant Read calls of files already loaded this session.
- **Suggested action:** Trust prior Read results unless the file was edited. Each redundant Read injects fresh tool output that busts the cache.

### [LOW] large-tool-output
- 90th-percentile tool result is 4,156 bytes.
- **Suggested action:** Prefer Grep with head_limit, Bash | head -N, or narrower file Read offsets over broad output. Big tool results inflate cache_create.

