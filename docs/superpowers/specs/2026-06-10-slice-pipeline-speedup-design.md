# Slice Pipeline Speedup — Design

- **Date:** 2026-06-10
- **Status:** approved (brainstorm gate passed)
- **Owner:** pm_milashico
- **Approach:** A — staged, ceremony-first, Bun behind a compat gate

## Problem

The full crew/loop workflow per slice is too slow, especially for plugin repos. Measured baseline (FEAT-133, cost telemetry): **~43 min wall-clock, 195 messages, 8 sequential subagent dispatches, ~$80–90/slice.** Tooling profile: full test suite **115.9s** (573 tests / 60 files), lint 1.9s, typecheck 3.9s, crew CLI startup 0.17s. The long pole inside the suite is `tests/cli.test.ts`: 5 tests at 17–23s each, because nearly every assertion spawns `node --experimental-strip-types crew.ts` as a subprocess, re-parsing the 85-file script graph per spawn. Slice wall-clock is ~80% LLM ceremony (sequential dispatches, LLM-authored artifacts), ~15–20% tooling.

## Goals & success criteria

1. Slice wall-clock ~43 min → **≤25 min (-40%)**, verified via cost-report telemetry (`durationMin`, `messages`, `subagentDispatches`) over 3 consecutive slices after full rollout.
2. Full quality-gate tooling: 116s → **<30s**.
3. Quality floor: review + validation gates remain mandatory; no grade dimension drops more than 0.05 from the recent baseline (architecture_quality 0.76, reliability 0.78, observability 0.756, production_readiness 0.784, security 0.77, test_confidence 0.76, product_completeness 0.81).

## Non-goals

- Reducing scope or rigor of quality gates (review, validation, full-suite run).
- Prompt-slimming workstream (explicitly deferred by user).
- Cost ($/slice) as the primary metric — it improves as a side effect.

## WS1 — Kill the test long-pole (node-only, lands first)

- Export an in-process entry point `runCrew(argv, opts): Promise<{code, stdout}>` from the crew CLI lib. Convert `tests/cli.test.ts` assertions from subprocess spawns to in-process calls.
- Keep **one real spawn smoke test per command family** (claims, approvals, artifacts, synthesis, cost) covering exit codes, stdout hygiene, and process wiring.
- Split `cli.test.ts` into per-command-family files so `node --test` parallelizes across cores.
- Expected: 116s → ~25–35s. Pays off on every validator gate and fix bounce immediately, before Bun.
- Risk: in-process tests can mask process-level bugs. Mitigation: the per-family spawn smokes.

## WS2 — Ceremony (the big lever)

### 2a. Parallel gates

After builder PASS, lead/orchestrate-slice dispatches reviewer and validator **concurrently** instead of sequentially. Conflict rule: if reviewer returns `needs_fix`, the validation result is marked stale and the fix bounce reruns the validator. Saves one dispatch round-trip (~5–10 min/slice). Touches `agents/lead.md`, `commands/orchestrate-slice.md`, loop dispatch instructions. Workflow-state gate-badge writes must be merge-safe under concurrent writers.

### 2b. Templated artifacts

New `--scaffold` mode on the `crew.ts write-*` commands: emits the complete artifact skeleton (frontmatter, section headers, gate fields, file lists pulled from git) deterministically; the agent fills only judgment fields via the existing idempotent `--update` path (direct extension of the front-loaded stub-artifact machinery). Cuts artifact-authoring messages per dispatch.

### 2c. Skip-tier

Lead classifies each slice at start: `tier: full | light` via deterministic rules (docs-only diff, or ≤50 changed lines (initial value, tunable via loop.json), and no hook/runtime/manifest files touched → light). Light ladder = builder → **one combined review+validate dispatch** (single agent performs lens review and runs the full gate). The full-suite gate itself is never skipped — it runs inside the combined dispatch. Misclassification guard: any `needs_fix` on a light slice promotes the fix bounce to the full ladder. Tier recorded in the run brief.

## WS3 — Bun runtime swap (gated by spike)

Compat spike timeboxed to one slice; ALL exit criteria must be green **on Windows**:

1. Test suite under Bun (either `bun test` migration cost assessed, or Bun's `node:test` compat proven) — 573 tests green.
2. `crew.ts` CLI under Bun: `child_process` spawns, fs semantics, stdout hygiene, exit codes.
3. Hooks invoked via Bun end-to-end in a sample repo (`e2e-smoke`).
4. TS execution parity — Bun runs TS natively; `--experimental-strip-types` flags dropped.

If green: swap in order **dev scripts → CI → consumer hooks/CLI**, with a `runtime: node|bun` fallback flag in crew config for one release; README + marketplace gain Bun install instructions; ships as a minor release. If any criterion is red: stay hybrid (Bun for dev/CI, node for consumers), record a DEC, revisit on the next Bun release.

## Verification & rollout

- Re-baseline cost telemetry after each workstream; per-lever impact recorded in cost reports.
- Release sequencing: WS1 = patch; WS2 = minor (behavior change); WS3 = minor with migration notes. Each workstream runs as its own slice(s) through the loop.
- Rollback: parallel gates and skip-tier are prompt/command changes — revertible per release; Bun has the runtime fallback flag.

## Testing strategy

- WS1: full suite stays green; spawn smokes guard process-level regressions.
- WS2: `e2e-smoke` extended with a parallel-gate scenario and a light-tier scenario; a test covers two simultaneous workflow-state badge writes.
- WS3: CI runs a node+Bun matrix during the transition release.
