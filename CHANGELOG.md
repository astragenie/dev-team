# Changelog

All notable changes to the `crew` plugin are documented here. Versions follow
semver-ish for a pre-1.0 plugin: minor bumps may include behavior changes.

## v0.1.23 — 2026-05-22

### Changed
- **`session-cost.mjs::computeSessionCost`** — 235 lines / complexity 85
  cut to 133 lines / complexity 22.
  - `scanSessions` extracted: drives the per-session JSONL loop and
    returns the full accumulator bundle (totals, byModel, tool stats,
    file reads, conversation counters, perSourceState).
  - `handleAssistantTurn` + `handleUserTurn` extracted: the assistant
    branch handles usage / tool-use; the user branch handles
    tool_result sizing, compaction signals, and user message shape.
  - `resolveScanSources` extracted: encapsulates the three-mode source
    selection (aggregateAll / explicit / repo-derived with auto-detect
    fallback).
  - `sessionsHaveInWindowAssistantTurns` extracted: short-circuit
    activity probe used by the auto-detect fallback path.
- **`cost-advisor.mjs::summarizeReport`** — complexity 27 cut by
  extracting `summarizeToolStats` + `computeExplorationRatio` +
  `toolCount` helpers. summarizeReport now reads as a flat data shape.

### Notes
- Lint warning count: 18 → 15.
- All 49 tests pass.

## v0.1.22 — 2026-05-22

### Changed
- **artifacts.mjs `render` complexity 79 → split.** `resolveArtifactConfig`
  now dispatches off a `SIMPLE_RENDERERS` table (7 entries) and the heavy
  cost-report renderer is split into 9 named helpers
  (`renderCostReportFrontmatter`, `renderCostReportHeader`,
  `renderCostReportOutcome`, `renderCostReportTokens`,
  `renderCostReportModelMix`, `renderCostReportConversation`,
  `renderCostReportToolUsage`, `renderCostReportToolResultSizes`,
  `renderCostReportFileReReads`, `renderCostReportByModel`).
- **`briefing/render.mjs`** — `buildBlockedOrMissing` (complexity 41 → 18)
  and `recommendedNextStep` (38 → 20) refactored to `[condition, message]`
  rule tables. Messages that need runtime data go through thunks so
  expressions are only evaluated when the condition fires.
- **`briefing/collect.mjs::collectRecentCosts`** (193 lines, complexity 64)
  split into focused helpers: `parseFrontmatterBlock`, `parseModelMix`,
  `parseToolUsage`, `computeDominantModel`, `deriveFlags`,
  `parseCostReportText`, `listCostReportFilesByMtime`. Orchestrator now
  fits in ~25 lines.
- **`workflow-state.mjs::registerWorkflowArtifact`** (complexity 28) →
  per-kind dispatch via `ARTIFACT_HANDLERS` table.
- **`workflow-state.mjs::summarizeWorkflowState`** (complexity 18) →
  pending-badge specs in `PENDING_BADGE_SPECS` table; `collectPendingBadges`
  helper.

### Notes
- Lint warning count: 18 → 15.
- All 49 tests pass.

## v0.1.21 — 2026-05-22

### Changed
- **installer.mjs full split (Tier #10)**: extracted 5 more cohesive
  submodules from the residual installer.mjs. Now 11 files total under
  `scripts/lib/installer/`, each ≤ 110 lines and single-concern:
  - `claude-md.mjs` (67) — CLAUDE.md create / legacy-marker upgrade /
    idempotent re-run / append-on-no-marker.
  - `gitignore.mjs` (38) — `# crew:start`/`# crew:end` block create or
    in-place replace.
  - `harness-files.mjs` (90) — README + hook script refresh + state
    seed-if-missing + artifact / log directory tree.
  - `repo-guides.mjs` (28) — `.claude/crew/constitution.md` +
    `workflow.md` + `protocol.md` write.
  - `welcome.mjs` (30) — post-install message shape, pure data.
  - `audit.mjs` (24) — read-only repo + global presence check.
  - `global.mjs` (110) — `inspectGlobalInstall` + `installGlobal` +
    `GLOBAL_IMPORT_LINES` + `globalPaths`.
- `scripts/lib/installer.mjs` is now 72 lines (was 397; was 1040 before
  the Tier B-5 splits started). Just the public API:
  `bootstrapRepo`, `initRepo` + re-exports for `auditRepo` and
  `installGlobal`.
- Public surface unchanged. All 49 tests pass.

## v0.1.20 — 2026-05-22

### Changed
- **`scripts/lib/workflow-state.mjs`** — reduced complexity in five
  hot functions:
  - `hasCompletedPhaseEvidence`: 37 → 19. Extracted
    `isGateResolved(status)` + `RESOLVED_GATE_STATUSES` set;
    artifact-shape check pulled out.
  - `hasMeaningfulProgress` (25) and `isSubstantialRunHint` (24):
    artifact / gate predicates extracted into
    `hasReviewOrValidationArtifact`, `hasSubstantialArtifact`,
    `hasSubstantialGate`, `hasSubstantialMode`.
  - `summarizeMissingArtifactWritesForRun`: 43 → 23. Status checks
    folded into a `[cond, code][]` table; named `isDecided(status)`
    helper makes the intent (pass/fail, not pending or skipped)
    explicit.
  - `applyBadge`: 18 → 1. Replaced 16-branch `if`-chain with a
    `BADGE_TABLE` registry mapping badge name → `(run) => [parent, key]`
    selector + target status. Adding a new badge is now one entry.
- **`scripts/validate-manifests.mjs`**: exports `validateManifests()`
  for in-process testing. Entry-point check uses `process.exitCode`
  instead of `process.exit(1)` so `await import` doesn't kill the
  caller.
- **`scripts/lib/wakeup.mjs`**: dropped dead `resolvedSprintPath`
  computation (lint `no-unused-vars`).
- **`scripts/lib/workflow-state.mjs`**: dropped dead
  `workflowStateExists()`.
- **`scripts/lib/cost-advisor.mjs`**: dropped unused `base` parameter
  in `cache-busted` rule trigger.

### Added
- **`docs/code-conventions.md`**: per-repo coding conventions adapted
  from `Astragenie.Standards/typescript/coding-conventions.md` for
  plain ESM. Anchors the lint rules to their reasoning.

### Notes
- Lint warning count: 20 → 17.
- All 49 tests pass.

## v0.1.19 — 2026-05-22

### Changed
- **briefing.mjs split (Tier B-7)**: 821-line module split along the
  natural data / render boundary.
  - `scripts/lib/briefing/collect.mjs` (515 lines): pure I/O —
    `collectGitActivity`, `collectRelevantArtifacts`,
    `collectRecentCosts`, `fetchAutonomousLoopBrief`.
  - `scripts/lib/briefing/render.mjs` (299 lines): pure data → string
    — `buildRetrievalGuide`, `buildCurrentObjective`,
    `buildBlockedOrMissing`, `buildImportantReminders`,
    `recommendedNextStep`, `buildSecondaryOptions`.
  - `scripts/lib/briefing.mjs` (88 lines, was 821): thin orchestrator.
  Public API `buildBriefingReport` unchanged.
- **marketplace**: autonomous-loop entry bumped to v0.1.15 to pick up
  the slice-linker + phase-gate splits shipped there.

Tests: 49/49 pass.

## v0.1.18 — 2026-05-22

### Changed
- **installer.mjs split (Tier B-5)**: the 1040-line mega-module is now
  399 lines. Extracted four cohesive submodules under
  `scripts/lib/installer/`:
  - `templates.mjs` (504 lines) — all string templates and constants.
  - `util.mjs` (42 lines) — filesystem + JSON helpers.
  - `settings.mjs` (61 lines) — `.claude/settings.json` hook-merge logic
    (`isCrewHook`, `mergeHooks`, `updateSettings`).
  - `legacy-migration.mjs` (89 lines) — the one-shot
    `engineering-os` → `crew` namespace migrator.
- Public API unchanged: `bootstrapRepo`, `initRepo`, `installGlobal`,
  `auditRepo` still export from `scripts/lib/installer.mjs`. All 49
  tests pass without modification.

## v0.1.17 — 2026-05-22

### Changed
- **Tooling**: ESLint 9 (flat config) + Prettier 3 added. CI now runs
  `npm ci`, `validate-manifests`, `lint`, `format:check`, `node --test`,
  `e2e-smoke` as separate gates. devDependencies pinned via
  `package-lock.json`.
- **Code style swept**: prettier --write across `scripts/**/*.mjs` and
  `tests/**/*.mjs`; no semantic changes.
- **CLI registry refactor** (`scripts/crew.mjs`):
  - 58 hand-written `if (value === "--foo") { ... }` flag branches
    collapsed into a single `FLAG_SPEC` table.
  - 30-branch command `else if` chain collapsed into a `COMMANDS`
    registry of `(ctx) => Promise<result>` handlers.
  - File size: 767 → 560 lines (-207). Same flags, same outputs,
    same error messages. Adding a new command/flag is now one entry.

### Fixed
- `scripts/lib/cost-advisor.mjs`: empty `catch {}` blocks now carry
  intent comments (ESLint `no-empty`).

## v0.1.16 — 2026-05-22

### Added
- `scripts/validate-manifests.mjs`: lightweight CI gate verifying
  `plugin.json` / `marketplace.json` / `package.json` required fields,
  semver parseability, and version-drift between the three files.
  Catches the class of regression that `marketplace.json` version drift
  already caused once.
- CI: validate-manifests step runs before tests on every push/PR.
- README: test / release / license badges.
- `/crew:adopt`: explicit step 12 instructs the lead to inspect repo
  commit conventions and recommend `/crew:install-commit-bridge` when
  a matching preset applies. Stays opt-in; never auto-installs.

### Notes (not changed)
- `.gitignore` install block intentionally does NOT ignore
  `.claude/artifacts/` — artifacts are the durable record per the
  constitution and should be committed in target repos.
- Hooks audit: `log_event.sh` and the generated `commit_bridge.sh`
  are fail-closed at the shell layer (`set -euo pipefail`),
  fail-open at the JS layer (best-effort, never blocks tool output),
  use `execFileSync` (no shell) with `escapeForJsLiteral` on all
  template substitutions. No injection surface. Minor follow-up:
  `log_event.sh` has no payload-dir rotation.
- No `package-lock.json` added: zero runtime deps (Node built-ins only).

## v0.1.15 — 2026-05-22

### Changed
- README: removed stale "legacy compatibility aliases" section that
  listed five `/crew:*` commands which no longer exist (`build-feature`,
  `investigate-bug`, `bootstrap-repo`, `init-repo`, `install-global`).
- README: added optional follow-up step recommending
  `/crew:install-commit-bridge`, replacing the dead-alias block with
  real, discoverable guidance.
- `installer.mjs::buildWelcome`: returns an `optional` array with a
  one-line hint pointing at `/crew:install-commit-bridge` after `init`
  or `bootstrap`. Bridge remains opt-in; install flow is unchanged.

## v0.1.14 — 2026-05-21

### Changed
- Plugin and marketplace `author`/`owner` updated to `shishkosv` to match
  repo owner and the companion `autonomous-loop` plugin.

### Fixed
- README local-development clone URL pointed to the legacy
  `alex-radaev/engineering-os` repo; corrected to
  `sergeymilashico/hero-crew`.
- `docs/reference-repo-plan.md` replaced hard-coded
  `/Users/aradaev/Desktop/Projects/` paths with `<reference-repos-dir>`
  placeholders.

## v0.1.13 — 2026-05-21

### Fixed
- `bootstrapRepo` / `init` now seed `.gitignore` with a marker-bracketed
  `# crew:start`/`# crew:end` block. User lines outside the block are
  preserved; the block is replaced in place on re-install. Closes the
  e2e-smoke regression and lets the CI step run as a blocking gate.

### Infrastructure
- `e2e-smoke` promoted from `continue-on-error` to blocking in CI.

## v0.1.12 — 2026-05-21

First tagged release after accumulated 0.1.0 → 0.1.12 work.

### Fixed
- `write-final-synthesis` no longer hides top-level `path` under a `synthesis`
  key when a cost-report is also emitted. Restores the documented JSON shape
  for downstream callers and tests.
- `marketplace.json` version drift: autonomous-loop entry bumped to 0.1.12 to
  match its `plugin.json`.

### Added — accumulated since 0.1.0
- Per-slice Claude session cost tracking and `cost-advise` recommender.
- `brief-me` cost diagnostics: combined cache R/W + I/O in millions, dominant
  model, preformatted I/O and Cache R/W strings, richer `autonomousLoop`
  block, cost-diagnostics table for flagged slices.
- Tool-failure flag threshold raised to `> 3`.

### Infrastructure
- CI: `node --test` + `e2e-smoke` on push/PR (GitHub Actions).
- `.gitignore` covers `node_modules/`, `.claude/logs|state|artifacts/`,
  `.claude.backup.*`, `*.tmp`.
- Docs: removed hard-coded absolute paths in favor of `<path-to-this-repo>`
  placeholders.
- README documents marketplace install commands.
