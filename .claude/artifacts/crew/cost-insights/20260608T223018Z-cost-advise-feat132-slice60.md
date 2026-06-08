---
feature: FEAT-132
---
# Cost Advisor

## Performance Grade: B

Target slice: **FEAT132 SLICE60**
Cost: $5.7675 · duration 6.8 min · cache hit 99.4% · grade avg -

## Baseline (last 9 slices)
- median $: $0.90
- p75 $: $4.76
- median cache hit: 99.1%
- median Opus share: 0.0%

## Per-slice findings
### [MEDIUM] opus-overuse
- Opus accounts for 74.4% of spend — Opus is ~5x Sonnet on every token category.
- **Suggested action:** Switch routine slices to Sonnet via /model. Reserve Opus for design, ambiguous problem framing, or hard refactors.

### [MEDIUM] file-rereads
- 5 redundant Read calls of files already loaded this session.
- **Suggested action:** Trust prior Read results unless the file was edited. Each redundant Read injects fresh tool output that busts the cache.

