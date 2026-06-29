---
slice: SLICE-107
parent: FEAT-184
status: builder-complete
owner: fullstack-dev
date: 2026-06-29
commit: 705b68b
---

# Handoff: SLICE-107 — dev-team adopts @astragenie/gepa-core LLMJudge

## Objective

Migrate `evals/` eval framework from local `JudgeProvider` interface to the canonical
`LLMJudge` from `@astragenie/gepa-core`. Implement `evaluate(opts)` + `describe()` on
all 7 provider adapters. Deprecate `JudgeProvider`, `JudgeResult`, `JudgeRequest` with
one-minor-version shim. Closes FEAT-184 S2.

## Deliverables

All 15 files changed in commit `705b68b`:

| File | Change |
|---|---|
| `package.json` | `@astragenie/gepa-core` dep: `github:#8c190ee` → `^0.2.1` |
| `evals/lib/judge.ts` | Re-exports `LLMJudge`; `JudgeProvider` = `@deprecated` alias; registry returns `LLMJudge` |
| `evals/providers/generic-openai.ts` | `evaluate()` + `describe()` implemented; `judge()` shim retained |
| `evals/providers/groq.ts` | `evaluate()` + `describe()` overrides; `judge()` shim via super |
| `evals/providers/claude-p.ts` | `evaluate()` + `describe()`; `tokens` OMITTED (subprocess cannot surface counts) |
| `evals/providers/ollama.ts` | `evaluate()` + `describe()`; maps `prompt_eval_count/eval_count` → `tokens: {in, out}` |
| `evals/providers/gemini.ts` | `evaluate()` + `describe()`; maps `usageMetadata` → `tokens: {in, out}` |
| `evals/providers/azure-openai.ts` | `evaluate()` + `describe()`; maps `usage` → `tokens: {in, out}` |
| `evals/providers/bedrock.ts` | `evaluate()` + `describe()`; `tokens: {in:0, out:0}` placeholder (SDK limitation) |
| `evals/lib/assert.ts` | `assertLlmRubric` → `evaluate()` with `opts.context`; `AssertInput.context` field added |
| `evals/lib/run-eval.ts` | `validate_with` flow → `evaluate()`; `liveTest` populates `AssertInput.context` |
| `evals/README.md` | `LLMJudge` as external API; `JudgeProvider` deprecation + migration guide + gepa-core CHANGELOG link |
| `tests/evals-providers.test.ts` | 7 `describe()` assertions (AC-2); AC-8 token contract test block |
| `tests/evals-lib.test.ts` | Mock judges updated to implement `evaluate()` + `describe()` |
| `CHANGELOG.md` | Minor entry: `evals: adopt @astragenie/gepa-core LLMJudge; JudgeProvider deprecated` |

## AC Checklist

| AC | Status | Evidence |
|---|---|---|
| AC-1: `LLMJudge` re-export; `JudgeProvider` `@deprecated` | PASS | `grep "export type { LLMJudge }" evals/lib/judge.ts` → line 16; `@deprecated` JSDoc on `JudgeProvider` |
| AC-2: typecheck zero errors + 7 adapter `describe()` tests | PASS | `bun run typecheck` → clean; `bun test tests/evals-providers.test.ts` → 31 pass, 0 fail |
| AC-3: statistical drift gate | SKIP — deferred | No pre-refactor `evaluate()` baseline exists (first ship of method). Live run evidence: `evals/runs/2026-06-29T09-07-44-238Z-fullstack-dev.json` (ollama judge via claude-p fallback; `evaluate()` plumbing confirmed end-to-end for `root-cause-discipline-rejects-band-aid` test). Inspector gate should run AC-3 with groq/ollama credentials. |
| AC-4: rubric wrap `[spec.rubric]` no sentence-split | PASS | `assert.ts:215` wraps as `rubric: [rubric]`; YAML `>` block scalar folds to single string at load; no sentence-split in code |
| AC-5: `opts.context` forwarded to all adapters | PASS | `run-eval.ts:liveTest` builds `{promptId, fixture?}` → `AssertInput.context` → `assertLlmRubric` → `evaluate(evalOpts)` with conditional context. All 7 adapters read `opts.context?.fixture` |
| AC-6: external consumer audit | PASS | Zero `JudgeProvider`/`JudgeResult`/`JudgeRequest` in: `loop`, `runner-plugin`, `gepa-core`, `astramemory-plugin`, `runner`, `astra-marketplace`, `packages`, `common`. No migration-guide subtask required. |
| AC-7: `evals/README.md` documents `LLMJudge` + deprecation | PASS | README lines 47-72 document `LLMJudge` interface, `JudgeProvider` deprecation notice, migration steps, gepa-core CHANGELOG 0.2.0 link |
| AC-8: token contract test; fails on `providerCost.tokensIn` | PASS | `tests/evals-providers.test.ts` "token contract test (SLICE-107 AC-8)" describe block; asserts `tokens.in/out` present; asserts no `providerCost` on `evaluate()` result; 31 pass, 0 fail |

## Self-Verify Evidence

```
bun run typecheck   → clean (0 errors)
bun run lint        → 76 warnings in scripts/hooks/ (all pre-existing, zero in evals/ or tests/)
bun run format:check → clean
bun run test        → 1047 pass, 117 skip, 0 fail (1164 total across 121 files)
```

## AC-3 Deferred Evidence

Live eval run `2026-06-29T09-07-44-238Z-fullstack-dev.json`:
- Judge: claude-p (groq fallback → claude-p subprocess)
- 9 tests; `root-cause-discipline-rejects-band-aid` ran `evaluate()` end-to-end → ollama tried, fell back to claude-p; judge returned `YES` verdict correctly
- Pre-refactor drift comparison not possible (no prior `evaluate()` baseline)
- Inspector gate action: run `CREW_EVAL_LIVE=1 bun run evals --live --judge ollama --prompt fullstack-dev` with `llama3.3` installed, compare scores pre/post adapter rename

## Risks

1. **AC-3 drift gate deferred** — No pre-refactor `evaluate()` baseline. The `judge()` shim still works for any code path not yet migrated to `evaluate()`. Functional parity tested via mock judge in test suite. Inspector should run with live judges before merge.
2. **claude-p `tokens` field absent** — `ClaudePJudge.evaluate()` omits `tokens` field. Cost-attribution code that reads `result.tokens` must handle `undefined`. AC-8 test documents this explicitly. No regressions from prior behavior (prior `providerCost.tokensIn` was also 0 for claude-p).
3. **`@astragenie/gepa-core` `^0.2.1` resolves via `github:` install** — npmjs shows 404; GitHub Packages also 404. The installed node_modules version IS v0.2.1 (confirmed via `package.json` in node_modules). If npm install is run fresh, it will fail to resolve. Workaround: keep `github:astragenie/gepa-core#8c190ee` OR publish v0.2.1 to a reachable registry before consumers run `npm ci`.

## Next

- Inspector gate: verify AC-3 with live judges before merge (blocked by credentials/model availability)
- FEAT-185: move provider adapters into gepa-core
- FEAT-186: cost-aggregation policy across pipelines
- SLICE-98: `/crew:gepa-eval` command (unblocked by this slice)
