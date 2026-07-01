---
id: SLICE-98
parent: FEAT-183
status: done
closed: 2026-07-01
closed_via: PR #135 (merged 2026-07-01, squash SHA a4322c5)
priority: P1
created: 2026-06-27
title: "FEAT-183 S3 — 5 hand-seed eval cases for fullstack-dev + /crew:gepa-eval cmd + train/heldOut splitter + lock acquire/release"
stack: typescript + markdown
autonomous_safe: false
est_days: 2
depends_on: [SLICE-96, SLICE-97]
touches_files:
  - agents/fullstack-dev/.gepa/eval/seed-001.jsonl
  - agents/fullstack-dev/.gepa/eval/seed-002.jsonl
  - agents/fullstack-dev/.gepa/eval/seed-003.jsonl
  - agents/fullstack-dev/.gepa/eval/seed-004.jsonl
  - agents/fullstack-dev/.gepa/eval/seed-005.jsonl
  - commands/gepa-eval.md
  - scripts/crew.ts
  - scripts/lib/gepa/eval-runner.ts
  - scripts/lib/gepa/dataset-loader.ts
  - scripts/lib/gepa/split-train-heldout.ts
  - tests/gepa/eval-fullstack-dev.test.ts
  - tests/gepa/eval-no-dataset.test.ts
  - tests/gepa/concurrent-eval-block.test.ts
  - tests/gepa/split-determinism.test.ts
---

# SLICE-98: FEAT-183 S3 — eval fullstack-dev end-to-end

## Scope

Land Phase 2 (Eval) end-to-end for `fullstack-dev`:

- 5 hand-seeded `EvalCase` rows in `agents/fullstack-dev/.gepa/eval/seed-00{1..5}.jsonl`, each matching `EvalCaseSchema` with realistic inputs (not lorem ipsum) representing common dispatch shapes (single-file bugfix, multi-file refactor, cross-layer SPLIT_BUILD, identity-anchor stress, skill-budget pressure). At least one case has `held_out: true`.
- `scripts/lib/gepa/dataset-loader.ts` — reads all `*.jsonl` files under `agents/<agent>/.gepa/eval/`, parses each line via `EvalCaseSchema`, deduplicates by `id`.
- `scripts/lib/gepa/split-train-heldout.ts` — deterministic split honoring explicit `held_out: true` flags first; remaining cases split 80/20 by stable `id` hash (no RNG). Guarantees same input → same split.
- `scripts/lib/gepa/eval-runner.ts` — wraps `runEvalSuite()` from the library with crew-specific scorer wiring (`binaryScorer` wrapping `crew:inspector` PASS/FAIL for v1; `rubricScorer` lands in S5a). Acquires `fileLockManager` lock for `(agent, "eval")` before starting; releases on completion or process exit.
- `commands/gepa-eval.md` + `/crew:gepa-eval <agent>` CLI subcommand — runs the eval and writes aggregate artifact to `.claude/artifacts/crew/gepa/eval/<run-id>.json`.
- Four test files: `eval-fullstack-dev.test.ts`, `eval-no-dataset.test.ts`, `concurrent-eval-block.test.ts`, `split-determinism.test.ts`.

## Acceptance criteria

AC-1: Given `agents/fullstack-dev/.gepa/eval/seed-00{1..5}.jsonl` each contains exactly one JSONL line parseable as `EvalCaseSchema` with at least one row carrying `held_out: true`, When `dataset-loader.loadDataset("fullstack-dev")` runs, Then it returns an array of 5 `EvalCase` objects, no parse errors are thrown, and `id` values are unique.

AC-2: Given a 5-case dataset loaded for `fullstack-dev`, When `splitTrainHeldOut(dataset)` runs twice on the same input, Then both calls return the same `{ train, heldOut }` partition (byte-identical JSON serialization) AND every case with `held_out: true` lands in `heldOut`.

AC-3: Given the 5 seed cases are loaded and a `binaryScorer` wraps a mocked inspector that returns PASS for 4 cases and FAIL for 1, When `/crew:gepa-eval fullstack-dev` runs, Then a file `.claude/artifacts/crew/gepa/eval/<run-id>.json` is written containing the fields `agent: "fullstack-dev"`, `pass_rate: 0.8`, `p50_cost_usd`, `p50_latency_ms`, `total_cases: 5`, `started_at`, `completed_at`, and 5 trial rows are appended to `.claude/artifacts/crew/gepa/trials/fullstack-dev.jsonl` with `source: "eval"`.

AC-4: Given `agents/<unknown-agent>/.gepa/eval/` does not exist, When `/crew:gepa-eval unknown-agent` runs, Then the command exits non-zero with stderr containing the literal string `no eval dataset found at agents/unknown-agent/.gepa/eval/` and a hint pointing to `docs/superpowers/specs/2026-06-27-gepa-skill-improvement-loop-design.md` for dataset-authoring guidance, and no artifact is written under `.claude/artifacts/crew/gepa/eval/`.

AC-5: Given two `/crew:gepa-eval fullstack-dev` invocations run concurrently from sibling git worktrees (different PIDs), When the second invocation reaches `fileLockManager.acquire("fullstack-dev", "eval")`, Then `acquire()` returns `null`, the second command exits with stderr containing `already_in_progress: <other-pid>` and exit code 2, AND no partial eval artifact is written by the second invocation AND no orphan trial rows from the second invocation appear in the JSONL.

AC-6: Given `/crew:gepa-eval fullstack-dev` completes successfully, When `fileLockManager.acquire("fullstack-dev", "eval")` is called again from a new process, Then it succeeds (lock was released) and the new run proceeds normally.

AC-7: Given `/crew:gepa-eval fullstack-dev` is interrupted by SIGTERM mid-run, When the operator inspects `.claude/artifacts/crew/gepa/locks/`, Then no stale lock file blocks subsequent runs beyond the heartbeat timeout window (PID-based stale-lock recovery from SLICE-96).

AC-8: Given a `binaryScorer` whose underlying inspector throws an exception on case 3, When `/crew:gepa-eval fullstack-dev` runs, Then case 3 is recorded as `pass: false, score: 0, rationale: "scorer_error: <msg>"` (per design failure mode), the eval continues through cases 4 and 5, the aggregate artifact is written with `pass_rate` computed over all 5 cases, and the trial row for case 3 carries the error rationale.

AC-9: Given the seed dataset contains at least one case with explicit `held_out: true` and four without, When `runEvalSuite` is invoked with `train` and `heldOut` passed separately, Then trial rows for `held_out: true` cases appear in the trial JSONL with a discriminator that lets `detectEvalDrift` (S5a) compare distributions.

## Dependencies

- SLICE-96 (gepa-core library): `runEvalSuite`, `binaryScorer`, `fileStore`, `sequentialRunner`, `dailyCapMeter`, `fileLockManager`, Zod types.
- SLICE-97 (capture tee + config loader): `gepa.config.json` loader must already validate `GepaConfigSchema`; trial JSONL infrastructure must exist.

## Risks

- 5 hand-seeded cases may not exercise enough failure-mode diversity to drive optimization in S4 — design spec calls for hybrid bootstrap (hand-seed + auto-grow from captured trials). The auto-grow path is implicit (captured trials with `score ≥ 0.9` accrete) and surfaces in S5c when other agents come online. Document in the slice's run-brief.
- Inspector-as-scorer for `fullstack-dev` works because fullstack-dev is non-scorer-class — but this slice cannot use the same pattern for inspector itself (circularity). Design spec notes inspector uses `rubricScorer` in S6 — that dependency is documented in the design's "Resolved concerns" C1.
- Lock collision test must mock PIDs deterministically — forking real processes for the test is OS-dependent.
- Split determinism must survive reordering of files in `agents/<agent>/.gepa/eval/` (e.g. case `id` hash sort, not filename sort).

## References

- Design spec "Eval (Phase 2, on-demand or scheduled)" diagram (lines 503–544).
- Design spec slice plan row S3 (line 859) — acceptance evidence: "running eval produces aggregate, trials stored, `/crew:gepa-score` shows trend, concurrent `/crew:gepa-eval fullstack-dev` exits cleanly with `already_in_progress`".
- Design spec "Failure modes" table rows: "Eval scorer throws", "Eval runner walltime exceeded", "Eval budget cap exceeded mid-run", "Eval/Optimize another op already holds lock for same agent".
- Design spec "Testing strategy → crew integration tests" rows: `eval-fullstack-dev`, `eval-no-dataset`, `concurrent-eval-block` (lines 788–797).
- Design spec "Dataset bootstrap" decision row (line 46) — hybrid: 5 hand-seeded + auto-grow + 20% held-out.
