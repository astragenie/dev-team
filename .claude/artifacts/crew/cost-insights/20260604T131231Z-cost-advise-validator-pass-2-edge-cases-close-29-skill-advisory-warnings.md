# Cost Advisor

## Performance Grade: F

Target slice: **Validator Pass-2 edge cases + close 29 skill advisory warnings**
Cost: $5959.5882 · duration 9941.0 min · cache hit 98.6% · grade avg -

## Baseline (last 9 slices)
- median $: $1190.46
- p75 $: $3964.37
- median cache hit: 97.9%
- median Opus share: 96.1%

## Per-slice findings
### [HIGH] opus-overuse
- Opus accounts for 96.8% of spend — Opus is ~5x Sonnet on every token category.
- **Suggested action:** Switch routine slices to Sonnet via /model. Reserve Opus for design, ambiguous problem framing, or hard refactors.

### [HIGH] file-rereads
- 405 redundant Read calls of files already loaded this session.
- **Suggested action:** Trust prior Read results unless the file was edited. Each redundant Read injects fresh tool output that busts the cache.

### [HIGH] subagent-overuse
- 183 subagent dispatches.
- **Suggested action:** Subagents cold-start with no cache reuse — each one re-derives session context. Reserve for genuinely independent parallel work.

### [HIGH] compaction
- 228 compaction/meta event(s) — context was summarised mid-slice.
- **Suggested action:** Slice ran past the context window. Checkpoint to a handoff artifact earlier and split the work.

### [HIGH] compaction-cascade
- 228 compactions + 183 subagent dispatches — context overflow driven by excessive dispatching.
- **Suggested action:** Each subagent cold-starts the cache; the lead's context grows with each handoff read. Target ≤3 dispatches per slice. Bundle review + validation when scope is small. Write checkpoint handoffs at ≥3 compactions instead of dispatching more agents.

### [MEDIUM] non-repo-dominant
- Only 20.0% of spend ($1190.46 of $5959.59) came from the repo-derived session. Bookkeeping is misaligned with where work actually happened.
- **Suggested action:** Either work directly inside the repo's own Claude session, or move the work to its real home. Cross-repo work hides accountability and inflates the next session's context.

### [HIGH] many-sources
- Slice spend spread across 10 different Claude sessions. Hard to reason about; cache reuse is fragmented.
- **Suggested action:** Scope sessions per slice. Open one Claude Code session in the target repo and stay there until the slice closes.

## Cross-slice trends
### [MEDIUM] trend-opus
- Median Opus $ share is 96.1% across recent slices.
- **Suggested action:** Default to Sonnet; promote to Opus only on slice-start when the problem is design-shaped.

