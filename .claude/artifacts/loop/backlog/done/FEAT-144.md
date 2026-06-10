---
id: FEAT-144
status: done
priority: null
category: bug
target_release: null
created: 2026-06-10
updated: 2026-06-10
completed_at: 2026-06-10
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

> **Note (as-shipped):** items 2 and 3 below state the *original plan*. Two
> things changed during implementation — see annotations. The canonical tree
> direction **inverted**, and the marketplace step became moot.

1. **Loop repo fix**: every `runBacklog*` / snapshot / triage entry point must
   load `.claude/loop.json` and pass `config` through (audit all callers of
   `backlogRoot()` for the same omission). Release as a loop patch.
   _Shipped in loop v0.36.0 — `config` threads `resolveConfig` → `runBacklogSubcommand`
   → `runBacklogAdd` → `addFeature({config})` → `ensureBacklogScaffold`/`nextFeatureId`._
2. ~~**This repo**: bump `marketplace.json` loop version once fixed.~~
   _Moot: loop now ships from its own standalone marketplace; this repo's
   `marketplace.json` no longer carries a loop entry._
3. **One-time reconciliation**: collapse the two trees into a single
   authoritative tree, resolving per-FEAT state conflicts by git history, then
   regenerate `loop-snapshot.md`.
   _Direction inverted from the original draft: the single tree lives at
   **`.claude/artifacts/loop/backlog/`** (the loop-CLI default); `docs/backlog/`
   was stripped to non-state files only (`product-backlog.md`, templates).
   Done via `loop doctor --fix` (commit `d0c49ca`)._
4. Add a validator/CI check that fails when both trees exist.
   _Shipped: `scripts/validate-loop-state.ts`, wired in `.github/workflows/test.yml`._

## Resolution (2026-06-10)

Shipped via docs/superpowers/specs/2026-06-10-loop-crew-state-contract-design.md:
loop v0.36.0 (dispatcher config resolution, state-schemas, write-guard, loop doctor),
hero-crew single-tree migration (commit d0c49ca), CI guard scripts/validate-loop-state.ts.
Doctor report: .claude/artifacts/loop/doctor/2026-06-10T02-15-22-817Z-report.md
