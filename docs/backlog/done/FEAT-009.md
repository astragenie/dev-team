---
id: FEAT-009
status: pending
priority: P3
category: performance
target_release: tbd
created: 2026-05-22
updated: 2026-05-22
depends_on: []
slices: []
derived_from: null
autonomous_safe: true
phase: 4
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
