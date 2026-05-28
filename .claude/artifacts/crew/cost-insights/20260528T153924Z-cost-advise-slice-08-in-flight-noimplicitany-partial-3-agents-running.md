# Cost Advisor

## Performance Grade: C

Target slice: **SLICE-08**
Cost: $9.5198 · duration 7.9 min · cache hit 99.2% · grade avg -

## Baseline (last 9 slices)
- median $: $11.63
- p75 $: $23.51
- median cache hit: 99.4%
- median Opus share: 95.8%

## Per-slice findings
### [MEDIUM] file-rereads
- 9 redundant Read calls of files already loaded this session.
- **Suggested action:** Trust prior Read results unless the file was edited. Each redundant Read injects fresh tool output that busts the cache.

### [MEDIUM] subagent-overuse
- 6 subagent dispatches.
- **Suggested action:** Subagents cold-start with no cache reuse — each one re-derives session context. Reserve for genuinely independent parallel work.

### [MEDIUM] compaction
- 2 compaction/meta event(s) — context was summarised mid-slice.
- **Suggested action:** Slice ran past the context window. Checkpoint to a handoff artifact earlier and split the work.

### [MEDIUM] non-repo-dominant
- Only 17.3% of spend ($1.64 of $9.52) came from the repo-derived session. Bookkeeping is misaligned with where work actually happened.
- **Suggested action:** Either work directly inside the repo's own Claude session, or move the work to its real home. Cross-repo work hides accountability and inflates the next session's context.

### [LOW] many-sources
- Slice spend spread across 4 different Claude sessions. Hard to reason about; cache reuse is fragmented.
- **Suggested action:** Scope sessions per slice. Open one Claude Code session in the target repo and stay there until the slice closes.

## Cross-slice trends
### [MEDIUM] trend-opus
- Median Opus $ share is 95.8% across recent slices.
- **Suggested action:** Default to Sonnet; promote to Opus only on slice-start when the problem is design-shaped.

