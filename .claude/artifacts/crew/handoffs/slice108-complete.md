---
slice: SLICE-108
feat: FEAT-185
phase: SLICE-A
status: builder-complete
created: 2026-06-29
owner: fullstack-dev
next_owner: crew:inspector
---

# SLICE-108 Builder Handoff — FEAT-185 SLICE-A

## Objective

Relocate 4 low-blast-radius judge adapters (ollama, generic-openai, groq, gemini)
from `dev-team/evals/providers/*.ts` into `@astragenie/gepa-core/providers/*` as
discrete entry points. Cut gepa-core 0.3.0 (MINOR, additive). Bump dev-team dep.
Establish CI matrix scaffold for 3 OSes × 2 SDK states × 4 providers.

## Evidence

### gepa-core release

- **Commit**: `db194b0` on `origin/main` — `feat(providers): 0.3.0 — ollama, generic-openai, groq, gemini entry points (FEAT-185 SLICE-A)`
- **Tag**: `v0.3.0` pushed to `https://github.com/astragenie/gepa-core.git`
- **npm publish**: `+ @astragenie/gepa-core@0.3.0` (operator handled token rotation during session)
- **Registry verify**: `npm view @astragenie/gepa-core version` → `0.3.0` ✓
- **Exports verify**: `npm view @astragenie/gepa-core exports` confirms all 4 entry points live

### dev-team integration

- **Branch**: `refactor/feat-185-slice-a-providers`
- **Commit**: `1882bd5` — `refactor(evals): extract 4 providers to gepa-core 0.3.0 shims (FEAT-185 SLICE-A)`
- **7 files changed**: package.json, package-lock.json, CHANGELOG.md, evals/providers/{ollama,generic-openai,groq,gemini}.ts

## Per-AC Results

| AC | Status | Evidence |
|---|---|---|
| AC-1: 4 entry points resolve from gepa-core | PASS | `npm view @astragenie/gepa-core exports` shows all 4; `bun test tests/providers/*.test.ts` 32 pass in gepa-core |
| AC-2: zero process.env in moved providers | PASS | `bun run scripts/check-no-env-reads.ts` exits 0; script covers dot-access and bracket-access patterns; comment lines skipped |
| AC-3: YAML compat preserved | PASS | `bun test tests/evals-providers.test.ts` → 31 pass, 0 fail (includes groq/ollama/gemini YAML-driven cases) |
| AC-4: snapshot-diff with tolerance band | SKIP | REQUIRES GROQ_API_KEY + GEMINI_API_KEY — carried forward from SLICE-107 AC-3 deferral; operator gate |
| AC-5: gepa-core 0.3.0 MINOR ships with peer-dep table | PASS | `package.json` version=0.3.0; CHANGELOG `## 0.3.0` entry; README peer-dep table; naming rationale + AC-9 callout present |
| AC-6: dev-team integration green | PASS | `bun run lint && bun run format:check && bun run typecheck && bun run test` all pass; 1047 pass, 117 skip, 0 fail |
| AC-8: CI matrix scaffold 4 providers × 3 OS × 2 SDK | PASS | `.github/workflows/peer-dep-matrix.yml` added to gepa-core; 24 matrix cells; each cell runs AC-2 check + provider smoke; SLICE-109 extends to 36 cells |
| AC-9: claude-p stays in dev-team | PASS | `git diff main -- evals/providers/claude-p.ts` → zero output; CHANGELOG 0.3.0 in gepa-core carries explicit callout |

## Changed Files

### gepa-core (`C:\work\mega\gepa-core`)

- `package.json` — version 0.2.1→0.3.0; exports map for 4 provider entry points; `check:no-env` script
- `CHANGELOG.md` — `## 0.3.0` entry: naming rationale, AC-9 callout, peer-dep table
- `README.md` — provider quick-start section + peer-dep table
- `src/providers/ollama/index.ts` — OllamaJudge (config-only, LLMJudge impl)
- `src/providers/generic-openai/index.ts` — GenericOpenAIJudge (config-only, LLMJudge impl)
- `src/providers/groq/index.ts` — GroqJudge extends GenericOpenAIJudge (config-only)
- `src/providers/gemini/index.ts` — GeminiJudge (config-only, native fetch)
- `scripts/check-no-env-reads.ts` — AC-2 grep gate (comment-aware)
- `tests/providers/{ollama,generic-openai,groq,gemini}.test.ts` — config smoke + offline reject per provider
- `.github/workflows/peer-dep-matrix.yml` — CI matrix scaffold (24 cells)

### dev-team (`C:\work\mega\dev-team`, branch `refactor/feat-185-slice-a-providers`)

- `package.json` — `@astragenie/gepa-core` ^0.2.1→^0.3.0
- `package-lock.json` — lockfile updated
- `CHANGELOG.md` — provider extraction entry + claude-p-stays callout
- `evals/providers/ollama.ts` — shim: reads OLLAMA_HOST, delegates to gepa-core
- `evals/providers/generic-openai.ts` — shim: pass-through (caller supplies apiKey)
- `evals/providers/groq.ts` — shim: reads GROQ_API_KEY, bridges Partial<GenericOpenAIConfig>→GroqConfig
- `evals/providers/gemini.ts` — shim: reads GEMINI_API_KEY, guards empty-key before fetch

## Deferrals

- **AC-4** (snapshot-diff tolerance): SKIP — requires GROQ_API_KEY + GEMINI_API_KEY. Carry-forward from SLICE-107 AC-3. Operator gate.

## Risks Observed

1. **npm publish token**: the `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` token in `~/.npmrc` returned 401 during this session. Operator handled token rotation. The token stored in `~/.npmrc` should be refreshed so SLICE-109 publish is self-service.

2. **GeminiJudge empty-key guard**: the gepa-core implementation uses native fetch and returns HTTP 403 on invalid/empty key (no fast-fail guard). The dev-team shim re-adds the `throw new Error("GeminiJudge: GEMINI_API_KEY is not set")` guard on `evaluate()` to preserve the test contract in `tests/evals-providers.test.ts`. This is a behavioral divergence from the gepa-core base — if the gepa-core GeminiJudge adds its own guard in a future release, the shim guard can be dropped.

3. **Groq constructor bridge**: `GroqJudge` in the old shim extended `GenericOpenAIJudge`; the new shim wraps `_GroqJudge` via composition. The `lastRateLimit` property is proxied via a getter. If a future caller reassigns `lastRateLimit` on the shim instance (rather than reading it), the assignment will not propagate to the inner `_GroqJudge`. This is low-risk given current usage (read-only in callers).

4. **CI matrix smoke on Windows**: the `peer-dep-matrix.yml` uses `shell: bash` for inline Bun script execution. On Windows runners this requires Git Bash. If the Windows runner doesn't have bash on PATH, cells will fail. Mitigation: SLICE-109 can add a PowerShell variant if the matrix fails.

## Confidence

High — both repos green on all four CI gates. The only non-PASS AC is AC-4 which requires live API keys (operator gate).

## Suggested Next

- Inspector review of this handoff and the shim design (especially GeminiJudge guard + GroqJudge composition).
- After review PASS: operator merges `refactor/feat-185-slice-a-providers` to dev-team main.
- Refresh npm auth token in `~/.npmrc` before SLICE-109 starts.
- SLICE-109: extend CI matrix to 36 cells (azure + bedrock providers).
