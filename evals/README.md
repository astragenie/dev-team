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
| live (no flag) | Dispatches `claude -p` candidate; calls judge API; records result | SLICE-B2 (now) |

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

## Judge interface — LLMJudge (external API)

As of SLICE-107 (FEAT-184), the canonical judge interface is **`LLMJudge`** from
`@astragenie/gepa-core`. New adapters should implement `LLMJudge`, not `JudgeProvider`.

```ts
import type { LLMJudge } from "@astragenie/gepa-core";

export class MyJudge implements LLMJudge {
  describe(): { provider: string; model: string } {
    return { provider: "my-judge", model: "my-model" };
  }

  async evaluate(opts: {
    candidateOutput: unknown;
    expected: import("@astragenie/gepa-core").EvalCase;
    rubric: string[];   // single-element array when porting a prose rubric — never sentence-split
    signal?: AbortSignal;
    context?: { fixture?: string; promptId?: string; version?: string };
  }): Promise<{
    pass: boolean;
    score: number;
    rubricScores: Record<string, number>;
    rationale: string;
    cost_usd: number;
    latency_ms: number;
    tokens?: { in: number; out: number };  // omit if adapter cannot surface counts
    raw?: unknown;
  }> {
    // call your API, return unified result shape
  }
}
```

Register in `JUDGE_REGISTRY` in `evals/lib/judge.ts` and reference in a spec.

### Deprecation notice: JudgeProvider

`JudgeProvider` (from `evals/lib/judge.ts`) is **deprecated** as of SLICE-107 and will
be removed in the next MAJOR version. It is currently a type alias for `LLMJudge`
plus the legacy `judge(req)` shim method.

Migration:
- Replace `import type { JudgeProvider } from "../lib/judge.ts"` with
  `import type { LLMJudge } from "@astragenie/gepa-core"`
- Replace `implements JudgeProvider` with `implements LLMJudge`
- Replace `judge(req: JudgeRequest)` with `evaluate(opts)` (see shape above)
- Replace `providerCost: { tokensIn, tokensOut }` with `tokens: { in, out }` + `cost_usd`

See [gepa-core CHANGELOG 0.2.0](https://github.com/astragenie/gepa-core/blob/main/CHANGELOG.md)
for the canonical interface definition and migration notes.

## How to add a new judge provider (3-step recipe)

1. **Create the adapter file** at `evals/providers/<name>.ts`.
   Implement `LLMJudge` from `@astragenie/gepa-core`:

   ```ts
   import type { LLMJudge } from "@astragenie/gepa-core";

   export class MyJudge implements LLMJudge {
     describe() { return { provider: "my-judge", model: "my-model" }; }
     async evaluate(opts) {
       // call your API, return { pass, score, rubricScores, rationale, cost_usd, latency_ms }
     }
   }
   ```

   Also expose `readonly id: string` and a `judge()` shim if you want the adapter
   to be usable via the deprecated `JudgeProvider` path (one minor version only).

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
| ClaudeP | `providers/claude-p.ts` | Subscription fallback | `claude -p` subprocess; tokens field omitted (subprocess cannot surface counts) |
| Ollama | `providers/ollama.ts` | Free / offline | Native `/api/chat` shape |
| Gemini | `providers/gemini.ts` | Free alternative | Google API shape |
| Azure OpenAI | `providers/azure-openai.ts` | Validation tier | Fires on judge disagreement or `--validate` |
| Bedrock | `providers/bedrock.ts` | Validation tier | AWS SigV4; `@aws-sdk/client-bedrock-runtime` |

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
| `llm-rubric` | Free-text rubric evaluated by judge via `LLMJudge.evaluate()` |

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
