---
id: SLICE-101
parent: FEAT-183
status: triaged
priority: P1
created: 2026-06-27
title: "FEAT-183 S5b — azureOpenAIJudge + geminiJudge + per-agent judge_per_agent config switch + per-agent rubric.md loader"
stack: typescript + markdown
autonomous_safe: false
est_days: 2
depends_on: [SLICE-100]
touches_files:
  - gepa-core/src/judges/azure-openai-judge.ts
  - gepa-core/src/judges/gemini-judge.ts
  - gepa-core/src/judges/resolve-judge.ts
  - gepa-core/src/judges/redact-rationale.ts
  - gepa-core/src/index.ts
  - gepa-core/package.json
  - gepa-core/CHANGELOG.md
  - gepa-core/tests/azure-openai-judge.test.ts
  - gepa-core/tests/gemini-judge.test.ts
  - gepa-core/tests/resolve-judge.test.ts
  - gepa-core/tests/redact-rationale.test.ts
  - scripts/lib/gepa/load-rubric.ts
  - scripts/lib/gepa/eval-runner.ts
  - agents/fullstack-dev/.gepa/rubric.md
  - tests/gepa/per-agent-judge.test.ts
  - tests/gepa/rubric-loader.test.ts
---

# SLICE-101: FEAT-183 S5b — Azure + Gemini judges + per-agent config + rubric.md loader

## Scope

Land cloud judge adapters and per-agent judge routing:

- `gepa-core/src/judges/azure-openai-judge.ts` — separate entry point `@astragenie/gepa-core/judges/azure`, peer-dep on `@azure/openai`. Supports both API-key auth and `DefaultAzureCredential` via Entra ID. Translates `LLMJudge.evaluate()` calls into Azure OpenAI Chat Completions API with a structured-output JSON schema response. Reports actual `cost_usd` from token usage × Azure pricing (consumer plugin supplies pricing via opts).
- `gepa-core/src/judges/gemini-judge.ts` — separate entry point `@astragenie/gepa-core/judges/gemini`, peer-dep on `@google/generative-ai`. Free-tier quota limits surfaced as clean errors.
- `gepa-core/src/judges/resolve-judge.ts` — exported helper `resolveJudge(config: GepaConfig, agent: string): LLMJudge`. Implements precedence rule: if agent appears in `config.judge_per_agent`, that block fully overrides global `config.judge` (no field-level merge per design spec line 462). This is the only sanctioned construction path. Throws `JudgeConfigError` if the per-agent provider's peer dep is absent at runtime.
- `gepa-core/src/judges/redact-rationale.ts` — exported `redactRationale(s: string): string` that scrubs common secret patterns (API keys, bearer tokens, AWS keys, GitHub tokens) before persisting judge rationale to disk. Default regex set sourced from astragenie/standards (per design line 838).
- `scripts/lib/gepa/load-rubric.ts` (crew) — reads `agents/<name>/.gepa/rubric.md` (per-agent rubric criteria, one per markdown bullet `- criterion-name: description`). Returns `string[]` rubric criteria for `rubricScorer`.
- `scripts/lib/gepa/eval-runner.ts` (crew, updated) — replaces `binaryScorer` default with `rubricScorer(resolveJudge(config, agent))`. Loads rubric via `load-rubric.ts`. Applies `redactRationale` to all rationale strings before persisting via `TrialStore.put()`.
- Sample `agents/fullstack-dev/.gepa/rubric.md` with 5–7 criteria covering bundle size, identity anchor, SPLIT_BUILD signal, scope discipline, skill budget.

## Acceptance criteria

AC-1: Given `@azure/openai` peer dep is installed and `azureOpenAIJudge({ deployment: "gpt-4o", endpoint: "https://x.openai.azure.com", apiKey: "test" })` is constructed, When `evaluate({ candidateOutput, expected, rubric })` runs against a mocked Azure SDK, Then the returned `ScoreResult`-compatible object has `pass`, `score in [0,1]`, `rubricScores` matching the rubric keys, `cost_usd > 0` (computed from token usage), and `latency_ms > 0`.

AC-2: Given `azureOpenAIJudge({ ..., useEntraId: true })` is constructed without `apiKey`, When `evaluate()` is called against a mocked `DefaultAzureCredential`, Then the SDK is initialized with token-credential auth (no API key in request headers), and a bad deployment name triggers a clean `judge_misconfigured` error (not a stack trace).

AC-3: Given `@azure/openai` peer dep is NOT installed and `import("@astragenie/gepa-core/judges/azure")` is attempted, When the import resolves, Then a clean install-instruction error is thrown naming `@azure/openai` as the missing peer dep (per design spec invariant line 126), not a generic `Cannot find module` stack.

AC-4: Given `geminiJudge({ model: "gemini-1.5-flash", apiKey: "test" })` is constructed against a mocked `@google/generative-ai` SDK returning a valid JSON response, When `evaluate()` runs, Then `cost_usd: 0` (free tier) is reported and the rubric subscores propagate correctly; given the mock SDK returns a 429 quota error, the judge surfaces `judge_quota_exceeded` and the caller halts cleanly with `partial: true`.

AC-5: Given `gepa.config.json` with global `judge: { provider: "ollama", model: "llama3.2:latest" }` and `judge_per_agent: { architect: { provider: "azure-openai", deployment: "gpt-4o", endpoint: "...", api_key_env: "AZURE_OPENAI_KEY" } }`, When `resolveJudge(config, "fullstack-dev")` is called, Then the returned judge's `describe()` is `{ provider: "ollama", model: "llama3.2:latest" }`; When `resolveJudge(config, "architect")` is called, the returned judge's `describe()` is `{ provider: "azure-openai", model: "gpt-4o" }` (full override, no merge).

AC-6: Given `gepa.config.json` with `judge_per_agent: { inspector: { provider: "gemini", model: "gemini-1.5-flash", api_key_env: "GEMINI_KEY" } }` and the env var `GEMINI_KEY` is unset at runtime, When `resolveJudge(config, "inspector")` is called, Then a `JudgeConfigError` is thrown naming the missing env var, and no judge call is attempted.

AC-7: Given an `EvalCase.rubric` provided via `agents/fullstack-dev/.gepa/rubric.md` containing 5 criteria as markdown bullets, When `loadRubric("fullstack-dev")` runs, Then it returns an array of exactly 5 strings, each matching the bullet's `criterion-name: description` format. Given the rubric file is absent, an error is thrown directing the operator to author the rubric — eval halts cleanly.

AC-8: Given a judge rationale string contains `Bearer sk-proj-AbCd1234EfGh5678IjKl9012...` (OpenAI-style key), When `redactRationale(s)` is applied, Then the returned string contains `***` in place of the key (preserving surrounding context), and the original string is NOT persisted to disk by the eval runner.

AC-9: Given `/crew:gepa-eval architect` runs with `judge_per_agent.architect = azure-openai`, When the eval completes successfully, Then the written `.claude/artifacts/crew/gepa/eval/<run-id>.json` includes a `judge: { provider: "azure-openai", model: "gpt-4o" }` field for provenance, and each trial row's rationale has been passed through `redactRationale` before persist.

AC-10: Given `gepa-core` is bumped to v0.3.0 introducing `judge_per_agent` resolution and two new judge entry points (additive), When `scripts/check-semver.ts` runs against v0.2.0, Then the change is identified as MINOR (additive); `CHANGELOG.md` is updated with `## [0.3.0]` listing the additions.

## Dependencies

- SLICE-100 (LLMJudge interface + ollamaJudge + rubricScorer): required for adapter pattern and per-agent resolution.
- Implicit: the `redactRationale` regex set sourced from astragenie/standards must be bundled or vendored — declare as embedded constant in the library (no runtime dep on the standards repo).

## Risks

- Cross-judge score comparability is the open product call (design spec line 923). If any agent on the auto-merge allowlist (`fullstack-dev`, `backend-dev`, `frontend-dev`) ends up routed to a different judge than its champion-comparison baseline, scores are not strictly comparable. **Hard block**: resolve calibration approach before this slice ships if such a mismatch exists in the operator's `gepa.config.json`.
- Azure peer-dep error path must NOT crash the whole CLI when other unrelated commands run — use dynamic import boundary.
- `redactRationale` regex set is a moving target — vendor a fixed snapshot; add new patterns in S5c+ if redaction misses observed in eval artifacts.
- Gemini free tier 429 quota errors are common — surface as `judge_quota_exceeded`, not generic `judge_unreachable`, so observability events are precise.
- Per-agent config precedence rule (full override, not merge) must be enforced ONLY through `resolveJudge` — direct construction of judges in scorer wiring would bypass the rule. Document in slice's run-brief.

## References

- Design spec "Library API surface → Top-level functions → Built-in LLMJudge" (lines 437–449).
- Design spec "Library API surface → Shape rationale → `judge_per_agent` precedence rule" (line 462).
- Design spec "Implementation notes → S5b — judges" (lines 836–838) — score normalization open call + rationale redaction.
- Design spec slice plan row S5b (line 862) — acceptance evidence: "each adapter has unit test against mocked SDK; per-agent override switches model correctly".
- Design spec "Failure modes" table rows: "Judge LLMJudge endpoint unreachable" (line 694), "Judge LLMJudge returns malformed score" (line 695).
- Design spec "Invariants → Cloud judge adapters … publish them as separate entry points" (line 126).
- Design spec "Open product calls remaining → Per-agent score normalization" (line 923).
- Design spec "Testing strategy → gepa-core tests" rows: `azureOpenAIJudge`, `geminiJudge` (lines 775–776).
