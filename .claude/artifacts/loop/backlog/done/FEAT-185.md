---
id: FEAT-185
status: done
shipped_slices: [SLICE-108, SLICE-109]
remaining_slices: []
reconciliation_note: "SLICE-108 (S-A: ollama+generic+groq+gemini) shipped 2026-06-28..30 across gepa-core PRs #122/#123/#124 → v0.3.1 without being materialized as a file (see docs/superpowers/specs/2026-06-30-feat-183-wave-plan.md). SLICE-109 (S-B) revised 2026-06-30 to azure-only — bedrock dropped per operator Q3. proposed_slices block below is the ORIGINAL 2026-06-28 decomp; treat as historical reference, not current plan."
priority: P2
category: refactor
target_release: null
created: 2026-06-28
revised: 2026-07-07
depends_on: [FEAT-184]
slices: []
derived_from: null
pm_customer_impact: 0.65
pm_effort_estimate: 0.70
pm_strategic_alignment: 0.75
pm_technical_risk: 0.70
pm_dependency_depth: 0.55
composite_score: 0.58
autonomous_safe: false
tags: [evals, gepa, providers, extraction, gepa-core]
proposed_slices:
  - id_suffix: -SLICE-108
    title: "Move 4 low-blast providers to gepa-core 0.3.0; CI matrix scaffold"
    points: 3
    id: SLICE-108
    scope: "Relocate 4 OpenAI-shaped / local adapters from dev-team evals/providers/{ollama,generic-openai,groq,gemini}.ts into @astragenie/gepa-core/providers/{ollama,generic-openai,groq,gemini} as discrete entry points (AC-1). Clean process.env reads out of groq.ts line 45 during the move (AC-2 grep gate violator). dev-team shims become env-resolution-only re-exports that pass concrete config into gepa-core constructors. Cut gepa-core 0.3.0 (MINOR — additive entry points only). Bump dev-team @astragenie/gepa-core dep + run YAML compat + snapshot-diff (deterministic ollama exact-match; nondeterministic groq+gemini N>=5 statistical band per AC-4). Stand up the full {linux,windows,macos} x {with-sdk,without-sdk} CI matrix in gepa-core for these 4 providers (16 cells) so SLICE-B inherits the matrix scaffolding. Establish rollback baseline + naming-rename CHANGELOG entry (judges/ -> providers/)."
    acs_covered: ["AC-1 (4 of 6)", "AC-2 (groq.ts cleanup + grep gate scaffold)", "AC-3", "AC-4 (ollama exact + groq/gemini statistical)", "AC-5 (gepa-core 0.3.0 MINOR + CHANGELOG + peer-dep table for 4 providers)", "AC-6 (dev-team integration for 4 providers)", "AC-8 (CI matrix scaffold for 4 providers, 16 cells)", "AC-9 (claude-p stays — CHANGELOG note lands here)"]
    touches:
      - "gepa-core/src/providers/ollama/index.ts"
      - "gepa-core/src/providers/generic-openai/index.ts"
      - "gepa-core/src/providers/groq/index.ts"
      - "gepa-core/src/providers/gemini/index.ts"
      - "gepa-core/package.json (exports + version 0.2.1 -> 0.3.0)"
      - "gepa-core/CHANGELOG.md"
      - "gepa-core/README.md (peer-dep table)"
      - "gepa-core/.github/workflows/*.yml (CI matrix scaffold)"
      - "gepa-core/scripts/check-no-env-reads.ts (AC-2 grep gate)"
      - "dev-team/evals/providers/ollama.ts (shim rewrite)"
      - "dev-team/evals/providers/generic-openai.ts (shim rewrite)"
      - "dev-team/evals/providers/groq.ts (shim rewrite + env-pull out of line 45)"
      - "dev-team/evals/providers/gemini.ts (shim rewrite)"
      - "dev-team/package.json (@astragenie/gepa-core ^0.3.0)"
    repos: ["gepa-core", "dev-team"]
    est_days: 2
    depends_on: ["FEAT-184"]
    autonomous_safe: false
    risk_notes: "Cross-repo publish ceremony (npm publish gepa-core@0.3.0 cannot be un-published). Naming rename (judges/->providers/) must be documented in CHANGELOG or future architects re-litigate. CI matrix scaffold = new infrastructure; AC-2 grep gate is new gate that needs review for false-negatives (e.g. process['env'] bracket-access). gemini SDK dynamic-import behavior under without-sdk matrix cell is the highest-risk new cell — verify the install-instruction error path actually fires before claiming AC-1."
  - id_suffix: -SLICE-109
    title: "Move azure+bedrock to gepa-core 0.4.0; extend CI matrix to 36 cells"
    points: 3
    id: SLICE-109
    scope: "Relocate azure-openai + bedrock adapters from dev-team evals/providers/{azure-openai,bedrock}.ts into @astragenie/gepa-core/providers/{azure,bedrock}. Clean process.env reads out of bedrock.ts lines 94/96/102 (AC-2 grep gate violators). Wire @azure/openai + AWS SDK credential chain through constructor config only — env resolution stays in dev-team shims. Extend the SLICE-A CI matrix to cover azure + bedrock (12 additional cells: 3 OSes x 2 SDK states x 2 providers, bringing total to 28 cells across both slices; the remaining 8 cells for ollama+generic-openai+groq+gemini land in S-A's 16 — combined matrix = 36 cells). Cut gepa-core 0.4.0 (MINOR follow-up — still additive entry points). Bump dev-team gepa-core dep + re-run YAML compat + snapshot-diff for azure + bedrock with N>=5 statistical band. Verify AWS SDK credential chain dynamic require() does not break ESM-only assertion on without-sdk matrix cell — the highest-risk new failure mode for this slice."
    acs_covered: ["AC-1 (2 of 6 — azure + bedrock)", "AC-2 (bedrock.ts cleanup + grep gate covers azure + bedrock)", "AC-3", "AC-4 (azure + bedrock statistical N>=5)", "AC-5 (gepa-core 0.4.0 MINOR + CHANGELOG + peer-dep table extended)", "AC-6 (dev-team integration for azure + bedrock)", "AC-8 (CI matrix extension to 2 more providers, 12 more cells)"]
    touches:
      - "gepa-core/src/providers/azure/index.ts"
      - "gepa-core/src/providers/bedrock/index.ts"
      - "gepa-core/package.json (exports + version 0.3.0 -> 0.4.0)"
      - "gepa-core/CHANGELOG.md"
      - "gepa-core/README.md (peer-dep table extension)"
      - "gepa-core/.github/workflows/*.yml (CI matrix extension)"
      - "dev-team/evals/providers/azure-openai.ts (shim rewrite + env-pull out of bedrock-adjacent paths)"
      - "dev-team/evals/providers/bedrock.ts (shim rewrite + env-pull out of lines 94/96/102)"
      - "dev-team/package.json (@astragenie/gepa-core ^0.4.0)"
    repos: ["gepa-core", "dev-team"]
    est_days: 2
    depends_on: ["FEAT-184", "FEAT-185 S-A"]
    autonomous_safe: false
    risk_notes: "Heavier SDK footprint than S-A: AWS SDK credential chain + Azure key+endpoint+deployment auth shape are distinct from the OpenAI-style adapters in S-A — more surface for ESM/CJS dynamic-import surprises. without-sdk matrix cells on Windows are the most likely failure (bedrock.ts has historically been the env-read offender + AWS SDK has heavier ESM-compat history). MAJOR-vs-MINOR risk inherited from FEAT body §Risks: if AC-2 hardening forces a constructor signature change on the 4 providers already published in 0.3.0, this slice retroactively becomes MAJOR (0.x.y -> 1.0.0). Mitigation: keep S-A constructor signatures stable; only ADD optional config fields here."
triage_notes: "Triaged 2026-06-28 — moves 6 of 7 evals/providers/* adapters into @astragenie/gepa-core as discrete entry points (ollama+generic-openai+groq+gemini+azure+bedrock); claude-p stays in dev-team because its subprocess-spawn + Windows-specific + --dangerously-skip-permissions + FEAT-173 tempdir-isolation logic is dev-team-motivated and would leak into a portable library. Architect-reviewer cycle already addressed AC-2 contradicting existing code (bedrock.ts/groq.ts/claude-p.ts read process.env directly), AC-4 unrealistic identical-scores against nondeterministic LLM judges, claude-p portability concern under-weighted, AC-7 scope creep into cost-aggregation, missing CI matrix AC for peer-dep resolution, no slice-split for rollback safety — revisions visible in FEAT body lines 115-119. 2-slice split (SLICE-A low-blast ollama+generic-openai+groq+gemini, SLICE-B SDK-heavy azure+bedrock) already specified in FEAT body. Cost analog: each slice is roughly SLICE-84-class ($457) due to cross-repo publish + AC-8 CI matrix (3 OSes × 2 SDK states × 6 providers = 36 matrix cells); effort 0.70 reflects this. No grade weak dimensions (5-grade rolling avg: arch 0.86 / reliability 0.88 / observability 0.83 / prod-readiness 0.86 / security 0.86 / test-conf 0.92 / product-completeness 0.81; all >= 0.80). Composite 0.58 → P2: customer 0.65 (indirect — required for zero-hard-cross-plugin-deps guarantee per design spec line 18), strategic 0.75 (mid; concentrates strategic value in upstream FEAT-184 unification), effort 0.70 (2 medium slices, cross-repo publish + heavy CI matrix), risk 0.70 (cross-plugin contract change + peer-dep wiring across Win/Linux/macOS = band 0.6-0.8), dependency_depth 0.55 (hard upstream dep on FEAT-184; cannot start until 184 lands). autonomous_safe=false confirmed — cross-repo publish + peer-dep wiring + CI matrix changes; human-in-loop on review per CLAUDE.md autonomous-loop-hard-rules + cross-plugin contract policy. claude-p stays in dev-team per AC-9 — explicitly called out in CHANGELOG to prevent future re-litigation. Naming alignment risk: spec line 126 says judges/ but FEAT uses providers/ because adapters serve candidate+judge roles — CHANGELOG entry must document the rename. Decomposition (proposed_slices block) DEFERRED per operator instruction (dispatcher will slice after triage lands). Pre-mortem (mandatory per risk>=0.6): (1) likely failure = AC-8 CI matrix Windows × without-SDK row trips on npm optional-peer-dep resolution quirk causing install-instruction error path to be silently untested OR SLICE-B azure/bedrock SDK dynamic require() breaks ESM-only assertion; (2) rollback cost = revert gepa-core publish (cannot un-publish vN+1 from npm) + revert dev-team evals/providers/* shim rewrites + 6 adapter relocations × 2 repos; (3) coverage gap = no test today asserts evals/providers/* contain ONLY env-resolution-and-shim code; AC-2 grep gate is new infrastructure that needs review for false-negatives. MAJOR-vs-MINOR risk on gepa-core: AC-5 says MINOR (additive entry points only) but if AC-2 hardening forces constructor signature change on EXISTING exports, retroactively becomes MAJOR.\n\nDecomposition appended 2026-06-29 (per /runner:pm decomposition gate): 2-slice plan formalized into proposed_slices block above. SLICE-A (4 low-blast providers + CI matrix scaffold + gepa-core 0.3.0 MINOR) -> SLICE-B (2 SDK-heavy providers + matrix extension + gepa-core 0.4.0 MINOR). SLICE-A owns the matrix scaffold + grep-gate infra + naming-rename CHANGELOG note + AC-9 claude-p-stays callout; SLICE-B inherits all of that and extends. Both slices 2 days est (fits ceiling). Cross-repo: both slices ship into gepa-core + dev-team in lockstep — npm publish gepa-core@X then bump dev-team @astragenie/gepa-core dep in same logical wave.\n\nSlice-level pre-mortem (extends FEAT-level pre-mortem above):\n  SLICE-A: (1) most likely failure = without-sdk matrix cell on Windows passes silently because the install-instruction error path uses a string-match the test doesn't assert on, OR gemini SDK dynamic-import behavior on without-sdk differs between linux and windows; (2) rollback = unpublish-impossible on npm, so rollback means dev-team pins back to gepa-core 0.2.1 + re-inlines the 4 adapters; SLICE-B then blocked until rollback path documented; (3) coverage gap = the 4 newly-published entry points have no contract test asserting they remain importable across gepa-core minor bumps — add a snapshot of the public export surface.\n  SLICE-B: (1) most likely failure = AWS SDK ESM/CJS dynamic require() on without-sdk matrix cell trips on Windows, OR azure constructor accidentally accepts a different config shape than the 4 SLICE-A providers (signature drift between minor versions), forcing MAJOR; (2) rollback = dev-team pins back to gepa-core 0.3.0 + re-inlines azure + bedrock; SLICE-A providers remain published and consumed; (3) coverage gap = no test asserts the 6 providers share a consistent constructor signature shape — without this, AC-5's MINOR-only guarantee is by inspection, not by gate."
---

# FEAT-185: Move 6 cloud providers to gepa-core — single source of truth for LLM adapters

## Description

After FEAT-184 unifies the judge interface, move **6 of the 7** `evals/providers/*` adapters into `@astragenie/gepa-core` as discrete entry points:

```
@astragenie/gepa-core/providers/generic-openai
@astragenie/gepa-core/providers/groq
@astragenie/gepa-core/providers/gemini
@astragenie/gepa-core/providers/ollama
@astragenie/gepa-core/providers/azure
@astragenie/gepa-core/providers/bedrock
```

**`claude-p` stays in dev-team `evals/providers/claude-p.ts`** (revised per architect-reviewer — see Options Considered Option 3 below).

Pattern is already specified in the GEPA design (`docs/superpowers/specs/2026-06-27-gepa-skill-improvement-loop-design.md` line 126):

> Cloud judge adapters (`azureOpenAIJudge`, `geminiJudge`) are optional peer deps on their respective SDKs (`@azure/openai`, `@google/generative-ai`). Library publishes them as separate entry points: `@astragenie/gepa-core/judges/azure`, `@astragenie/gepa-core/judges/gemini`. Importing them without the SDK throws a clean install-instruction error.

dev-team's `evals/providers/*` becomes thin re-export + env-var auth-wiring shims; gepa-core owns the transport, retry, and cost-accounting logic. Naming alignment: spec line 126 says "judges/", but the move uses "providers/" because adapters serve both candidate-dispatch AND judge roles. CHANGELOG entry documents the rename explicitly.

## Options Considered

### Option 1 (chosen): Move 6 cloud providers to gepa-core, keep claude-p in dev-team

6 cloud providers (generic-openai, groq, gemini, ollama, azure, bedrock) move to gepa-core under `@astragenie/gepa-core/providers/*`. claude-p stays in dev-team. dev-team shims hold env-var resolution; gepa-core takes config objects only.

**Why chosen:** matches the design-spec pattern (line 126), serves S3's need without forcing dev-team to remain in the provider business, isolates the subprocess-spawn + Windows-specific + `--dangerously-skip-permissions` + FEAT-173 tempdir-isolation logic of claude-p (which is dev-team-motivated and would leak into a portable library). 6-of-7 split keeps the "portable library" charter clean.

### Option 2 (rejected): Move all 7 providers including claude-p

**Why rejected:** claude-p shells out to the `claude` CLI binary (subscription auth), carries Windows-specific `windowsHide`, hardcoded `--dangerously-skip-permissions`, and FEAT-173 tempdir-isolation logic that escapes the host CLAUDE.md. All of this is dev-team-specific concerns leaking into a library positioned for external consumer plugins. Future consumers installing `@astragenie/gepa-core/providers/claude-p` would inherit unwanted constraints. If a future consumer genuinely needs claude-p, extract it then.

### Option 3 (rejected): Create third package `@astragenie/llm-providers`

A standalone package consumed by both gepa-core and dev-team evals.

**Why rejected:** extraction criteria from `loop-snapshot.md` not met (≥2 external consumers, interface stable 2 months). gepa-core is the only judge-consuming library today; eval framework imports through gepa-core would be the second consumer — that's still not 2 *external* consumers. Premature extraction freezes wrong abstractions. Adds a third repo to the cross-repo release dance for zero behavioral benefit.

### Option 4 (rejected): Keep providers in dev-team, gepa-core imports them

Cross-repo import from gepa-core back to dev-team.

**Why rejected:** kills the "zero hard cross-plugin runtime deps" guarantee from the design spec (line 18). Forces consumer plugins to install dev-team even if they only want GEPA. Inverted dependency direction.

## Slice plan

**2 slices for rollback safety** (revised per architect-reviewer):

- **SLICE-A (low blast radius):** ollama + generic-openai + groq + gemini. All OpenAI-shaped or local, lightest SDK footprint, simplest cost-accounting. If S-B breaks, S-A working baseline preserved.
- **SLICE-B (heavier SDK):** azure + bedrock. Distinct auth chains (Azure key+endpoint+deployment, AWS SDK credential chain), heavier peer deps, higher rollback complexity.

## Motivation

- gepa-core is the natural home: pure ESM, zero imports from dev-team, the package consumer plugins install.
- Without FEAT-185, GEPA S3 (`/crew:gepa-eval`) would either (a) re-implement 7 providers inside gepa-core or (b) reach across the repo boundary to import `evals/providers/*` from dev-team — both kill the "zero hard cross-plugin runtime deps" guarantee from the design spec (line 18).
- Per the same spec (line 126), entry-point-per-provider with peer-dep SDKs is already the chosen pattern.
- Removes ~600 LOC of duplication anticipated when S3 lands.

## Acceptance criteria

- **AC-1 (entry points):** Each of the 6 cloud providers exports under `@astragenie/gepa-core/providers/<name>`. Each has its own export, optional peer dep on its SDK, and a clean install-instruction error (`throw new Error("Install '<sdk>' to use the <provider> judge: npm install <sdk>")`) if the SDK is missing at import time.
- **AC-2 (zero env reads in moved code, REVISED):** The moved gepa-core provider modules contain **zero `process.env` reads** (`grep -n "process.env" providers/*.ts` returns empty). All defaults come from constructor config arguments. dev-team `evals/providers/*` shims resolve env vars and pass concrete config in. Compliance gate: CI script greps moved files and fails if any `process.env` access appears. Today's violators that must be cleaned during the move: `bedrock.ts` lines 94/96/102, `groq.ts` line 45, `claude-p.ts` line 24 (claude-p stays in dev-team but listed for completeness).
- **AC-3 (YAML compat):** Existing eval specs (`crew-fullstack-dev.yaml`, `crew-inspector.yaml`) run unchanged — provider lookup still works via the same YAML keys. Test: run both specs pre/post extraction, both produce parseable output.
- **AC-4 (snapshot-diff with tolerance band, REVISED):** Re-run both shipped specs pre/post extraction:
  - **Deterministic providers** (ollama at `temperature: 0`, fixture-only replays): exact-match assertion on score + token counts.
  - **Nondeterministic providers** (groq, gemini, azure, bedrock): N≥5 runs pre and post; require (a) PASS/FAIL verdict identical per test, (b) mean score within ±0.05, (c) mean token counts within ±5%. Drift outside band fails the AC.
- **AC-5 (CHANGELOG + version):** gepa-core ships a new MINOR version (additive entry points, no existing API change) with 6 new entry points documented in CHANGELOG. Peer-dep table added to gepa-core README explicitly listing SDK + install command per provider.
- **AC-6 (dev-team integration):** dev-team `package.json` bumps `@astragenie/gepa-core` dep; `evals/` test suite green; e2e smoke green; `evals/cli.ts` cost-attribution output unchanged byte-for-byte for fixture replays.
- **AC-7 (REMOVED, see FEAT-186):** Cost-aggregation policy across both pipelines spun out into FEAT-186 (per architect-reviewer — keeps snapshot-diff gate AC-4 interpretable by isolating one variable change at a time).
- **AC-8 (NEW — CI matrix coverage):** gepa-core CI matrix `{linux, windows, macos} × {with-sdk, without-sdk}` per provider entry point. Assertions:
  - Without SDK installed: importing the entry point throws the install-instruction error with the right SDK name + install command.
  - With SDK installed: trivial smoke call resolves and the adapter instantiates.
- **AC-9 (claude-p NOT moved):** `evals/providers/claude-p.ts` stays in dev-team. CHANGELOG and FEAT-185 close-out note explicitly call this out so future architects don't re-litigate. claude-p `describe()` method (added by FEAT-184) returns `{ provider: "claude-p", model: <from config> }` — interface contract preserved even though location differs.

## Out of scope (deferred)

- Moving eval orchestration (`evals/cli.ts`, `evals/lib/run-eval.ts`, `evals/lib/langfuse-emit.ts`) — stays in dev-team. Extraction criteria from `loop-snapshot.md` NOT met.
- Adding new providers (anthropic, vertex, openrouter, etc) — separate FEATs.
- Multi-provider failover policy beyond `crew-fullstack-dev.yaml.judge.fallback[]` — out of scope.
- Third package `@astragenie/llm-providers` — deferred per Options Considered Option 3.
- Cost-aggregation across pipelines — FEAT-186.

## Dependencies

- FEAT-184 (judge interface unification) — must land first. Moving providers before the interface is unified means double-migrating them.

**Blocks SLICE-98 (GEPA S3).** Both FEAT-184 and FEAT-185 should ship before S3 so `/crew:gepa-eval` consumes providers from gepa-core directly.

## Risks

- **Risk: peer-dep resolution surprises on Windows (npm install bug with optional peer deps).** Mitigation: AC-1 ships explicit install-instruction error path; AC-8 enforces CI matrix coverage on Linux + Windows + macOS.
- **Risk: provider auth differences.** Mitigation: AC-2 keeps env-var resolution in dev-team `evals/providers/` shims; gepa-core exports take config objects, never reach for env directly. CI grep gate enforces.
- **Risk: bumping gepa-core MAJOR if AC-7 cost-shape change is breaking.** Mitigation: AC-7 spun out to FEAT-186; FEAT-185 is now pure entry-point relocation, MINOR bump only.
- **Risk: SLICE-A and SLICE-B both blocked on FEAT-184.** Mitigation: dependency chain explicit; SLICE-B inherits SLICE-A's lessons (rollback path established before tackling heavier SDK providers).
- **Risk: provider naming drift (spec line 126 says "judges/", FEAT uses "providers/").** Mitigation: CHANGELOG entry calls out the rename and rationale (adapters serve candidate+judge roles, not just judge).

## Architect-reviewer feedback addressed (2026-06-28)

Initial FEAT had: AC-2 contradicting existing code (bedrock.ts/claude-p.ts/groq.ts read process.env directly), AC-4 unrealistic ("identical scores" against nondeterministic LLM judges), claude-p portability concern under-weighted, AC-7 scope creep into cost-aggregation, missing CI matrix AC for peer-dep resolution, no slice-split for rollback safety, missing Options Considered section.

Revisions applied: AC-2 hardened with explicit grep gate + listed current violators; AC-4 statistical-bound rewrite with deterministic vs nondeterministic split; AC-7 spun out to FEAT-186; AC-8 added for CI matrix; AC-9 added for claude-p stays in dev-team; 2-slice split (SLICE-A low-blast + SLICE-B SDK-heavy); Options Considered section added with 4 options.
