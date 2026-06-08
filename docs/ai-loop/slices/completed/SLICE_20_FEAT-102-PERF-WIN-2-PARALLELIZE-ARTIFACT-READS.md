---
id: SLICE-20
status: completed
feature: FEAT-102
phase: null
priority: P2
target_release: null
requires_validation: false
created: 2026-06-07
updated: 2026-06-07
completed_at: 2026-06-07
github_issue: 69
github_url: "https://github.com/sergeymilashico/hero-crew/issues/69"
---
# SLICE-20: # FEAT-102 — Perf win 2: parallelize artifact reads

Implements FEAT-102. See [feature file](../../../backlog/in-progress/FEAT-102.md) for product context.

## Objective

`scripts/lib/briefing/collect.mjs` reads `runBrief`, every `handoffs[]` entry, `reviewResult`, `validationPlan`, `validationResult`, `deploymentChecks.{dev,prod}`, and `finalSynthesis` sequentially via awaited `fs.readFile`. On a slice with ~3 handoffs that's ~7 sequential reads = latency dominated by serialised I/O. Wrap in `Promise.all`; latency drops from sum to max. Estimated saving: 100–300 ms per `brief-me`.

## In scope

- bullet 1
- bullet 2

## Out of scope

- bullet 1

## Acceptance criteria

- [ ] AC-1: `scripts/lib/briefing/collect.mjs` reads the 7+ workflow-run artifacts via `Promise.all` (or `Promise.allSettled` if missing files are routine), not sequential await.
- [ ] AC-2: Missing-file behaviour preserved — current code tolerates ENOENT on optional artifacts; parallel version maps the same per-file fallback.
- [ ] AC-3: Existing briefing tests pass unchanged.
- [ ] AC-4: PR body includes baseline vs post-change `time` p50/p95 comparison on a slice with ≥3 handoffs.
- [ ] AC-5: All existing CI gates green.

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-102 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- (pure refactors / mechanical changes: set `requires_validation: false` in frontmatter
   above to waive the validation gate — no badge needed at close time)

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...
