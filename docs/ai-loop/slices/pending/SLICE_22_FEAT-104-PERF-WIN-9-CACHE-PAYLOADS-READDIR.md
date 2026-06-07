---
id: SLICE-22
status: pending
feature: FEAT-104
phase: null
priority: P3
target_release: null
requires_validation: false
created: 2026-06-07
updated: 2026-06-07
---
# SLICE-22: # FEAT-104 — Perf win 9: cache payloads readdir

Implements FEAT-104. See [feature file](../../../backlog/in-progress/FEAT-104.md) for product context.

## Objective

`.claude/logs/payloads/` holds ~2.8k files on this repo. The session-cost scanner runs `readdir` on it (sometimes multiple times per `brief-me` invocation when scanning multiple slices). Cache the sorted file list at module level, invalidate when the directory's mtime changes. Estimated saving: 80–150 ms per cost-aggregate `brief-me`.

## In scope

- bullet 1
- bullet 2

## Out of scope

- bullet 1

## Acceptance criteria

- [ ] AC-1: A helper (e.g. `getPayloadsIndex(dir)`) caches the sorted-descending file list per process; subsequent calls within the same process return the cached array unless `fs.stat(dir).mtimeMs` has advanced.
- [ ] AC-2: Cost scanner uses the helper instead of raw `fs.readdir`.
- [ ] AC-3: Unit tests: (a) second call without mtime change returns same array reference (cached), (b) mtime advance invalidates cache.
- [ ] AC-4: PR body includes baseline vs post-change p50/p95 on a cost-aggregate `brief-me`.
- [ ] AC-5: All existing CI gates green.

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-104 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- (pure refactors / mechanical changes: set `requires_validation: false` in frontmatter
   above to waive the validation gate — no badge needed at close time)

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...
