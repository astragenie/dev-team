<!-- AUTO-GENERATED — do not edit by hand. Regenerate: bun src/scripts/loop.mts snapshot-memory --repo <path> -->
# Autonomous Loop snapshot — 2026-06-29

_Manually refreshed during 2026-06-29 session retrospect — loop CLI lives in companion plugin, not this repo. The `snapshot-memory` subcommand was removed in v0.53; use `runner:status` for the structural state and edit this file by hand for the narrative._

## Backlog state

- Pending: 1 (FEAT-182)
- Triaged: 1 FEAT (FEAT-185 in flight — SLICE-A/B pending) + GEPA cluster (SLICE-96..106 + FEAT-183, FEAT-186)
- In-progress: 0
- Done: 117 (incl. SLICE-107 closed today)

## In-flight FEAT

- **FEAT-184** (P1, composite 0.81) — unify judge interface
  - S1 (gepa-core LLMJudge extension) shipped 2026-06-28 in gepa-core PR #1 / v0.2.1 npm publish 2026-06-29
  - **SLICE-107 (S2, dev-team adoption) shipped 2026-06-29** — verifier passed_with_notes (AC-3 deferred; needs operator GROQ_API_KEY + `CREW_EVAL_LIVE=1 bun run evals --live`)
  - FEAT-184 close-out pending pending operator AC-3 run

- **FEAT-185** (P2, composite 0.58) — move 6 providers to gepa-core
  - SLICE-A (ollama + generic-openai + groq + gemini): pending, gepa-core 0.2.1 → 0.3.0, 2 days
  - SLICE-B (azure + bedrock): pending, gepa-core 0.3.0 → 0.4.0, 2 days, depends on FEAT-185 S-A

- **FEAT-186** (P2, composite 0.55) — unified cost-aggregation contract
  - 5 proposed slices (S1 JudgeCost export → S2 dailyCapMeter ingestion → S3 cost-report renderer → S4 brief-me reader → S5 asymmetry+Langfuse), all autonomous_safe=false
  - **Phase 7 surfaced**: dispatcher operator task tracker MUST insert FEAT-186 S1+S2+S3 before SLICE-98 (GEPA S3) — else SLICE-98 ships against dual cost-shape problem
  - All depend on FEAT-184 (done) + FEAT-185 (in flight)

## Recent ships (2026-06-29 session)

| Tag / SHA | What |
|---|---|
| `7ab6592` | gepa-core .gitattributes LF pin (Biome formatter on Windows clones) |
| `2abe974` / v0.2.1 | gepa-core npm publish — payload identical to burned v0.2.0 (unpublish 24h lockout) |
| `705b68b` | SLICE-107 builder — 15 files, evals/ adopts gepa-core LLMJudge |
| `1df2b38` | dev-team `.npmrc` @astragenie scope override (user-global pinned GH Packages) |
| `23a2662` | SLICE-107 AC-5 follow-up — `runValidateWith` + 3 adapters now thread `opts.context.fixture` |
| `bf856c1` | Inspector verdict artifact for SLICE-107 |
| `cbaf3e6` | biome.json cognitive-complexity threshold 10 → 15 (Biome default) |
| `f578217` | Lint wave 1 — scripts/crew.ts (9 hotspots, 322 LoC restructure) |
| `c0ecea0` | Lint wave 2 — validate-routing-table.ts + validate-bundles.ts (4 hotspots) |
| `a935917` | Lint wave 3 — cost telemetry cluster (8 hotspots across 5 files) |
| `5c39214` | Lint wave 4 — workflow/claims/preflight/artifacts (6 hotspots across 4 files) |
| `5367bcb` | Lint wave 5 — leaf utilities (5 hotspots), **biome lint = 0 warnings** |
| `2bc41a8` | SLICE-107 close ceremony + FEAT-185 decomposition |

## Session telemetry

- Cognitive-complexity backlog cleared (76 → 0 in single session). Threshold bump 10 → 15 cleared 44 cheap; 5 refactor waves cleared the remaining 32 genuine hotspots. New memory: [[biome-cognitive-complexity-threshold]].
- gepa-core npm publish ceremony: hit Windows CRLF / Biome formatter trap, then 2FA token (without bypass) blocked publish, then 24h unpublish lockout on v0.2.0. v0.2.1 escapes the lockout with identical payload. New memories: [[gepa-core-v0.2.0-unpublish-lockout]] + [[npmrc-astragenie-scope-override]].
- SLICE-107 builder dispatch hit cutoff at tool 82 / 18 min, resumed via SendMessage and finished cleanly. Builder used `isolation: worktree` mode; worktree auto-merged to main on completion.
- Verifier ran in 104s with 19 tool calls. PM decomp ran in 133s with 9 tool calls. Both background; main thread did inline memory writes + snapshot refresh in parallel.

## Open architectural questions

- AC-3 deferred for SLICE-107: when is the operator's live-judge baseline available? Without it, FEAT-185 SLICE-A can't run snapshot-diff (AC-4) — same statistical gate needs a baseline.
- gepa-core release cadence: 0.2.1 → 0.3.0 → 0.4.0 → 0.5.0 across FEAT-185 S-A, FEAT-185 S-B, FEAT-186 S1. Each is MINOR (additive entry points / type exports). MAJOR risk only if AC-2 hardening forces a constructor-signature change on already-shipped exports.
- 36-cell CI matrix on gepa-core (3 OSes × 2 SDK states × 6 providers) — staged: SLICE-A scaffolds 24 cells, SLICE-B extends to 36.
- When does `@astragenie/llm-providers` extract trigger? Per Options Considered (FEAT-185 Option 3 rejected): ≥2 external consumers + interface stable 2 months. Not met yet.

## How to use this file

- Referenced from `CLAUDE.md` via `@.claude/artifacts/loop/loop-snapshot.md` — picked up at session start.
- The `runner:snapshot-memory` subcommand was removed in v0.53 (see `runner:status` for structural state); the narrative section is now manually maintained.
