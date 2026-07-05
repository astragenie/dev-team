---
id: FEAT-190
status: pending
priority: P2
category: infra
target_release: null
created: 2026-07-05
depends_on: []
slices: [SLICE-A, SLICE-B, SLICE-C, SLICE-D, SLICE-E]
derived_from: docs/architecture/decisions/ADR-003-bun-single-runtime.md
pm_customer_impact: 0.60
pm_effort_estimate: 0.45
pm_strategic_alignment: 0.70
pm_technical_risk: 0.60
pm_dependency_depth: 0.35
composite_score: 0.58
autonomous_safe: false
tags: [runtime, bun, node, adr-reversal, ci, installer, gepa, consumer-parity, cross-repo]
triage_notes: |
  Reverses ADR-002 (hybrid Node-consumer / Bun-dev) → ADR-003 (Bun single
  runtime). Root trigger: gepa-core ships raw .ts, Node refuses to strip types
  under node_modules in ALL versions incl 24 → GEPA + cost commands are
  Node-broken for consumers. Premise-falsifier: hooks/hooks.json ALREADY runs 14
  hooks on Bun, so Bun is already a de-facto consumer requirement; the hybrid's
  "don't force a second runtime" rationale is void. Consumer machine already
  carries both engines (CC=Node process, hooks=Bun). Migration is wide but
  mechanical: 95 command-doc lines, 18 pkg scripts, 19 CI lines, 37 docs refs, 9
  CLAUDE.md refs, 2 child_process node spawns, 1 installer heredoc, 1 lockfile.
  autonomous_safe=false: touches CI (cross-repo reusable-plugin-ci.yml in
  astragenie/common), installer-emitted CONSUMER config, and an ADR reversal —
  all require human review. Composite 0.58 → P2: impact 0.60 (unblocks GEPA as a
  shipped consumer feature + kills runtime ambiguity, but invisible in day-to-day
  use), strategic 0.70 (single-runtime foundation + ADR coherence), effort 0.45
  (~4 dev-days, wide/mechanical), risk 0.60 (Windows Bun maturity + consumer
  installer config + cross-repo CI), dependency_depth 0.35 (astragenie/common
  reusable workflow must accept a Bun path).
---

# FEAT-190: Bun as the single plugin runtime (retire the Node/Bun split)

## Context

ADR-002 kept Node as the consumer runtime and Bun for dev/CI only. Two facts
break that split (full argument in ADR-003):

1. **Hooks already run on Bun.** `hooks/hooks.json` → 14 `bun …` invocations.
   Bun is already required on every consumer machine.
2. **Node can't run our deps.** `@astragenie/gepa-core` ships raw `.ts`; Node
   refuses type-stripping under `node_modules` in every version (incl. 24). The
   11 `scripts/lib/gepa/*` + `scripts/lib/cost/*` importers fail under Node with
   `Stripping types is currently unsupported for files under node_modules`. Bun
   runs them.

Result: GEPA + cost commands are Node-broken for consumers, and the plugin runs a
split runtime (hooks=Bun, commands=Node) with two lockfiles.

## Goal

One runtime — **Bun** — across dev, CI, and consumer surfaces. Every `node`
invocation in plugin code becomes `bun`. Single lockfile (`bun.lock`). GEPA/cost
commands run for consumers. ADR-002 superseded by ADR-003.

## Non-goals

- Shipping `@astragenie/gepa-core` as compiled `dist/` (that is the fix for
  *non-Bun* library consumers; orthogonal, tracked in the gepa-core repo, not
  here). ADR-003 Option C.
- Changing Claude Code's own runtime (CC is a Node process; out of our control).
- Rewriting hook logic (hooks already Bun; untouched).
- Bun version-floor negotiation beyond pinning `engines.bun`.

## Acceptance criteria

AC-1: Given a fresh consumer checkout with Bun on PATH and **no `node` on PATH**,
When `/crew:gepa-optimize reviewer --budget 5 --artifact-only` runs, Then it exits
0 and writes an `OptimizationResult` JSON — no `Stripping types … node_modules`
error.

AC-2: Given the repo, When `grep -rn 'node ' commands/ package.json
.github/workflows/ CLAUDE.md docs/` runs, Then zero plugin-invocation `node `
calls remain (matches limited to prose/`node:` imports/`Node.js` nouns are
allowed and enumerated in the slice's allowlist).

AC-3: Given `scripts/e2e-smoke.ts` and `scripts/lib/briefing/workflow.ts`, When
they spawn the CLI via `child_process`, Then the spawned binary is `bun`, and both
paths pass on a Bun-only machine.

AC-4: Given the installer heredoc at `scripts/lib/installer/templates.ts:306`
(`node <<'NODE'`), When a consumer runs the installer, Then the emitted hook
payload processor invokes `bun` (or an inline JS form Bun executes), and the
generated config runs on a Bun-only consumer.

AC-5: Given `.github/workflows/test.yml`, When CI runs, Then every validator +
e2e step runs under `bun`, dependency install is `bun install`, and the run is
green — including on the Windows job.

AC-6: Given the repo root, When install runs, Then only `bun.lock` exists
(`package-lock.json` removed) and `package.json` declares `engines.bun` with no
`engines.node` floor that implies Node execution of plugin scripts.

AC-7: Given ADR-002, When ADR-003 lands, Then ADR-002 frontmatter
`superseded_by: ADR-003` is set and `validate-adr-template.ts --strict` passes for
ADR-003.

## Slice plan

| Slice | Scope | Files | Gate | ETA |
|---|---|---|---|---|
| **SLICE-A** — Foundation + ADR | Land ADR-003; set ADR-002 `superseded_by`; `package.json` 18 scripts `node`→`bun`; add `engines.bun`; delete `package-lock.json`; keep `bun.lock` sole lockfile | `docs/architecture/decisions/ADR-00{2,3}*.md`, `package.json`, `package-lock.json` | validate-adr-template --strict; `bun install` clean | 0.5 d |
| **SLICE-B** — Internal spawns + installer | `execFile("node",…)` → `bun` in `e2e-smoke.ts:329` + `briefing/workflow.ts:214`; installer heredoc `templates.ts:306` `node <<'NODE'` → Bun-executable form; verify emitted consumer config runs Bun-only | `scripts/e2e-smoke.ts`, `scripts/lib/briefing/workflow.ts`, `scripts/lib/installer/templates.ts` | e2e-smoke green on Bun-only; installer round-trip test | 0.5 d |
| **SLICE-C** — CI flip (cross-repo) | `.github/workflows/test.yml`: 19 `node` validator lines → `bun`; `npm ci` → `bun install`; coordinate `astragenie/common` `reusable-plugin-ci.yml@main` to accept a Bun path; keep/enable a **Windows** job | `.github/workflows/test.yml`, (cross-repo) `astragenie/common` | full CI green incl Windows | 1.0 d + coordination |
| **SLICE-D** — Docs + command surface | 30 command docs (95 `node ` lines) → `bun`; `CLAUDE.md` (9 refs); `docs/` (37 refs); enumerate + allowlist any legitimate `node:`/prose remainders | `commands/*.md`, `CLAUDE.md`, `docs/**` | AC-2 grep gate; validate-agents/skills clean | 1.0 d |
| **SLICE-E** — Consumer-parity proof + guardrail | Prove AC-1 on a Node-absent shell (PATH-scrubbed); Windows smoke as blocking gate; run gepa-optimize + gepa-history end-to-end to confirm the node_modules error is gone | test harness, CI matrix | AC-1 + AC-5 evidence artifact | 0.5 d |

**Dependency order:** A → B → (C ∥ D) → E. C and D are independent after B and can run in parallel worktrees. C carries the cross-repo scheduling risk (astragenie/common).

## ETA

- **Engineering: ~3.5 dev-days** of mechanical + verification work.
- **Calendar: ~1 week** with review + validation gates and the cross-repo CI
  coordination (astragenie/common reusable workflow is the schedule long-pole).
- **Critical-path risk:** if `reusable-plugin-ci.yml@main` needs its own PR +
  review cycle in `astragenie/common`, SLICE-C can add 1–2 calendar days. Mitigate
  by opening that coordination early (during SLICE-A).

## Risks + mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Bun-on-Windows edge cases (file lock, spawn, path) break a consumer flow | High | Blocking **Windows** CI job (SLICE-E); ADR-003 revisit condition = fall back to hybrid for the affected surface only |
| Installer emits consumer config that assumes `node` (templates.ts:306) | Med | SLICE-B explicit installer round-trip test on a Bun-only shell (AC-4) |
| Cross-repo `astragenie/common` reusable CI doesn't accept Bun | Med | Coordinate early (SLICE-A); until merged, this repo's inline steps carry the Bun path |
| Dual-lockfile drift during migration | Med | SLICE-A deletes `package-lock.json` atomically with the `bun install` cutover |
| Hidden `node` string in an un-grepped surface fires at runtime | Low | AC-2 grep gate + a repo-wide `node ` audit in SLICE-D's allowlist |

## References

- ADR-003: `docs/architecture/decisions/ADR-003-bun-single-runtime.md`
- Superseded ADR-002: `docs/architecture/decisions/ADR-002-bun-runtime-no-go.md`
- Trigger evidence: `hooks/hooks.json`; `scripts/lib/gepa/*`, `scripts/lib/cost/*`;
  observed `Stripping types … node_modules` failure on `node scripts/crew.ts
  gepa-optimize`.
