---
id: SLICE-102
parent: FEAT-183
status: triaged
priority: P1
created: 2026-06-27
title: "FEAT-183 S5c — astramemStore + sharedAstramemMeter + horizontalize seed datasets + eval runs for backend-dev, frontend-dev, verifier"
stack: typescript + markdown
autonomous_safe: false
est_days: 2
depends_on: [SLICE-100, SLICE-101]
touches_files:
  - gepa-core/src/stores/astramem-store.ts
  - gepa-core/src/meters/shared-astramem-meter.ts
  - gepa-core/src/index.ts
  - gepa-core/package.json
  - gepa-core/CHANGELOG.md
  - gepa-core/tests/astramem-store.test.ts
  - gepa-core/tests/shared-astramem-meter.test.ts
  - agents/backend-dev/.gepa/eval/seed-001.jsonl
  - agents/backend-dev/.gepa/eval/seed-002.jsonl
  - agents/backend-dev/.gepa/eval/seed-003.jsonl
  - agents/backend-dev/.gepa/eval/seed-004.jsonl
  - agents/backend-dev/.gepa/eval/seed-005.jsonl
  - agents/backend-dev/.gepa/rubric.md
  - agents/frontend-dev/.gepa/eval/seed-001.jsonl
  - agents/frontend-dev/.gepa/eval/seed-002.jsonl
  - agents/frontend-dev/.gepa/eval/seed-003.jsonl
  - agents/frontend-dev/.gepa/eval/seed-004.jsonl
  - agents/frontend-dev/.gepa/eval/seed-005.jsonl
  - agents/frontend-dev/.gepa/rubric.md
  - agents/verifier/.gepa/eval/seed-001.jsonl
  - agents/verifier/.gepa/eval/seed-002.jsonl
  - agents/verifier/.gepa/eval/seed-003.jsonl
  - agents/verifier/.gepa/eval/seed-004.jsonl
  - agents/verifier/.gepa/eval/seed-005.jsonl
  - agents/verifier/.gepa/rubric.md
  - scripts/lib/gepa/capture-tee.ts
  - tests/gepa/horizontalize-eval.test.ts
  - tests/gepa/store-interchangeable.test.ts
---

# SLICE-102: FEAT-183 S5c — astramemStore + horizontalize to 4 agents

## Scope

Two parallel workstreams:

**1. astramemStore + sharedAstramemMeter (gepa-core):**
- `gepa-core/src/stores/astramem-store.ts` — implements `TrialStore` by spawning the `astramem` CLI subprocess (path supplied via `astramemStore({ cliPath })`). Maps `put()` to `astramem fact add --type gepa-trial --tag agent:<name> --payload <json>`. Maps `recall({ filter })` to `astramem fact list --type gepa-trial --tag agent:<name> ...`. Maps `invalidate()` to `astramem fact tag-add --tag invalidated:<reason>` (soft delete via tag, audit row preserved). Falls back gracefully when `astramem` CLI is absent (returns clean error directing to install memory-plugin).
- `gepa-core/src/meters/shared-astramem-meter.ts` — implements `BudgetMeter` by reading/writing to the same astramem-local wallet that the rest of the loop uses. `reserve` adds a reservation fact; `record` finalizes spend; `release` removes the reservation fact. Day-roll-over honored by astramem's existing temporal tag.

**2. Horizontalize eval to backend-dev, frontend-dev, verifier (crew):**
- 5 hand-seeded `EvalCase` rows per agent under `agents/<name>/.gepa/eval/seed-00{1..5}.jsonl`, plus per-agent `rubric.md` with 5–7 criteria. Verifier's rubric MUST use `rubricScorer` (not binaryScorer-via-inspector) to avoid scorer-circularity per design concern C1.
- Capture tee in `scripts/lib/gepa/capture-tee.ts` extended to attach for `backend-dev`, `frontend-dev`, `verifier` (was fullstack-dev only after S2).
- Eval runs for all 4 agents (fullstack-dev + new 3) produce aggregate artifacts.

## Acceptance criteria

AC-1: Given the `astramem` CLI is on `PATH` and `astramemStore({ cliPath: "astramem" })` is constructed, When `store.put(trial)` is called with a valid `Trial`, Then the CLI is spawned with `astramem fact add --type gepa-trial --tag agent:<name>` and a JSON payload arg; the returned promise resolves on subprocess exit code 0; subsequent `store.recall({ agent })` returns the persisted trial round-tripped through `TrialSchema`.

AC-2: Given the `astramem` CLI is NOT on `PATH`, When `astramemStore({ cliPath: "astramem" }).put(trial)` is called, Then the spawned-process error is caught and re-thrown as `AstramemUnavailableError` with a message directing the operator to install `memory-plugin`, and `gepaCapture` (called from the capture tee) catches this error per its fail-silent contract and logs `gepa_capture_drop` with `reason: "astramem_unavailable"`.

AC-3: Given `gepa.config.json` declares `storage.backend: "astramem"` AND `storage.astramem_cli_path: "astramem"`, When the same eval scenario from SLICE-98 runs against `astramemStore` instead of `fileStore`, Then the produced aggregate artifact has byte-identical `pass_rate`, `p50_cost_usd`, `total_cases` fields (store-interchangeability invariant for the `runEvalSuite` contract). The 5 trials are persisted via astramem facts.

AC-4: Given `sharedAstramemMeter({ cliPath: "astramem" })` is constructed and `reserve($1.50, { ttlSeconds: 600 })` is called, When the reservation succeeds, Then the astramem wallet shows a reservation fact with `payload: { reservationId, estimate: 1.50, ttl: 600 }`; `record(reservationId, 1.20)` finalizes spend at $1.20 (not the estimate); `release(reservationId)` removes the reservation; `spentToday()` reflects $1.20.

AC-5: Given `sharedAstramemMeter`'s daily cap is $50 and astramem-local has already recorded $48 in unrelated spend today, When `reserve($3)` is called, Then `{ ok: false, remainingUsd: 2 }` is returned (shared wallet shows budget is exhausted), and no fact is created.

AC-6: Given each of `backend-dev`, `frontend-dev`, `verifier` has 5 seed cases under `agents/<name>/.gepa/eval/` with at least one `held_out: true` and a `rubric.md`, When `/crew:gepa-eval backend-dev`, `/crew:gepa-eval frontend-dev`, and `/crew:gepa-eval verifier` each run, Then each produces an aggregate artifact at `.claude/artifacts/crew/gepa/eval/<run-id>.json` and each agent's trial JSONL gains 5 trial rows with `source: "eval"`.

AC-7: Given `crew:verifier` is dispatched during a `/crew:build` cycle and `capture.enabled: true`, When the dispatch completes, Then a trial row appears in `.claude/artifacts/crew/gepa/trials/verifier.jsonl` with `source: "captured"` (was previously skipped — only fullstack-dev was captured after S2). Same assertion holds for `backend-dev` and `frontend-dev`.

AC-8: Given the verifier rubric specifies criteria like `evidence-citation-completeness`, `command-runnability`, `verdict-justification`, When `/crew:gepa-eval verifier` runs against `rubricScorer(resolveJudge(config, "verifier"))`, Then each trial row's `score.rubric` contains entries for all 3 criteria, the overall `score.score` is a weighted continuous value in `[0, 1]`, and the scorer never short-circuits on `score_hint.pass` from the captured live-dispatch verdict (per design spec line 463).

AC-9: Given the same 5-case dataset for `fullstack-dev`, When the test `tests/gepa/store-interchangeable.test.ts` runs `runEvalSuite` first with `fileStore` then with `astramemStore` (with astramem CLI mocked), Then both runs produce aggregate artifacts whose `pass_rate`, `total_cases`, and per-case ordering match byte-for-byte (modulo `started_at`/`completed_at` timestamps), proving the `TrialStore` abstraction is store-neutral.

AC-10: Given `gepa-core` is bumped to v0.4.0 introducing `astramemStore` and `sharedAstramemMeter` (additive — both new exports), When `scripts/check-semver.ts` runs against v0.3.0, Then the change is identified as MINOR; `CHANGELOG.md` is updated with `## [0.4.0]` listing the additions and the entry points for the new exports.

## Dependencies

- SLICE-100 (`LLMJudge` + `rubricScorer`): required for non-binary scoring of verifier (breaks circularity).
- SLICE-101 (per-agent judge resolution + rubric.md loader): used to load each new agent's rubric and route to the configured judge.

## Risks

- `astramem` CLI subprocess overhead may exceed capture walltime budget on slow disks — measure in S5c micro-bench; if persistent, document `fileStore` as the recommended capture-tee store and reserve `astramemStore` for eval/optimize runs where latency is less critical.
- Hand-seed datasets for 3 new agents are tedious — each agent's 5 cases must be realistic dispatch shapes (not lorem ipsum) to drive S6/S7 inspector/architect work. Allow ~half-day per agent for case authoring.
- Verifier seed cases must be carefully designed: verifier scores OTHER agents' output, so the eval input includes a fake builder handoff + the case asks verifier to produce a verdict. Don't conflate "verifier rubric" with "the verifier's underlying inspector rubric".
- The store-interchangeability test (`tests/gepa/store-interchangeable.test.ts`) requires a mockable astramem subprocess — implement via `child_process.spawn` mock that returns canned fact-list responses.
- `sharedAstramemMeter` race conditions on concurrent reserve/record from different worktrees — astramem CLI itself must provide atomic fact-write semantics, otherwise we re-introduce the locking problem SLICE-96 solved for files. Document in slice's run-brief; fall back to `dailyCapMeter` if astramem atomicity proves insufficient.

## References

- Design spec "Library API surface → Top-level functions → Built-in TrialStores" (lines 421–422) and "Built-in BudgetMeter" (lines 429–430).
- Design spec slice plan row S5c (line 863) — acceptance evidence: "4 agents have working eval (fullstack + backend + frontend + verifier), astramem trial store interchangeable with file store under same eval".
- Design spec "Failure modes" table row: "Capture tee astramem CLI absent when `astramemStore` is configured" (line 681).
- Design spec "Testing strategy → gepa-core tests" rows: `astramemStore`, `dailyCapMeter` (and by extension shared meter parity) (lines 762, 777).
- Design spec "Shape rationale → `score_hint.pass` on a `CrewArtifact` is ADVISORY" (line 463) — verifier scoring must not short-circuit.
- Design spec "Resolved concerns → C1 Inspector grades inspector" (line 58) — verifier eval uses rubric, not binary self.
