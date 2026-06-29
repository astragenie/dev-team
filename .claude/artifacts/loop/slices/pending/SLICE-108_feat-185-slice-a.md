---
id: SLICE-108
feat: FEAT-185
status: pending
created: 2026-06-29
title: "FEAT-185 SLICE-A — move 4 low-blast providers to gepa-core 0.3.0 + CI matrix scaffold"
autonomous_safe: false
risk_band: 0.50
estimated_loc: 800
estimated_files: 13
repos:
  - gepa-core
  - dev-team
depends_on:
  - "FEAT-184 (closed via SLICE-107 2026-06-29)"
---

# SLICE-108: FEAT-185 SLICE-A — move 4 low-blast providers to gepa-core 0.3.0

## Intent

Relocate 4 low-blast-radius adapters (ollama, generic-openai, groq, gemini) from
`dev-team/evals/providers/*.ts` into `@astragenie/gepa-core/providers/*` as
discrete entry points. Cut gepa-core 0.3.0 (MINOR — purely additive). Bump
dev-team dep. Establish the {linux,windows,macos} × {with-sdk,without-sdk} CI
matrix for these 4 providers (16 cells) so SLICE-109 inherits the scaffolding.
claude-p stays in dev-team per AC-9.

## Scope

### gepa-core repo (`C:\work\mega\gepa-core`)
1. Create `src/providers/ollama/index.ts` — port from
   `dev-team/evals/providers/ollama.ts`. Constructor takes `{ host?, model?,
   temperature?, timeoutMs? }`. NO `process.env` access — env reads stay in
   the dev-team shim.
2. Create `src/providers/generic-openai/index.ts` — port from
   `dev-team/evals/providers/generic-openai.ts`. Constructor takes
   `{ baseUrl, apiKey, model, temperature?, maxTokens? }`.
3. Create `src/providers/groq/index.ts` — port from
   `dev-team/evals/providers/groq.ts`. Strip `process.env` read at the
   pre-refactor line 45 (AC-2 grep gate violator). Constructor takes
   `{ apiKey, model, temperature? }`.
4. Create `src/providers/gemini/index.ts` — port from
   `dev-team/evals/providers/gemini.ts`. Constructor takes `{ apiKey, model,
   temperature?, maxOutputTokens?, timeoutMs? }`. Dynamic-import
   `@google/generative-ai` as optional peer dep; throw install-instruction
   error on missing SDK.
5. Update `package.json`:
   - Bump `version: "0.2.1"` → `"0.3.0"`
   - Add `exports`:
     - `./providers/ollama` → `./src/providers/ollama/index.ts`
     - `./providers/generic-openai` → `./src/providers/generic-openai/index.ts`
     - `./providers/groq` → `./src/providers/groq/index.ts`
     - `./providers/gemini` → `./src/providers/gemini/index.ts`
   - Add `peerDependenciesMeta.@google/generative-ai.optional: true` (groq
     uses fetch only; ollama uses fetch only; generic-openai uses fetch only;
     only gemini has an SDK peer dep at this stage)
6. Update `CHANGELOG.md` — 0.3.0 entry:
   - 4 new entry points
   - Naming rationale: `providers/` not `judges/` (adapters serve
     candidate-dispatch + judge roles)
   - AC-9 callout: claude-p stays in dev-team (subprocess + Windows-specific
     + FEAT-173 tempdir-isolation logic)
   - Peer-dep table
7. Update `README.md` — peer-dep table (provider → SDK → install command).
8. Add `scripts/check-no-env-reads.ts` — AC-2 grep gate. Greps
   `src/providers/**/*.ts` for `process.env`, exits non-zero if any match.
   Wire into `bun run lint` or its own `bun run check:no-env`. Watch for
   false-negative on `process['env']` bracket-access (regex must cover both
   `process.env.X` and `process['env']['X']`).
9. CI matrix scaffold under `.github/workflows/`:
   - New job `peer-dep-matrix` with strategy: `os: [ubuntu-latest,
     windows-latest, macos-latest]`, `sdk-state: [with-sdk, without-sdk]`.
   - 4 provider modules × 4 cells per provider = 16 cells. For each:
     - `without-sdk`: import the entry point, assert it throws
       `Error("Install '<sdk>' to use the <provider> judge: npm install
       <sdk>")` with exact SDK name + install command.
     - `with-sdk`: install the SDK, import, instantiate, smoke test.
10. `npm publish --access public` ceremony (after local green + tag):
    - `git tag -a v0.3.0 -m "v0.3.0 — providers/ollama, /generic-openai, /groq, /gemini"`
    - `npm publish --access public`
    - Verify via `npm view @astragenie/gepa-core version` → `0.3.0`.

### dev-team repo (`C:\work\mega\dev-team`)
1. `package.json`: bump `"@astragenie/gepa-core": "^0.2.1"` → `"^0.3.0"`.
2. Rewrite shims `evals/providers/{ollama,generic-openai,groq,gemini}.ts`:
   - Import the relocated class from `@astragenie/gepa-core/providers/<name>`.
   - Read env vars (e.g. `process.env.GROQ_API_KEY`,
     `process.env.GEMINI_API_KEY`, `process.env.OLLAMA_HOST`) and pass them
     as constructor config.
   - Re-export the relocated class so existing `evals/lib/judge.ts`
     `JUDGE_REGISTRY` factories continue to work.
3. Run YAML compat — `crew-fullstack-dev.yaml` + `crew-inspector.yaml` parse
   unchanged.
4. CHANGELOG entry: provider extraction to gepa-core 0.3.0.

## Acceptance criteria

- [ ] **AC-1: 4 of 6 provider entry points resolve from `@astragenie/gepa-core`.** Given gepa-core 0.3.0 published, When `import { OllamaJudge } from "@astragenie/gepa-core/providers/ollama"` (and the same for `generic-openai`, `groq`, `gemini`), Then each import resolves; instantiating with valid config works; for gemini without `@google/generative-ai` installed, the import throws `Error("Install '@google/generative-ai' to use the gemini judge: npm install @google/generative-ai")` verbatim. Pass-fail: `bun test gepa-core/tests/providers/*.test.ts` returns 0 with one missing-SDK case per relevant provider.

- [ ] **AC-2: Zero `process.env` reads in moved providers.** Given gepa-core HEAD, When `grep -nE "process\.env|process\[['\"]env['\"]\]" src/providers/**/*.ts` runs, Then output is empty (zero hits). Pass-fail: `bun run scripts/check-no-env-reads.ts` exits 0; CI step fails if any hit appears.

- [ ] **AC-3: YAML spec compat preserved.** Given `specs/crew-fullstack-dev.yaml` and `specs/crew-inspector.yaml`, When parsed via the existing provider lookup, Then both specs parse without error and resolve provider names to the relocated classes. Pass-fail: `bun test tests/evals-providers.test.ts` returns 0; existing YAML-parse cases stay green.

- [ ] **AC-4: Snapshot-diff with tolerance band.** Given the 4 providers in this slice, When pre-refactor and post-refactor runs are compared, Then ollama at `temperature: 0` produces byte-identical PASS/FAIL + score + token counts; groq and gemini run N≥5 each pre and post and satisfy (a) PASS/FAIL identical per test, (b) mean score within ±0.05, (c) mean token counts within ±5%. Pass-fail: drift outside band fails the AC; run logs captured under `evals/runs/`. REQUIRES `GROQ_API_KEY` + `GEMINI_API_KEY` — carries forward from SLICE-107 AC-3 deferral; operator gate.

- [ ] **AC-5: gepa-core 0.3.0 MINOR ships with peer-dep table.** Given gepa-core `package.json`, `CHANGELOG.md`, and `README.md`, When inspected, Then `version === "0.3.0"`, CHANGELOG `## 0.3.0` entry lists the 4 new entry points + naming-rename rationale + AC-9 claude-p-stays callout, and README's peer-dep table maps each provider to its SDK + install command. Pass-fail: `node ./scripts/validate-manifests.ts` exits 0; `npm view @astragenie/gepa-core version` returns `0.3.0` post-publish.

- [ ] **AC-6: dev-team integration green.** Given dev-team `package.json` bumped to `"@astragenie/gepa-core": "^0.3.0"`, When `bun install && bun run typecheck && bun run lint && bun run test && bun run e2e:smoke` runs, Then all pass. Cost-attribution byte-for-byte unchanged on deterministic fixture replays (`bun run evals --judge ollama --prompt fullstack-dev` produces identical `evals/runs/<run-id>.json` pre vs post). Pass-fail: every gate exit code 0; deterministic diff is empty.

- [ ] **AC-8: CI matrix scaffold covers 4 providers across 3 OSes × 2 SDK states.** Given gepa-core `.github/workflows/`, When pushed, Then the new `peer-dep-matrix` job runs `{ubuntu-latest, windows-latest, macos-latest} × {with-sdk, without-sdk}` per provider; without-sdk asserts the install-instruction error with exact SDK name + install command; with-sdk smoke-instantiates each adapter. Pass-fail: 16 matrix cells (4 providers × 4 cells) report success on the SLICE-108 commit; SLICE-109 extends to 36 cells.

- [ ] **AC-9: claude-p stays in dev-team.** Given `dev-team/evals/providers/claude-p.ts`, When inspected post-slice, Then the file is unchanged. CHANGELOG 0.3.0 entry includes a "claude-p stays in dev-team" callout citing FEAT-185 Option 1. Pass-fail: `git diff main -- evals/providers/claude-p.ts` shows zero lines changed during the SLICE-108 commit.

## Out of scope

- azure + bedrock providers (SLICE-109).
- Cost-aggregation across pipelines (FEAT-186).
- claude-p relocation (AC-9 — explicitly out).
- New providers (anthropic, vertex, openrouter) — separate FEATs.

## Risks (slice-level pre-mortem from PM decomposition)

1. **Most likely failure:** without-sdk matrix cell on Windows passes silently
   because the install-instruction error path uses a string-match the test
   doesn't assert on. OR gemini SDK dynamic-import behavior on without-sdk
   differs between linux and windows. Mitigation: assert the EXACT error
   message string (SDK name + install command) per cell.
2. **Rollback:** unpublish-impossible on npm. Rollback = dev-team pins back
   to `@astragenie/gepa-core@0.2.1` + re-inlines the 4 adapters from this
   slice's deletions. SLICE-109 blocked until rollback path documented.
3. **Coverage gap:** the 4 newly-published entry points have no contract
   test asserting they remain importable across gepa-core minor bumps. Add a
   snapshot of the public export surface (introspect `package.json#exports`
   keys + `import * as X` round-trip per entry point).

## Pre-flight

1. Confirm `@astragenie/gepa-core@0.2.1` is the current published version
   (was 2026-06-29 SLICE-107 ship): `npm view @astragenie/gepa-core version`
   → expect `0.2.1`.
2. Confirm dev-team `evals/providers/{ollama,generic-openai,groq,gemini}.ts`
   currently import `LLMJudge` from `@astragenie/gepa-core` (SLICE-107
   landed this).
3. Confirm working tree clean before starting cross-repo work.
4. Decide branch strategy: feature branch in each repo OR direct-to-main with
   dev.stable carve-out (per CLAUDE.md commit discipline).
