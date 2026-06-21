<!-- AUTO-GENERATED — do not edit by hand. Regenerate: bun src/scripts/loop.mts snapshot-memory --repo <path> -->
# Autonomous Loop snapshot — 2026-06-21

_Manually refreshed during 2026-06-21 session retrospect — loop CLI lives in companion plugin, not this repo. Regenerate via `/runner:snapshot-memory` from any consumer install._

## Backlog state

- Pending: 0
- Triaged: 1 (FEAT-170 in flight: SLICE-92/93 shipped, SLICE-94/95 pending)
- In-progress: 0
- Done: 116 (incl. FEAT-167 narrowed close + FEAT-169 3/4 with SLICE-91 deferred)

## In-flight FEAT

- **FEAT-170** (P1, composite 0.69) — fix fullstack-dev
  - SLICE-92 (A) shipped — diagnostic baseline (claude-p live eval 2/7 → identified 5 failure modes)
  - SLICE-93 (B) shipped — prompt shrink 397→313 + extract to fullstack-cross-layer skill
  - SLICE-94 (C) pending — routing classifier fix
  - SLICE-95 (D) pending — label-gated CI regression gate

## Proposed but not opened

- **FEAT-171** — candidate dispatch in eval framework. Surfaced by SLICE-93 post-shrink diagnosis. `evals/lib/run-eval.ts` currently treats fixture as candidate output; needs `claude -p` subprocess dispatch step. ~80 LoC + `--candidate-live` flag.

## Deferred

- **FEAT-169 SLICE-91** (B4) — nightly CI eval workflow. Trigger: OAuth-in-CI feasible (self-hosted runner OR claude-code-action non-issue OAuth support).

## Recent ships (2026-06-21 session)

| Tag / SHA | What |
|---|---|
| v0.38.0 / 34aa2c4 | Cost-config refactor (CREW_* env vars → features block) |
| dfd5a2e | Release-gate lint + format cleanup for v0.38.0 |
| aea1c62 | FEAT-167 close + FEAT-169 open |
| 34e2a48 | SLICE-88 — eval framework B1 (judge interface + Generic + Groq + dry-run + 1 ref spec) |
| 6af3d29 | SLICE-89 — eval framework B2 (ClaudeP + Ollama + Gemini + llm-rubric + 2 ref specs) |
| 14a5f84 | SLICE-90 — eval framework B3 (Azure + Bedrock + validate_with + Langfuse emit) |
| 73a19e4 | FEAT-169 close (3/4) + FEAT-170 open |
| cde4f93 | SLICE-92 — fullstack-dev diagnostic baseline (5 new fixtures + claude-p live eval) |
| 116fd6a | SLICE-93 — fullstack-dev prompt shrink 397→313 + skill extraction |

## Session telemetry

- Subagent dispatch + inline-finish pattern: SLICE-88/89/90 all hit cutoff at tool 67–71, finished inline by main thread. SLICE-93 ran fully inline — no cutoff, no info loss. New memory: [[feedback-inline-vs-dispatch]].
- Eval framework limitation surfaced: candidate dispatch missing in run-eval.ts; behavioral asserts blocked until FEAT-171. New memory: [[project-eval-framework-state-2026-06-21]].
- Subscription-only eval memory loosened: free-tier judges (Groq/Gemini/Cerebras/Ollama) acceptable; paid judges (Azure/Bedrock) for validation tier only.

## Open architectural questions

- When does `@astragenie/crew-eval` extract trigger? Current criteria: ≥2 external plugin authors ask, ≥5 third-party specs, interface stable 2 months. None observed yet.
- Should the eval framework grow `--candidate-live` in FEAT-171 or stay limited to judge-live? Pro: behavioral evaluation. Con: rate-limit budget burn (~10 min per sweep).
- Other agents (architect, lead, inspector, builders) — do they have hidden cap-pressure similar to fullstack-dev? Re-baseline campaign as separate FEAT once FEAT-170 closes.

## How to use this file

- Referenced from `CLAUDE.md` via `@.claude/artifacts/loop/loop-snapshot.md` — picked up at session start.
- Regenerate via `/runner:snapshot-memory` from any consumer install of the loop companion plugin.
