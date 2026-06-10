---
id: SLICE-23
status: completed
feature: FEAT-105
phase: null
priority: P3
target_release: null
requires_validation: false
created: 2026-06-07
updated: 2026-06-07
completed_at: 2026-06-07
github_issue: 75
github_url: "https://github.com/sergeymilashico/hero-crew/issues/75"
---
# SLICE-23: # FEAT-105 — Perf win 10: skip stat-before-read

Implements FEAT-105. See [feature file](../../../backlog/in-progress/FEAT-105.md) for product context.

## Objective

The codebase has many call sites following the pattern:

## In scope

- bullet 1
- bullet 2

## Out of scope

- bullet 1

## Acceptance criteria

- [ ] AC-1: A grep for `existsSync\(.*\)\s*\)\s*\{?\s*return\s+readFile|existsSync.*readFileSync` finds at most 5 remaining occurrences in `scripts/` (count is `≥30` today; document baseline in PR).
- [ ] AC-2: A shared helper (e.g. `readFileIfExists(path)` returning `string | null`) is introduced and used at the refactored sites.
- [ ] AC-3: Any error other than `ENOENT` still propagates — the catch must be code-gated, not blanket.
- [ ] AC-4: Unit test: present file returns content; missing file returns null; permission-denied throws.
- [ ] AC-5: All existing tests pass unchanged.
- [ ] AC-6: PR body includes baseline vs post-change p50/p95 timings.
- [ ] AC-7: All existing CI gates green.

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-105 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- (pure refactors / mechanical changes: set `requires_validation: false` in frontmatter
   above to waive the validation gate — no badge needed at close time)

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...
