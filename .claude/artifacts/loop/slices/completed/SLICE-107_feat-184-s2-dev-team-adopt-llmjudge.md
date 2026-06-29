---
id: SLICE-107
parent: FEAT-184
status: completed
priority: P1
created: 2026-06-29
title: FEAT-184 S2 — dev-team adopts @astragenie/gepa-core LLMJudge (re-export + 7 adapter describe() + rubric wrap + README)
stack: typescript
autonomous_safe: false
est_days: 1
depends_on: [gepa-core v0.2.1 published to npmjs 2026-06-29 (v0.2.0 burned by unpublish lockout; 0.2.1 ships identical payload). Use ^0.2.1 in package.json.]
touches_files: [package.json, evals/lib/judge.ts, evals/lib/run-eval.ts, evals/providers/generic-openai.ts, evals/providers/groq.ts, evals/providers/claude-p.ts, evals/providers/ollama.ts, evals/providers/gemini.ts, evals/providers/azure-openai.ts, evals/providers/bedrock.ts, evals/README.md, tests/evals-providers.test.ts, evals/cli.ts, specs/crew-fullstack-dev.yaml, specs/crew-inspector.yaml]
completed_at: 2026-06-29
updated: 2026-06-29
---
# SLICE-107: FEAT-184 S2 — dev-team adopts @astragenie/gepa-core LLMJudge

## Parent

FEAT-184 (unify judge interface). gepa-core side (S1) shipped v0.2.0 / PR #1
2026-06-28. This slice closes the dev-team half. Blocks SLICE-98 (GEPA S3
`/crew:gepa-eval`).

## Scope

1. Add `@astragenie/gepa-core` dep to `package.json` at `^0.2.1` (published
   to npmjs 2026-06-29 — v0.2.0 was burned by unpublish lockout; 0.2.1 ships
   the identical payload).
2. Rewrite `evals/lib/judge.ts`:
   - Re-export `LLMJudge` from `@astragenie/gepa-core`.
   - Mark `JudgeProvider` as `@deprecated` alias mapping to `LLMJudge` for one
     minor version (removed in next MAJOR). Maintain old `judge()` method as
     deprecated shim that forwards to `evaluate()`.
   - Keep `JUDGE_REGISTRY` shape; factories now return `LLMJudge`.
3. Migrate 7 adapters (`evals/providers/*.ts` — generic-openai, groq, claude-p,
   ollama, gemini, azure-openai, bedrock):
   - Implement `evaluate(opts)` returning canonical result shape (pass, score,
     rubricScores, rationale, cost_usd, latency_ms, optional tokens, optional
     raw).
   - Map old `providerCost.{usd, tokensIn, tokensOut}` → `cost_usd` +
     `tokens: { in, out }`.
   - Implement `describe(): { provider, model }`.
   - claude-p adapter: `tokens` omitted (subprocess cannot surface counts) —
     documented.
4. Migrate `evals/lib/run-eval.ts` + `evals/cli.ts` to call `evaluate()` with
   the unified opts; forward `context: { fixture, promptId, version }`.
5. Rubric migration for shipped specs (`crew-fullstack-dev.yaml`,
   `crew-inspector.yaml`): wrap prose rubric in single-element array
   `[oneString]`. NEVER sentence-split.
6. External-consumer audit (AC-9): grep for `JudgeProvider` / `JudgeResult` /
   `JudgeRequest` outside this repo; log result in handoff.
7. Rewrite `evals/README.md` lines 49-62: point at `LLMJudge` from gepa-core,
   add deprecation note for `JudgeProvider` with migration link to gepa-core
   CHANGELOG 0.2.0.

## Acceptance criteria

**AC-1 (parent FEAT-184 AC-2 — re-export):** Given a fresh checkout, When
`grep -n "export" evals/lib/judge.ts` runs, Then output contains
`export type { LLMJudge } from "@astragenie/gepa-core"` AND the deprecated
`JudgeProvider` alias carries a JSDoc `@deprecated` tag pointing at `LLMJudge`.

**AC-2 (parent FEAT-184 AC-3 — 7 adapter compile + describe):** Given the 7
provider files, When `bun run typecheck` runs, Then zero errors AND
`tests/evals-providers.test.ts` includes one assertion per adapter that
`adapter.describe()` returns `{ provider: <expected>, model: <expected> }`.

**AC-3 (parent FEAT-184 AC-4 — statistical drift gate):** For each of
`crew-fullstack-dev.yaml` and `crew-inspector.yaml`:
- Deterministic providers (ollama at `temperature: 0`, fixture replays):
  exact-match PASS/FAIL + score + token counts pre- vs post-refactor.
- Nondeterministic (claude-p, groq, gemini, azure, bedrock): N≥5 runs each,
  PASS/FAIL identical per test, mean score within ±0.05, mean token counts
  within ±5%.
Drift outside band fails the AC. Capture run logs as evidence in handoff.

**AC-4 (parent FEAT-184 AC-5 — rubric wrap, no split):** Given the 2 shipped
specs, When the adapter layer reads `spec.rubric`, Then it wraps in
single-element array (`[spec.rubric]`); sentence-splitting forbidden.
Single-element arrays remain valid forever (gepa-core interface JSDoc and
CHANGELOG already document this).

**AC-5 (parent FEAT-184 AC-6 — context preservation):** Given a judge call
from `evals/cli.ts` carrying `{ fixture, promptId, version }`, When the call
reaches the adapter, Then `opts.context` is present and forwarded to Langfuse
emission (FEAT-169 SLICE-90 path); zero adapters drop the field.

**AC-6 (parent FEAT-184 AC-9 — external-consumer audit):** Given the audit,
When the result is filed in the handoff, Then it lists every external repo
checked AND confirms zero external implementers of `JudgeProvider`. If any
external consumer surfaces, slice grows a migration-guide subtask before merge.

**AC-7 (parent FEAT-184 AC-10 — README rewrite):** Given `evals/README.md`,
When the relevant section renders, Then it documents `LLMJudge` as the
external-author API, links to gepa-core CHANGELOG 0.2.0, AND notes
`JudgeProvider` deprecation timeline.

**AC-8 (telemetry contract test — pre-mortem mitigation):** Given a synthetic
test that runs `evals/cli.ts` against a mock adapter producing
`tokens: { in: 100, out: 50 }`, When cost-attribution output is asserted, Then
the test reads token counts via the unified field path AND fails if the
adapter returns the old `providerCost.tokensIn` path. This catches silent
shape lossage per FEAT-184 triage pre-mortem item (3).

## Out of scope

- Provider moves into gepa-core — FEAT-185.
- Cost-aggregation policy across pipelines — FEAT-186.
- gepa-core AC-8 contract test (lives in gepa-core repo) — separate ticket
  there.
- gepa-core npm publish ceremony — separate ticket in gepa-core repo.

## Risks

- **gepa-core not on npmjs at slice start.** Mitigation: open paired PRs;
  flip `file:../gepa-core` → `^0.2.0` once publish lands, OR publish first
  (see "Pre-flight" below).
- **AC-3 drift gate trips on borderline LLM judge from rubric wrap.**
  Mitigation: AC-4 forbids sentence-splitting; if drift trips, investigate
  prompt token sequence before relaxing band.
- **claude-p `tokens` omission flagged by AC-8 cost-attribution test.**
  Mitigation: AC-8 asserts shape when present; claude-p path skipped with
  documented reason.
- **CHANGELOG bump in dev-team.** Add MINOR entry: "evals: adopt
  @astragenie/gepa-core LLMJudge; JudgeProvider deprecated."

## Pre-flight (before starting)

1. Confirm `@astragenie/gepa-core@0.2.1` resolves via `npm view`
   (published 2026-06-29). v0.2.0 is permanently unusable on npmjs
   (unpublish lockout); never target `^0.2.0`.
2. Re-grep `evals/lib/judge.ts` consumers in dev-team to confirm only the
   files listed in `touches_files` need edits.
