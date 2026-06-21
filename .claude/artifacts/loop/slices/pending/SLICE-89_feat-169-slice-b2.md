---
id: SLICE-89
feat: FEAT-169
status: pending
created: 2026-06-21
title: "FEAT-169 SLICE-B2 — ClaudePJudge + OllamaJudge + GeminiJudge + llm-rubric + 2 ref specs"
autonomous_safe: false
risk_band: 0.45
estimated_loc: 800
estimated_files: 9
line_budgets:
  - { path: "evals/providers/claude-p.ts", max: 180 }
  - { path: "evals/providers/ollama.ts", max: 100 }
  - { path: "evals/providers/gemini.ts", max: 120 }
  - { path: "evals/lib/assert.ts", max: "+80 (llm-rubric impl)" }
  - { path: "evals/lib/run-eval.ts", max: "+60 (live candidate dispatch + fallback chain)" }
  - { path: "evals/cli.ts", max: "+30 (drop dry-run-only error, add --live flag)" }
  - { path: "evals/agents/crew-inspector.yaml", max: 80 }
  - { path: "evals/agents/crew-lead.yaml", max: 80 }
  - { path: "evals/fixtures/inspector-*.{diff,txt}", max: 60 }
  - { path: "evals/fixtures/lead-*.{diff,txt}", max: 60 }
  - { path: "tests/evals-providers.test.ts", max: 250 }
  - { path: ".gitignore", max: "+2 (evals/runs/)" }
---

# SLICE-89: FEAT-169 SLICE-B2 — ClaudePJudge + OllamaJudge + GeminiJudge + llm-rubric + 2 reference specs

## Intent

Extend the eval framework with live judge runtime. Three new providers:

- `ClaudePJudge` — subscription-billed self-judge via `claude -p` subprocess
- `OllamaJudge` — local/offline judge via Ollama `/api/chat` endpoint
- `GeminiJudge` — free-tier cross-model judge via Google Gemini Flash API

Plus the `llm-rubric` assert implementation (calls the configured judge with a rubric template) and live candidate dispatch in `run-eval.ts` (replaces the dry-run-only stub from SLICE-B1).

Two new reference specs land for crew-inspector + crew-lead — judgment-heavy roles where eval signal matters most.

`autonomous_safe: false` because subprocess auth + cross-network credentials (GEMINI_API_KEY, optional OLLAMA_HOST) require human-in-loop verification.

## Files to touch

| Path | Action | Notes |
|---|---|---|
| `evals/providers/claude-p.ts` | create | Spawns `claude -p "<prompt>" --output-format stream-json` via Node child_process, captures stdout, parses NDJSON lines, extracts final text. Configurable model + max-turns. Subscription auth inherited from CC install. Timeout per request (default 180s). |
| `evals/providers/ollama.ts` | create | POST to `${OLLAMA_HOST}/api/chat` (default `http://localhost:11434`). Default model `llama3.3` configurable per spec. JSON response → JudgeResult. |
| `evals/providers/gemini.ts` | create | POST to Google Gemini Flash API (`generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`). Native Google API shape (not OpenAI-compatible). Free-tier auth via `GEMINI_API_KEY`. |
| `evals/lib/assert.ts` | edit | Replace `llm-rubric` stub with real implementation. Takes rubric text + candidate output, dispatches the configured judge with template: `"Did this response satisfy: <rubric>? Answer YES or NO with one-sentence rationale."`, parses binary → `{pass, score, rationale}`. |
| `evals/lib/run-eval.ts` | edit | Add `--live` mode: dispatch candidate via `ClaudePJudge` (or other registered runner), capture trace, pipe through asserts. Implement `fallback:` chain in YAML (try primary, on rate-limit/error try next). |
| `evals/cli.ts` | edit | Add `--live` flag. Drop the dry-run-only error gate (kept `--dry-run` as opt-in mode). |
| `evals/agents/crew-inspector.yaml` | create | 3 tests: `blocker-on-null-deref` (contains `[BLOCKER]`, not-contains `[NIT]`, llm-rubric on identifying the line-N null-deref), `no-blocker-on-clean-rename` (not-contains `[BLOCKER]`), `verdict-shape` (json-shape on verdict artifact). |
| `evals/agents/crew-lead.yaml` | create | 2 tests: `identity-anchor-holds` (not-contains `"I am Claude Code"`, contains `"lead"`), `dispatches-builder-via-agent` (dispatched-agent expects `crew:backend-dev` OR `crew:frontend-dev` OR `crew:fullstack-dev`). |
| `evals/fixtures/inspector-null-deref.diff` | create | Code diff with explicit null-deref bug on a clear line. |
| `evals/fixtures/inspector-clean-rename.diff` | create | Mechanical rename diff, zero behavioral change. |
| `evals/fixtures/lead-dispatch-prompt.txt` | create | Realistic dispatch prompt where lead should hand off to a builder. |
| `tests/evals-providers.test.ts` | create | Unit tests for each provider (mock fetch/spawn). Min 9 cases (3 per provider). Skip live integration tests behind `CREW_EVAL_LIVE=1` env flag (rate-limit budget). |
| `.gitignore` | edit | Add `evals/runs/` (SLICE-B1 cleanup). |

## Acceptance criteria

1. `bun run evals --live --prompt fullstack-dev` runs end-to-end with `judge.provider: ollama` (assumes Ollama running locally) and emits a structured run artifact. Skip gracefully with clear error if Ollama not reachable.
2. `bun run evals --live --prompt inspector` works against the new spec. Same for `crew-lead`.
3. `Object.keys(JUDGE_REGISTRY).length >= 5` (`generic-openai`, `groq`, `claude-p`, `ollama`, `gemini`).
4. `llm-rubric` assert returns `{pass: boolean, score: 0..1, rationale: string}` — no more deferred stub.
5. `tests/evals-providers.test.ts` covers each provider with mocked network/subprocess. Min 9 cases pass. Live integration tests skipped unless `CREW_EVAL_LIVE=1` set.
6. Each new provider implements `JudgeProvider` interface from SLICE-B1.
7. Fallback chain: when primary judge errors (rate-limit, timeout, network), `fallback:` array iterates until one succeeds. Order preserved.
8. `bun run lint` + `bun run typecheck` + `bun run format:check` green.
9. Boundary lint rule still enforces: new providers do not import from `agents/`, `scripts/`, `src/`, `hooks/`, `commands/`.
10. CI gates green: `validate-manifests`, `validate-skills`, `validate-agents`, `validate-slices`, `lint`, `format:check`, `typecheck`, `test` (allowing the 21 pre-existing Windows perf + Bun test-in-test failures as baseline).

## Validation commands

```
bun run lint
bun run typecheck
bun run format:check
bun test tests/evals-providers.test.ts
bun test tests/evals-lib.test.ts
bun run evals --dry-run --prompt fullstack-dev
node ./scripts/validate-agents.ts
node ./scripts/validate-skills.ts
node ./scripts/validate-manifests.ts
node ./scripts/validate-slices.ts
```

Live integration smoke (manual, optional — requires Ollama running and GEMINI_API_KEY set):

```
CREW_EVAL_LIVE=1 bun run evals --live --prompt fullstack-dev --judge ollama
GEMINI_API_KEY=... CREW_EVAL_LIVE=1 bun run evals --live --prompt fullstack-dev --judge gemini
```

## Constraints

- **No new npm dependencies.** Native `fetch` for Ollama + Gemini. Native `child_process` for claude-p subprocess. NO `@google/generative-ai`, NO `ollama`, NO `@anthropic-ai/sdk`. Raw HTTP keeps the framework portable + extractable.
- **Bundle cap.** Build bundle must stay ≤2000 lines. Cite per-file LoC in summary, not full diffs.
- **No commits.** dev.stable: false. User reviews and commits manually.
- **Boundary lint preserved.** New providers under `evals/providers/` may not import from `agents/`, `scripts/`, `src/`, `hooks/`, `commands/`.
- **Rate-limit etiquette.** ClaudePJudge subprocess timeout default 180s. Tests skip live calls unless `CREW_EVAL_LIVE=1` so default `bun run test` does not burn subscription quota.
- **Stream-json parsing.** ClaudePJudge must handle stream-json NDJSON lines (one event per line). Extract `event: "result"` or final `event: "message"` for the assistant text.

## Out of scope

- `AzureOpenAIJudge`, `BedrockJudge`, `validate_with` flow → SLICE-B3.
- `evals/lib/langfuse-emit.ts` dataset emission → SLICE-B3.
- Nightly CI workflow → SLICE-B4.
- `OpenRouterJudge` / `CerebrasJudge` / `DeepSeekJudge` — Generic adapter already covers via registry entry, no new files needed (deferred to docs update).
- Multi-turn evals — single-prompt-to-completion only.

## Forbidden

- Modifying any `agents/*.md` file.
- Modifying `scripts/validate-agents.ts` or `scripts/validate-skills.ts`.
- Adding npm dependencies (`@google/generative-ai`, `ollama`, `@anthropic-ai/sdk`, etc.).
- Auto-commit. dev.stable: false.
- Reaching into `src/`, `hooks/`, `commands/` from `evals/lib/**` or `evals/providers/**`.
- Live network calls in default test run (must be gated behind `CREW_EVAL_LIVE=1`).

## Dispatch hint

- Builder: `crew:backend-dev` (TS subprocess + HTTP client work, native turf).
- Reviewer: `crew:inspector` + `crew:3rdparty:typescript-reviewer` in parallel.
- Validator: `crew:verifier` running the validation commands above.
