---
id: SLICE-109
parent: FEAT-185
status: done
priority: P2
created: 2026-06-30
title: "FEAT-185 SLICE-B (revised) — relocate AzureOpenAIJudge to gepa-core 0.5.0; CI matrix extends to 30 cells"
stack: typescript
autonomous_safe: false
est_days: 1.5
depends_on: [FEAT-184, FEAT-185-SLICE-A]
touches_files:
  - gepa-core/src/providers/azure/index.ts
  - gepa-core/src/providers/index.ts
  - gepa-core/src/index.ts
  - gepa-core/package.json
  - gepa-core/CHANGELOG.md
  - gepa-core/tests/providers/azure.test.ts
  - gepa-core/.github/workflows/ci.yml
  - evals/providers/azure-openai.ts
  - evals/lib/judge.ts
  - package.json
---

# SLICE-109: FEAT-185 SLICE-B (revised) — AzureOpenAIJudge relocation to gepa-core

## Source

Created 2026-06-30 from operator Q2 decision in `docs/superpowers/specs/2026-06-30-feat-183-wave-plan.md`:
- FEAT-185 SLICE-B originally bundled `azure + bedrock`. Operator Q2 awarded azure relocation ownership to this slice (vs. FEAT-183 wave-plan SLICE-101 which now drops azure).
- Operator Q3 dropped bedrock entirely until proven needed. SLICE-109 therefore covers azure ONLY.

## Scope

Relocate `AzureOpenAIJudge` from `evals/providers/azure-openai.ts` (dev-team) into `@astragenie/gepa-core` as `src/providers/azure/index.ts` following the same pattern as gepa-core 0.3.0 providers (ollama, generic-openai, groq, gemini):

- Implement `LLMJudge` interface (already shipped in gepa-core 0.2.0 via FEAT-184).
- Typed config object in constructor (`AzureConfig` with `endpoint`, `deployment`, `apiVersion`).
- Zero `process.env` reads — env reads stay in consumer shim layer (enforced by gepa-core `scripts/check-no-env.ts`).
- Native `fetch` — no npm runtime dependencies beyond gepa-core itself.
- Update `gepa-core/package.json` exports map: add `./providers/azure` entry point.
- Add `tests/providers/azure.test.ts` mock-fetch suite (matches groq/gemini test patterns).
- Extend gepa-core CI matrix from 24 cells (3 OS × 2 SDK × 4 providers) to 30 cells (+azure = 5 providers).
- Cut gepa-core 0.5.0 MINOR (additive; no breaking changes to existing exports).
- Update dev-team `evals/providers/azure-openai.ts` to re-export from gepa-core (thin shim — same pattern as FEAT-184 / FEAT-185 SLICE-A did for ollama/generic-openai/groq/gemini).
- Bump dev-team `package.json` dep on `@astragenie/gepa-core` to `^0.5.0`.

## Acceptance criteria

AC-1: `import { AzureOpenAIJudge } from "@astragenie/gepa-core/providers/azure"` resolves and constructs without error against a typed `AzureConfig` argument.

AC-2: `new AzureOpenAIJudge(config).describe()` returns `{ provider: "azure-openai", model: <deployment-name> }` matching the `describe()` shape FEAT-184 AC-3 introduced.

AC-3: `evaluate(prompt, rubric)` POSTs to `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}` with the rubric-derived messages array and returns `{ score, rationale, cost?, latency_ms }` matching the `LLMJudge` contract.

AC-4: `scripts/check-no-env.ts` passes — no `process.env` reads in `src/providers/azure/`.

AC-5: `bun test tests/providers/azure.test.ts` green; mock-fetch covers happy path + 429 retry + auth-failure surface.

AC-6: gepa-core CI matrix extends to 30 cells (3 OS × 2 SDK × 5 providers); green on `main`.

AC-7: gepa-core CHANGELOG.md documents 0.5.0 as MINOR with the new entry point + naming-rationale note. ALSO retracts the stale forward statement about "36 cells when azure + bedrock added" — bedrock dropped per Q3 (2026-06-30 decision).

AC-8: dev-team `evals/providers/azure-openai.ts` becomes a thin re-export of `AzureOpenAIJudge` from `@astragenie/gepa-core/providers/azure`; existing eval runs against azure judges continue to pass (no behavior change for callers).

AC-9: dev-team `package.json` updated to `"@astragenie/gepa-core": "^0.5.0"`; `bun install && bun test` green.

## Risks

- Endpoint URL shape diverges between Azure OpenAI vs. standard OpenAI — covered by typed config + explicit URL builder in test.
- Some consumers may have set `AZURE_OPENAI_ENDPOINT` env var pattern; relocation moves env-reads into the consumer shim. Validate shim still resolves the env-var the same way.
- Bedrock-drop second-order effect (per architect-reviewer N3-v3): AWS-shop consumers who assumed bedrock was on roadmap need a CHANGELOG note. Covered in AC-7.

## Out of scope

- Bedrock judge (Q3 deferred until proven needed).
- claude-p judge (intentionally stays in dev-team per gepa-core 0.3.0 AC-9 callout).
- Per-agent judge_per_agent config switch (lives in FEAT-183 wave-plan SLICE-101).

## Dispatch order

Wave-plan calls this part of WAVE 1 (alongside SLICE-100 + SLICE-101). Recommended merge order: SLICE-100 (0.4.0) → SLICE-101 (0.5.0 OR fold both into 0.5.0) → SLICE-109 (0.5.0 if folded, else separate MINOR). Operator picks bundling at WAVE 1 launch.
