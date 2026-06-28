---
id: FEAT-185
status: pending
priority: P2
category: refactor
target_release: null
created: 2026-06-28
revised: 2026-06-28
depends_on: [FEAT-184]
slices: []
derived_from: null
autonomous_safe: false
tags: [evals, gepa, providers, extraction, gepa-core]
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
