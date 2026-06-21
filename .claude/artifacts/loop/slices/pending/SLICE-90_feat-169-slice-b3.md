---
id: SLICE-90
feat: FEAT-169
status: pending
created: 2026-06-21
title: "FEAT-169 SLICE-B3 — Azure + Bedrock judges + validate_with disagreement flow + Langfuse dataset emit"
autonomous_safe: false
risk_band: 0.55
estimated_loc: 750
estimated_files: 10
line_budgets:
  - { path: "evals/providers/azure-openai.ts", max: 90 }
  - { path: "evals/providers/bedrock.ts", max: 160 }
  - { path: "evals/lib/langfuse-emit.ts", max: 140 }
  - { path: "evals/lib/run-eval.ts", max: "+100 (validate_with disagreement flow + langfuse hook)" }
  - { path: "evals/lib/judge.ts", max: "+15 (registry entries)" }
  - { path: "evals/agents/crew-fullstack-dev.yaml", max: "+25 (add validate_with block)" }
  - { path: "evals/agents/crew-inspector.yaml", max: "+25 (add validate_with block)" }
  - { path: "tests/evals-cloud-providers.test.ts", max: 300 }
  - { path: "tests/evals-langfuse-emit.test.ts", max: 180 }
  - { path: "evals/README.md", max: "+40 (validation tier + Langfuse docs)" }
  - { path: "package.json", max: "+1 dep line (@aws-sdk/client-bedrock-runtime)" }
---

# SLICE-90: FEAT-169 SLICE-B3 — Azure + Bedrock judges + validate_with disagreement flow + Langfuse dataset emit

## Intent

Validation tier of the pluggable eval framework. Three concerns:

1. **AzureOpenAIJudge** — extends GenericOpenAIJudge with Azure auth (`api-key` header instead of `Authorization`) + deployment-name URL shape (`/openai/deployments/<deployment>/chat/completions?api-version=...`). Validation tier — paid, BYO Azure key.

2. **BedrockJudge** — AWS Bedrock Runtime via `@aws-sdk/client-bedrock-runtime` (one npm dep — manual SigV4 would cost ~150 LoC of crypto and break portability). Supports Claude models (`anthropic.claude-3-5-sonnet-20241022-v2:0`), Llama, Mistral, Nova. Validation tier — paid, BYO AWS creds.

3. **validate_with disagreement flow** — when primary judge says PASS and any judge in `validate_with` array says FAIL (or vice-versa), the test result escalates to `disagreement`. Triggers a third arbitrator call OR records both verdicts for Langfuse review. Also fires unconditionally on `--validate` CLI flag.

4. **Langfuse dataset emission** — `evals/lib/langfuse-emit.ts` posts each run as a Langfuse dataset run (`/api/public/datasets`, `/api/public/dataset-runs`, `/api/public/dataset-items`). Raw fetch — no `langfuse` npm dep. Diff UI comes free.

`autonomous_safe: false` — cloud creds + new dependency + multi-step orchestration require human-in-loop verification.

## Files to touch

| Path | Action | Notes |
|---|---|---|
| `evals/providers/azure-openai.ts` | create | Extends `GenericOpenAIJudge`. URL shape: `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`. Auth: `api-key: ${apiKey}` header. Default `api-version: 2024-10-21`. |
| `evals/providers/bedrock.ts` | create | `BedrockRuntimeClient` + `InvokeModelCommand`. Body shape varies per model family (Claude vs Llama vs Nova) — switch on model prefix. Region from `BEDROCK_REGION` env or spec. Default `us-east-1`. |
| `evals/lib/langfuse-emit.ts` | create | Three functions: `ensureDataset(promptId)` (idempotent POST), `recordRun(runId, promptId, judge)` (POST dataset-run), `recordItem(runId, fixture, result)` (POST dataset-item). Auth via `LANGFUSE_PUBLIC_KEY` + `LANGFUSE_SECRET_KEY` env (Basic auth). Endpoint default `https://cloud.langfuse.com`, override via `LANGFUSE_HOST`. Raw fetch — no SDK. Graceful skip if keys absent. |
| `evals/lib/run-eval.ts` | edit | Add `validate_with` orchestration: after primary judge returns, dispatch each `validate_with[]` judge in parallel, compare verdicts, mark `disagreement` if mismatch (or `validated` if all agree). Force-fire on `--validate` flag. After all asserts, call `langfuse-emit` if enabled. |
| `evals/lib/judge.ts` | edit | Add `azure` + `bedrock` registry entries. Both factories. |
| `evals/agents/crew-fullstack-dev.yaml` | edit | Add `validate_with:` block with Azure + Bedrock entries (commented `# env: AZURE_OPENAI_API_KEY` style — does NOT fire by default, only on disagreement or `--validate`). |
| `evals/agents/crew-inspector.yaml` | edit | Same `validate_with:` block. |
| `tests/evals-cloud-providers.test.ts` | create | Mock fetch for Azure (verify URL shape + auth header). Mock `BedrockRuntimeClient` for Bedrock (`bun:mock` module override). Min 12 cases (6 per provider). Live integration gated `CREW_EVAL_LIVE=1` + `AZURE_OPENAI_API_KEY` / `AWS_ACCESS_KEY_ID`. |
| `tests/evals-langfuse-emit.test.ts` | create | Mock fetch. Verify dataset/run/item POST shapes. Confirm graceful skip when keys absent. Min 8 cases. |
| `evals/README.md` | edit | Add "Validation tier" section + "Langfuse dataset emission" section. Document the disagreement flow. Update provider matrix. |
| `package.json` | edit | Add `@aws-sdk/client-bedrock-runtime` to `dependencies`. No version pin tighter than `^3` — let lockfile drive. |

## Acceptance criteria

1. `Object.keys(JUDGE_REGISTRY).length >= 7` — adds `azure` + `bedrock` to existing 5.
2. `bun run evals --dry-run --prompt fullstack-dev` still works (B1+B2 backward compatibility).
3. `bun run evals --live --prompt fullstack-dev --validate` triggers `validate_with` chain even when primary judge passes — verifiable via run artifact containing `validations: [{judge, verdict, rationale}]`.
4. When primary verdict and `validate_with` verdict disagree, result entry has `disagreement: true` and includes both verdicts.
5. `evals/lib/langfuse-emit.ts` skips silently when `LANGFUSE_PUBLIC_KEY` or `LANGFUSE_SECRET_KEY` absent. When present, POSTs three endpoints in order.
6. `tests/evals-cloud-providers.test.ts` passes ≥12 cases. Live tests skip without `CREW_EVAL_LIVE=1`.
7. `tests/evals-langfuse-emit.test.ts` passes ≥8 cases with mocked fetch.
8. Boundary lint rule still passes — new providers + langfuse-emit obey the rule (no imports from `agents/`, `scripts/`, `src/`, `hooks/`, `commands/`).
9. CI gates green (allow same baseline pre-existing failures).
10. `package.json` adds exactly one dep (`@aws-sdk/client-bedrock-runtime`). No other deps added.

## Validation commands

```
bun install
bun run lint
bun run typecheck
bun run format:check
bun test tests/evals-cloud-providers.test.ts
bun test tests/evals-langfuse-emit.test.ts
bun test tests/evals-providers.test.ts
bun test tests/evals-lib.test.ts
bun run evals --dry-run --prompt fullstack-dev
node ./scripts/validate-agents.ts
node ./scripts/validate-skills.ts
node ./scripts/validate-manifests.ts
node ./scripts/validate-slices.ts
```

Live integration (manual, optional):

```
CREW_EVAL_LIVE=1 AZURE_OPENAI_API_KEY=... AZURE_OPENAI_ENDPOINT=... bun run evals --live --prompt fullstack-dev --judge azure
CREW_EVAL_LIVE=1 AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... bun run evals --live --prompt fullstack-dev --judge bedrock
LANGFUSE_PUBLIC_KEY=... LANGFUSE_SECRET_KEY=... CREW_EVAL_LIVE=1 bun run evals --live --prompt fullstack-dev
```

## Constraints

- **One new npm dep allowed** — `@aws-sdk/client-bedrock-runtime`. Justified: manual SigV4 = 150+ LoC crypto + brittle vs SDK. NO other deps. Specifically forbidden: `@azure/openai`, `langfuse`, `@google-cloud/*`, `openai` (raw fetch sufficient for Azure + Langfuse).
- **Bundle cap.** Build bundle must stay ≤2000 lines. Per-file LoC in summary.
- **No commits.** dev.stable: false.
- **Boundary lint preserved.** New files under `evals/providers/`, `evals/lib/` may not import from `agents/`, `scripts/`, `src/`, `hooks/`, `commands/`.
- **Langfuse client = raw fetch.** No `langfuse` npm dep. Three POST endpoints documented in evals/lib/langfuse-emit.ts.
- **Validate_with default OFF.** Only fires on disagreement OR explicit `--validate` flag. Default `bun run evals --live` does NOT burn paid judge quota.
- **Graceful skip on missing creds.** Each cloud provider + langfuse-emit must skip with clear error when env vars absent, not crash mid-eval.

## Out of scope

- Nightly CI workflow → SLICE-B4.
- Vertex AI provider (Google paid) — add later via registry once demand appears.
- OpenAI direct provider — Generic adapter already covers via registry config; documented in README, no new file.
- Prompt mutation / auto-tuning → separate FEAT if pursued.
- Langfuse self-host config — FEAT-165 already covers `scripts/setup-langfuse-self-host.ts`. This slice consumes whatever Langfuse the user runs.

## Forbidden

- Modifying any `agents/*.md` file.
- Modifying `scripts/validate-*.ts` or `scripts/lib/telemetry/otel-bridge.ts`.
- Adding npm dependencies other than `@aws-sdk/client-bedrock-runtime` (single allowance).
- Auto-commit. dev.stable: false.
- Reaching into `src/`, `hooks/`, `commands/`, `scripts/` from `evals/lib/**` or `evals/providers/**`.
- Live network calls in default `bun run test` (must be gated behind `CREW_EVAL_LIVE=1` + creds).
- Hardcoded API keys or endpoints in source. All cloud auth via env vars.
- Release ceremony (no version bump, no CHANGELOG entry, no tag).

## Dispatch hint

- Builder: `crew:backend-dev` (TS + cloud SDK + HTTP client work).
- Reviewer: `crew:inspector` + `crew:3rdparty:typescript-reviewer` in parallel.
- Validator: `crew:verifier` running the validation commands above.
