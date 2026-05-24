# Cost Advisor

Target slice: **SLICE-04**
Cost: $226.8454 · duration 18.0 min · cache hit 99.7% · grade avg -

## Baseline (last 6 slices)
- median $: $51.73
- p75 $: $102.23
- median cache hit: 99.6%
- median Opus share: 98.5%

## Per-slice findings
### [HIGH] opus-overuse
- Opus accounts for 97.3% of spend — Opus is ~5x Sonnet on every token category.
- **Suggested action:** Switch routine slices to Sonnet via /model. Reserve Opus for design, ambiguous problem framing, or hard refactors.

### [HIGH] file-rereads
- 16 redundant Read calls of files already loaded this session.
- **Suggested action:** Trust prior Read results unless the file was edited. Each redundant Read injects fresh tool output that busts the cache.

### [MEDIUM] compaction
- 1 compaction/meta event(s) — context was summarised mid-slice.
- **Suggested action:** Slice ran past the context window. Checkpoint to a handoff artifact earlier and split the work.

### [LOW] many-sources
- Slice spend spread across 3 different Claude sessions. Hard to reason about; cache reuse is fragmented.
- **Suggested action:** Scope sessions per slice. Open one Claude Code session in the target repo and stay there until the slice closes.

## Cross-slice trends
### [MEDIUM] trend-opus
- Median Opus $ share is 98.5% across recent slices.
- **Suggested action:** Default to Sonnet; promote to Opus only on slice-start when the problem is design-shaped.

