---
id: SLICE-100
parent: FEAT-183
status: triaged
priority: P1
created: 2026-06-27
title: "FEAT-183 S5a — LLMJudge interface + ollamaJudge built-in + rubricScorer + validateTrialCorpus + detectEvalDrift"
stack: typescript
autonomous_safe: false
est_days: 2
depends_on: [SLICE-96]
touches_files:
  - gepa-core/src/interfaces.ts
  - gepa-core/src/scorers/rubric-scorer.ts
  - gepa-core/src/judges/ollama-judge.ts
  - gepa-core/src/validators/validate-trial-corpus.ts
  - gepa-core/src/validators/detect-eval-drift.ts
  - gepa-core/src/index.ts
  - gepa-core/package.json
  - gepa-core/CHANGELOG.md
  - gepa-core/tests/rubric-scorer.test.ts
  - gepa-core/tests/ollama-judge.test.ts
  - gepa-core/tests/validate-trial-corpus.test.ts
  - gepa-core/tests/detect-eval-drift.test.ts
  - gepa-core/tests/fixtures/ollama-mock-responses/
  - gepa-core/tests/fixtures/bad-corpus/
---

# SLICE-100: FEAT-183 S5a — LLMJudge + ollamaJudge + rubricScorer + validators

## Scope

Land the gate between MVP (S1–S4 work without LLM judge) and horizontalized eval. All work in `gepa-core`:

- `LLMJudge` interface in `gepa-core/src/interfaces.ts` per design spec (`evaluate()` returns `{ pass, score, rubricScores, rationale, cost_usd, latency_ms }`; `describe()` returns `{ provider, model }` for trial provenance).
- `ollamaJudge` built-in at `gepa-core/src/judges/ollama-judge.ts` — separate package entry point `@astragenie/gepa-core/judges/ollama` so the SDK isn't pulled unless wired. Talks HTTP to `http://localhost:11434` (configurable endpoint) with `llama3.2:latest` (configurable model). Sends rubric criteria as prompt; parses JSON response with `pass`, `score` (0..1), and per-criterion subscores. Retries once on transient errors per design failure mode (`judge_unreachable: <provider>` halts eval after one retry with 1 s backoff).
- `rubricScorer(judge: LLMJudge)` factory at `gepa-core/src/scorers/rubric-scorer.ts` — implements `Scorer.score(run, expected)` by calling `judge.evaluate({ candidateOutput: run.raw_output, expected, rubric: expected.rubric })` and assembling `ScoreResult` with `cost_usd` and `latency_ms` from the judge call.
- `validateTrialCorpus(store)` at `gepa-core/src/validators/validate-trial-corpus.ts` — scans the trial JSONL for: torn lines, orphan agent refs, trial_id collisions, missing required metrics. Returns `ValidationReport` with `{ ok, tornLines, orphanAgentRefs, collisions, missingMetrics }`.
- `detectEvalDrift(trials, heldOutPass)` at `gepa-core/src/validators/detect-eval-drift.ts` — compares train-split vs held-out-split pass rates; flags drift when delta > 0.10 (configurable). Returns `DriftReport`.
- Bun unit tests covering each. Mock Ollama HTTP server on localhost in tests via a tmp port.

`rubricScorer` is the load-bearing piece — it breaks the scorer-circularity that blocked optimizing inspector/verifier/architect in the original ticket framing (architect concern C1).

## Acceptance criteria

AC-1: Given the new `LLMJudge` interface is exported from `@astragenie/gepa-core`, When TypeScript consumers import and implement the interface, Then the interface contract matches the design spec exactly (`evaluate({ candidateOutput, expected, rubric, signal? }) => Promise<{ pass, score, rubricScores, rationale, cost_usd, latency_ms }>` plus `describe() => { provider, model }`), and `tsc --noEmit` against a sample consumer compiles clean.

AC-2: Given a mock HTTP server on `http://localhost:<port>` responding to `POST /api/chat` with a fixture JSON containing `pass: true, score: 0.85, rubricScores: { clarity: 0.9, correctness: 0.8 }, rationale: "..."`, When `ollamaJudge({ model: "llama3.2:latest", endpoint: "http://localhost:<port>" }).evaluate({ ... })` is invoked, Then the returned object has `pass: true, score: 0.85, rubricScores: { clarity: 0.9, correctness: 0.8 }`, `cost_usd: 0` (local model), and `latency_ms > 0`.

AC-3: Given the Ollama endpoint at `http://localhost:11434` is unreachable (e.g. connection refused), When `ollamaJudge.evaluate()` is called, Then the implementation retries exactly once with 1 s backoff, the second failure throws an error whose message includes `judge_unreachable: ollama`, AND the caller (S5c eval runner) is expected to halt the cycle cleanly with `partial: true`.

AC-4: Given `rubricScorer(ollamaJudge({ ... }))` is constructed and called with an `AgentRun` and an `EvalCase` with `rubric: ["criterion-1", "criterion-2"]`, When `score(run, expected)` runs against a mocked judge returning `{ pass: true, score: 0.8, rubricScores: { "criterion-1": 0.9, "criterion-2": 0.7 }, rationale: "...", cost_usd: 0, latency_ms: 1500 }`, Then the returned `ScoreResult` has `pass: true, score: 0.8, rubric: { "criterion-1": 0.9, "criterion-2": 0.7 }, cost_usd: 0, latency_ms: 1500, rationale: "..."` and the score is in the closed interval `[0, 1]`.

AC-5: Given the judge returns a malformed score (NaN, or `score: 1.5` out of range), When `rubricScorer.score()` runs, Then per design failure mode it retries once; if still malformed, the returned `ScoreResult` is `pass: false, score: 0, rationale: "judge_malformed"`, AND the trial is preserved (not dropped).

AC-6: Given a trial JSONL containing 100 valid lines, 2 torn lines (truncated mid-JSON), and 1 line with an unknown `agent` field not appearing elsewhere in the corpus, When `validateTrialCorpus(fileStore("..."))` runs, Then the report has `ok: false, tornLines: 2, orphanAgentRefs: 1`, the 100 valid trials are still recallable via `store.recall()`, and the 2 torn lines are discarded by the store on recall (per design SIGKILL invariant).

AC-7: Given two trials share the same `trial_id` (collision injected via test fixture), When `validateTrialCorpus` runs, Then the report has `collisions: 1` with the offending `trial_id` listed; given trials missing `cost_usd` or `latency_ms` fields, the report has `missingMetrics > 0` with offending `trial_id`s listed.

AC-8: Given a held-out split of 20 trials with `pass_rate: 0.95` and a train split of 80 trials with `pass_rate: 0.60` (35pp delta), When `detectEvalDrift(allTrials, heldOutPass: 0.95)` runs with default drift threshold 0.10, Then the report has `drift: true, deltaPp: 0.35`; given a 5pp delta, the report has `drift: false`.

AC-9: Given `@astragenie/gepa-core` v0.2.0 introduces the `LLMJudge` interface (additive — no signature changes), When `scripts/check-semver.ts` runs against the v0.1.0 release line, Then it identifies the change as MINOR-bump-eligible (additive), not MAJOR, and the script exits 0; `CHANGELOG.md` is updated with a `## [0.2.0]` section listing the additions.

AC-10: Given `bun test --coverage` runs against the full library after this slice, Then line coverage on `src/judges/ollama-judge.ts`, `src/scorers/rubric-scorer.ts`, `src/validators/validate-trial-corpus.ts`, and `src/validators/detect-eval-drift.ts` all ≥ 90%.

## Dependencies

- SLICE-96 (gepa-core bootstrap): `Scorer` interface, `TrialStore` interface, `ScoreResult` schema, `Trial` schema, `EvalCase` schema, `fileStore` (for validator test fixtures).

## Risks

- Ollama is an external service — even in tests, the mock HTTP server must bind to an ephemeral port to avoid CI port collisions.
- `rubricScorer` cost reporting is critical: Ollama is local ($0), but the same scorer used with Azure/Gemini in S5b must report actual API spend. The interface design (`cost_usd` from `judge.evaluate()`) propagates correctly; verify in S5b adapter tests.
- `validateTrialCorpus` torn-line detection must match the SIGKILL-during-put invariant from SLICE-96 — the same fixture corpus should pass both validators.
- `detectEvalDrift` default threshold (0.10) is unevidenced — calibrate during S5c after horizontalize lands. Document as open question in slice run-brief.
- Score normalization across judges is the open product call in design spec line 923. Not resolved in this slice; resolve before S5b ships if any auto-merge-allowlist agent ends up on `judge_per_agent`.

## References

- Design spec "Library API surface → Interfaces → LLMJudge" (lines 336–352).
- Design spec "Library API surface → Top-level functions → `rubricScorer`" (line 418).
- Design spec "Library API surface → Built-in LLMJudge → `ollamaJudge`" (line 439).
- Design spec slice plan row S5a (line 861) — acceptance evidence: "judge interface contract test; `rubricScorer` with `ollamaJudge` produces continuous score against fixture rubric".
- Design spec "Resolved concerns → C1 Inspector grades inspector" (line 58) — `rubricScorer` resolves the circularity.
- Design spec "Resolved concerns → C25 Judge model decision deferred but unsafe to leave open" (line 82) — ollamaJudge default decided.
- Design spec "Failure modes" table rows: "Judge LLMJudge endpoint unreachable", "Judge LLMJudge returns malformed score" (lines 694–695).
- Design spec "Testing strategy → gepa-core tests" rows: `rubricScorer`, `ollamaJudge`, `validateTrialCorpus`, `detectEvalDrift` (lines 765, 774, 771–772).
- Design spec "Invariants → Cloud judge adapters … optional peer deps" (line 126) — separate entry points pattern.
