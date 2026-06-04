# Cost Advisor

## Performance Grade: F

Target slice: **Normalise Skills-you-consult heading to H3 + revert builder scope-violation on validate-skills.mjs**
Cost: $5383.6882 · duration 9830.5 min · cache hit 98.5% · grade avg -

## Baseline (last 9 slices)
- median $: $1091.37
- p75 $: $3908.30
- median cache hit: 97.8%
- median Opus share: 95.9%

## Per-slice findings
### [HIGH] opus-overuse
- Opus accounts for 96.5% of spend — Opus is ~5x Sonnet on every token category.
- **Suggested action:** Switch routine slices to Sonnet via /model. Reserve Opus for design, ambiguous problem framing, or hard refactors.

### [HIGH] file-rereads
- 391 redundant Read calls of files already loaded this session.
- **Suggested action:** Trust prior Read results unless the file was edited. Each redundant Read injects fresh tool output that busts the cache.

### [HIGH] subagent-overuse
- 136 subagent dispatches.
- **Suggested action:** Subagents cold-start with no cache reuse — each one re-derives session context. Reserve for genuinely independent parallel work.

### [HIGH] compaction
- 211 compaction/meta event(s) — context was summarised mid-slice.
- **Suggested action:** Slice ran past the context window. Checkpoint to a handoff artifact earlier and split the work.

### [HIGH] compaction-cascade
- 211 compactions + 136 subagent dispatches — context overflow driven by excessive dispatching.
- **Suggested action:** Each subagent cold-starts the cache; the lead's context grows with each handoff read. Target ≤3 dispatches per slice. Bundle review + validation when scope is small. Write checkpoint handoffs at ≥3 compactions instead of dispatching more agents.

### [MEDIUM] non-repo-dominant
- Only 20.3% of spend ($1091.37 of $5383.69) came from the repo-derived session. Bookkeeping is misaligned with where work actually happened.
- **Suggested action:** Either work directly inside the repo's own Claude session, or move the work to its real home. Cross-repo work hides accountability and inflates the next session's context.

### [HIGH] many-sources
- Slice spend spread across 9 different Claude sessions. Hard to reason about; cache reuse is fragmented.
- **Suggested action:** Scope sessions per slice. Open one Claude Code session in the target repo and stay there until the slice closes.

## Cross-slice trends
### [HIGH] cost-regression
- Current slice cost $5383.6882 is 35% above the last-3 median of $3995.8109.
- **Suggested action:** Audit what drove the spike: Opus usage, subagent cold-starts, cache busts, or long exploration loops. Mandate Sonnet-default and a written plan before the next similar slice.

### [MEDIUM] trend-opus
- Median Opus $ share is 95.9% across recent slices.
- **Suggested action:** Default to Sonnet; promote to Opus only on slice-start when the problem is design-shaped.

