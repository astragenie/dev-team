---
id: SLICE-21
status: completed
feature: FEAT-103
phase: null
priority: P3
target_release: null
requires_validation: false
created: 2026-06-07
updated: 2026-06-07
completed_at: 2026-06-07
github_issue: 71
github_url: "https://github.com/sergeymilashico/hero-crew/issues/71"
---
# SLICE-21: # FEAT-103 — Perf win 4: memoize hot frontmatter reads

Implements FEAT-103. See [feature file](../../../backlog/in-progress/FEAT-103.md) for product context.

## Objective

The same artifact file is parsed in `briefing/collect.mjs`, `briefing/render.mjs`, and `session-cost-scanner.mjs` during a single `brief-me` invocation. Each re-parses the YAML/JSON frontmatter from disk. A module-level cache keyed by `(absolutePath, mtime.getTime())` returns the parsed object after the first read, invalidates when the file changes on disk. Estimated saving: 50–150 ms per `brief-me`.

## In scope

- bullet 1
- bullet 2

## Out of scope

- bullet 1

## Acceptance criteria

- [ ] AC-1: New module `scripts/lib/artifact-cache.mjs` (or `.ts` if landing post-Phase-0) exposes `getCachedFrontmatter(absPath)` returning parsed frontmatter (and body, optionally).
- [ ] AC-2: Cache key includes `mtimeMs` from `fs.stat`. A changed-on-disk file is re-read, not stale.
- [ ] AC-3: At least 2 call sites refactored to use the cached reader: one in `briefing/`, one in `session-cost-scanner.mjs`.
- [ ] AC-4: Unit tests: (a) second call returns cached result (assert via spy that read is called once), (b) stale-after-mtime-change test, (c) ENOENT propagates.
- [ ] AC-5: `brief-me` output byte-identical to pre-change baseline.
- [ ] AC-6: PR body includes baseline vs post-change p50/p95 timings on a slice with re-reads.
- [ ] AC-7: All existing CI gates green.

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-103 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- (pure refactors / mechanical changes: set `requires_validation: false` in frontmatter
   above to waive the validation gate — no badge needed at close time)

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...
