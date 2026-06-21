---
status: completed
---
# Task Handoff: SLICE-89: eval framework B2 — ClaudeP + Ollama + Gemini judges + llm-rubric + 2 ref specs

- Created: 2026-06-21T12:03:01.351Z
- Completed: 2026-06-21T12:21:00.000Z
- From: backend-dev (cutoff at tool 67 / 92k tokens, finished inline by main thread)
- To: lead
- Objective: Ship SLICE-B2 — ClaudePJudge + OllamaJudge + GeminiJudge + llm-rubric assert implementation + 2 reference specs (crew-inspector, crew-lead) + .gitignore evals/runs cleanup.
- Allowed Scope: evals/providers/{claude-p,ollama,gemini}.ts, evals/lib/{assert,run-eval}.ts edits, evals/cli.ts edits, evals/agents/{crew-inspector,crew-lead}.yaml, evals/fixtures/{inspector-*,lead-*}.{diff,txt}, tests/evals-providers.test.ts, .gitignore.
- Forbidden Scope: agents/*.md, scripts/validate-*.ts, npm dependency adds, package.json version bumps, CHANGELOG entries, commits.
- Deliverable: Pluggable judge framework now has 5 providers in JUDGE_REGISTRY (generic-openai, groq, claude-p, ollama, gemini). Real llm-rubric assert (was deferred stub). Live candidate dispatch via ClaudePJudge in run-eval.ts with YAML fallback chain. 2 new reference specs covering crew:inspector (3 tests) and crew:lead (2 tests). Live tests gated behind CREW_EVAL_LIVE=1.
- Changed Files:
  - evals/providers/claude-p.ts (new, 155 LoC)
  - evals/providers/ollama.ts (new, 100 LoC)
  - evals/providers/gemini.ts (new, 119 LoC)
  - evals/lib/assert.ts (edit, 221 → 260 LoC; llm-rubric real impl)
  - evals/lib/run-eval.ts (edit, 188 → 309 LoC; live dispatch + fallback chain — OVER budget by 61 LoC, justified by fallback chain scope)
  - evals/lib/judge.ts (edit, 92 → 119 LoC; registry entries for 3 new providers)
  - evals/cli.ts (edit, 150 → 177 LoC; dropped dry-run-only gate, added --live)
  - evals/agents/crew-inspector.yaml (new, 42 LoC)
  - evals/agents/crew-lead.yaml (new, 31 LoC)
  - evals/fixtures/inspector-null-deref.diff (new, 13 LoC)
  - evals/fixtures/inspector-clean-rename.diff (new, 19 LoC)
  - evals/fixtures/lead-dispatch-prompt.txt (new, 7 LoC)
  - tests/evals-providers.test.ts (new, 403 LoC; 22 cases — OVER budget by 153, justified by 3-provider coverage with mocked fetch+spawn)
  - tests/evals-lib.test.ts (edit, removed 1 obsolete SLICE-B1 gate test)
  - .gitignore (edit, +2 lines for evals/runs/)
- Confidence: high
- Risks:
  - ClaudePJudge stream-json parsing relies on `event: "result"` shape — if Claude Code CLI changes output schema, this breaks. Defensive: fall back to aggregating message events.
  - Live integration tests not exercised in this slice (CREW_EVAL_LIVE=1 gated). First real `bun run evals --live` call may surface auth or rate-limit surprises.
  - GeminiJudge uses native API (not OpenAI-compatible) — schema fragility if Google bumps v1beta endpoint. Pin to v1beta documented now in evals/providers/gemini.ts.
  - llm-rubric parsing is naive ("first non-whitespace token matches /^yes/i"). Edge cases like "Yes, however..." with negation downstream could mis-classify. Acceptable for SLICE-B2; refine later if false positives observed.
  - run-eval.ts over line budget (309 / 248 target). Refactor candidate for SLICE-B3 if it grows again with Langfuse emission.
  - tests/evals-providers.test.ts over budget (403 / 250). 22 cases across 3 providers. Splitting per-provider file would help but adds boilerplate.
- Suggested Next Handoff: SLICE-90 (FEAT-169 SLICE-B3) — AzureOpenAIJudge + BedrockJudge + validate_with disagreement flow + evals/lib/langfuse-emit.ts.

## Self-Verify Gates

- typecheck: PASS (`bun run typecheck` — clean)
- lint: PASS (`bun run lint` — 0 errors, 73 pre-existing complexity warnings)
- format:check: PASS (`bun run format:check` — clean after `bun run format` cleanup)
- evals-lib.test.ts: PASS (26 / 26)
- evals-providers.test.ts: PASS (22 / 22)
- dry-run smoke: PASS (`bun run evals --dry-run --prompt fullstack-dev` — 2 / 2 PASS)
- validate-manifests: PASS
- validate-skills: PASS (64 checked)
- validate-agents: PASS (18 checked)
- validate-slices: PASS
- Deferred to verifier: live `claude -p` subprocess smoke (gated CREW_EVAL_LIVE=1, manual), live Ollama smoke (requires localhost:11434), live Gemini smoke (requires GEMINI_API_KEY).

## Inline finish trail

Per memory feedback_subagent_cutoff_recovery + feedback_finish_stuck_agent_inline: backend-dev hit context limit at tool 67 / 92k tokens with a mid-flight typecheck error on run-eval.ts:120 (exactOptionalPropertyTypes mismatch on `model?: string`). Main thread:

1. Added `| undefined` to chain type — typecheck green.
2. Ran format auto-fix (1 file in evals-providers.test.ts).
3. Removed obsolete SLICE-B1 gate test from evals-lib.test.ts (the agent dropped the gate per spec, but did not update the test asserting it).
4. Re-ran all gates green.
