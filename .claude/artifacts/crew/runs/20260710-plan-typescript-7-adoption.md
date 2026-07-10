# Plan — adopt TypeScript 7 across dev-team + plugins-common (2026-07-10)

## Grounded reality (verified, not memory)

- **TS 7.0 is GA** as of **2026-07-08** (RC 2026-06-18). It's the Go-native compiler, ~10× faster. Binary name is **`tsc`** (RC/GA dropped the `tsgo` name; nightlies still publish `tsgo`).
- **Type-check parity is strong**: across ~20k compiler test cases, of ~6000 that error under TS 6.0, all but **74** also error under TS 7.0 (~98.8%). Divergences are rare but real — the spike must catalog ours.
- **Declaration emit is INTENTIONALLY different** (`--declaration`/`--build`) — MS guidance: "safest to wait for a mature emit pipeline"; the `.d.ts` output "differs greatly, intentionally, to be closer to TS declarations." **This is the #1 risk and it only affects plugins-common** (which emits published `.d.ts`).

## Two repos, two risk profiles (from their actual tsconfigs)

| | dev-team | plugins-common |
|---|---|---|
| TS today | `^6.0.3` (already on the TS6 bridge) | `^5.5.0`–`^5.7.0` |
| tsc role | **typecheck only** (`noEmit:true`) | **EMITS published dist** (`declaration`, `declarationMap`, `sourceMap`, `rewriteRelativeImportExtensions`, `outDir dist`) |
| Runtime | Bun strip-types (tsc never emits/runs) | consumers import the emitted dist |
| Compiler-API use | **none** (grep clean) | none |
| Notable opts | `moduleResolution:Bundler`, `allowImportingTsExtensions`, `isolatedModules:false`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noUnusedLocals/Parameters` | same base + emit opts |
| **Risk** | **LOW** — swap the gate, done | **MEDIUM-HIGH** — emit parity gates it |

Core principle: **decouple typecheck-speed from emit.** TS 7 as the fast typecheck gate is low-risk everywhere. TS 7 as the *emit* compiler for published packages is the only place real caution is needed.

## Wave 0 — spike (parallel, both repos, de-risk before any commit)

**S0a — dev-team diagnostic parity** (isolated worktree, read-only-ish):
- Add `typescript@7` (dev-only), run `tsc --noEmit` (now the TS7 binary) over the full include set.
- Diff diagnostics vs the TS6 baseline. Catalog every divergence (expect ~0–few, from the 74-class). Confirm TS7 accepts `moduleResolution:Bundler` + `allowImportingTsExtensions` + `isolatedModules:false` + `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`.
- Confirm `bun run typecheck` invokes the TS7 `tsc` correctly under Bun.
- Output: GO/NO-GO + a fix list (usually tiny). **No emit risk here at all.**

**S0b — plugins-common emit parity** (branch, ONE package = plugin-std):
- Add `typescript@7`, run typecheck across all packages (diagnostic parity).
- Run the emit on plugin-std: `tsc -p tsconfig.build.json` with TS7. **Diff the emitted `dist/` vs the TS5 dist**: (a) `.js` — runtime-equivalent? (b) `.d.ts` — still *correct* (types resolve the same for a consumer), even if formatted differently? (c) `.d.ts.map`/`.js.map` — valid? Confirm `rewriteRelativeImportExtensions` still works.
- Consumer smoke: point dev-team (or a scratch consumer) at the TS7-emitted plugin-std, run its typecheck — does it still resolve + type-check identically?
- Output: EMIT_OK (parity holds → Path A) or EMIT_DIVERGES (→ Path B). **This verdict gates Wave 2.**

## Wave 1 — dev-team adoption (after S0a GO; LOW risk)

- Swap `typescript` → `^7` in package.json; apply S0a's fix list (if any).
- Update `typecheck` script if the flag surface changed (should stay `tsc --noEmit`).
- Both lockfiles; full CI green (self-hosted suite unaffected — Bun runtime doesn't use tsc).
- Ship as a patch (fold into the next minor, e.g. v0.62.0). 1 PR.

## Wave 2 — plugins-common adoption (after S0b; path chosen by the emit verdict)

**Path A — EMIT_OK (parity holds):**
- Per package (plugin-std → astramem-client → memory-provider → gepa-core → plugin-registry → openclaw): swap `typescript` → `^7`, rebuild dist with TS7, **diff each package's dist**, run its tests, run a **consumer smoke** (install the republished package into dev-team, typecheck).
- Republish each as a **patch bump** (`<pkg>-v<x.y.z+1>`) — emitted artifacts changed, so consumers get new versions. Do NOT reuse a published version.
- Sequence by dependency (plugin-std first, since others emit against it).

**Path B — EMIT_DIVERGES (declaration emit not consumer-safe yet):**
- Use TS7 only for the **typecheck gate** (`bun run typecheck` → TS7, fast) in every package.
- **Keep TS5/6 `tsc` for the emit/build** (`tsc -p tsconfig.build.json` stays on the old compiler) until TS7 declaration emit matures.
- No republish needed (dist unchanged). Pure gate-speed win. Revisit emit in a later cycle.
- This is the SAFE default if S0b shows any consumer-facing `.d.ts` regression.

## Wave 3 — cleanup + record

- Update both repos' CI typecheck steps + any docs referencing `tsc`/TS version.
- ADR recording the decision + which emit path plugins-common took (+ the S0b evidence).
- Confirm the memory-provider package (newest) is covered.

## Risks + mitigations

1. **Declaration-emit divergence (plugins-common)** — #1 risk. MS explicitly says `.d.ts` differs. Mitigate: S0b per-package `.d.ts` diff + consumer smoke; Path B fallback (keep tsc emit) costs nothing but the speed win on emit.
2. **~74-case diagnostic divergence** — a TS7 error TS6 didn't raise (usually a real latent bug → fix it) or vice-versa. Mitigate: S0a/S0b whole-suite diagnostic diff before adopting.
3. **tsconfig option support** — Bundler resolution, `allowImportingTsExtensions`, `rewriteRelativeImportExtensions`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`. TS7 targets parity but confirm in the spike (a NO here is a hard blocker for that repo).
4. **Early-GA maturity** — GA'd days ago (2026-07-08); early-GA bugs possible. Mitigate: spike-first; keep the old compiler pinned as a one-line revert.
5. **Bun ↔ tsc interaction** — dev-team's `bun run typecheck` shells to tsc; confirm it resolves the TS7 binary. plugins-common build likewise.
6. **Toolchain** — biome/lint/format unaffected (not tsc). Only the `typescript` dep + lockfiles move.

## ETA (effort, not calendar)

| Wave | Scope | Size |
|---|---|---|
| 0 spike (S0a + S0b, parallel) | diagnostic + emit parity verdicts | **S** (mostly run+diff, ~half session) |
| 1 dev-team | dep swap + gate + release | **S** (1 PR) — low risk |
| 2 plugins-common | Path A: per-pkg rebuild+diff+republish / Path B: gate-only | **M** (A) or **S** (B) — gated on S0b |
| 3 cleanup + ADR | CI/docs/decision record | **S** |

**Total ≈ 1 focused session if Path B or if Path A parity is clean; ~1.5–2 if Path A needs careful per-package emit validation + republishes.** dev-team is quick and safe; plugins-common's cost is entirely the emit decision.

## Sequencing note

Independent of the just-shipped v0.61.0 work — no file overlap with the memory/adoption tracks. Can start the Wave-0 spike anytime. Recommend: **spike first, decide Path A/B on evidence, then dev-team (safe) before plugins-common (gated).**

---

## Spike outcomes (2026-07-10)

### S0a — dev-team: **NO-GO (deferred)** — see dev-team#214
- Typecheck parity is **perfect**: `typescript ^6.0.3 → ^7.0.2` gives 0 new diagnostics; all 10 tsconfig options accepted; lint/format clean.
- **Blocker**: TS 7.0 removed the classic compiler API (`ts.factory`, etc.) from the default import → `openapi-typescript` (devDep ^7.13.0, peerDep still `^5.x`) throws at module-load → breaks `validate-contracts.ts` + its CI-gate test. Not fixable in dev-team source.
- **Decision**: stay on TS6. Revisit trigger = openapi-typescript declares `typescript ^7` support (watch its releases). Interim option if urgent: npm/bun `overrides` pinning openapi-typescript's nested typescript to ^6.
- Plan gap corrected: the "no compiler-API usage" check must include **transitive devDependencies**, not just first-party source. openapi-typescript is the sole blocker.

### S0b — plugins-common: (pending) — independent of #214
plugins-common does NOT use openapi-typescript, so the dev-team blocker doesn't apply. Its TS7 viability rides solely on the declaration-emit parity verdict (S0b). Wave 2 proceeds or falls to Path B on that evidence alone.

### S0b + Wave 2 — plugins-common: **ADOPTED TS7 (merged)**
- S0b verdict EMIT_OK; Wave 2 merged as plugins-common PR #26 (main `77d935b`). typescript ^5.x → ^7.0.2 across all 6 packages; removed `esModuleInterop:false` (3 files — TS7 removed the option, inert here).
- **Emit safety, corrected**: non-zod packages (plugin-std) emit BYTE-identical; **zod packages (memory-provider, gepa-core) are TYPE-identical but NOT byte-identical** — TS7's normalized declaration emit sorts union members + object properties alphabetically. Same lines/types/optionality; structurally identical for consumers (verified: consumer smoke exit 0, full suite 0 fail). On next natural release those packages' published `.d.ts` reorder cosmetically — harmless.
- Toolchain-only: no source, no version bumps, no forced republish. CI green on TS7 (Linux).
- **Net TS7 status**: plugins-common ✅ on TS7; dev-team ⏸ deferred (openapi-typescript, #214). The two repos decoupled — the dev-team blocker never touched plugins-common.
