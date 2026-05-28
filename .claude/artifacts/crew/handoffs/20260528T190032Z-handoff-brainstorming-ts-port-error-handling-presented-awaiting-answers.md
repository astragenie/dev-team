# Task Handoff: Brainstorming — TS port, Error Handling presented, awaiting 5 answers + approval

- Created: 2026-05-28T19:00:32Z
- From: lead
- To: lead (next session)
- Supersedes: 20260528T181513Z-handoff-brainstorming-ts-port-migration-order-pending-approval.md
- Objective: Design + spec the TypeScript port of the crew plugin codebase (exact mirror of `hero-crew-autonomous-loop`'s TS port pattern)
- Allowed Scope: brainstorming dialogue only; spec write at `docs/superpowers/specs/2026-05-28-typescript-port-design.md` after all sections approved
- Forbidden Scope: No code changes to `scripts/**/*.mjs`. No `src/` directory creation. No `.mts` files. No `tsconfig.build.json` until spec written + user-approved
- Deliverable: Written spec at `docs/superpowers/specs/2026-05-28-typescript-port-design.md`, committed, user-approved → then invoke `superpowers:writing-plans`
- Changed Files (this session): `scripts/lib/fleet.mjs`, `scripts/validate-manifests.mjs` — AC5 fixup, unrelated to TS port itself but landed in same session
- Confidence: high
- Risks: none active

## Design Sections — Status

| Section | Status |
|---|---|
| Architecture | ✅ APPROVED |
| Components + CI | ✅ APPROVED |
| Migration order | ✅ APPROVED (this session, 2026-05-28T18:50ish) |
| **Error handling** | **PRESENTED, awaiting 5 answers + approval** |
| Testing | pending |
| Spec write → self-review → user review → writing-plans | pending |

## Error Handling Section — Content (delivered)

Mirror of loop spec's parity model: TS source → compiled `.mjs` → `git diff scripts/` shows whitespace/comments only.

- **Acceptable diff**: whitespace, comment removal (JSDoc replaced by TS types), `.mjs` import extension stays (NodeNext), no compiler helpers (importHelpers: false, noEmitHelpers: false), tsc emit ordering.
- **Unacceptable diff**: any executable token change (`===` ↔ `==`, conditional reorder, branch removal, var rename in body, default arg add/remove, async structural change, const ↔ let, implicit undefined returns).
- **Stop+fix rule**: halt group commit → bisect to file → root-cause in source → fix → rebuild → re-diff → no "small fix" exception.
- **Phase 1 rollback**: 3+ stops or 30+ min unclear root-cause → `git reset --hard HEAD~1` on migration branch → reduce group scope (split in half) → re-run → escalate to `crew:reviewer` after 2 reductions.
- **Parity-critical files** (extra scrutiny, own commit each within group): `cost-advisor.mjs` (866L), `session-cost.mjs` (842L), `briefing/collect.mjs` (764L), `workflow-state.mjs` (742L), `artifacts.mjs` (667L).
- **CI drift guard** (lands with Phase 1 close): new `validate-build-parity.mjs` step — `npm run build && git diff --exit-code scripts/`. Optional pre-commit hook. Removable after Phase 2 (intentional divergence begins).

## Open Questions for User (must be answered to unblock Testing section)

1. **Source dir name** — loop uses `src/scripts/`. Hero-crew same, or different (e.g. `tssrc/`)?
2. **Build command** — `tsc -p tsconfig.build.json` plus a separate `tsc -p tsconfig.json --noEmit` for the typecheck script? Or one config that both type-checks and emits?
3. **Commit compiled output to git** — yes (loop's choice: plugin works from clone with no postinstall), or build-on-install (cleaner repo, requires postinstall hook)?
4. **Per-group commit cadence** — group as single commit by default, but the 5 parity-critical files each get a commit. Confirm?
5. **30-min / 3-stop escalation threshold** — too lenient, too strict, or right?

## Resume Instructions

1. **Wait for answers to the 5 questions above**, then declare Error handling APPROVED.
2. Move to **Testing section**:
   - Parity check as CI gate (covered in Error handling — confirm not duplicated).
   - Regression suite unchanged: `node --test`, all 112 tests must pass per group.
   - Phase 2/3 integration test targets: full-cycle `startSlice` → `completeSlice` (mirror loop spec lines 217–221, adapted for crew commands), test-adequacy gate, validation gate, ladder gate.
   - Test count gate: fail CI if test count drops below current 112.
3. On Testing approval → write spec at `docs/superpowers/specs/2026-05-28-typescript-port-design.md` (mirror loop spec structure: Goal / Scope / Phase 1 / Phase 2 / Phase 3 / Risk Register / Out of scope).
4. Self-review spec → present to user for review.
5. On user approval → invoke `superpowers:writing-plans` skill to convert spec into an executable implementation plan.

## Reference

- Loop spec (mirror source): `C:/work/mega/hero-crew-autonomous-loop/docs/superpowers/specs/2026-05-28-typescript-port-design.md`
- Loop spec section anchors used this session: Phase 1 § Parity check (line 157), Phase 1 § Migration order (line 146), Phase 2 § slice-linker decomposition (line 166), Phase 2 § TS interfaces (line 179), Phase 3 § Integration tests (line 215), Risk Register (line 241).
- Phase 2 targets (hero-crew side, by size): `cost-advisor.mjs` 866L, `session-cost.mjs` 842L, `briefing/collect.mjs` 764L, `workflow-state.mjs` 742L, `artifacts.mjs` 667L.
- Migration order (approved): leaf utils → mid-level utils → core lib → compound modules → entry scripts → tests. 6 groups, 1 commit per group except 5 parity-critical files get individual commits.

## Out-of-band Session Work (not part of brainstorming, but landed in same window)

- **AC5 fixup** for SLICE-08: replaced 2 residual `{any}` occurrences in `scripts/validate-manifests.mjs:56` (inline `@type`) and `scripts/lib/fleet.mjs:155-167` (added `FleetItem` typedef).
- Verified: `tsc --noEmit` EXIT 0, `eslint` EXIT 0, `node --test` 112/112 pass, `grep '{any}' scripts/` → zero matches.
- Commit: `f092cd5 fix(types): close SLICE-08 AC5 — eliminate residual {any} in scripts/`.
- Push: `de8ad7f..f092cd5 main -> main` — 6 commits total pushed to `origin/main` (5 prior handoff chores + this fixup).
- Workflow-state's `next` field for SLICE-08 (lead AC5 decision) is now satisfied. No additional update needed unless we choose to re-open + close the slice formally.
