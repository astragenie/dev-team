---
id: FEAT-009
status: wont_fix
priority: P3
category: performance
target_release: n/a
created: 2026-05-22
updated: 2026-05-24
completed_at: 2026-05-24
decision: wont_fix
decision_note: "Trigger not met — artifact grep latency 0.111s vs 2s threshold (18× under). Re-evaluate if artifact corpus grows past ~800 files (current: 45)."
depends_on: []
slices: []
derived_from: null
autonomous_safe: true
phase: 1
github_issue: 9
github_milestone: 1
---
# FEAT-009: Artifact index file (deferred)

## Description

Build only when artifact-corpus grep exceeds ~2s on a representative repo.

Append-only `.claude/artifacts/crew/index.jsonl` with
`{kind, path, runId, timestamp}` per artifact. Maintained by
`writeArtifact` and `registerWorkflowArtifact`.

`brief-me` consumes the index instead of full-tree readdir.

## Acceptance hints

- `writeArtifact` appends to the index after the artifact file write
  succeeds.
- A `crew rebuild-index` CLI command can reconstruct the index from
  on-disk artifacts.
- Tests: index stays consistent after a rebuild.
- DO NOT BUILD UNTIL grep latency is measured and documented as a
  problem — premature optimization risk.

## Closure notes (2026-05-24)

Measured artifact grep latency:

- Artifact corpus: 45 `.md` files under `.claude/artifacts/crew/`.
- Full-text grep (`grep -r "FEAT-019" .claude/artifacts/crew/`): **0.111s**.
- Trigger threshold per this FEAT: `~2s`.
- **18× under threshold.** No build needed.

Re-evaluate when:
- Artifact corpus exceeds ~800 files (current: 45 → 18× headroom).
- OR a representative grep operation observed at >1s.
- OR `brief-me` startup latency degrades noticeably.

Closing as `wont_fix: trigger not met`.
