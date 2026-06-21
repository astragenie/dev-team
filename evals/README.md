# crew-eval — Pluggable Agent Prompt Eval Framework

Embedded under `evals/` in `hero-crew`. Designed for extraction to a standalone
`@astragenie/crew-eval` plugin when extraction triggers are met (see bottom of this doc).

## Quick start

```bash
# Run a dry-run eval against the fullstack-dev reference spec
bun run evals --dry-run --prompt fullstack-dev

# Run against a different repo root
bun run evals --dry-run --prompt fullstack-dev --root /path/to/repo
```

Results are written to `evals/runs/<timestamp>-<prompt-id>.json`.

## Dry-run vs live mode

| Mode | What runs | When available |
|---|---|---|
| `--dry-run` | Loads fixture JSON/text; skips candidate subprocess; runs asserts against fixture | SLICE-B1 (now) |
| live (no flag) | Dispatches `claude -p` candidate; calls judge API; records result | SLICE-B2 (pending) |

Invoking without `--dry-run` currently exits with error:
`live judge dispatch ships in SLICE-B2`.

## Module boundary rule

Files under `evals/lib/**` and `evals/providers/**` **MUST NOT** import from:

- `agents/`
- `scripts/`
- `src/`
- `hooks/`
- `commands/`

This boundary is enforced by a `biome.json` `noRestrictedImports` rule scoped to the
`evals/` subtree. The spec layer (`evals/agents/*.yaml`) is data and may reference
`agents/*.md` paths via `file://` URIs — that is not a code import.

Reason: the `evals/` tree is designed for extraction to a standalone plugin. Leaking
internal hero-crew paths into the eval lib would make extraction impossible without
a refactor.

## How to add a new judge provider (3-step recipe)

1. **Create the adapter file** at `evals/providers/<name>.ts`.
   Implement the `JudgeProvider` interface from `evals/lib/judge.ts`:

   ```ts
   import type { JudgeProvider, JudgeRequest, JudgeResult } from "../lib/judge.ts";

   export class MyJudge implements JudgeProvider {
     readonly id = "my-judge";
     async judge(req: JudgeRequest): Promise<JudgeResult> {
       // call your API, return { pass, score, rationale, raw }
     }
   }
   ```

2. **Register it** in `JUDGE_REGISTRY` in `evals/lib/judge.ts`:

   ```ts
   "my-judge": async (config) => {
     const { MyJudge } = await import("../providers/my-judge.ts");
     return new MyJudge(config);
   }
   ```

3. **Reference it in a spec** (`evals/agents/<agent>.yaml`):

   ```yaml
   judge:
     provider: my-judge
     api_key: ${MY_JUDGE_API_KEY}
   ```

No other core changes needed. The registry is the only extension point.

## Provider matrix

| Provider | Adapter | Tier | Notes |
|---|---|---|---|
| Generic OpenAI-compatible | `providers/generic-openai.ts` | Free/paid | Covers Cerebras, DeepSeek, Mistral, Together, OpenRouter, GitHub Models, xAI, SambaNova, vLLM, LM Studio |
| Groq | `providers/groq.ts` | Free primary | Llama-3.3-70B; rate-limit header parsing |
| ClaudeP | (SLICE-B2) | Subscription fallback | `claude -p` subprocess |
| Ollama | (SLICE-B2) | Free / offline | Native `/api/chat` shape |
| Gemini | (SLICE-B2) | Free alternative | Google API shape |
| Azure OpenAI | (SLICE-B3) | Validation tier | Fires on judge disagreement or `--validate` |
| Bedrock | (SLICE-B3) | Validation tier | AWS SigV4; `@aws-sdk/client-bedrock-runtime` |

## Assert types

| Type | Description |
|---|---|
| `contains` | Candidate output must contain the string |
| `not-contains` | Candidate output must not contain the string |
| `regex` | Candidate output must match the regex pattern |
| `artifact-exists` | A file matching the glob must exist under repo root |
| `json-shape` | Candidate output (parsed as JSON) must have the required keys |
| `tool-called` | Trace must include a call to the named tool |
| `dispatched-agent` | Trace must include a dispatch to the named agent id |
| `llm-rubric` | Free-text rubric evaluated by judge (stub returns pass=true until SLICE-B2) |

## Eval spec format

```yaml
prompt_id: fullstack-dev
versions_under_test:
  - file://agents/fullstack-dev.md

candidate:
  runner: claude-p
  model: claude-sonnet-4-6

judge:
  provider: groq
  model: llama-3.3-70b-versatile
  api_key: ${GROQ_API_KEY}
  temperature: 0.0
  fallback:
    - provider: claude-p

tests:
  - name: my-test
    fixture: file://evals/fixtures/my-fixture.json
    assert:
      - type: contains
        value: "expected string"
      - type: not-contains
        value: "bad string"
```

Fixtures:
- JSON: `{ "candidateOutput": "...", "toolCalls": [...], "dispatches": [...] }` for structured replay
- Plain text: used as-is for `candidateOutput`

## Extraction roadmap

Triggers (any one suffices):
- 2+ external plugin authors ask for the framework
- Interface stable for 2 months with no breaking changes
- 5+ third-party specs in the wild
- 50+ GitHub stars citing the eval feature
- hero-crew CI runtime grew >50% from the eval suite

When triggered: extract to `astragenie/crew-eval-plugin` with own marketplace entry.
Name reservations: npm `@astragenie/crew-eval`, GH repo placeholder at `astragenie/crew-eval-plugin`.
