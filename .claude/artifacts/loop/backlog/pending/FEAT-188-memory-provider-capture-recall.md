---
id: FEAT-188
status: pending
priority: P1
category: platform
target_release: null
created: 2026-07-04
depends_on: []
slices: []
derived_from: docs/superpowers/specs/2026-07-04-memory-provider-plan.md
pm_customer_impact: 0.85
pm_effort_estimate: 0.65
pm_strategic_alignment: 0.85
pm_technical_risk: 0.5
pm_dependency_depth: 0.3
composite_score: 0.7
autonomous_safe: false
tags: [stack:typescript, surface:plugin, concern:memory, concern:dispatch]
triage_notes: "Free-text intake 2026-07-04 (PM-scored at intake, FEAT-277 mode). Architecture review §15 found the capture/recall loop broken at every stage: learnings.jsonl stale since 2026-06-11 (zero capture through the entire GEPA cluster), 27% of 78 grade files are unfilled placeholders, 21% all-zero scores, and 2 of runner:lessons-recent's already-shipping top-5 digest entries are placeholder noise today. P1 reflects user-flagged importance plus quantified, already-materializing operational damage balanced against real multi-slice effort. autonomous_safe=false because S3 touches dispatch prompts across every builder/reviewer/verifier gate; S1/S2/S4/S5 could individually qualify as safe but the FEAT is gated as a whole."
---

# FEAT-188: MemoryProvider — capture/recall learning loop (S1-S5)

## Description

Implement per `docs/superpowers/specs/2026-07-04-memory-provider-plan.md`. Pluggable
MemoryProvider mirroring the proven gepa-core TrialStore pattern — `noopProvider`
default (zero behavior change), `fileProvider` (atomic JSONL), `astramemProvider`
(auto-detect when astramem installed) — making agents aware of recent failures,
lessons, and decisions at dispatch time.

Five sequential slices; S1 is the prerequisite and carries standalone value even if
nothing else ships:

- **S1 — Capture repair**: hook `runner:close` (auto-append learnings from grade
  lessons/surprises), review-FAIL / validation-FAIL artifact writes, incident-close,
  `runner:pr-fix` circuit-breaker trips, and retrospective decisions; extend
  `validate-syntheses.ts` placeholder rejection to grade files (fixes the polluted
  `lessons-recent` digest returning 2/5 placeholder entries today); point
  `docs/decisions/README.md` at `.claude/artifacts/loop/decisions/`.
- **S2 — Interface + noop/file providers**: `src/lib/memory/` — Zod entry schema
  (kind/severity/tags/summary≤280/source-provenance/supersedes), MemoryProvider
  interface, atomic O_APPEND JSONL with torn-line discard, legacy learnings.jsonl
  adapter, config parsing (absent = noop; unknown provider = hard error).
- **S3 — Recall injection**: one injection helper wired into ALL 6 dispatch-assembly
  sites (slice-linker `dispatch.mts`, `/crew:build`, `/crew:fix`, `/crew:ship`
  retries, `orchestrate-slice` step-3 + gate prompts, wave runner); top-K
  recency×severity, 800-token hard cap, completeness fitness test.
- **S4 — astramemProvider**: auto-detect like `astramemStore`, fallback to file,
  contract-parity test vs fileProvider.
- **S5 — Eval interaction + hygiene**: capture-parity golden test (incl. SIGKILL),
  with/without-memory GEPA eval fixture measuring judge-score delta, 45-day decay
  (except critical), superseded/invalidated never recalled.

## Acceptance criteria

### S1 — Capture repair (prerequisite)
- GIVEN a slice closes via `runner:close` with non-empty lessons/surprises in its grade, WHEN the close ceremony completes, THEN a learnings entry is auto-appended with zero operator action.
- GIVEN a grade file contains the literal placeholder `"- bullet"` or is otherwise incomplete, WHEN `validate-syntheses.ts` runs against it, THEN validation rejects it (or `runner:close` flags `grade_incomplete`) and the slice cannot close silently.
- GIVEN a review-FAIL or validation-FAIL artifact is written, WHEN the write completes, THEN a `failure`-kind entry is auto-captured with agent, severity, and summary derived from the verdict.
- GIVEN incident-close, `runner:pr-fix` circuit-breaker trips, or retrospective decisions occur, WHEN each completes, THEN a corresponding entry is captured.
- GIVEN `docs/decisions/README.md` is read, WHEN a contributor looks for the decision log, THEN it points at `.claude/artifacts/loop/decisions/` as the authoritative store.

### S2 — MemoryProvider interface + noop/file providers
- GIVEN `.claude/loop.json`/`crew.json` has no `memory` block, WHEN any provider is constructed, THEN `noopProvider` is selected and dispatch output is byte-identical to pre-S2 behavior (golden test).
- GIVEN `provider: "file"` is configured, WHEN entries are captured concurrently, THEN writes are atomic (O_APPEND) and torn lines are discarded on read.
- GIVEN the legacy `.claude/artifacts/loop/learnings.jsonl` (3 entries) exists, WHEN `fileProvider.recall()` runs, THEN those entries are included via the legacy adapter.
- GIVEN an unknown `provider` config value, WHEN config is parsed, THEN it is a hard error, not a silent fallback.
- GIVEN a set of entries with mixed recency/severity, WHEN `recall()` is called, THEN ranking is recency × severity, with unit tests covering token-budget truncation and supersede-chain resolution.

### S3 — Recall injection at dispatch
- GIVEN any of the 6 dispatch-assembly sites builds a dispatch instruction, WHEN memory is configured, THEN a `## Recent lessons (top-K)` block is injected, one line per entry (`[severity] summary — source`), scoped by agent/tags, never exceeding the token cap.
- GIVEN the noop provider is active, WHEN dispatch instructions are assembled, THEN output is byte-identical to today (golden dispatch-trace test, with and without memory context).
- GIVEN a new dispatch-assembly path is added without calling the injection helper, WHEN the completeness fitness test runs, THEN it fails (grep-based check across dispatch-assembly modules).

### S4 — astramemProvider
- GIVEN astramem is installed/detected, WHEN `provider` config resolves, THEN `astramemProvider` is selected automatically (mirroring `astramemStore` auto-detect); WHEN astramem is absent, THEN it falls back to `fileProvider`.
- GIVEN the same entry set is loaded into both `fileProvider` and `astramemProvider`, WHEN `recall()` is called with identical query params on each, THEN ranking order and token-truncation results are identical (contract-parity test).

### S5 — Eval interaction + hygiene
- GIVEN the GEPA capture-parity golden test (mirroring gepa-core's `captureParityGoldenTest`), WHEN a capture is issued including a SIGKILL-interrupted case, THEN the entry is captured or safely dropped without corruption, matching the golden fixture.
- GIVEN one GEPA v1 agent's eval fixture is run twice, once with the injected memory block and once without, WHEN judge scores are compared, THEN the with/without delta is measured and reported.
- GIVEN an entry is older than 45 days and not `severity: critical`, WHEN `recall()` runs with the default staleness policy, THEN it is excluded from results; GIVEN an entry has been superseded or invalidated, WHEN `recall()` runs, THEN it is never returned regardless of age.

## Refs

- `docs/superpowers/specs/2026-07-04-memory-provider-plan.md` — design (call-site matrix, schema, open questions)
- `docs/superpowers/specs/2026-07-04-crew-architecture-review-REPORT.md` §15 — evidence
- gepa-core TrialStore (`fileStore`/`astramemStore`) — the pattern precedent
