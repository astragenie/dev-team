---
id: FEAT-191
status: done
priority: P1
category: infra
target_release: null
created: 2026-07-05
depends_on: []
slices: [SLICE-A, SLICE-B]
derived_from: docs/superpowers/plans/2026-07-05-gepa-core-dist-node-parity-plan.md
pm_customer_impact: 0.60
pm_effort_estimate: 0.25
pm_strategic_alignment: 0.65
pm_technical_risk: 0.60
pm_dependency_depth: 0.20
composite_score: 0.62
autonomous_safe: false
tags: [gepa-core, packaging, node, bun, consumer-parity, cross-repo, adr-003-option-c, capture-tee]
triage_notes: |
  Derived 2026-07-05 from docs/superpowers/plans/2026-07-05-gepa-core-dist-node-parity-plan.md
  (ADR-003 Option C - narrow unblock, distinct from the full Bun sweep in FEAT-190). Root cause:
  @astragenie/gepa-core ships raw .ts and its exports point at src/*.ts; Node refuses to
  type-strip anything under node_modules in ALL versions incl. 24 (a permanent design guard),
  so 7 GEPA slash-commands hard-fail under Node and GEPA capture silently drops trials
  (fireCaptureTeeSilent swallows the throw), leaving the trial corpus near-empty. Fix: gepa-core
  builds a compiled dist/ (JS + d.ts), flips exports src->dist, republishes 0.7.0 (MINOR - no
  API surface change, only path resolution). No crew logic change; 8 value imports resolve to
  JS instead of TS.
  Calibrated against FEAT-190 (impact .60/effort .45/strat .70/risk .60/dep .35/composite .58)
  and FEAT-183 (composite .65). customer_impact .60: same evidenced root-cause quote as FEAT-190
  (Stripping types ... node_modules) but this fix closes a concrete data-loss bug (silent
  capture-drop -> near-empty trial corpus) rather than the broader runtime-coherence goal
  FEAT-190 targets. effort_estimate .25 (well below FEAT-190's .45): packaging-only, ~0.75
  dev-day across 2 slices vs FEAT-190's ~3.5 across 5. Cost analog: SLICE-108's dev-team-side
  share (dep bump + shim wiring only) ran $68.20/85 msgs inside a larger $388 cross-repo slice;
  FEAT-191 SLICE-B is narrower still - .25 is a lower-bound estimate. strategic_alignment .65
  (below FEAT-190's .70): ADR-003's own Option C, "the right fix for gepa-core as a reusable
  library... tracked separately, not in FEAT-190" (ADR-003) - serves the GEPA centerpiece
  (FEAT-183) by fixing trial-corpus data loss, not itself a roadmap centerpiece. technical_risk
  .60 (banded 0.6-0.8 floor): published/cross-plugin package-contract change (exports src->dist)
  with migration-class rollback (npm publish irreversible; rollback = corrective 0.7.1 + crew
  re-pin, not git revert) - same banding as FEAT-184/FEAT-185 for cross-repo npm-publish work,
  scored slightly lower because zero call signatures change. dependency_depth .20 (below
  FEAT-190's .35): no external cross-org blocker (unlike FEAT-190's astragenie/common) - only an
  internal SLICE-A-before-SLICE-B publish-then-bump sequence.
  Overlap check: none. FEAT-190's Non-goals explicitly exclude this work ("Shipping
  @astragenie/gepa-core as compiled dist/... orthogonal, tracked in the gepa-core repo, not
  here. ADR-003 Option C") and never touch gepa-core packaging. FEAT-185 (in flight) moves
  provider *code* into gepa-core; FEAT-191 only changes how already-shipped code is packaged.
  Architect-review (crew:architect-reviewer, 2026-07-05) verdict needs_revision -> RESOLVED in
  plan v2: [HIGH] gepa-core src uses .ts-extension imports requiring allowImportingTsExtensions
  +noEmit:true; naive noEmit:false breaks tsc -> plan now mandates
  rewriteRelativeImportExtensions:true (TS 5.7+) + typescript devDep bump ^5.5->^5.7. [MED] main
  field still points at src -> plan now flips main+adds root types. [MED] provider peer-dep
  isolation -> promoted to AC-5. [MED] inert peerDependenciesMeta (no peerDependencies block) ->
  fixed in SLICE-A. [MED] PR-time build gate in gepa-core added. [MED] exact-pin 0.7.0 in crew
  until confidence. All verified against node_modules/@astragenie/gepa-core on disk.
  autonomous_safe=false: cross-repo (gepa-core owner session + dev-team consumer session per the
  cross-repo-edit rule), touches a published npm package's export contract (irreversible once
  published), requires consumer-parity verification - same class as FEAT-184/FEAT-185 human-review
  precedent.
  Pre-mortem (mandatory: technical_risk >= 0.6 AND P1):
  (1) likely failure = tsc build emits a .d.ts surface subtly different from raw .ts (re-export
  drift breaking a downstream import type consumer), OR dist bundling hoists a peer-SDK require()
  across entry points defeating lazy peer-dep isolation (plan risk-table row -> AC-5).
  (2) rollback reality = npm publish irreversible; rollback = corrective 0.7.1 publish + crew
  re-pin - migration-class, not git revert.
  (3) coverage gap = no existing test asserts the shape of capture-tee's dynamic-import success/
  failure path; a regression re-introducing the drop passes CI green today because
  fireCaptureTeeSilent swallows the error by design. AC-4 closes this gap.
---

# FEAT-191: gepa-core ships compiled `dist/` for Node consumer parity

## Context

`@astragenie/gepa-core` ships raw TypeScript and points `exports` at `src/*.ts`. Node refuses to
type-strip anything under `node_modules` in every version including 24 (a permanent design
guard). This breaks 7 GEPA slash-commands under Node and silently drops GEPA capture trials
(`writeArtifact` -> dynamic-import `capture-tee.ts` -> value-imports gepa-core -> throws under
Node -> caught by `fireCaptureTeeSilent`), leaving the trial corpus near-empty. Full design:
`docs/superpowers/plans/2026-07-05-gepa-core-dist-node-parity-plan.md`. This is ADR-003's Option
C — the narrow, gepa-core-only fix, explicitly retained as "the right fix for gepa-core as a
reusable library" and explicitly out of scope for FEAT-190 (the full crew-wide Bun sweep).

## Goal

gepa-core builds a compiled `dist/` (JS + `.d.ts`) and flips its 6 `exports` entries (plus the
legacy `main`/`types` root fields) from `src/*.ts` to `dist/*.js`. Publishes as `0.7.0` (MINOR —
no public API change, only path resolution). crew bumps its dependency. No crew logic changes;
the 8 existing value imports of gepa-core resolve to JS instead of TS and now run under both
Node and Bun.

## Non-goals

- The full Bun-single-runtime migration (FEAT-190) — hooks, CI, installer, command docs.
- Any change to gepa-core's public API shape, provider constructor signatures, or judge
  interface (FEAT-184/FEAT-185 concerns) — packaging only.
- Moving additional providers into gepa-core — FEAT-185's concern.

## Acceptance criteria

- **AC-1 (build emits runnable dist):** Given gepa-core with `tsconfig.build.json`
  (`outDir: dist`, `rootDir: src`, `declaration: true`, `noEmit: false`,
  `rewriteRelativeImportExtensions: true`, `tests/` excluded), When `bun run build` runs, Then
  `dist/index.js` + `dist/index.d.ts` and all 5 provider `dist/providers/*/index.{js,d.ts}`
  exist, **and** a fresh Node process import smoke test `node -e "import('./dist/index.js')"`
  exits 0 (proves emitted specifiers resolve under Node ESM, not just that files exist).

- **AC-2 (tarball ships dist, not src):** Given `"files": ["dist"]` + `.npmignore` excluding
  `src/`/`tests/`/configs, When `npm pack --dry-run` runs against the 0.7.0 build, Then the
  tarball lists `dist/**` and contains **zero** `src/*.ts` or `tests/*` entries.

- **AC-3 (node runs gepa-optimize clean — happy path):** Given crew pinning
  `@astragenie/gepa-core@0.7.0`, When `node scripts/crew.ts gepa-optimize reviewer
  --artifact-only` runs on a plain Node 22.6+ shell, Then it exits `0`, prints a valid
  `OptimizationResult` JSON, and the output contains **zero** occurrences of `Stripping types is
  currently unsupported for files under node_modules`.

- **AC-4 (capture no longer silently drops under Node — the bug this FEAT fixes):** Given a crew
  slice dispatch to an allowlisted GEPA agent under Node, When `writeArtifact` dynamically
  imports `capture-tee.ts` (which value-imports gepa-core), Then the import resolves against
  `dist/index.js` without throwing and a `source: "captured"` trial is appended to the
  `TrialStore`. The test asserts the trial's `source` field explicitly — not merely the absence
  of a thrown exception (closes the coverage gap: `fireCaptureTeeSilent` swallows errors by
  design).

- **AC-5 (provider peer-dep isolation survives the flip):** Given a consumer imports
  `@astragenie/gepa-core/providers/azure-openai` **without** `@azure/openai` installed, When the
  import executes against the new `dist` entry point, Then it throws the existing clean
  install-instruction error — unchanged from the `src` entry point — confirming the dist flip did
  not hoist the peer SDK across entry points.

- **AC-6 (Bun path no regression):** Given the Bun path unchanged, When `bun test` and
  `bun scripts/crew.ts gepa-optimize reviewer --artifact-only` run against gepa-core `0.7.0`,
  Then both remain green with zero new failures attributable to the exports-format change, and
  crew `bun run typecheck` resolves gepa-core under `moduleResolution: Bundler`.

- **AC-7 (semver + CHANGELOG + pin):** Given the release, When gepa-core `package.json` is
  inspected, Then `version` is `"0.7.0"`, `main` is `"./dist/index.js"`, root `types` is
  `"./dist/index.d.ts"`, `CHANGELOG.md` has a dated `0.7.0` entry documenting the src→dist flip
  and the "no deep `/src/*` imports sanctioned" caveat, and crew pins `@astragenie/gepa-core`
  exactly `"0.7.0"` (loosen to `^0.7.0` after stability is proven).

## Slice plan

| Slice | Repo | Scope | ETA |
|---|---|---|---|
| SLICE-A | gepa-core | tsconfig.build (+ `rewriteRelativeImportExtensions`) + typescript ^5.7 + build script + exports/main/types flip + files/.npmignore + peerDependencies fix + prepublishOnly + PR-time build gate + 0.7.0 + CHANGELOG + publish | 0.5 d |
| SLICE-B | dev-team (crew) | dep pin `0.7.0` + bun install + Node/Bun parity verify (AC-3/4/6) + optional lockfile consolidation | 0.25 d |

**Dependency order:** SLICE-B blocks on SLICE-A being published. Cross-repo: SLICE-A must run in
a gepa-core session/worktree, not from the crew checkout, per the repo's cross-repo-edit rule.

## Risks + mitigations

| Risk | Sev | Mitigation |
|---|---|---|
| `.ts`-extension imports break `tsc` emit under `noEmit:false` | **High** | `rewriteRelativeImportExtensions: true` (TS 5.7+) + typescript devDep bump; AC-1 runtime import smoke proves emit resolves |
| `main` field left at src → node10 resolvers re-hit raw `.ts` | Med | Flip `main`→dist + add root `types` (AC-7) |
| Provider entry points lose lazy peer-dep isolation | Med | 1:1 entry-point mapping; AC-5 verifies install-error path still fires |
| Stale/absent dist shipped | Med | `prepublishOnly: bun run build` + `files:["dist"]` + PR-time `build && node import` gate + AC-2 |
| npm publish irreversible if 0.7.0 broken | Med | Forward-fix 0.7.1, never unpublish; crew pins exact `0.7.0` until confidence |
| Windows CRLF / biome on gepa-core build | Low | `.gitattributes` LF pin already in gepa-core |

## References

- Plan: `docs/superpowers/plans/2026-07-05-gepa-core-dist-node-parity-plan.md`
- ADR-003 (Option C): `docs/architecture/decisions/ADR-003-bun-single-runtime.md`
- Sibling (do not duplicate): `.claude/artifacts/loop/backlog/pending/FEAT-190-bun-single-runtime.md`
- Reviews (2026-07-05): architect-reviewer needs_revision (1 HIGH + 5 MED, all folded into plan
  v2); pm P1 composite 0.62.
