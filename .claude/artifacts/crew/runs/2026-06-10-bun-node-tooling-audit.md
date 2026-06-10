# Bun vs Node tooling audit — agent & command instructions

- **Date:** 2026-06-10
- **Scope:** `agents/**/*.md` + `commands/**/*.md`
- **Goal:** Inventory every `npm` / `node` / `npx` usage to scope a Bun migration.
- **Current decision state:** ADR-002 ("Bun runtime no-go") was **amended by v0.30.0**
  to a **hybrid** — Bun is adopted as the **test runner** for dev/CI
  (`bun test --parallel --timeout 30000 tests/`, requires Bun 1.3+), with
  `npm run test:node` retained as Node fallback. Harness CLI scripts and
  consumer hooks remain on Node 22.6+ (`--experimental-strip-types`).

This audit therefore documents both: (1) what is *already* migrated by the
hybrid decision, and (2) what would change under a *full* swap, should that be
revisited.

---

## Class 1 — Test / lint / format / build tooling

The real migration targets. All in `agents/`; **none** in `commands/`.

| File:Line | Command | Bun equiv | Note |
|-----------|---------|-----------|------|
| `agents/validator.md:38` | `npm run lint` | `bun run lint` | script passthrough |
| `agents/validator.md:39` | `npm run format:check` / `npm run format` | `bun run format:check` | script passthrough |
| `agents/validator.md:40` | `node --test` + `npm run test:be`/`test:fe` | `bun test` ⚠ | runner change — see risk |
| `agents/validator.md:41` | `npm run validate:all` | `bun run validate:all` | script passthrough |
| `agents/reviewer-validator.md:28` | `npm run lint` | `bun run lint` | script passthrough |
| `agents/reviewer-validator.md:29` | `npm run format:check` | `bun run format:check` | script passthrough |
| `agents/reviewer-validator.md:31` | `npm run validate:all` | `bun run validate:all` | script passthrough |
| `agents/builder.md:195` | `npm run typecheck` | `bun run typecheck` | script passthrough (tsc still under the hood) |
| `agents/builder.md:197` | `node --test <*.test.ts>` | `bun test` ⚠ | runner change — see risk |
| `agents/builder-fe.md:120` | `npm run typecheck` | `bun run typecheck` | script passthrough |
| `agents/reviewer.md:65` | `npm audit` | `bun audit` ⚠ | needs recent Bun |
| `agents/3rdparty/typescript-reviewer.md:70` | prose "new npm package audited" | reword "bun package" | doc-only |
| `agents/3rdparty/playwright-tester.md:21` | `npx playwright test` | `bunx playwright test` | runner change |

**13 references.** The two `node --test` rows are the high-risk items
(see Risk section). `npm run *` rows are trivial — `bun run <script>` reads the
same `package.json` scripts.

---

## Class 2 — Harness CLI invocation (`node scripts/crew.ts`, `loop.mjs`, `node -e`)

These invoke the plugin's own `.ts` / `.mjs` scripts. Under the hybrid decision
these **stay on Node**. Listed for completeness / full-swap scoping.

### agents/ (`node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" …`)

| File | Refs |
|------|------|
| `builder-be.md` | 5 |
| `builder-fe.md` | 5 |
| `builder.md` | 5 (incl. `scope-estimate`) |
| `reviewer.md` | 8 (incl. `validate-manifests.ts`, `validate-skills.ts`) |
| `validator.md` | 4 |
| `deployer.md` | 6 |
| `architect.md` | 3 (incl. `validate-contracts.ts`) |
| `researcher.md` | 3 |
| `reviewer-validator.md` | 3 |
| `parallel-runner.md` | ~9 (`node <loop-cli> …`) |
| `refactor.md`, `qa-expert.md`, `performance-engineer.md`, `uxdesigner.md`, `integrator.md`, `3rdparty/test-automator.md` | 1–2 each |
| `lead.md` | 1 (`scope-estimate`) |

### commands/ (`node …/crew.ts`, `loop.mjs`, `node -e`)

| File | Refs |
|------|------|
| `build.md` | 11 |
| `fix.md` | 11 |
| `orchestrate-slice.md` | 10 (incl. `loop.mjs resolve-skills`, `validate-contracts.ts`, `validate-ux-spec.ts`, `node -e`) |
| `ship.md` | 8 |
| `validate.md` | 5 (incl. `node -e` bundle inline) |
| `review.md` | 4 (incl. `node -e`) |
| `adopt.md`, `parallel.md` | 3 each |
| `design.md`, `init.md`, `prune-artifacts.md` | 2 each |
| `audit-repo.md`, `brief-me.md`, `claim-files.md`, `install.md`, `release-files.md`, `request-approval.md`, `resolve-approval.md`, `show-approvals.md`, `show-claims.md`, `show-conflicts.md`, `wake-up-brief.md`, `architect-feature.md` | 1 each |

**commands/ total: ~73 `node` invocations.** All mechanically `bun`-swappable
(`node X.ts` → `bun X.ts`; Bun runs `.ts`/`.mjs` natively, no flag).

---

## Excluded — false positives (not tooling)

- `stack:node` tag — `orchestrate-slice.md:44`, `builder-be.md:75,115`, `reviewer.md:51`
- `node-ts-patterns` skill path — `typescript-reviewer.md:18`
- "Visual node editors" prose — `ui-ux-designer.md:121`

---

## Risk — `node --test` → `bun test` is NOT a drop-in

`bun test` is a jest-style runner, **not** `node:test` API compatible. The
ADR-002 spike (Bun 1.3.14, Windows) measured this directly:

| Criterion | Result |
|-----------|--------|
| `bun test` (full suite) | **RED** — 402/611 tests discovered, 23 fail + 22 errors, 33.9s vs 21.1s Node |
| `crew.ts` CLI under Bun | GREEN |
| e2e-smoke under Bun | GREEN — 1.9s |
| Native TS exec (no strip-types flag) | GREEN |

The hybrid decision (v0.30.0) adopts `bun test --parallel` for the suite, which
implies the suite is being moved to / kept compatible with Bun's native runner
(or `test:node` fallback covers the gap). The agent-file rows in Class 1 that
still say `node --test` should be reconciled with that decision.

---

## Performance analysis — approximate Bun vs Node gain

Grounded in the ADR-002 spike (the only measured data for THIS repo) plus
general runtime characteristics. **Bottom line: the win is on process
startup / native-TS, not on the test suite's real work.**

### Measured (this repo)

| Surface | Node | Bun | Δ |
|---------|------|-----|---|
| Full test suite (post-WS1) | 21.1s | 33.9s (partial discovery) | **−60% (regression)** |
| Full test suite (pre-WS1, historical) | 115.9s | — | WS1 already won the big gain on Node |
| e2e-smoke | n/a logged | 1.9s | green |
| crew.ts CLI round-trip | green | green | parity |

The suite's 21.1s is dominated by **real work** — subprocess smokes, filesystem
fixture provisioning, network timeouts. A runtime swap cannot compress that.
WS1 already removed the compressible part (per-spawn TS parse overhead) **on
Node**, so the headroom Bun would otherwise capture is largely gone.

### Where Bun genuinely helps (estimated)

1. **Per-process cold start.** Bun ~15–35 ms vs Node ~50–90 ms cold.
2. **Native TS, no transpile-per-spawn.** Node `--experimental-strip-types`
   strips types on every invocation; Bun parses natively with a cache.

The harness spawns `node scripts/*.ts` **~110+ times** across a full slice
ceremony (agents + commands). Estimated startup+transpile saving:

```
~110 spawns × ~40 ms saved/spawn ≈ ~4.4 s per full slice
```

Against a slice that runs **minutes** end-to-end, that is **low single-digit
seconds — marginal** (~1–3% of slice wall time, high confidence it is small).

### Potential upside (unverified, contingent)

If the suite is rewritten to Bun's **native** test API (not the `node:test`
shim) **and** parallelized (`--parallel` across cores), Bun's runner is strong
on I/O-bound suites. Speculative: 21.1s → **~8–14 s** if the fixture/subprocess
work parallelizes well — a **~35–60% suite gain**. This is **UNVERIFIED** and
contingent on:
- the `node:test` → `bun:test` rewrite landing green on Windows (the ADR
  blocker), and
- the suite's heavy I/O actually parallelizing rather than serializing on
  shared temp dirs / ports.

### Verdict

| Question | Answer |
|----------|--------|
| Faster test suite today? | **No** — measured regression (−60%) on the `node:test` shim. |
| Faster harness CLI / startup? | **Yes, slightly** — ~2–3× per spawn, but ≈ seconds per slice (marginal). |
| Big win available? | **Only** via a native-Bun parallel test rewrite — est. 35–60%, unverified, gated on Windows `node:test` compat. |
| Net recommendation | Hybrid (current v0.30.0) captures the realistic upside while keeping Node fallback. A full swap buys ~marginal CLI savings for migration + cross-platform risk. |

---

## Migration effort summary (if full swap revisited)

- **Trivial (mechanical):** ~73 command `node X.ts` → `bun X.ts`; ~50 agent
  `node …/crew.ts` → `bun`; all `npm run *` → `bun run *`.
- **Medium:** `npm audit` → `bun audit` (version-gate); `npx` → `bunx`.
- **High-risk / gating:** `node --test` → native `bun test` suite rewrite
  (611 tests, Windows `node:test` compat). This is the only item that can
  block; everything else is find-and-replace.
