---
id: FEAT-185
status: pending
priority: P2
category: refactor
target_release: null
created: 2026-06-28
depends_on: [FEAT-184]
slices: []
derived_from: null
autonomous_safe: false
tags: [evals, gepa, providers, extraction, gepa-core]
---

# FEAT-185: Move providers to gepa-core — single source of truth for LLM adapters

## Description

After FEAT-184 unifies the judge interface, move `evals/providers/*` (7 adapters: claude-p, generic-openai, groq, gemini, ollama, azure-openai, bedrock) into `@astragenie/gepa-core` as discrete entry points:

```
@astragenie/gepa-core/providers/claude-p
@astragenie/gepa-core/providers/generic-openai
@astragenie/gepa-core/providers/groq
@astragenie/gepa-core/providers/gemini
@astragenie/gepa-core/providers/ollama
@astragenie/gepa-core/providers/azure
@astragenie/gepa-core/providers/bedrock
```

Pattern is already specified in the GEPA design (`docs/superpowers/specs/2026-06-27-gepa-skill-improvement-loop-design.md` line 126):

> Cloud judge adapters (`azureOpenAIJudge`, `geminiJudge`) are optional peer deps on their respective SDKs (`@azure/openai`, `@google/generative-ai`). Library publishes them as separate entry points: `@astragenie/gepa-core/judges/azure`, `@astragenie/gepa-core/judges/gemini`. Importing them without the SDK throws a clean install-instruction error.

dev-team's `evals/providers/` becomes thin re-export + auth-wiring shims; gepa-core owns the transport, retry, and cost-accounting logic.

## Motivation

- gepa-core is the natural home: it already imports nothing from dev-team, is pure ESM, and is the package consumer plugins install. Providers belong with the judge interface they satisfy.
- Without FEAT-185, GEPA S3 (`/crew:gepa-eval`) would either (a) re-implement 7 providers inside gepa-core or (b) reach across the repo boundary to import `evals/providers/*` from dev-team — both kill the "zero hard cross-plugin runtime deps" guarantee from the design spec (line 18).
- Per the same spec (line 126), entry-point-per-provider with peer-dep SDKs is already the chosen pattern. FEAT-185 is execution of an already-decided design, not a new architecture choice.
- Removes ~600 LOC of duplication anticipated when S3 lands. Today: ~1 day of work. Post-S3: rebuild against shipped duplication.

## Acceptance criteria

- AC-1: All 7 providers live under `@astragenie/gepa-core/providers/<name>`. Each has its own export, optional peer dep on its SDK, and a clean install-instruction error if the SDK is missing.
- AC-2: `evals/providers/*` files become thin shims: `export { groqProvider } from "@astragenie/gepa-core/providers/groq";` plus env-var resolution (auth wiring stays in dev-team).
- AC-3: Existing eval specs (`crew-fullstack-dev.yaml`, `crew-inspector.yaml`) run unchanged — provider lookup still works via the same YAML keys.
- AC-4: Snapshot-diff gate: re-run both shipped specs pre/post extraction — zero score drift, identical token counts (within rounding).
- AC-5: gepa-core ships a new MINOR version with 7 new entry points documented in CHANGELOG. Peer-dep table added to gepa-core README.
- AC-6: dev-team `package.json` bumps `@astragenie/gepa-core` dep; `evals/` test suite green; e2e smoke green.
- AC-7: Cost-aggregation works across both pipelines — a single `providerCost` shape feeds both `evals/cli.ts` output and gepa-core `Trial.score.cost_usd`.

## Out of scope (deferred)

- Moving eval orchestration (`evals/cli.ts`, `evals/lib/run-eval.ts`, `evals/lib/langfuse-emit.ts`) — these stay in dev-team. Extraction criteria from `loop-snapshot.md` NOT met (≥2 external authors, ≥5 third-party specs, interface stable 2 months). Premature extraction freezes wrong abstractions.
- Adding new providers (anthropic, vertex, openrouter, etc) — separate FEATs as needed.
- Multi-provider failover policy beyond what `crew-fullstack-dev.yaml.judge.fallback[]` already does — out of scope.

## Dependencies

- FEAT-184 (judge interface unification) — must land first. Moving providers before the interface is unified means double-migrating them.

**Blocks SLICE-98 (GEPA S3).** Both FEAT-184 and FEAT-185 should ship before S3 so `/crew:gepa-eval` consumes providers from gepa-core directly.

## Risks

- Risk: peer-dep resolution surprises on Windows (npm install bug with optional peer deps). Mitigation: AC-1 ships explicit install-instruction error path; CI matrix includes Windows runner.
- Risk: provider auth differences — `claude-p` uses subscription/CLI auth, `azure-openai` uses endpoint+deployment+key, `bedrock` uses AWS SDK chain. Mitigation: AC-2 keeps env-var resolution in dev-team `evals/providers/` shims; gepa-core exports take config objects, never reach for env directly.
- Risk: `claude-p` provider is dev-team-specific (shells out to `claude` CLI). It might not belong in a portable library. Mitigation: ship it under `@astragenie/gepa-core/providers/claude-p` regardless — it's still pure logic with a `spawn` call. Document the CLI dep as a peer requirement.
- Risk: bumping gepa-core MAJOR if AC-7 cost-shape change is breaking. Mitigation: design AC-7 cost-shape additive — never remove fields, only add.
