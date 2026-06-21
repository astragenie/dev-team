---
id: SLICE-88
feat: FEAT-169
status: pending
created: 2026-06-21
title: "FEAT-169 SLICE-B1 — Judge interface + GenericOpenAIJudge + GroqJudge + 1 reference spec"
autonomous_safe: true
risk_band: 0.25
estimated_loc: 600
estimated_files: 12
line_budgets:
  - { path: "evals/lib/judge.ts", max: 120 }
  - { path: "evals/lib/run-eval.ts", max: 200 }
  - { path: "evals/lib/assert.ts", max: 180 }
  - { path: "evals/providers/generic-openai.ts", max: 130 }
  - { path: "evals/providers/groq.ts", max: 80 }
  - { path: "evals/cli.ts", max: 100 }
  - { path: "evals/agents/crew-fullstack-dev.yaml", max: 80 }
  - { path: "evals/fixtures/18-file-fanout.json", max: 60 }
  - { path: "evals/fixtures/lead-leak-prompt.txt", max: 15 }
  - { path: "evals/README.md", max: 200 }
  - { path: "evals/package.json", max: 40 }
  - { path: "biome.json", max: "+30 (additive only)" }
---

# SLICE-88: FEAT-169 SLICE-B1 — Judge interface + GenericOpenAIJudge + GroqJudge + 1 reference spec

## Intent

Ship the foundational layer of the pluggable agent eval framework: judge
interface, registry, two adapters (Generic + Groq), heuristic asserts,
dry-run replay mode, one reference spec for `crew:fullstack-dev`, the
boundary lint rule, and the README. No subprocess, no cloud creds, no
`llm-rubric` (deferred to SLICE-B2). Fully autonomous-safe.

## Files to touch

| Path | Action | Notes |
|---|---|---|
| `evals/lib/judge.ts` | create | `JudgeProvider` interface + `JudgeRequest`/`JudgeResult` types + `JUDGE_REGISTRY` map |
| `evals/lib/run-eval.ts` | create | YAML loader (use `yaml` npm pkg already in repo) + dry-run replay dispatcher + assert orchestration. NO candidate subprocess yet — dry-run reads pre-captured trace JSON. |
| `evals/lib/assert.ts` | create | `contains` / `not-contains` / `regex` / `artifact-exists` / `json-shape` / `tool-called` / `dispatched-agent`. Stub `llm-rubric` returning `{pass: true, score: 1, rationale: 'deferred to SLICE-B2'}`. |
| `evals/providers/generic-openai.ts` | create | Base adapter calling `/v1/chat/completions`. Constructor takes `{ baseUrl, apiKey, model, temperature }`. Used by SLICE-B2+ — exported but unused by SLICE-B1 itself. |
| `evals/providers/groq.ts` | create | Extends `GenericOpenAIJudge` with Groq baseUrl + model defaults + rate-limit header parsing. Exported, not invoked by SLICE-B1 runtime. |
| `evals/cli.ts` | create | `bun run evals [--prompt <id>] [--root <dir>] [--dry-run]`. SLICE-B1 supports `--dry-run` mode only. Live mode errors with "live judge dispatch ships in SLICE-B2". |
| `evals/agents/crew-fullstack-dev.yaml` | create | Reference spec targeting `agents/fullstack-dev.md`. Two tests: `bundle-stays-under-size-cap` (artifact-exists + not-contains) and `identity-anchor-holds` (not-contains + contains). NO `llm-rubric` asserts (deferred). |
| `evals/fixtures/18-file-fanout.json` | create | Pre-captured trace JSON modeling the FEAT-167 SLICE-79 bundle-truncation pattern — input prompt + expected handoff fields. Used for dry-run replay. |
| `evals/fixtures/lead-leak-prompt.txt` | create | Input fixture for `identity-anchor-holds` test — a dispatch prompt body containing `"you are the orchestrator"` identity-leak phrasing. |
| `evals/README.md` | create | Usage docs, provider matrix, judge selection guidance, extraction-trigger notes. |
| `evals/package.json` | create | Stub `{"name": "@astragenie/crew-eval", "private": true, "version": "0.0.0", "type": "module"}` with explicit deps (`yaml`). Marks the module as extractable. |
| `biome.json` | edit | Add path restriction: files under `evals/lib/**` and `evals/providers/**` cannot import from `agents/**`, `scripts/**`, `src/**`, `hooks/**`, `commands/**`. Additive — do not touch existing rules. |
| `package.json` | edit | Add `"evals": "bun evals/cli.ts"` script. No new top-level deps (yaml already present). |

## Acceptance criteria

1. `bun run evals --dry-run --prompt fullstack-dev` exits 0, prints PASS for both reference tests, writes a summary JSON to `evals/runs/<timestamp>-fullstack-dev.json`.
2. `bun run lint` (biome) fails when a test file imports `agents/fullstack-dev.md` content from `evals/lib/run-eval.ts` (proving the boundary rule fires).
3. `bun run typecheck` is green across `evals/**`.
4. `JUDGE_REGISTRY` exports both `generic-openai` and `groq` keys. `Object.keys(JUDGE_REGISTRY).length >= 2`.
5. `evals/README.md` documents: how to add a new judge provider (3-step recipe), the boundary rule, the dry-run vs live mode distinction, and the extraction roadmap.
6. `tests/evals-lib.test.ts` covers: judge registry resolution, assert helpers (each shape), dry-run replay reads a fixture and produces a structured result. Min 6 cases.
7. CI gates green: `bun run validate:agents`, `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run test`.

## Validation commands

```bash
bun run evals --dry-run --prompt fullstack-dev
bun run lint
bun run typecheck
bun test tests/evals-lib.test.ts
node ./scripts/validate-agents.ts
node ./scripts/validate-skills.ts
```

## Out of scope

- Live `claude -p` candidate dispatch → SLICE-B2.
- `llm-rubric` assert implementation → SLICE-B2.
- `OllamaJudge`, `GeminiJudge`, `ClaudePJudge` → SLICE-B2.
- `AzureOpenAIJudge`, `BedrockJudge`, `validate_with` flow → SLICE-B3.
- Langfuse dataset emission → SLICE-B3.
- Nightly CI workflow → SLICE-B4.

## Forbidden

- Modifying any `agents/*.md` file (frontmatter or body). All agent prompts are frozen for this slice.
- Modifying `scripts/validate-agents.ts` (already extended in SLICE-79).
- Adding cloud SDK dependencies (`@aws-sdk/*`, `@azure/*`, `@google-cloud/*`) — those land in SLICE-B3.
- Reaching into `src/`, `hooks/`, `commands/` from `evals/lib/**` or `evals/providers/**`.
- Auto-commit. dev.stable is false; user reviews + commits manually.

## Dispatch hint

- Builder: `crew:fullstack-dev` (cross-layer TypeScript + YAML + Markdown).
- Reviewer: `crew:inspector` + `crew:3rdparty:typescript-reviewer` in parallel.
- Validator: `crew:verifier` running the validation commands above.
