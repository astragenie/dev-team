# Cost Advisor

## Performance Grade: C

Target slice: **FEAT-046 Task 5 modelCompliance in brief-me**
Cost: $30.9640 · duration 6.6 min · cache hit 99.2% · grade avg -

## Baseline (last 9 slices)
- median $: $14.69
- p75 $: $19.18
- median cache hit: 98.8%
- median Opus share: 0.0%

## Per-slice findings
### [MEDIUM] opus-overuse
- Opus accounts for 74.5% of spend — Opus is ~5x Sonnet on every token category.
- **Suggested action:** Switch routine slices to Sonnet via /model. Reserve Opus for design, ambiguous problem framing, or hard refactors.

### [MEDIUM] file-rereads
- 10 redundant Read calls of files already loaded this session.
- **Suggested action:** Trust prior Read results unless the file was edited. Each redundant Read injects fresh tool output that busts the cache.

### [MEDIUM] subagent-overuse
- 4 subagent dispatches.
- **Suggested action:** Subagents cold-start with no cache reuse — each one re-derives session context. Reserve for genuinely independent parallel work.

### [MEDIUM] non-repo-dominant
- Only 0.0% of spend ($0.00 of $30.96) came from the repo-derived session. Bookkeeping is misaligned with where work actually happened.
- **Suggested action:** Either work directly inside the repo's own Claude session, or move the work to its real home. Cross-repo work hides accountability and inflates the next session's context.

### [LOW] many-sources
- Slice spend spread across 3 different Claude sessions. Hard to reason about; cache reuse is fragmented.
- **Suggested action:** Scope sessions per slice. Open one Claude Code session in the target repo and stay there until the slice closes.

