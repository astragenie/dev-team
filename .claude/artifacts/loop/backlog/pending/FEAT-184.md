---
id: FEAT-184
status: pending
priority: P1
category: refactor
target_release: null
created: 2026-06-28
depends_on: [FEAT-167, FEAT-169, FEAT-183]
slices: []
derived_from: null
autonomous_safe: false
tags: [evals, gepa, judge, interface-alignment, pre-extraction]
---

# FEAT-184: Unify judge interface — adopt LLMJudge across evals/ + gepa-core

## Description

Two parallel pluggable-judge systems exist today and will drift the moment GEPA S3 (`/crew:gepa-eval`, SLICE-98) lands a second judge call site:

| | evals/lib/judge.ts | gepa-core LLMJudge |
|---|---|---|
| Interface | `JudgeProvider.judge(req: JudgeRequest): Promise<JudgeResult>` | `LLMJudge.evaluate({ candidateOutput, expected, rubric, signal })` |
| Rubric shape | `string` | `string[]` (structured criteria) |
| Has `expected: EvalCase` | no | yes |
| Has `signal: AbortSignal` | no | yes |
| Has `providerCost` + `rationale` | yes (`providerCost.usd / tokensIn / tokensOut`) | no (gap in spec) |
| Location | dev-team repo | astragenie/gepa-core@5a13eaa |

Pick `LLMJudge` as the canonical shape (richer: structured rubric, abort signal, expected case), add `providerCost` + `rationale` fields to it (port from `evals/`), then adapt `evals/lib/judge.ts` to consume the unified shape.

This is a **pure refactor** — no provider moves yet (those land in FEAT-185), no new behavior. The goal is to lock the interface before the second consumer ships.

## Motivation

- S3 (`/crew:gepa-eval`) is the next slice in the GEPA roadmap (per `loop-snapshot.md` line "S3 (eval + /crew:gepa-eval for fullstack-dev)"). It will instantiate judges from `gepa.config.json` — a second call site for the same providers.
- If S3 ships against the current `LLMJudge` interface, we have two judge contracts in two repos. Cost-accounting will diverge; rubric semantics will diverge; abort/timeout handling will diverge.
- Refactor cost now: ~1 day (interface alignment + adapter shim in `evals/lib/judge.ts`).
- Refactor cost post-S3: ~2 weeks + behavior-drift bugs + dual provider auth maintenance.
- Spec line 128 (`docs/superpowers/specs/2026-06-27-gepa-skill-improvement-loop-design.md`) already commits to strict semver on `LLMJudge`. Locking the shape before S3 ships means the v1.0.0 cut is the right one.

## Acceptance criteria

- AC-1: `@astragenie/gepa-core` exports `LLMJudge` with fields: `candidateOutput`, `expected`, `rubric: string[]`, `signal?: AbortSignal`. Result shape includes `pass`, `score`, `rationale`, `providerCost?: { usd?, tokensIn, tokensOut }`, `raw`.
- AC-2: `evals/lib/judge.ts` re-exports `LLMJudge` from gepa-core; the old `JudgeProvider` type is a deprecated alias.
- AC-3: All 7 existing `evals/providers/*` adapters compile and pass their current tests against the unified interface.
- AC-4: Both shipped specs (`crew-fullstack-dev.yaml`, `crew-inspector.yaml`) still produce identical eval scores to the pre-refactor baseline (snapshot diff: zero score drift).
- AC-5: gepa-core CHANGELOG records the interface bump. Version reflects semver impact (MINOR for additive fields if backwards compat preserved, MAJOR otherwise).
- AC-6: New consumer-facing test: a single mock judge satisfies both `evals/` and a synthetic gepa-core `rubricScorer` call — proves contract is genuinely shared.

## Out of scope (deferred)

- Moving providers into gepa-core — FEAT-185.
- Full eval framework extraction (cli.ts, run-eval.ts, langfuse-emit.ts → gepa-core) — deferred until extraction criteria met (`loop-snapshot.md`: ≥2 external authors, ≥5 third-party specs, interface stable 2 months).
- Provider cost-aggregation policy across the two pipelines — FEAT-186 if needed.

## Dependencies

- FEAT-167 (eval framework B1) — shipped.
- FEAT-169 (eval framework B2/B3) — shipped except SLICE-91.
- FEAT-183 (GEPA umbrella) — S2 shipped (PR #124), S3 not yet started.

**Blocks SLICE-98 (GEPA S3).** This refactor must land before `/crew:gepa-eval` ships, or we double the migration cost.

## Risks

- Risk: cross-repo coordination — gepa-core lives in its own repo. Order: gepa-core PR first (publish vN+1), then dev-team PR (bump dep, adapt `evals/`).
- Risk: hidden eval-score drift from rubric `string → string[]` semantics change. Mitigation: AC-4 snapshot-diff gate.
- Risk: provider-cost field name collision (`providerCost` vs upstream SDK conventions). Mitigation: pick names matching `evals/lib/judge.ts` since those are battle-tested in 2 shipped specs.
