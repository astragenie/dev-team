---
status: completed
---
# Task Handoff: SLICE-90: eval framework B3 — Azure + Bedrock + validate_with + Langfuse emit

- Created: 2026-06-21T12:31:45.169Z
- Completed: 2026-06-21T12:44:00.000Z
- From: backend-dev (cutoff at tool 69 / 118k tokens, finished inline by main thread)
- To: lead
- Objective: Ship SLICE-B3 — AzureOpenAIJudge + BedrockJudge + validate_with disagreement flow + Langfuse dataset emission.
- Allowed Scope: evals/providers/{azure-openai,bedrock}.ts, evals/lib/{langfuse-emit,judge,run-eval}.ts, evals/cli.ts, evals/agents/{crew-fullstack-dev,crew-inspector}.yaml, tests/evals-{cloud-providers,langfuse-emit}.test.ts, package.json (single dep add).
- Forbidden Scope: agents/*.md, scripts/validate-*.ts, npm dep adds other than @aws-sdk/client-bedrock-runtime, package.json version bumps, CHANGELOG entries, commits.
- Deliverable: Validation tier of the pluggable eval framework. JUDGE_REGISTRY now has 7 providers (generic-openai, groq, claude-p, ollama, gemini, azure, bedrock). validate_with disagreement flow lands. Langfuse dataset emission via raw fetch with graceful skip when keys absent.
- Changed Files:
  - evals/providers/azure-openai.ts (new, 147 LoC — OVER budget 90)
  - evals/providers/bedrock.ts (new, 117 LoC — within budget 160)
  - evals/lib/langfuse-emit.ts (new, 112 LoC — within budget 140)
  - evals/lib/run-eval.ts (edit, 309 → 485 LoC — OVER budget by 76)
  - evals/lib/judge.ts (edit, 119 → 137 LoC — within budget)
  - evals/cli.ts (edit, 177 → 195 LoC — within budget)
  - evals/agents/crew-fullstack-dev.yaml (edit, +12 LoC, validate_with block)
  - evals/agents/crew-inspector.yaml (edit, +12 LoC, validate_with block)
  - tests/evals-cloud-providers.test.ts (new, 490 LoC — OVER budget 300; 12+ cases per provider)
  - tests/evals-langfuse-emit.test.ts (new, 264 LoC — OVER budget 180; 8+ cases)
  - package.json (single dep: @aws-sdk/client-bedrock-runtime)
  - bun.lock (regenerated)
- Confidence: high
- Risks:
  - BedrockJudge body-shape switches per model family (anthropic / meta / mistral / amazon.nova). New families need extension.
  - Langfuse REST API shape stability — pinned to /api/public/datasets|dataset-runs|dataset-items. Breaks on Langfuse v3 migration.
  - validate_with parallel-then-filter wastes API budget. Optimization candidate.
  - run-eval.ts at 485 LoC near maintainability ceiling. SLICE-B4 should refactor.
  - AWS SDK ~5MB install footprint. Acceptable per slice rationale.
- Suggested Next Handoff: SLICE-91 (FEAT-169 SLICE-B4) — nightly GitHub Action, advisory + label-gated. Pre-mortem'd as risky (OAuth-in-CI unsolved per FEAT-162 triage). May defer.

## Self-Verify Gates

- typecheck: PASS
- lint: PASS (0 errors, 73 pre-existing complexity warnings)
- format:check: PASS
- evals-lib + evals-providers + evals-cloud-providers + evals-langfuse-emit: PASS 79 / 79
- dry-run smoke: PASS 2 / 2
- validate-manifests / validate-skills / validate-agents / validate-slices: PASS
- Deferred to verifier: live Azure / Bedrock / Langfuse / --validate disagreement smokes (CREW_EVAL_LIVE=1 + creds).

## Inline finish trail

backend-dev cutoff at tool 69 / 118k tokens with stub "All within budget now. Let me do a full validation run". Main thread ran the validation run, confirmed all gates green, wrote completion handoff. No code fixes needed — agent finished functionality before hitting limit.
