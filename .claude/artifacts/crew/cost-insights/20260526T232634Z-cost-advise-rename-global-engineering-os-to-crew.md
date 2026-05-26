# Cost Advisor

Target slice: **Rename global engineering-os to crew**
Cost: $23.1658 · duration 11.7 min · cache hit 98.7% · grade avg -

## Baseline (last 9 slices)
- median $: $102.23
- p75 $: $223.53
- median cache hit: 98.6%
- median Opus share: 91.7%

## Per-slice findings
### [HIGH] opus-overuse
- Opus accounts for 96.3% of spend — Opus is ~5x Sonnet on every token category.
- **Suggested action:** Switch routine slices to Sonnet via /model. Reserve Opus for design, ambiguous problem framing, or hard refactors.

### [LOW] file-rereads
- 3 redundant Read calls of files already loaded this session.
- **Suggested action:** Trust prior Read results unless the file was edited. Each redundant Read injects fresh tool output that busts the cache.

### [MEDIUM] compaction
- 2 compaction/meta event(s) — context was summarised mid-slice.
- **Suggested action:** Slice ran past the context window. Checkpoint to a handoff artifact earlier and split the work.

## Cross-slice trends
### [MEDIUM] trend-opus
- Median Opus $ share is 91.7% across recent slices.
- **Suggested action:** Default to Sonnet; promote to Opus only on slice-start when the problem is design-shaped.

