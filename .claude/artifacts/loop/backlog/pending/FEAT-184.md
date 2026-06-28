---
id: FEAT-184
status: pending
priority: P1
category: refactor
target_release: null
created: 2026-06-28
revised: 2026-06-28
depends_on: [FEAT-167, FEAT-169, FEAT-183]
slices: []
derived_from: null
autonomous_safe: false
tags: [evals, gepa, judge, interface-alignment, pre-extraction]
---

# FEAT-184: Unify judge interface — adopt LLMJudge across evals/ + gepa-core

## Description

Two parallel pluggable-judge systems exist today and will drift permanently when GEPA S3 (`/crew:gepa-eval`, SLICE-98) ships its second judge call site. This FEAT is the pre-S3 scope-lock that aligns both onto one interface.

### Actual current interfaces (cited verbatim against source)

**`evals/lib/judge.ts`** (dev-team repo, shipped v0.39.0):

```ts
interface JudgeProvider {
  id: string;
  judge(req: JudgeRequest): Promise<JudgeResult>;
}
interface JudgeRequest {
  rubric: string;
  candidateOutput: string;
  context?: { fixture?: string; promptId?: string; version?: string };
}
interface JudgeResult {
  pass: boolean;
  score: number;                                       // 0..1
  rationale: string;
  raw: unknown;
  providerCost?: { usd?: number; tokensIn: number; tokensOut: number };
}
```

**`@astragenie/gepa-core` LLMJudge** (per design spec line 337-352):

```ts
interface LLMJudge {
  evaluate(opts: {
    candidateOutput: unknown;
    expected: EvalCase;
    rubric: string[];                                  // criteria text shown to judge
    signal?: AbortSignal;
  }): Promise<{
    pass: boolean;
    score: number;                                     // 0..1 weighted sum of rubric subscores
    rubricScores: Record<string, number>;
    rationale: string;
    cost_usd: number;
    latency_ms: number;
  }>;
  describe(): { provider: string; model: string };     // for trial provenance
}
```

### Reconciliation table (post-merge canonical shape)

| Field | evals/ today | gepa-core today | Canonical after FEAT-184 |
|---|---|---|---|
| `pass` | yes | yes | yes |
| `score` (0..1) | yes | yes | yes |
| `rationale` | yes | yes | yes |
| `cost_usd` | nested in `providerCost.usd?` | flat | **flat `cost_usd: number`** (gepa-core wins) |
| `latency_ms` | absent | flat | **flat `latency_ms: number`** (gepa-core wins) |
| `tokens` | nested `providerCost.{tokensIn, tokensOut}` | absent | **add `tokens?: { in: number; out: number }`** — load-bearing for `evals/cli.ts` cost-attribution telemetry |
| `rubricScores` | absent | `Record<string, number>` | **`rubricScores: Record<string, number>`** (gepa-core wins) |
| `raw` | `unknown` | absent | **add `raw?: unknown`** — load-bearing for Langfuse emission (FEAT-169 SLICE-90) and debug tooling |
| Provider id | `id: string` field | `describe(): { provider, model }` method | **`describe()`** (gepa-core wins) — every adapter implements |
| `expected: EvalCase` | absent | yes | yes (gepa-core wins — `rubricScorer` needs it) |
| `signal: AbortSignal` | absent | yes | yes (gepa-core wins — orphan-judge prevention) |
| Rubric shape | `string` | `string[]` | `string[]` — **with degenerate single-element wrap migration for shipped specs** (see AC-4) |
| `JudgeRequest.context` | `{ fixture?, promptId?, version? }` | absent | **add `context?: { fixture?, promptId?, version? }`** to evaluate opts — load-bearing for Langfuse emission |

## Options Considered

### Option 1 (chosen): Adopt LLMJudge as canonical, extend with missing fields

Adopt the gepa-core `LLMJudge` interface as the canonical shape across both repos. Extend it with three missing fields that `evals/` depends on today: `tokens?: { in, out }`, `raw?: unknown`, and `context?: {...}` on the input opts. dev-team `evals/lib/judge.ts` re-exports from gepa-core; adapters in `evals/providers/*` implement the extended shape.

**Why chosen:** preserves the gepa-side investment (structured rubric, `expected`, `signal`, `rubricScores`, `describe()`) that resolves spec constraints C1 (inspector grades inspector) and C4 (continuous-gradient feedback). Avoids forcing the GEPA `rubricScorer` to invent a side-channel for `expected`. Single canonical interface lives in the library that already publishes it.

### Option 2 (rejected): Adopt JudgeProvider as canonical

dev-team's `JudgeProvider` is simpler and battle-tested in 2 shipped specs. gepa-core could adopt it instead.

**Why rejected:** loses `expected: EvalCase` (forces `rubricScorer` to invent a side channel for the case under judgement), loses `signal: AbortSignal` (orphan judge calls when GEPA optimizer kills a cycle mid-stream), loses `rubricScores` (kills continuous-gradient feedback that resolves spec constraint C4), loses `describe()` for trial provenance. Net: spec-violating, requires gepa-core MAJOR bump to remove already-published methods.

### Option 3 (rejected): Build a third superset interface

A new `UnifiedJudge` interface in a third location (e.g. `@astragenie/judge-contract`) that both `evals/` and gepa-core consume.

**Why rejected:** extraction criteria from `loop-snapshot.md` not met (≥2 external consumers, interface stable 2 months). gepa-core is the only judge-consuming library today; eval framework imports through gepa-core would be the second consumer — that's not 2 *external* consumers. Premature extraction freezes wrong abstractions. Also: adds a third repo to the cross-repo release dance for zero behavioral benefit.

### Option 4 (rejected): Do nothing, ship S3 with a translation adapter

Ship `/crew:gepa-eval` against the current divergent interfaces; bridge with an adapter inside dev-team that translates `LLMJudge → JudgeProvider` per call.

**Why rejected:** the adapter becomes load-bearing. Every cost-accounting bug, every Langfuse emission, every trial-provenance check has to thread through the translation layer. Two-interface mental model permanent. Cost-asymmetry calculation: ~1 day adapter author + 2 weeks of cumulative bug fixes per quarter vs. 2-3 days unification now.

## Motivation

- S3 (`/crew:gepa-eval`) is the next slice in the GEPA roadmap (per `loop-snapshot.md`: "S3 (eval + /crew:gepa-eval for fullstack-dev)"). It will instantiate judges from `gepa.config.json` — a second call site for the same providers.
- If S3 ships against the current `LLMJudge`, we have two judge contracts in two repos. Cost-accounting will diverge; rubric semantics will diverge; abort/timeout handling will diverge.
- Refactor cost now: **~2-3 days realistic** (revised from initial "1 day" estimate after architect-reviewer found cost-shape reconciliation is bidirectional, not one-way port; rubric `string → string[]` migration touches 2 shipped specs; cross-repo gepa-core publish + npm bump). Architect-reviewer confidence: **low** on 1-day estimate, **medium** on 2-3 days.
- Refactor cost post-S3: ~2 weeks + behavior-drift bugs + dual provider auth maintenance + permanent two-interface mental model.
- Spec line 128 commits to strict semver on `LLMJudge`. Locking the shape before S3 ships means the v1.0.0 cut is the right one.

## Acceptance criteria

- **AC-1:** `@astragenie/gepa-core` exports `LLMJudge` with the canonical fields from the reconciliation table above: `candidateOutput`, `expected`, `rubric: string[]`, `signal?: AbortSignal`, `context?: {...}` on input opts; `pass`, `score`, `rubricScores`, `rationale`, `cost_usd`, `latency_ms`, `tokens?: { in, out }`, `raw?: unknown` on result; `describe()` method on the adapter class.
- **AC-2:** `evals/lib/judge.ts` re-exports `LLMJudge` from gepa-core; the old `JudgeProvider` type is a `@deprecated` alias that maps to `LLMJudge` for one minor version. Removed in the next MAJOR.
- **AC-3:** All 7 existing `evals/providers/*` adapters compile against the unified interface AND implement `describe(): { provider, model }`. Each adapter test asserts the `describe()` output matches expected `{provider, model}`.
- **AC-4 (statistical drift, not exact match):** For each of the 2 shipped specs (`crew-fullstack-dev.yaml`, `crew-inspector.yaml`):
  - **Deterministic providers** (ollama at `temperature: 0`, fixture-only replays): exact-match assertion on score + token counts.
  - **Nondeterministic providers** (claude-p, groq, gemini, azure, bedrock): run N≥5 pre- and post-refactor; require (a) PASS/FAIL verdict identical per test, (b) mean score within ±0.05, (c) mean token counts within ±5%. Drift outside band fails the AC.
- **AC-5 (rubric `string → string[]` migration):** The 2 shipped specs today carry `rubric:` as a prose string. The adapter MUST wrap-in-single-element (`[oneString]`) — sentence-splitting is forbidden because it changes the prompt token sequence enough to flip borderline cases. The unified interface MUST accept single-element arrays as a degenerate case forever (documented in CHANGELOG and interface JSDoc).
- **AC-6 (`JudgeRequest.context` mapping):** `evals/cli.ts` and `evals/lib/run-eval.ts` currently pass `{ fixture, promptId, version }` to judges and forward to Langfuse (FEAT-169 SLICE-90). The unified interface MUST carry these through `evaluate(opts.context)` — dropping them is a regression on observability.
- **AC-7 (semver decision, explicit):** This change is **MAJOR** for gepa-core (v0.1 → v1.0 or v0.x → v0.y per pre-1.0 convention). Rationale: adding required fields to the LLMJudge result type that user-implemented judges must produce is breaking. Documented in CHANGELOG.md with migration guide for any external implementers (audit confirms there are none today — see AC-9).
- **AC-8 (consumer-facing contract test):** A single mock judge satisfies both `evals/run-eval.ts` and a synthetic gepa-core `rubricScorer` call. Test lives in gepa-core repo to prove the contract is genuinely shared.
- **AC-9 (external-consumer audit):** Grep confirms only in-repo callers of `evals/lib/judge.ts` (`evals/providers/*`, `evals/lib/run-eval.ts`, `evals/README.md`). Audit logged in the slice handoff. If external consumers found, FEAT-184 grows a migration-guide AC.
- **AC-10 (README update):** `evals/README.md` lines 49-62 currently document `JudgeProvider` as the external-author API. Rewrite to point at `LLMJudge` (or to deprecation note + migration link).

## Out of scope (deferred)

- Moving providers into gepa-core — FEAT-185.
- Full eval framework extraction (cli.ts, run-eval.ts, langfuse-emit.ts → gepa-core) — deferred until extraction criteria met (`loop-snapshot.md`: ≥2 external authors, ≥5 third-party specs, interface stable 2 months).
- Cost-aggregation policy across the two pipelines — **FEAT-186** (spun out per architect-reviewer FEAT-185 finding).
- `validate_with` chain (judge disagreement → escalation) interface changes — already covered by `LLMJudge` shape, no migration needed.

## Dependencies

- FEAT-167 (eval framework B1) — shipped.
- FEAT-169 (eval framework B2/B3) — shipped except SLICE-91.
- FEAT-183 (GEPA umbrella) — S2 shipped (PR #124), S3 not yet started.

**Blocks SLICE-98 (GEPA S3).** This refactor MUST land before `/crew:gepa-eval` ships, or we double the migration cost.

## Risks

- **Risk: cross-repo coordination.** gepa-core lives in its own repo. Order: gepa-core PR first (publish vN+1), then dev-team PR (bump dep, adapt `evals/`). Mitigation: ship gepa-core publish + dev-team bump as paired PRs reviewed together.
- **Risk: rubric `string → string[]` semantic drift.** Mitigation: AC-5 forbids sentence-splitting; AC-4 statistical-drift gate catches anything else.
- **Risk: `describe()` method on 7 existing adapters = 7 file edits.** Mitigation: trivial implementation (`describe = () => ({ provider: "groq", model: this.model })`). Architect-reviewer flagged this; included in AC-3.
- **Risk: cost-shape lossiness on `tokens` field.** Without explicit preservation, evals/cli.ts cost-attribution telemetry breaks silently. Mitigation: AC-1 lists `tokens?: { in, out }` as required canonical field.
- **Risk: scope creep into FEAT-185.** Each AC must stay interface-only. Provider moves belong in FEAT-185. Reviewer will reject scope crossing.

## Architect-reviewer feedback addressed (2026-06-28)

Initial FEAT had: missing Options Considered section (auto-reject), factually wrong interface comparison table (claimed gepa-core had no `rationale`/`providerCost` — actually has `rationale`/`cost_usd`/`latency_ms`/`rubricScores`/`describe()`), untestable AC-4 (LLM nondeterminism), missing ACs for rubric migration + `describe()` + token preservation + `context` mapping + README update, ambiguous semver decision.

Revisions applied: added Options Considered with 4 options + per-option Why rejected; rewrote interface comparison against actual spec line 337-352; reworded AC-4 with deterministic vs nondeterministic split + statistical bounds; added AC-5/6/9/10; promoted semver decision from "depends" to explicit MAJOR with rationale; spun cost-aggregation out into FEAT-186; revised cost estimate 1 day → 2-3 days.
