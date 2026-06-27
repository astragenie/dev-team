---
id: SLICE-103
parent: FEAT-183
status: triaged
priority: P1
created: 2026-06-27
title: "FEAT-183 S6 — inspector bug-corpus mining + 10-case eval set + inspector eval run using rubricScorer (breaks scorer-circularity)"
stack: typescript + markdown
autonomous_safe: false
est_days: 3
depends_on: [SLICE-100, SLICE-101, SLICE-102]
touches_files:
  - scripts/lib/gepa/mine-inspector-bug-corpus.ts
  - scripts/crew.ts
  - agents/inspector/.gepa/eval/bug-001.jsonl
  - agents/inspector/.gepa/eval/bug-002.jsonl
  - agents/inspector/.gepa/eval/bug-003.jsonl
  - agents/inspector/.gepa/eval/bug-004.jsonl
  - agents/inspector/.gepa/eval/bug-005.jsonl
  - agents/inspector/.gepa/eval/bug-006.jsonl
  - agents/inspector/.gepa/eval/bug-007.jsonl
  - agents/inspector/.gepa/eval/bug-008.jsonl
  - agents/inspector/.gepa/eval/bug-009.jsonl
  - agents/inspector/.gepa/eval/bug-010.jsonl
  - agents/inspector/.gepa/rubric.md
  - tests/gepa/mine-inspector-bug-corpus.test.ts
  - tests/gepa/eval-inspector-no-circularity.test.ts
  - docs/superpowers/specs/2026-06-27-gepa-inspector-bug-mining-notes.md
---

# SLICE-103: FEAT-183 S6 — inspector bug-corpus mining + 10-case eval

## Scope

Land the inspector eval pipeline. Inspector is scorer-class, so it must be evaluated with `rubricScorer` (via LLM-judge) — binary-self scoring would be circular per design concern C1.

- `scripts/lib/gepa/mine-inspector-bug-corpus.ts` — script that walks GitHub PR review history (via `gh` CLI) for the past N weeks, extracts review comments labeled `bug` or with diff-suggest blocks, and emits candidate `EvalCase` JSON. Each candidate case has `input: { diff, context }`, `expected_output: { verdict, rationale }` from the human reviewer's recorded reaction. CLI: `node scripts/crew.ts gepa-mine-inspector --weeks 8 --out agents/inspector/.gepa/eval/`.
- `scripts/crew.ts` wires the new `gepa-mine-inspector` subcommand.
- 10 hand-curated `EvalCase` rows under `agents/inspector/.gepa/eval/bug-00{1..10}.jsonl` (mined output reviewed + edited by operator). At least 2 are `held_out: true`. Each case covers a distinct bug class: logic error, integration failure, data corruption, timeout, permission, resource exhaustion, external dep break, security issue, performance regression, race condition.
- `agents/inspector/.gepa/rubric.md` with criteria: `verdict-accuracy`, `evidence-citation-correctness`, `risk-class-named`, `rationale-actionability`, `escalation-appropriateness`, `false-positive-rate`.
- `/crew:gepa-eval inspector` runs against `rubricScorer(resolveJudge(config, "inspector"))` — typically `ollamaJudge` to keep cost zero on a 10-case sweep.
- Two integration tests: `mine-inspector-bug-corpus.test.ts` (verifies mining script schema), `eval-inspector-no-circularity.test.ts` (verifies no scorer-circular warning emitted).

## Acceptance criteria

AC-1: Given `gh auth status` reports a logged-in user and the repo's PR review history contains 30+ reviews over the past 8 weeks, When `node scripts/crew.ts gepa-mine-inspector --weeks 8 --out tmp/inspector-eval/` runs, Then JSON files under `tmp/inspector-eval/` each contain a single line parseable as `EvalCaseSchema` with `input.diff` (non-empty string), `input.context` (PR title + body), `expected_output.verdict` (`approve` | `request_changes` | `comment`), and `expected_output.rationale` (non-empty string).

AC-2: Given a hand-mined `bug-001.jsonl` case represents a logic-error bug in a TypeScript function, When `/crew:gepa-eval inspector` runs with `rubricScorer(ollamaJudge)`, Then the judge call returns a `ScoreResult` with `score in [0, 1]`, `rubric: { "verdict-accuracy": ..., "evidence-citation-correctness": ..., ... }` containing all 6 rubric criteria from `agents/inspector/.gepa/rubric.md`, and `pass` derived from the configured threshold (e.g. `score >= 0.7`).

AC-3: Given `agents/inspector/.gepa/eval/` contains 10 cases with 2 marked `held_out: true`, When `/crew:gepa-eval inspector` runs, Then 10 trial rows are appended to `.claude/artifacts/crew/gepa/trials/inspector.jsonl` with `source: "eval"`, the aggregate artifact at `.claude/artifacts/crew/gepa/eval/<run-id>.json` reports `total_cases: 10` AND `held_out_cases: 2` AND `pass_rate_all`, `pass_rate_train`, `pass_rate_held_out` all present as separate fields.

AC-4: Given `agents/inspector/.gepa/eval/` is configured and `/crew:gepa-eval inspector` runs, When the eval completes, Then no warning or error containing the substring `scorer_circular` or `inspector_grades_inspector` is emitted to stdout/stderr or `.claude/logs/events.jsonl`, AND the resolved judge in the aggregate's `judge:` provenance field is NOT `crew:inspector` (binary self-grading is forbidden).

AC-5: Given the operator runs the mining script with `--weeks 0` (no history), When the script completes, Then exit code is 0, no files are written to the output dir, and stdout contains a helpful message directing the operator to set `--weeks` to a non-zero value or hand-author cases.

AC-6: Given a mined case has an `expected_output.verdict: "request_changes"` but the inspector champion's response under eval is `verdict: "approve"`, When `rubricScorer` evaluates the response, Then `rubric.verdict-accuracy` is below the rubric's pass threshold (e.g. `<= 0.3`), the trial's `pass: false`, and the rationale string from the judge cites the verdict mismatch (after `redactRationale` from SLICE-101).

AC-7: Given the 10 mined cases span 10 distinct bug classes (logic, integration, data, timeout, permission, resource, external-dep, security, perf, race), When `validateTrialCorpus` runs on the resulting trial JSONL, Then it reports `ok: true` AND a separate report (not yet a library function — emit in slice notes) confirms class coverage by parsing `notes` field on each `EvalCase` for the class tag.

AC-8: Given the inspector champion prompt edit experiment in S8a/S8b will need a baseline, When this slice completes, Then the aggregate at `.claude/artifacts/crew/gepa/eval/<inspector-baseline-run-id>.json` is committed (per repo policy `.claude/artifacts/crew/gepa/eval/` is durable), and the run-id is documented in `docs/superpowers/specs/2026-06-27-gepa-inspector-bug-mining-notes.md` as the baseline ref.

AC-9: Given the mining script processes 100 PR review comments, When the script runs, Then it completes in under 5 minutes wall-clock (gh CLI subprocess + JSON munging), and per-comment processing logs progress to stderr (1 line per PR).

## Dependencies

- SLICE-100 (rubricScorer + ollamaJudge): required to score inspector without circularity.
- SLICE-101 (resolveJudge + rubric.md loader): per-agent rubric routing.
- SLICE-102 (capture tee extended to verifier): not strictly required for inspector eval, but shares the horizontalize infrastructure.

## Risks

- **Dataset authoring is the hidden subproject** (architect concern C2). The mining script accelerates case generation, but 10 truly diverse + correctly-labeled cases require operator review of each. Plan ~half-day per 3 cases. Design spec line 851 flags this as schedule risk — surface in slice run-brief and request 3-day contingency before S7.
- Mined cases may carry sensitive PR content (e.g. secret keys committed by accident in the diff). The `gepa-mine-inspector` script MUST apply `redactRationale` from SLICE-101 to ALL extracted strings before write.
- LLM-judge quality on 6-criteria rubric with `llama3.2:latest` may be inadequate — verify via dry-run; if subscore variance is too high, route inspector to `azureOpenAIJudge` via `judge_per_agent` (cost: ~$0.50 per eval run with 10 cases).
- The mining script's `gh` CLI dependency must handle rate limits gracefully — back off on 403 with `Retry-After` header per GitHub's docs.
- Hand-curating 10 cases across 10 bug classes may force synthetic cases when history doesn't surface real examples — note as test-fixture origin in the EvalCase `notes` field.

## References

- Design spec "Resolved concerns → C1 Inspector grades inspector" (line 58).
- Design spec "Resolved concerns → C2 Eval dataset authoring is a hidden subproject that dwarfs the 1 week estimate" (line 59).
- Design spec slice plan row S6 (line 864) — acceptance evidence: "inspector eval produces aggregate, no scorer-circular warning".
- Design spec "Implementation notes → S8a / S8b → Dataset-authoring slack" (line 851) — 3-day contingency between S6 and S7.
- Design spec "Failure modes" table — relevant failure classes the bug-corpus must cover (line 80 enumerates logic/integration/data/timeout/permission/resource/external-dep classes which mirror the v1 bug-class coverage requirement).
- Design spec "Testing strategy → crew integration tests" — implied baseline for S8a/S8b inspector tests (lines 796 critical-agent-allowlist).
