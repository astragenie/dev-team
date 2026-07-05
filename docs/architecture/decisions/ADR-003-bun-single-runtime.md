---
id: ADR-003
title: Bun as the single runtime for all plugin surfaces (dev, CI, consumer)
status: proposed
introduced_by_slice: FEAT-190 SLICE-A
introduced_at: 2026-07-05
amended_at: null
related_specs: [FEAT-190]
supersedes: ADR-002
superseded_by: null
---
# ADR-003: Bun as the single runtime for all plugin surfaces

## Context

ADR-002 (2026-06-10) adopted a **hybrid**: Bun for dev/CI test runner only, Node
as the consumer runtime. That decision rested on one premise — *"a consumer has
Node but not Bun; don't force a second runtime install."*

Two facts falsify that premise as of 2026-07-05:

1. **Hooks already require Bun on the consumer machine.** `hooks/hooks.json`
   invokes every one of its 14 hooks as `bun "${CLAUDE_PLUGIN_ROOT}/hooks/*.ts"`.
   A consumer without Bun on PATH gets silently degraded hooks. Bun is therefore
   *already* a de-facto consumer requirement — the hybrid's premise is void.

2. **Node cannot run the plugin's own dependencies.** `@astragenie/gepa-core`
   ships raw `.ts` and is imported by 11 crew scripts (all `scripts/lib/gepa/*`
   + `scripts/lib/cost/*`). Node's type-stripping **refuses to transpile any file
   under `node_modules`** — in every version, including Node 24 (it is a
   deliberate design guard, not a version gap). So `node scripts/crew.ts
   gepa-optimize …` fails with `Stripping types is currently unsupported for
   files under node_modules`. The GEPA + cost commands are Node-broken for
   consumers today. Bun strips node_modules TS natively → the same command runs.

The consumer machine already carries **both** engines regardless of our choice:
Claude Code is itself a Node process, and our hooks are Bun. The only open
question is which engine the plugin's *commands + scripts* target. Today that
answer is split (hooks=Bun, commands=Node), which is incoherent and leaves GEPA
unusable for consumers.

## Decision

Adopt **Bun as the single runtime for all plugin surfaces** — dev, CI, and
consumer. Every `node <script>` invocation across command docs, package scripts,
CI, installer-emitted config, and internal `child_process` spawns migrates to
`bun`. Node is no longer assumed or invoked by plugin code. `bun.lock` becomes
the sole lockfile; `package-lock.json` is removed.

This supersedes ADR-002's hybrid.

## Rationale

- **Removes an inconsistency that already exists** — it does not add a consumer
  requirement. Bun is already mandatory (hooks). This aligns commands to hooks.
- **Fixes the gepa-core node_modules bug for free** — Bun strips node_modules TS,
  so GEPA/cost commands become consumer-runnable with zero packaging work.
- **One runtime = dev == CI == consumer parity.** CI already runs the test suite
  on Bun (ADR-002); this extends parity to validators, e2e, and commands.
- **Kills the strip-types flag gymnastics** — no `--experimental-strip-types`, no
  Node-version floor debate. Node 24 does not help (node_modules guard is
  permanent), so a version bump is not an alternative.
- **Faster script cold-start** — ADR-002's spike measured ~22% on the suite; the
  30 command docs spawn faster too.

## Consequences

Positive:
- GEPA + cost commands run for consumers (unblocks FEAT-183 as a shipped feature).
- Single lockfile, single engine, no per-surface "which runtime" ambiguity.
- ADR-002's hooks/commands split is resolved.

Negative / risk:
- **Windows Bun maturity** is the primary risk (file locking, spawn, path edge
  cases). Mitigation: a Windows smoke job stays a blocking CI gate (SLICE-E).
- **Loss of the `node --test` fallback** — a Bun-runtime bug has no easy escape
  hatch. Accepted; CI's Bun suite is already the source of truth.
- **Cross-repo CI coordination** — `.github/workflows/test.yml` calls the
  reusable `astragenie/common/.github/workflows/reusable-plugin-ci.yml@main`,
  which must accept a Bun path. Scheduling dependency, not a blocker.
- **Marketplace-norm divergence** — most CC plugins assume Node; we own the
  Bun support burden. Already true via hooks.

## Revisit conditions

- Bun ships a Windows regression that breaks a blocking CI gate and has no
  workaround within one release cycle → fall back to ADR-002 hybrid for the
  affected surface only.
- A future non-Bun consumer of `@astragenie/gepa-core` appears → that is solved
  by gepa-core shipping a compiled `dist/` (a gepa-core-repo concern), orthogonal
  to this ADR.

## Alternatives considered

- **Option A (Bun single runtime, all surfaces):** Migrate every `node` call to
  `bun`; drop `package-lock.json`.
  Accepted. Bun is already a consumer requirement via hooks, so this adds nothing
  and fixes the gepa-core node_modules failure at zero packaging cost. Windows
  risk is contained by a blocking Windows smoke gate.

- **Option B (Require Node 24 to gain native TS):** Bump the consumer Node floor
  to 24 and drop the strip-types flag.
  Rejected: Node refuses to strip types under `node_modules` in **all** versions
  including 24 — the specific failure mode (`gepa-core` raw `.ts` in node_modules)
  is untouched by a version bump, so the GEPA commands stay broken.

- **Option C (Keep Node, ship gepa-core as compiled `dist/`):** Leave commands on
  Node; fix only gepa-core packaging.
  Rejected for crew's own surfaces: it preserves the incoherent hooks=Bun /
  commands=Node split and the dual-lockfile drift, and still assumes a Node that
  buys nothing the already-present Bun does not. (Retained as the right fix for
  gepa-core *as a reusable library* for hypothetical non-Bun consumers — tracked
  separately, not in FEAT-190.)

## References

- Supersedes: ADR-002 (`docs/architecture/decisions/ADR-002-bun-runtime-no-go.md`)
- Evidence: `hooks/hooks.json` (14 Bun hooks); `scripts/lib/gepa/*` +
  `scripts/lib/cost/*` (11 gepa-core importers); observed failure `Stripping types
  is currently unsupported for files under node_modules`.
- FEAT-190 (`.claude/artifacts/loop/backlog/pending/FEAT-190-bun-single-runtime.md`)
