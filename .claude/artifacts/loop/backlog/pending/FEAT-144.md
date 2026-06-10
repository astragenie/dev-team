---
id: FEAT-144
status: pending
priority: null
category: bug
target_release: null
created: 2026-06-10
updated: 2026-06-10
depends_on: []
slices: []
derived_from: null
---
# FEAT-144: Reconcile dual backlog trees — loop CLI ignores configured backlogRoot

## Description

Discovered 2026-06-10 while adding FEAT-139: `loop backlog add` (loop plugin
v0.32.0, `loop.mjs` `runBacklogAdd`, ~line 458) calls `addFeature(repoPath,
{...})` **without loading `.claude/loop.json`**, so the writer falls back to
the path default `.claude/artifacts/loop/backlog` instead of the configured
`loop.backlogRoot` (`docs/backlog`). The subsequent `publishFeat` github-sync
step *does* load config, looks in `docs/backlog`, and fails with
"[github-sync] FEAT not found".

Consequences in this repo:

- Two diverged backlog trees: `docs/backlog/` (authoritative per CLAUDE.md)
  and `.claude/artifacts/loop/backlog/` (where config-blind loop commands
  read/write). Examples of divergence: FEAT-121 done in artifacts but triaged
  in docs; FEAT-129 in-progress in artifacts but done in docs; FEAT-136/137
  exist only in artifacts; FEAT-120 exists only in docs.
- `loop-snapshot.md` (embedded in CLAUDE.md) is generated from the artifacts
  tree, so session-start state is wrong.
- `nextFeatureId` scans only the artifacts tree → future config-blind adds
  will re-mint ids already used in docs (next collision: FEAT-139).

## Deliverables

1. **Loop repo fix**: every `runBacklog*` / snapshot / triage entry point must
   load `.claude/loop.json` and pass `config` through (audit all callers of
   `backlogRoot()` for the same omission). Release as a loop patch.
2. **This repo**: bump `marketplace.json` loop version once fixed.
3. **One-time reconciliation**: merge the two trees into `docs/backlog/`
   (resolve per-FEAT state conflicts by git history), delete
   `.claude/artifacts/loop/backlog/`, regenerate `loop-snapshot.md`.
4. Add a validator/CI check that fails when both trees exist.
