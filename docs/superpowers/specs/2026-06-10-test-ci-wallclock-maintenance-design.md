# Test/CI Wall-Clock + Maintenance Improvements — Design

- **Date:** 2026-06-10
- **Status:** approved (brainstorm complete, pending implementation plan)
- **Scope decision trail:** targets = wall-clock speed + maintenance burden; test pruning = conservative; runtime scope = tests/CI + safe runtime (hook-logic extraction, agent prompt trim). Explicitly NOT in scope: cost-per-slice model routing, dispatch-ladder changes, grade-lift work.

## Problem

The full suite (577 tests) takes ~113s. Evidence from the 2026-06-10 audit:

- 11 test files spawn `node` / `git` subprocesses per test (expensive on Windows). `tests/cli.test.ts` alone is 1,697 lines / 33 subprocess tests.
- The 4 per-tool hooks (`check-redundant-read`, `check-subagent-return`, `record-read-content`, `preflight-shell`) are only testable by spawning a fresh Node process — ~120 spawn-based tests today, and the pattern grows with every hook feature.
- 9 `cost-*` / `briefing-cost-*` test files (~2,800 lines) copy-paste temp-repo + cost-report fixture setup.
- `agents/lead.md` (333 lines) and `agents/reviewer.md` (314 lines) breach the 300-line governance cap (`docs/governance.md`, enforced advisory by `scripts/validate-agents.ts`).

## Goals / success criteria

1. Suite wall-clock ≤60s on the dev machine (stretch ≤45s), with measured before/after numbers recorded in WP1 and WP2 handoffs.
2. Zero net coverage loss. Every merged or removed test is listed with the kept assertion that covers it.
3. All `agents/*.md` ≤300 lines; `validate-agents.ts` passes.
4. CI green (all gates in `.github/workflows/test.yml`) after every work package.

## Conservative rule (applies to all WPs)

No assertion is deleted unless a kept assertion provably covers it, documented per deletion in the WP handoff. The May-2026 regression suite, validator-script tests, and prompt-content tests are all retained (prompt-content tests are updated, not demoted, in WP4).

## Work packages

Four independent, individually shippable and revertable slices. Ordered WP1→WP4 by payoff-per-risk; no hard dependencies between them.

### WP1 — Measure, then parallelize

Node's test runner already runs *files* concurrently by default (`--test-concurrency` defaults to cores−1). The serial bottleneck is likely *within* large files (tests in a file run sequentially) plus per-test subprocess spawn cost. Therefore measurement first:

1. Capture per-file durations (`--test-reporter=spec`) to locate where the 113s lives.
2. Apply the levers the data indicates:
   - explicit `--test-concurrency` tuning in the `npm test` script;
   - `{ concurrency: true }` on independent in-file test groups;
   - split `tests/cli.test.ts` (1,697 lines) into 3–4 files along command-group seams so file-level parallelism can bite.
3. Safety audit before enabling in-file concurrency: all fs-heavy tests must use `mkdtemp` (no shared cwd/temp-dir state). Audit `cli.test.ts` specifically.

**Exit:** before/after timing table in handoff; suite green at final concurrency settings.

### WP2 — Hook-logic extraction

Each of the 4 per-tool hooks splits into:

- `hooks/lib/<name>.ts` — pure function `(input, deps) → decision`. No stdin/stdout, no `process.*` access.
- `hooks/<name>.ts` — thin entry shim: parse stdin JSON → call lib function → print result. Stdout hygiene and exit semantics byte-identical to current behavior.

Tests import the lib functions directly. Keep 2–3 spawn-based smoke tests per hook proving shim wiring (stdin parse, stdout shape, exit code). The existing `hook-feature-gating` suite is retained as the runtime-contract proof.

**Why this is the keystone WP:** largest wall-clock cut (eliminates most of ~120 per-test process spawns) and the durable maintenance win — future hook behavior gets function-level tests by default.

**Exit:** hook runtime contract unchanged (smoke + gating suites green); spawn-based test count reduced to smoke-only; timing delta recorded.

### WP3 — Cost-test consolidation

1. Audit the 9 cost-related files: `briefing-cost-health`, `briefing-cost-rollup-dedupe`, `collect-model-compliance`, `cost-advisor-grade`, `cost-advisor-trends`, `cost-hygiene-hook`, `cost-hygiene-state`, `cost-report-emission`, `cost-report-role-breakdown`.
2. Extract shared fixture builder `tests/helpers/cost-fixtures.ts` (temp repo + seeded cost reports — currently duplicated per file).
3. Merge only provably duplicated cases; otherwise keep the file-per-module mapping.

**Exit:** duplication list in handoff; assertion-for-assertion coverage preserved; net line reduction reported.

### WP4 — Agent prompt trim

Bring `agents/lead.md` (333→<300) and `agents/reviewer.md` (314→<300) under the governance cap by relocating specifics into skills, per the repo's stated pattern ("specifics live in skills the agent invokes on demand"). Prompts reference the skill; no behavior content is deleted.

**Exit:** `validate-agents.ts` passes; prompt-content tests updated in the same change; no orphaned references (lint/validators green).

## Error handling & rollout

- Each WP lands as its own commit/PR; full gate set per WP: `npm test`, zero-warning lint, `format:check`, typecheck, all validate scripts, e2e smoke.
- WP2 regression risk is bounded by the retained spawn smoke tests + `hook-feature-gating` suite.
- Any WP can be reverted independently without affecting the others.

## Out of scope (explicit)

- Dispatch-ladder / contract-preload changes (CONTRACT_YAML 5–6× re-read problem) — candidate for a future design.
- Opus→Sonnet model routing for lead/architect/parallel-runner — cost work, not wall-clock.
- Deleting the May-2026 regression suite or validator-script tests.
- Hook batching/deferral at runtime.

## Evidence base

2026-06-10 exploration (two read-only audits): test-suite layout/timing audit and agent-workflow overhead audit. Key figures cited above; raw findings live in the brainstorm session record.
