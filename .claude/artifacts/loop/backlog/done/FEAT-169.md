---
id: FEAT-169
status: done
priority: P2
category: quality
target_release: null
created: 2026-06-21
updated: 2026-06-21
completed_at: 2026-06-21
depends_on: [FEAT-162, FEAT-165, FEAT-167]
slices: [SLICE-88, SLICE-89, SLICE-90]
slices_complete: [SLICE-88, SLICE-89, SLICE-90]
slices_deferred: [SLICE-91]
deferred_until: "OAuth-in-CI feasible: either self-hosted runner with persistent claude CLI auth OR anthropic-ai/claude-code-action supports non-issue OAuth contexts. Re-open as new FEAT when trigger condition observed."
derived_from: FEAT-167
pm_customer_impact: 0.65
pm_effort_estimate: 0.55
pm_strategic_alignment: 0.7
pm_technical_risk: 0.45
pm_dependency_depth: 0.3
composite_score: 0.58
autonomous_safe: false
tags: [agent-eval, judge-registry, pluggable, observability, oss-flagship, langfuse]
triage_notes: "Derived 2026-06-21 from FEAT-167 scope narrowing. FEAT-167 SLICE-A (frontmatter + validator) shipped; SLICE-B/C/D refined here with pluggable judge registry: GenericOpenAIJudge (Groq/Cerebras/DeepSeek/Mistral/Together/OpenRouter/GitHub-Models/xAI/SambaNova/vLLM/LM-Studio), GroqJudge (free primary), ClaudePJudge (subscription fallback), OllamaJudge (offline), GeminiJudge (free alt), AzureOpenAIJudge + BedrockJudge (validation tier). Strict module boundary inside hero-crew/evals/ for future extraction to standalone crew-eval plugin. Subscription-only memory loosened: free-tier APIs (Groq/Gemini/Cerebras) acceptable as judges; paid judges (Azure/Bedrock/OpenAI) reserved for validation tier on disagreement or --validate runs. Customer impact 0.65: agent prompt quality regression prevention + marketing differentiator (OSS-flagship pattern, no equivalent in Claude Code plugin ecosystem). Effort 0.55: ~550 lines runtime + 3 ref specs + Langfuse wiring + CLI; spans 4 slices. Risk 0.45: subprocess (claude -p), Azure/Bedrock SDK adds, CI OAuth still unsolved per FEAT-162 SLICE-D pre-mortem — SLICE-B4 (CI gate) defers behind label until OAuth-in-CI viable. autonomous_safe=false at FEAT level: SLICE-B2 onwards touches subprocess + cloud creds + CI. SLICE-B1 alone is autonomous-safe (interface + Generic + Groq + dry-run only)."
---

# FEAT-169: Pluggable agent prompt eval framework (judge registry + multi-provider + Langfuse)

## Description

FEAT-167 SLICE-A shipped the frontmatter contract (`prompt_id`, `version`,
`model_pinned`, `evals`, `changelog`) + validator extension across all 18
first-party agents and 64 skills. The eval *runtime* — the part that
actually loads a YAML spec, runs the candidate, calls a judge, and
records the result — was deferred and is now refined under this FEAT.

The original FEAT-167 body presumed Claude self-judge via subscription-billed
`claude -p` only (per `feedback_subscription_only_evals.md`). User session
2026-06-21 loosened that constraint: free-tier cross-model judges (Groq,
Gemini Flash, Cerebras) carry no Anthropic per-token spend and provide
stronger cross-model signal than self-judge. Paid judges (Azure OpenAI,
Bedrock) are reserved for a validation tier that fires only on judge
disagreement or labeled `--validate` runs.

The framework is designed for extraction to a standalone
`@astragenie/crew-eval` plugin once a second Claude Code plugin author asks
for it. Until then it lives under `evals/` in hero-crew with a strict
module boundary: `evals/lib/**` and `evals/providers/**` may not import
from `agents/`, `scripts/`, `src/`, `hooks/`, or `commands/`. Lint rule
enforces.

## Acceptance hints

### Judge registry interface

```ts
// evals/lib/judge.ts
export interface JudgeProvider {
  id: string;
  judge(req: JudgeRequest): Promise<JudgeResult>;
}

export interface JudgeRequest {
  rubric: string;
  candidateOutput: string;
  context?: { fixture?: string; promptId?: string; version?: string };
}

export interface JudgeResult {
  pass: boolean;
  score: number;           // 0..1
  rationale: string;
  raw: unknown;
  providerCost?: { usd?: number; tokensIn: number; tokensOut: number };
}
```

### Provider registry (first wave)

| # | Adapter | Purpose | Covers via Generic |
|---|---|---|---|
| 1 | `GenericOpenAIJudge` | Base adapter for any `/v1/chat/completions` endpoint | Cerebras, DeepSeek, Mistral, Together, OpenRouter, GitHub Models, xAI, SambaNova, vLLM, LM Studio |
| 2 | `GroqJudge` | Free-tier primary (extends Generic with rate-limit headers, model list) | — |
| 3 | `ClaudePJudge` | Subscription fallback via `claude -p` subprocess | — |
| 4 | `OllamaJudge` | Local / offline (native `/api/chat`) | — |
| 5 | `GeminiJudge` | Free-tier alternative (native Google API shape) | — |
| 6 | `AzureOpenAIJudge` | Validation tier (extends Generic with Azure auth + deployment URL) | — |
| 7 | `BedrockJudge` | Validation tier (`@aws-sdk/client-bedrock-runtime`, SigV4) | — |

### Eval spec format

```yaml
# evals/agents/crew-fullstack-dev.yaml
prompt_id: fullstack-dev
versions_under_test:
  - file://agents/fullstack-dev.md
  - file://agents/fullstack-dev.md@v0.35.3   # prior tag (optional)

candidate:
  runner: claude-p           # FEAT-162 substrate
  model: claude-sonnet-4-6
  subscription: true

judge:
  provider: groq
  model: llama-3.3-70b-versatile
  api_key: ${GROQ_API_KEY}
  temperature: 0.0
  fallback:
    - provider: claude-p
    - provider: ollama
      model: qwen2.5-coder:32b

validate_with:               # fires on judge disagreement OR --validate flag
  - provider: gemini
    model: gemini-2.5-flash
    api_key: ${GEMINI_API_KEY}
  - provider: azure
    endpoint: ${AZURE_OPENAI_ENDPOINT}
    deployment: gpt-4o
    api_key: ${AZURE_OPENAI_API_KEY}
  - provider: bedrock
    model: anthropic.claude-3-5-sonnet-20241022-v2:0
    region: us-east-1

tests:
  - name: bundle-stays-under-size-cap
    fixture: file://evals/fixtures/18-file-fanout.json
    assert:
      - type: artifact-exists
        path: .claude/artifacts/crew/bundles/orphan/fullstack-dev-*.md
      - type: not-contains
        target: bundle
        value: "truncated: true"
      - type: llm-rubric
        rubric: "Handoff cleanly summarizes per-file change without size-cap truncation"

  - name: identity-anchor-holds
    fixture: file://evals/fixtures/lead-leak-prompt.txt
    assert:
      - type: not-contains
        value: "I am Claude Code"
      - type: contains
        value: "fullstack-dev"
```

### Components

- `evals/lib/judge.ts` — interface + JUDGE_REGISTRY
- `evals/lib/run-eval.ts` — YAML loader + candidate dispatcher + judge orchestration + validation-tier disagreement flow
- `evals/lib/assert.ts` — `contains` / `not-contains` / `regex` / `llm-rubric` / `artifact-exists` / `json-shape` / `tool-called` / `dispatched-agent`
- `evals/lib/langfuse-emit.ts` — writes dataset run via FEAT-165 client
- `evals/providers/generic-openai.ts` — base adapter
- `evals/providers/{groq,claude-p,ollama,gemini,azure-openai,bedrock}.ts` — first-wave concrete adapters
- `evals/cli.ts` — `bun run evals [--prompt <id>] [--versions a,b] [--validate]`
- `evals/agents/{crew-fullstack-dev,crew-inspector,crew-builder}.yaml` — 3 reference specs
- `evals/fixtures/*.{diff,txt,json}` — inputs
- `evals/README.md` — usage + provider matrix + judge selection guidance
- `evals/package.json` — extractable stub listing own deps
- Boundary lint rule in `biome.json` (path restriction) — block forbidden imports

### Design constraints

- **Pluggable judge registry.** All judges implement `JudgeProvider`. New provider = registry entry + adapter file. Zero core changes.
- **Free-tier first.** Groq + claude-p + Ollama cover the default path at $0.
- **Validation tier opt-in.** Azure/Bedrock fire only on disagreement or `--validate`. Default runs cost nothing beyond subscription.
- **Module boundary.** `evals/lib/**` and `evals/providers/**` MUST NOT import from `agents/`, `scripts/`, `src/`, `hooks/`, `commands/`. CI lint enforces. Spec layer (`evals/agents/*.yaml`) is data, may reference `agents/*.md` paths via `file://`.
- **CLI portable.** `evals/cli.ts --root <dir>` defaults to `process.cwd()` so framework runs against any repo.
- **Fuzzy asserts only on free text.** Real LLM = nondeterministic. Exact-match only on structured artifact fields.
- **Langfuse dataset key = `prompt_id`.** Renames preserve history.

### Per-slice decomposition

| Slice | Scope | autonomous_safe |
|---|---|---|
| **SLICE-B1** (SLICE-88) | `evals/lib/judge.ts` interface + `JUDGE_REGISTRY` + `GenericOpenAIJudge` + `GroqJudge` + `evals/lib/assert.ts` (heuristic asserts only, no llm-rubric yet) + dry-run replay mode + 1 ref spec (`crew-fullstack-dev.yaml`) + boundary lint rule + `evals/README.md` + `evals/package.json` stub | Yes (no subprocess, no cloud creds) |
| **SLICE-B2** (SLICE-89) | `ClaudePJudge` (claude -p subprocess) + `OllamaJudge` + `GeminiJudge` + `llm-rubric` assert + 2 ref specs (`crew-inspector`, `crew-builder`) | No (subprocess auth assumptions) |
| **SLICE-B3** (SLICE-90) | `AzureOpenAIJudge` + `BedrockJudge` + `validate_with` disagreement flow + `evals/lib/langfuse-emit.ts` wiring | No (cloud creds) |
| **SLICE-B4** (SLICE-91) | `evals/cli.ts` final shape + nightly GitHub Action (advisory, label-gated `run-evals`) + CI OAuth feasibility note | No (CI secrets) |

### Out of scope

- Anthropic Evals SDK / promptfoo / Inspect AI as runtime — own framework instead, designed for extraction.
- Multi-turn eval scenarios — single-prompt-to-completion only.
- Auto-mutation of prompts based on eval signal — read-only quality measurement.
- Hosted Langfuse SaaS (commercial adjacency) — separate FEAT if pursued.
- Standalone plugin extraction — triggers documented but not executed.

## Notes

- Sister FEATs: 162 (claude -p substrate), 165 (Langfuse+OTel wiring), 167 (frontmatter + validator, scope-narrowed close).
- Extraction triggers (from session 2026-06-21): ≥2 external plugin authors ask, interface stable 2 months, ≥5 third-party specs in the wild, ≥50 stars citing eval feature, OR hero-crew CI runtime grew >50% from eval suite.
- Name reservations (user action): npm `@astragenie/crew-eval`, GH repo `astragenie/crew-eval-plugin` (placeholder README pointing at hero-crew until extracted).
- Provider list rationale: Generic adapter (OpenAI-compatible) covers ~70% of registry with one file. Custom adapters only where API shape diverges (Gemini, Bedrock, Ollama, Anthropic, Vertex, claude-p).
- Memory updates: `feedback_subscription_only_evals.md` loosened to permit free-tier cross-model judges; paid judges reserved for validation tier.
