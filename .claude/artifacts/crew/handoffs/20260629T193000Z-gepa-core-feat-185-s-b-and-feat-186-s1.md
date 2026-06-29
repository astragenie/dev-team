---
kind: cross-repo-handoff
target_repo: C:\work\mega\gepa-core
created: 2026-06-29T19:30:00Z
authored_in: dev-team
authored_by: lead-session
covers:
  - FEAT-185 SLICE-B (azure + bedrock provider extraction → gepa-core 0.4.0)
  - FEAT-186 S1 (JudgeCost canonical type export → gepa-core 0.4.1 OR rolled into 0.4.0)
session_note: Per memory feedback_marketplace_session_constraint.md, cross-repo source edits should happen in the target repo's own session. Open a session in C:\work\mega\gepa-core to consume this handoff.
---

# Cross-Repo Handoff — gepa-core: FEAT-185 SLICE-B + FEAT-186 S1

## Why this handoff exists

Two upstream slices that live in `@astragenie/gepa-core` were spec'd and
triaged in dev-team but cannot be implemented from a dev-team session
(cross-repo source-edit constraint). This handoff captures everything
the gepa-core session needs to execute both slices in a single
publish ceremony.

Both slices are **autonomous_safe: false** — they require human-in-loop
on review per the cross-plugin contract policy. Don't auto-merge.

---

## SLICE-B — FEAT-185 SLICE-B: azure + bedrock extraction → gepa-core 0.4.0

### Intent

Relocate the 2 remaining cloud judge adapters (azure-openai, bedrock)
from `dev-team/evals/providers/{azure-openai,bedrock}.ts` into
`@astragenie/gepa-core/providers/{azure-openai,bedrock}` as discrete
entry points. Cut gepa-core **0.4.0** (MINOR — purely additive). Bump
dev-team dep. Extend the existing CI matrix to cover these 2 new
providers (16 → 24 cells; without-sdk path stays identical to SLICE-A
scaffolding).

### Source files to port

In dev-team (preserve as `git mv`-style refs in your handoff back):

- `evals/providers/azure-openai.ts` — port to `gepa-core/src/providers/azure-openai/index.ts`
- `evals/providers/bedrock.ts` — port to `gepa-core/src/providers/bedrock/index.ts`

Constructor signatures (read these from the source before porting; they
mirror what's already in dev-team's shim layer):

- `AzureOpenAIJudge({ endpoint, apiKey, deployment, apiVersion?, model?, temperature?, maxTokens? })`
- `BedrockJudge({ region, modelId?, accessKeyId?, secretAccessKey?, temperature?, maxTokens? })`

### Mandatory hygiene (carries forward from SLICE-A AC-2)

**NO `process.env` reads** in `gepa-core/src/providers/*`. Strip them
during port — env reads stay in the dev-team shim. Verify with the
existing CI gate:

```bash
cd gepa-core
bun run check:no-env
# exit 0 required across all 6 providers (4 from 0.3.0 + 2 new)
```

### Package surface

`gepa-core/package.json` 0.3.1 → 0.4.0:

- Add `exports`:
  - `./providers/azure-openai` → `./src/providers/azure-openai/index.ts`
  - `./providers/bedrock` → `./src/providers/bedrock/index.ts`
- Add optional peer dep entries IF either provider has an SDK fast path:
  - `@aws-sdk/client-bedrock-runtime` (bedrock, optional)
  - Azure uses native fetch — no peer dep
- Update `package.json` `version` field
- Update `CHANGELOG.md` 0.4.0 entry — call out: 2 new entry points,
  rationale (`providers/` not `judges/`), 6/6 cloud providers now
  centralized, claude-p still in dev-team per FEAT-185 AC-9.

### dev-team shim updates

After gepa-core 0.4.0 publishes (verify on npmjs.org via `npm view`),
in the **dev-team session**:

- Reduce `evals/providers/azure-openai.ts` + `bedrock.ts` to thin shims
  matching the existing pattern (groq, ollama, gemini, generic-openai
  in dev-team are the templates). Each shim:
  - Imports the relocated class from `@astragenie/gepa-core/providers/<name>`
  - Reads env vars in the shim constructor
  - Forwards to inner class
  - Re-exports the config type
- Update `evals/lib/judge.ts` `JUDGE_REGISTRY` `azure` and `bedrock`
  factories the same way the FEAT-185 SLICE-A factories were updated
  (commit `2341b32` in dev-team has the pattern).
- Bump `@astragenie/gepa-core` peer-dep version in `dev-team/package.json`
  to `^0.4.0`.

### CI matrix extension

Extend `gepa-core/.github/workflows/peer-dep-matrix.yml`:

- Add `azure-openai` and `bedrock` to the providers matrix dimension
- Cell count: 3 OSes × 2 SDK states × 6 providers = 36 cells (up from 24)
- without-sdk cells for azure / bedrock follow the same identical-smoke
  pattern as SLICE-A (no peer-dep, just confirm the entry point
  resolves). Distinct without-sdk assertions are SLICE-108 NICE_TO_HAVE
  follow-up (gepa-core 0.4.1 patch).

### Acceptance criteria (cribbed from FEAT-185 SLICE-A pattern)

1. `gepa-core` exports `./providers/azure-openai` and `./providers/bedrock`
2. `bun run check:no-env` exits 0 (no `process.env` in relocated files)
3. gepa-core `bun run test` covers AzureOpenAI + Bedrock describe() +
   evaluate() shape + auth-missing guard
4. Live-judge parity gate **carry-forward** from SLICE-107 / SLICE-108
   AC-4: deferred to operator with credentials (same status as parent
   artifact `.claude/artifacts/crew/validations/20260629T125000Z-...`).
   Operator can re-run with `AZURE_OPENAI_API_KEY` + `AWS_ACCESS_KEY_ID`
   set if available; otherwise document deferral.
5. gepa-core `package.json` `version=0.4.0`; CHANGELOG entry present
6. dev-team's `bun run lint`, `bun run format:check`, `bun run typecheck`,
   `bun run test` all green after the shim swap
7. dev-team's `@astragenie/gepa-core` lockfile resolves to 0.4.0 from
   npmjs.org with sha512 integrity
8. CI matrix extended to 36 cells; smoke-script identical for new cells
9. claude-p stays in dev-team (do NOT relocate per FEAT-185 AC-9 — that
   AC is repeated for SLICE-B as a guard)

### Pre-flight before starting

```bash
# In gepa-core repo:
git pull origin main
npm view @astragenie/gepa-core version   # should show 0.3.1
git log -5 --oneline                      # confirm at last green main
```

---

## FEAT-186 S1 — JudgeCost canonical export → gepa-core 0.4.1 OR rolled into 0.4.0

### Intent

Define and export `JudgeCost` interface from `@astragenie/gepa-core`.
Wire shape into `LLMJudge.evaluate()` return type and `Trial.score`
typing. **Pure type widening over what FEAT-184 already returns** — no
behavior change. Cut gepa-core MINOR release (additive).

### Sequencing decision

Per FEAT-186 risk_notes line 28: "ship gepa-core S1 ONLY after FEAT-185
fully lands so all 6 cloud providers are in the same repo and can be
tested together against the new shape simultaneously."

Two paths:

- **Path A (recommended): roll into 0.4.0.** After SLICE-B lands but
  BEFORE publishing 0.4.0, add `JudgeCost` export. Single publish,
  single CHANGELOG entry, 6 providers tested against new shape together.
- **Path B: separate 0.4.1 patch.** Publish 0.4.0 (SLICE-B only), then
  immediately publish 0.4.1 with `JudgeCost`. Two publishes, more
  ceremony, but cleaner change isolation.

Recommend Path A — saves a publish cycle. Either way, the shape and
contract test are identical.

### Canonical shape

In `gepa-core/src/types/cost.ts` (new file):

```ts
/**
 * Canonical cost shape emitted by an LLMJudge evaluate() call.
 *
 * `usd` and `latency_ms` are required — every adapter MUST populate them.
 * `tokens?` is optional — claude-p subprocess judge cannot reliably emit
 * token counts; cloud providers (groq, gemini, azure, bedrock, openai)
 * always populate. ollama populates from response.eval_count + prompt_eval_count.
 * `cache?` is optional — only providers with explicit prompt-cache reporting
 * populate (Anthropic Claude, OpenAI Batch with cache headers). groq, ollama,
 * gemini omit; consumers must NOT require it.
 */
export interface JudgeCost {
  usd: number;
  latency_ms: number;
  tokens?: { in: number; out: number };
  cache?: { hit: boolean; tokens_saved?: number };
}
```

Export from `gepa-core/src/index.ts`:

```ts
export type { JudgeCost } from "./types/cost.ts";
```

### Wiring

- `LLMJudge.evaluate()` return type ALREADY emits the flat fields
  per FEAT-184 (`cost_usd`, `latency_ms`, `tokens?`). FEAT-186 S1
  re-shapes this into a single `JudgeCost` field on the result:

  ```ts
  // Before (FEAT-184):
  interface LLMJudgeResult {
    pass: boolean;
    score: number;
    rationale: string;
    raw?: string;
    cost_usd?: number;
    latency_ms?: number;
    tokens?: { in: number; out: number };
  }

  // After (FEAT-186 S1):
  interface LLMJudgeResult {
    pass: boolean;
    score: number;
    rationale: string;
    raw?: string;
    cost?: JudgeCost;   // ← new canonical container
    // Legacy fields kept for one MINOR cycle (deprecated):
    cost_usd?: number;       // @deprecated — use cost.usd
    latency_ms?: number;     // @deprecated — use cost.latency_ms
    tokens?: { in: number; out: number };  // @deprecated — use cost.tokens
  }
  ```

  Adapters populate BOTH the new `cost` field AND the legacy fields
  for one MINOR cycle. Removal scheduled for gepa-core 0.6.0 (NEVER
  retroactive MAJOR).

### Contract test (mandatory — pre-mortem mitigation)

Per FEAT-186 SLICE-1 risk_notes: "tokens?:{in,out} optionality slips
on one provider's mock test, retroactively forcing MAJOR."

Add `gepa-core/test/judge-cost-shape.test.ts` asserting:

1. `JudgeCost` is in the public export surface from `@astragenie/gepa-core`
2. Across ALL 6 adapter mocks (ollama, generic-openai, groq, gemini,
   azure-openai, bedrock — claude-p is in dev-team so cannot test here),
   the returned `cost.tokens` field is optional — at least one adapter
   omits it under a documented condition (claude-p shape parity check
   stays in dev-team).
3. `cost.cache` is optional across all 6 — at least one adapter omits it.
4. `cost.usd` and `cost.latency_ms` are REQUIRED — present on every
   evaluate() call from every adapter.

### Acceptance criteria (FEAT-186 S1)

- `JudgeCost` exported from `@astragenie/gepa-core` (top-level)
- Contract test passes across all 6 cloud providers in gepa-core
- `LLMJudgeResult` carries new `cost?: JudgeCost` field alongside legacy
  flat fields (one-MINOR-cycle backward-compat window)
- gepa-core CHANGELOG documents deprecation of `cost_usd` / `latency_ms`
  / `tokens` flat fields with removal scheduled for 0.6.0
- dev-team consuming the new shape (via lockfile bump) shows zero
  regressions in `bun run test` post-update

### Wiring into dev-team (separate dev-team session)

After gepa-core 0.4.0 (Path A) OR 0.4.1 (Path B) publishes:

- Bump `@astragenie/gepa-core` peer-dep to `^0.4.0` or `^0.4.1`
- Update `evals/lib/run-eval.ts` to read `result.cost?.usd ?? result.cost_usd`
  (transitional dual-read pattern)
- Update `evals/lib/langfuse-emit.ts` to read from `cost` if present, else
  fall back to legacy flat fields
- Cost telemetry pipeline in `scripts/lib/cost/` reads the same way

### Out of scope (FEAT-186 S1 ONLY)

- `dailyCapMeter` ingestion of `JudgeCost` (FEAT-186 S2 — depends on S1)
- Cost report renderer updates (FEAT-186 S3)
- brief-me cost reader (FEAT-186 S4)
- Asymmetry detector + Langfuse single-trace (FEAT-186 S5)

S1 is canonical type export + adapter wiring + contract test ONLY.

---

## Publish ceremony recap (for the gepa-core session)

```bash
# All in the gepa-core repo session, NOT dev-team:

cd /c/work/mega/gepa-core

# 1. SLICE-B port + S1 type (if Path A combined)
#    ... do the work ...

# 2. Gates
bun run typecheck
bun run lint
bun run format:check
bun run check:no-env       # CRITICAL — must exit 0
bun run test               # all green, incl. new judge-cost-shape.test.ts

# 3. Pre-publish audit (release-recovery skill's checklist)
grep '"version"' package.json    # confirm 0.4.0
grep -E "^## \[0\.4\.0\]" CHANGELOG.md   # entry exists
git status --porcelain           # working tree clean

# 4. Commit
git add -A
git commit -m "feat: 0.4.0 — relocate azure + bedrock providers + JudgeCost export (FEAT-185 S-B + FEAT-186 S1)"

# 5. Tag
git tag -a "v0.4.0" -m "v0.4.0 — 6/6 cloud providers in gepa-core + JudgeCost canonical export"

# 6. Push
git push origin main --follow-tags

# 7. Publish to npmjs.org (npm whoami; npm login if needed)
npm publish

# 8. Verify
npm view @astragenie/gepa-core version   # 0.4.0

# 9. Astra-marketplace paired bump (per dev-team CLAUDE.md HARD RULE exception)
#    Open astra-marketplace, bump plugins[name=gepa-core].version to 0.4.0,
#    commit + push as separate commit.
```

After gepa-core publishes, switch to a **dev-team session** to consume
the new version (lockfile bump + shim updates).

---

## Handback to dev-team after gepa-core publishes

Open a fresh dev-team session and:

1. `npm install` → resolves new gepa-core version
2. Slim down `evals/providers/{azure-openai,bedrock}.ts` to shims
3. Update `JUDGE_REGISTRY` factories for azure + bedrock to forward config
   (same pattern as commit `2341b32`)
4. Wire `JudgeCost` consumption in `evals/lib/run-eval.ts`
5. Run all gates
6. Commit + cut dev-team 0.48.0 (MINOR — peer-dep bump + shim slim-down)
