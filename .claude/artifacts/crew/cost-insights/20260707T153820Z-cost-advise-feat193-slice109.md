---
feature: FEAT-193
---
# Cost Advisor

## Performance Grade: B

Target slice: **FEAT193 SLICE109**
Cost: $255.3495 · duration 153.2 min · cache hit 99.2% · grade avg -

## Baseline (last 9 slices)
- median $: $1232.20
- p75 $: $4026.67
- median cache hit: 98.6%
- median Opus share: 99.5%

## Per-slice findings
### [HIGH] opus-overuse
- Opus accounts for 100.0% of spend — Opus is ~5x Sonnet on every token category.
- **Suggested action:** Switch routine slices to Sonnet via /model. Reserve Opus for design, ambiguous problem framing, or hard refactors.

### [LOW] file-rereads
- 3 redundant Read calls of files already loaded this session.
- **Suggested action:** Trust prior Read results unless the file was edited. Each redundant Read injects fresh tool output that busts the cache.

### [HIGH] compaction
- 3 compaction/meta event(s) — context was summarised mid-slice.
- **Suggested action:** Slice ran past the context window. Checkpoint to a handoff artifact earlier and split the work.

## Cross-slice trends
### [MEDIUM] trend-opus
- Median Opus $ share is 99.5% across recent slices.
- **Suggested action:** Default to Sonnet; promote to Opus only on slice-start when the problem is design-shaped.

