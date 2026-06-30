---
id: SLICE-96
parent: FEAT-183
status: superseded
superseded_by: "gepa-core PR-#122 + PR-#123 + PR-#124 (v0.1.0 -> v0.3.1) + FEAT-184 + FEAT-185 SLICE-A"
closed: 2026-06-30
priority: P1
created: 2026-06-27
title: "FEAT-183 S1 — gepa-core bootstrap (Zod schemas + fileStore + sequentialRunner + binaryScorer + meter + lock + paretoRank)"
stack: typescript
autonomous_safe: false
est_days: 3
touches_files:
  - gepa-core/package.json
  - gepa-core/tsconfig.json
  - gepa-core/CHANGELOG.md
  - gepa-core/src/types.ts
  - gepa-core/src/interfaces.ts
  - gepa-core/src/index.ts
  - gepa-core/src/stores/file-store.ts
  - gepa-core/src/runners/sequential-runner.ts
  - gepa-core/src/scorers/binary-scorer.ts
  - gepa-core/src/meters/daily-cap-meter.ts
  - gepa-core/src/locks/file-lock-manager.ts
  - gepa-core/src/algorithms/pareto-rank.ts
  - gepa-core/src/algorithms/dominates.ts
  - gepa-core/src/validators/validate-candidate-size.ts
  - gepa-core/tests/types.test.ts
  - gepa-core/tests/file-store.test.ts
  - gepa-core/tests/sequential-runner.test.ts
  - gepa-core/tests/binary-scorer.test.ts
  - gepa-core/tests/daily-cap-meter.test.ts
  - gepa-core/tests/file-lock-manager.test.ts
  - gepa-core/tests/pareto-rank.test.ts
  - gepa-core/tests/validate-candidate-size.test.ts
  - gepa-core/scripts/check-semver.ts
---

# SLICE-96: FEAT-183 S1 — gepa-core bootstrap

## Scope

Bootstrap the new ESM package `@astragenie/gepa-core` in a fresh repo `astragenie/gepa-core` with:

- Zod schemas for the 7 first-class types: `Trial`, `EvalCase`, `ScoreResult`, `CrewArtifact`, `AgentRun`, `Candidate`, `GepaConfig`.
- Interfaces: `Scorer`, `TrialStore`, `RunnerAdapter`, `PromotionPolicy`, `CandidateGenerator`, `BudgetMeter`, `LLMJudge`, `LockManager`.
- Built-ins (no peer-deps): `fileStore`, `sequentialRunner`, `binaryScorer`, `dailyCapMeter`, `fileLockManager`.
- Algorithms: `paretoRank` (with `pass > score > -cost > -latency` tiebreaker chain + deterministic trial_id final), `dominates` (exposed pure helper), `validateCandidateSize` (counts lines, default cap 350, exempts `gepa:` YAML frontmatter when configured).
- Bun test suite ≥ 90% line coverage.
- Strict semver: `CHANGELOG.md` template + `scripts/check-semver.ts` diffs exported interfaces against previous release and flags MAJOR-bump-required changes.
- `package.json` exports map declaring future judge entry points (`./judges/ollama`, `./judges/azure`, `./judges/gemini`) as separate paths so peer-dep SDKs aren't pulled unless wired.

This slice ships zero `LLMJudge` implementations — that's S5a. This slice ships zero `astramemStore` or `waveRunner` — those have peer-deps and ship later (S5c, deferred respectively).

## Acceptance criteria

AC-1: Given a clean checkout of `astragenie/gepa-core`, When `bun install && bun test` runs, Then all unit tests pass and `bun test --coverage` reports ≥ 90% line coverage on `src/`.

AC-2: Given a malformed `Trial` payload missing the required `candidate_prompt_hash` field, When `TrialSchema.parse(payload)` is invoked, Then a `ZodError` is thrown whose `issues[].path` includes `["candidate_prompt_hash"]`.

AC-3: Given two parallel `Promise.all([fileStore.put(t1), fileStore.put(t2)])` calls against the same `<agent>.jsonl`, When both complete, Then both trial rows appear in the file as complete JSONL lines (no torn lines, no interleaved bytes) and `validateTrialCorpus(store)` returns `{ ok: true, tornLines: 0 }`.

AC-4: Given a child process is SIGKILLed mid-`fileStore.put()` (during JSONL append), When the parent recovers and runs `validateTrialCorpus`, Then the report identifies zero torn lines AND any partial trial whose `write()` syscall did not complete is absent from the file (atomic-append invariant via `O_APPEND` single-syscall under JSONL line size; per design spec failure-mode "SIGKILL mid-`put`").

AC-5: Given a `sequentialRunner` configured with a `mockScorer` that costs $0.10 per case and a `dailyCapMeter` initialized with `capUsd: 0.25`, When `runCandidates([c1], [case1, case2, case3], mockScorer, { meter })` is invoked, Then the runner halts after 2 cases (reservation for case3 fails), the returned trials array has length 2, and `meter.spentToday()` returns `0.20`.

AC-6: Given 4 trials where t1 dominates t2 on all dimensions and t3, t4 are mutually non-dominated, When `paretoRank(trials)` runs, Then t1 receives `pareto_rank: 1`, t2 receives `pareto_rank > 1`, t3 and t4 both receive `pareto_rank: 1`, and a property-test over 100 random trial sets confirms no trial is ranked below a trial that dominates it.

AC-7: Given two non-dominated trials with identical `pass`, `score`, `cost_usd`, `latency_ms`, When `paretoRank` ranks them, Then the tiebreaker resolves to ascending `trial_id` lexicographic order and two consecutive `paretoRank` calls on the same input return byte-identical output (determinism).

AC-8: Given `fileLockManager.acquire("fullstack-dev", "eval")` succeeds and returns `{ released }`, When a second `acquire("fullstack-dev", "eval")` call is issued from a forked child process before `released()` is called, Then the second call returns `null` and the lock file path `.claude/artifacts/crew/gepa/locks/<sha256(worktree-root)>-fullstack-dev.eval.lock` contains the first process's PID + heartbeat timestamp.

AC-9: Given a `Candidate` whose prompt file is 351 lines long, When `validateCandidateSize(candidate, 350)` is invoked, Then it returns `{ ok: false, reason: "oversized_candidate" }`; given a 200-line candidate, it returns `{ ok: true }`.

AC-10: Given an exported interface signature is changed (e.g. a new required field on `Scorer.score`), When `node scripts/check-semver.ts` runs against the previous `CHANGELOG.md` release line, Then the script exits non-zero with a message naming the interface and requiring a MAJOR bump.

## Dependencies

None. This is the foundation slice.

## Risks

- New repo bootstrap may not catch every peer-dep entry-point requirement — exports map must declare `./judges/ollama`, `./judges/azure`, `./judges/gemini` paths even though their implementations land later (S5a, S5b).
- `fileStore` atomic append on Windows differs from POSIX — must test on both. Node's `fs.appendFileSync` with `flag: 'a'` is sufficient for ≤4 KiB lines per design spec line 832, but verify on Windows CI.
- `fileLockManager` stale-PID detection across sibling git worktrees that share the same lock path produces false-positive "already in progress" errors. Mitigation: include `sha256(worktree-root)` in lock filename per design spec line 831.
- `paretoRank` property test with random trials must be deterministic — seed RNG.

## References

- Design spec sections: "Library API surface" (lines 130–463) — Types, Interfaces, Top-level functions, Shape rationale.
- Design spec "Invariants" (lines 121–128) — zero hard Claude-Code-specific deps, ESM, Bun test runner.
- Design spec "Implementation notes for plan-writing → S1 — gepa-core bootstrap" (lines 829–834) — lockfile directory committed vs ephemeral, atomic file writes, semver discipline tooling.
- Design spec "Testing strategy → gepa-core tests" table (lines 757–782) — per-component test specification.
- Failure modes table (lines 678–703) — relevant rows: "Capture tee SIGKILL mid-`put`", "Optimize candidate exceeds 350-line cap", "Optimize Pareto rank shows tie at #1", "Eval/Optimize another op already holds lock".
