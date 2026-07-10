# Handoff — 3-repo wave plan: audit done, P1 in flight, resume P1→P5

- Date: 2026-07-10 (session hit limit mid-P1)
- From: dispatcher (dev-team session)
- Objective: complete `plan-3repo-wave-execution.md` (durable copy: `.claude/artifacts/crew/runs/20260710-plan-3repo-wave-execution.md`) for dev-team + plugins-common. runner-plugin tracks (W1-B, W2b, W3c) EXCLUDED — separate activities there (tracker-provider waves).
- Confidence: high (every claim verified against git/gh this session)

## Work-loss audit result (COMPLETE — do not redo)

Nothing lost. All dev-team wave branches squash-merged; PR head == branch tip verified via gh:

- `fix/w0c-202-152` → PR #204 MERGED (origin/main `75e55eef`)
- `fix/w1c-199-reviewer-idle-guard` → PR #203 MERGED (`aa33d660`)
- `worktree-transient-dancing-wren` → PR #201 MERGED (v0.58.0)
- `feat/arch-gate-integration` (+fix0/ws4) → PR #189 MERGED
- `feat/gepa-ac3-closeout` (dev-team-auto) → fully merged
- plugins-common `w0a-releaseyml` → PR #14 MERGED; `ci/release-tag-cases` → PR #13 MERGED

All those worktrees are prunable (dev-team: `.claude/worktrees/agent-a58daf3c35fb32128`, `agent-ad9ec1e1c831194af`, `transient-dancing-wren`, `../dev-team-release`, `../dev-team.wt/*`, `../dev-team-auto`; plugins-common: `.claude/worktrees/w0a-releaseyml`).

Only real sitting work was plugins-common PR #9 — now being landed (P1 below).

## Wave-plan status

- W0-A ◐ — release.yml tag cases merged (#13/#14); npm publishes NOT done (npm still: astramem-client 0.1.0, gepa-core 0.7.0, plugin-std/memory-provider 404)
- W0-B ◐ — #186/#197/#198/#200/#171 closed; #162 open; #202/#199 fix-merged but issues left open (close with evidence comment)
- W0-C ✅ merged (#204); W1-C ✅ merged (#203)
- W1-A ✗ — dev-team pins still astramem-client ^0.1.0 / gepa-core 0.7.0
- W2/W3/W4 ✗ not started. No v0.59.0 cut.

## UPDATE 2026-07-10 (Opus session, post-limit resume)

- **Recovered near-lost fix**: prior p1-builder left the actual CI fix STAGED-BUT-UNCOMMITTED (issue #171 failure mode) in plugins-common — `ci.yml` + `peer-dep-matrix.yml` edits adding `bun --filter @astragenie/plugin-std build` before typecheck. Merge commit `3d90d3c` had dropped the plugin-std build line (kept only astramem-client), so gepa-core + plugin-registry failed TS2307 and every peer-dep cell failed resolving `@astragenie/plugin-std/http`.
- Committed as `8584ed8`, pushed. Verified locally BEFORE push: fresh `dist` wipe + build + full `typecheck`/`lint`/`format:check`/`test` green across all 5 packages (gepa-core 212, plugin-registry 59, openclaw 38 tests pass). plugin-registry's TS2339/TS18046 errors were all cascading from the missing plugin-std import — vanish once resolved.
- CI running on `8584ed8`. Next: confirm green → crew review gate → merge PR #9 → main CI → P2 tags.
- **W2-pre report SAVED**: `.claude/artifacts/crew/runs/20260710-w2pre-plugin-std-swap-map.md` (investigator delivered full swap-list before dying). Feeds P4. Headline: frontmatter swap first (5 CRLF-unsafe parsers, highest value), http = skip (zero dev-team callers), jsonl needs a non-throwing-wrapper decision first.

## P3 COMPLETE (2026-07-10) — dev-team v0.59.0 released

- **W1-A pin bump** merged (dev-team PR #206): astramem-client ^0.2.0 + gepa-core 0.10.1. gepa-core 0.10.x moved LockManager to plugin-std `Result<handle|null,never>` (DEC-002) — adapted `run-with-lock.ts` + `optimize-runner.ts` with Result narrowing (behavior-preserving). Both lockfiles refreshed. CI green (self-hosted full suite).
- **v0.59.0 cut**: CHANGELOG + dual manifest bump (plugin.json + package.json) + README pinned-callout, tag `v0.59.0` pushed (`384ec164`, CI green), astra-marketplace registry bumped crew→0.59.0 (`5317a5a`, single-field per HARD RULE). Bundled #203 (reviewer idle-guard) + #204 (settings hook guard) + #206 (pins).

## P4 IN PROGRESS — W2 plugin-std adoption (target v0.60.0)

Swap-map: `.claude/artifacts/crew/runs/20260710-w2pre-plugin-std-swap-map.md`. plugin-std ^0.5.0 dep added in slice 1.

- **Slice 1 frontmatter** ✅ merged #207 (`68af7c7e`) — 4 sites (agent-registry, cost-advisor, wakeup, briefing/workflow); artifact-cache + serializers left local (findings-as-JSON-string contract). Reviewer MERGE_OK.
- **Slice 1 follow-up** ✅ merged #209 (`9e7bf908`) — wakeup unterminated-fence fallback restored to full-body (reviewer parity finding).
- **Slice 2 git** ✅ merged #208 (`ef700fa7`) — briefing/git.ts + branch-cleanup.ts → runGit; gepa-killswitch left local (plugin-std runGit hardcodes `git` binary → would drop `--git` override).
- **Slice 3 jsonl** 🔄 builder in isolated worktree. Guardrail: plugin-std `append()` THROWS; dispatch-timing/observability are fire-and-forget MUST-NOT-throw → wrap in try/catch. Likely leave observability dedupe + jsonl.mjs byte-seek tail (perf) + serialize-jsonl (overwrite) local.
- **Slice 4 result** ⏳ pending — the riskiest (result.ts is plugin-std's seed; swapping drags errors.ts + `.code` migration at call sites, claims.ts imports {ok,err}). Broad blast radius — evaluate carefully / may warrant its own decision.
- **http = skip** (zero dev-team callers).

After W2 families land → cut v0.60.0 (CHANGELOG + dual manifest bump + README callout + tag + marketplace registry bump, same as v0.59.0).

**LESSON**: dispatch adoption builders with `isolation: worktree` — a slice-2 shared-tree collision occurred when the orchestrator edited files while a non-isolated builder was live in the same checkout. Recovered via scoped `git stash`.

## P2 COMPLETE (2026-07-10) — all three packages published

npm now has: **plugin-std@0.5.0**, **astramem-client@0.2.0**, **gepa-core@0.10.1** (NOT 0.10.0 — see below). Path taken:
- Post-merge review (p1-reviewer) returned PUBLISH_BLOCKED with 3 blockers, all fixed:
  1. astramem-client `private:true` (copy-paste from astramem-openclaw) → removed + added publishConfig. **PR #15**.
  2. plugin-registry cli.ts `import.meta.main` → undefined on Node <22.18/<24.2 (below engines floor 22.6) → silent no-op under `node dist/cli.js`. Swapped for version-independent ESM entry check + cli.test.ts now asserts output written. **PR #15**.
  3. gepa-core `workspace:*` → `^0.5.0` pin (release guard). **PR #16** (also pinned plugin-registry).
- Published plugin-std-v0.5.0 + astramem-client-v0.2.0 (clean).
- **gepa-core-v0.10.0 tag FAILED** (release.yml pre-publish gate didn't build plugin-std → workspace-linked local copy unresolvable). Fixed release.yml (build plugin-std before gate) + bumped gepa-core 0.10.0→**0.10.1** (0.10.0 tag spent; tags never deleted; identical payload). **PR #17**. Tag gepa-core-v0.10.1 → published OK.
- **Orphan tag**: `gepa-core-v0.10.0` exists on origin, points at pre-fix commit, published nothing. Left per "never delete tags" hard rule.

**⚠️ P3 must pin gepa-core to 0.10.1 (or ^0.10.0 which allows it), NOT 0.10.0.**

## P1 DONE + P2 SEQUENCE (critical dep-order finding)

- **P1 COMPLETE**: PR #9 auto-merged to plugins-common main as `6341bab` (green CI + Peer-Dep both pass). Two real fixes landed this session: `8584ed8` (CI build plugin-std before typecheck — recovered from staged-but-uncommitted) + `ed81050` (plugin-registry cli.ts `import.meta.main` guard — root cause of the never-green cli.test.ts: main() ran on import, set process.exitCode=1). Main CI is suppressed by auto-merge (plan principle 7); verified green via tree-identity (`ed81050` tree == `6341bab` tree, 0-file diff). ci.yml has no `workflow_dispatch` — nice-to-have follow-up to add one.
- **P2 BLOCKER — publish order is forced**: `gepa-core` AND `plugin-registry` package.json both declare `@astragenie/plugin-std: "workspace:*"`. release.yml publish-guard (`.github/workflows/release.yml:45`) rejects any `npm publish` whose package.json still has a `workspace:` dep. So:
  1. Tag `plugin-std-v0.5.0` (clean, no workspace deps) → publish FIRST.
  2. Tag `astramem-client-v0.2.0` (clean, only a peerDep on astramem-plugin >=0.6.0) → independent, anytime.
  3. **Then** edit `packages/gepa-core/package.json` dep `@astragenie/plugin-std` `workspace:*` → `^0.5.0`, COMMIT to main, THEN tag `gepa-core-v0.10.0`. Cannot tag gepa-core before plugin-std is published + this pin lands.
  4. plugin-registry (v0.1.0) not in P2 scope, but same pin needed whenever it publishes.
- Publish = irreversible (npm locks version slot 24h even after unpublish — memory `gepa-core-v0.2.0-unpublish-lockout`). Gate on p1-reviewer PUBLISH_OK verdict first.

## P1 state (superseded — see above)

plugins-common `feat/plugin-std-stabilization` (= OPEN PR #9, plugin-std 0.5.0 + gepa-core 0.10.0 adoption + plugin-registry 0.1.0):

- Builder committed the parked `.github/workflows/peer-dep-matrix.yml` macOS-drop as `f456f05` and merged origin/main (CI fixes #12–#14) as `3d90d3c`. **Both PUSHED** to origin — nothing local-only.
- NOT yet verified: local test/typecheck run, PR #9 CI re-run result. Builder was interrupted before reporting. Next session: check `gh pr checks 9`; likely remaining failure = gepa-core workspace dep on plugin-std needs plugin-std built before typecheck (same class as #14 — extend the build-before-typecheck CI step).
- Versions on branch must stay: plugin-std 0.5.0, gepa-core 0.10.0, astramem-client 0.2.0 (main already carries 0.2.0 code — tag immediately publishable after P2 gate).

## Resume sequence (tasks were tracked as P1→P5, chained)

1. **P1** finish PR #9: fix CI → review gate → merge → `gh workflow run test.yml --ref main` green (auto-merge suppresses push CI — plan principle 7).
2. **P2** push tags on plugins-common main: `astramem-client-v0.2.0`, `plugin-std-v0.5.0`, `gepa-core-v0.10.0` → release.yml npm publish → `npm view` verify. Gotchas: provenance needs `repository` field; project `.npmrc` must route @astragenie → npmjs.org.
3. **P3** dev-team pin-only PR (astramem-client ^0.2.0, gepa-core 0.10.0; `npm install --package-lock-only` for the npm-ci gate; manual peer-dep check — astramem-plugin pinned by git ref, npm can't semver it) → merge → cut v0.59.0 + astra-marketplace single-field registry bump.
4. **P4** W2: swap-list from W2-pre investigation (was dispatched, interrupted — re-run: map dev-team `scripts/lib/` vs plugin-std errors/Result, jsonl, http, frontmatter, runGit) → W2-fix gaps (plugin-std 0.6.0 if needed) → behavior-preserving swap PRs per helper family → v0.60.0.
5. **P5** W3: W3-pre = `docs/research/2026-07-06-memory-bridge-reconciliation.md` schema reconcile FIRST; W3a extract 7 generic files (schema, types, resolve-provider, astramem-provider, file-provider, noop-provider, ranking) from `scripts/lib/memory/` → new `@astragenie/memory-provider` 0.1.0 (placement call needed for config.ts/index.ts/legacy-adapter.ts; capture-learning/inject-recall/drift-check STAY local); W3b dev-team consumes (fix/quarantine #170 flake BEFORE landing) → v0.61.0. W3c runner EXCLUDED.

## Rules in force

- Every PR through crew review gate; behavior-preserving swaps = zero existing-test edits.
- Pin bumps never share a PR with code changes.
- Arm auto-merge only AFTER review artifact lands (plan principle 8).
- plugins-common edits from its own checkout/worktree only.
- runner-plugin: hands off entirely.
