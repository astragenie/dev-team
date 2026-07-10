# Completion plan — dev-team + plugins-common, max-parallel waves (2026-07-10)

Closes the 3-repo stabilization plan for the two repos this session owns. runner-plugin
(W2b #449, W3c) is out of scope — its own sessions.

## Invariants (why the waves are shaped this way)

1. **Repo isolation = free parallelism.** dev-team and plugins-common are separate CI
   pipelines → their tracks run fully concurrently EXCEPT at the two cross-repo handoffs
   (W3-pre output feeds W3a; W3a publish feeds W3b).
2. **The memory lane is serial.** Every edit to `scripts/lib/memory/**` OR `package.json`/
   lockfiles is one ordered dev-team track: `W3-pre → #170 fix → W3b → #159`. No two of
   these run in parallel (same files / same dep manifest).
3. **Disjoint dev-team work parallelizes the memory lane.** hooks / dispatch / CLI / docs
   touch none of the memory files → separate worktree, concurrent.
4. **Critical chain (unavoidable sequence):** `W3-pre (dev-team) → W3a extract+publish
   (plugins-common) → W3b consume+release (dev-team)`. Everything else is scheduled around it.
5. **Isolation discipline:** every builder in its own `isolation: worktree`; orchestrator
   never edits the shared tree while a builder is live (session lesson from the slice-2
   collision). One owner per file per wave.

## Dependency graph

```
                 ┌─ T0-hygiene (inline, no worktree) ─────────────┐
   Wave 0 (∥):   ├─ T0-A dev-team MEMORY: W3-pre + #170 flake fix ─┼─┐
                 ├─ T0-B pcommon: ci workflow_dispatch + registry ADR
                 └─ T0-C dev-team DISJOINT: #164 + #163 ───────────┘ │
                                                                     ▼ (W3-pre landed)
   Wave 1 (∥):   ┌─ T1-A pcommon MEMORY: W3a extract → publish 0.1.0 ─┐ (critical)
                 ├─ T1-B dev-team DISJOINT: token-burn #167/#165 ──────┤
                 └─ T1-C pcommon: plugin-registry adopt-or-delete exec ┘
                                                                     ▼ (memory-provider@0.1.0 on npm)
   Wave 2 (∥):   ┌─ T2-A dev-team MEMORY: W3b consume+delete → v0.61.0 (critical)
                 └─ T2-B dev-team DISJOINT: any W4 leftovers
                                                                     ▼ (v0.61.0)
   Wave 3:        T3 dev-team MEMORY: #159 scoped-recall (lane now free) + plan-close retro
```

## Wave 0 — immediate parallel kickoff (4 tracks)

| Track | Repo / isolation | Work | Gate | Blocks |
|---|---|---|---|---|
| **T0-hygiene** | dev-team, inline (no code) | Close #168 (fixed by 0.10.1 pin), #199, #202 with evidence comments; `git worktree prune` + remove the 7 stale worktrees; leave orphan `gepa-core-v0.10.0` tag (hard rule), note it | issues closed | — |
| **T0-A** ⚠️MEMORY | dev-team wt-mem | **W3-pre**: apply `docs/research/2026-07-06-memory-bridge-reconciliation.md` — reconcile `memory.*` schema (`recall.k` vs `topK`, `enabled` vs `provider`) in `schema.ts`/`config.ts`; **+ fold in #170** flake fix (dual-write test starvation) since both touch memory/ | typecheck+full suite; reconciled schema on main | **W3a** |
| **T0-B** | pcommon wt | `ci.yml` add `workflow_dispatch` (tiny); **plugin-registry adopt-or-delete ADR** (decision doc only, no code yet) | CI green; ADR committed | T1-C |
| **T0-C** | dev-team wt-disjoint | #164 pre-push-verifier worktree-blind fix (hooks); #163 chore-branch parallel lane (worktree-mgmt) — disjoint from memory | review + CI | — |

Wave-0 exit: W3-pre + #170 on main (unblocks W3a); hygiene done; 2 disjoint fixes landed.

## Wave 1 — after W3-pre lands (3 tracks)

| Track | Repo / isolation | Work | Gate |
|---|---|---|---|
| **T1-A** ⚠️CRITICAL | pcommon wt | **W3a**: extract 7 generic files (`schema`, `types`, `resolve-provider`, `astramem-provider`, `file-provider`, `noop-provider`, `ranking`) → new `@astragenie/memory-provider` package; port WITH tests; leave `capture-learning`/`inject-recall`/`drift-check` in dev-team. Publish `memory-provider-v0.1.0` (release.yml tag case already exists). **Watch**: the release.yml build-before-gate fix from P2 applies; if memory-provider depends on plugin-std, pin it `^0.5.0` (not `workspace:*`) before tagging | full suite + tag → `npm view` shows 0.1.0 |
| **T1-B** | dev-team wt-disjoint | Token-burn levers #167/#165 (checkpoint commits, mechanical-scripted, worktree-default) — dispatch/model-routing files, disjoint from memory | review + CI |
| **T1-C** | pcommon wt | Execute the registry ADR decision (adopt→publish `plugin-registry-v0.1.0`, or delete). Sequence AFTER T1-A's package add settles the workspace/lockfile (same repo) | CI green |

Wave-1 exit: `@astragenie/memory-provider@0.1.0` published; token-burn + registry resolved.

## Wave 2 — after memory-provider publishes (2 tracks)

| Track | Repo / isolation | Work | Gate |
|---|---|---|---|
| **T2-A** ⚠️CRITICAL MEMORY | dev-team wt-mem | **W3b**: add `@astragenie/memory-provider: ^0.1.0` (both lockfiles); swap `scripts/lib/memory/` to consume the package; delete the 7 extracted local copies; thin adapter if import-shape differs; local orchestration files (`capture-learning`/`inject-recall`/`drift-check`) call the shared primitives. **Cut v0.61.0** (CHANGELOG + dual manifest + README + tag + marketplace bump) | full suite (memory dual-write green — #170 already fixed); v0.61.0 released |
| **T2-B** | dev-team wt-disjoint | Any remaining W4 (e.g. leftover perf items); do NOT touch package.json/lockfiles while T2-A holds the dep swap | review + CI |

## Wave 3 — after v0.61.0 (memory lane free)

- **T3**: #159 astramem scoped-recall adoption (memory lane now unblocked). Then plan-close:
  update `loop-snapshot`, write final synthesis, retro. FEAT-190 (bun-single-runtime) stays
  deferred — it's cross-repo (`astragenie/common`), a separate session.

## Parallelism summary

- **Peak concurrency: 4 tracks** (Wave 0) — 2 dev-team worktrees + 1 plugins-common + inline hygiene.
- **Only 2 true sequence points** the whole plan: W3-pre→W3a, W3a→W3b. Everything else overlaps.
- **Critical path length**: W3-pre → W3a(+publish) → W3b(+release) → (#159) = 4 serial slices.
- Disjoint dev-team perf/hygiene work (T0-C, T1-B, T2-B) is amortized alongside the critical path — zero added wall-clock.

## ETA (effort, not calendar)

| Wave | Critical-track PRs | Parallel-track PRs | Milestone |
|---|---|---|---|
| 0 | W3-pre+#170 (1) | hygiene + ci/ADR + #164/#163 (4) | schema reconciled |
| 1 | W3a extract+publish (1 PR + tag) | token-burn + registry (2–3) | memory-provider@0.1.0 |
| 2 | W3b + v0.61.0 (1–2 + release) | W4 leftovers (1–2) | **v0.61.0 = plan closed** |
| 3 | #159 + retro (1–2) | — | fully done |

Critical path ≈ **4 slices + 1 publish + 1 release**. With disjoint tracks amortized, total
dev-team+plugins-common completion ≈ **one focused session for Waves 0–2 (through v0.61.0)**,
plus a light Wave 3. runner-plugin work is entirely separate (#449).

## Gate policy (every track)

Independent review before merge; full CI green (no advisory skips on adoption/consume PRs);
behavior-preserving swaps keep existing tests unmodified; pin bumps isolated from code; no
release tag / marketplace bump without the local tag matching. Publishes are irreversible —
gate on the review verdict first (P2 lesson).
