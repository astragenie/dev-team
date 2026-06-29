---
status: active
---
# Run Brief: SLICE108: FEAT-185 SLICE-A — move 4 low-blast providers to gepa-core 0.3.0 + CI matrix scaffold

- Created: 2026-06-29T11:23:46.870Z
- Tier: full
- Goal: -
- Mode: autonomous
- Pace: unattended
- Owner: loop
- Status: active
- Summary: -
- Scope:
  - - [ ] **AC-1: 4 of 6 provider entry points resolve from `@astragenie/gepa-core`.** Given gepa-core 0.3.0 published
  - When `import { OllamaJudge } from "@astragenie/gepa-core/providers/ollama"` (and the same for `generic-openai`
  - `groq`
  - `gemini`)
  - Then each import resolves; instantiating with valid config works; for gemini without `@google/generative-ai` installed
  - the import throws `Error("Install '@google/generative-ai' to use the gemini judge: npm install @google/generative-ai")` verbatim. Pass-fail: `bun test gepa-core/tests/providers/*.test.ts` returns 0 with one missing-SDK case per relevant provider.

- [ ] **AC-2: Zero `process.env` reads in moved providers.** Given gepa-core HEAD
  - When `grep -nE "process\.env|process\[['\"]env['\"]\]" src/providers/**/*.ts` runs
  - Then output is emp
- Out Of Scope:
  - - azure + bedrock providers (SLICE-109).
- Cost-aggregation across pipelines (FEAT-186).
- claude-p relocation (AC-9 — explicitly out).
- New providers (anthropic
  - vertex
  - openrouter) — separate FEATs.
- Planned Files: -
- Next Step: Begin implementation

