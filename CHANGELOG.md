# Changelog

All notable changes to the `crew` plugin are documented here. Versions follow
semver-ish for a pre-1.0 plugin: minor bumps may include behavior changes.

## v0.3.0 — 2026-05-23 — Astra rebrand

### Breaking

- Marketplace renamed `crew-dev` → `astra`. New install path:
  `/plugin marketplace add sergeymilashico/hero-crew` then
  `/plugin install crew@astra`.
- Companion plugin renamed `autonomous-loop` → `loop`. Install:
  `/plugin install loop@astra`. Companion slash command namespace
  `/autonomous-loop:*` → `/loop:*` (handled in the companion repo
  release; `loop@0.3.0` ships a one-time migrator that renames
  `.claude/autonomous-loop.json` → `.claude/loop.json` and rewrites
  CLAUDE.md markers on first `/loop:install`).

### Migration

- Existing installs of `crew@crew-dev` and `autonomous-loop@crew-dev`
  must be uninstalled and re-installed under the new marketplace name.
  See `docs/process/rebrand-migration.md` for the exact command
  sequence.
- Consumer-repo state for the companion plugin auto-migrates on first
  `/loop:install`; no manual file rewrites required.

### Notes

- `crew` plugin itself has no consumer-repo state rename — only the
  install path changes.
- Marketplace manifest is the source of truth for plugin pins; both
  `crew` and `loop` pinned at `0.3.0` here.
- Hardcoded cache-path fallbacks in `scripts/lib/briefing/collect.mjs`
  walk the new `astra/loop/<version>/` cache first, then fall back to
  the legacy `autonomous-loop-dev/autonomous-loop/<version>/` shape so
  briefings keep working during the transition.

## v0.2.0 — 2026-05-22 — Phase 1 (Engineering OS) complete

Closes the Phase-1 backlog defined in `docs/architecture/architecture.md`.
Nine of eleven FEATs shipped; the remaining two (FEAT-005, FEAT-009)
are correctly deferred behind explicit "when X observed" triggers.

### Skill taxonomy (FEAT-001, FEAT-007)

- `skills/` split into four tiers: `universal/`, `workflow/`,
  `domain/`, `meta/`. Existing crew skills relocated; tier field
  added to frontmatter.
- New `scripts/validate-skills.mjs` enforces the quality bar
  (required: name, tier, description; recommended: owner,
  last_reviewed, triggers; hard caps: ≤200 lines, directory matches
  name, no duplicate names, tier in enum). Wired into CI between
  validate-manifests and lint. Local: `npm run validate:skills`.
- All 4 existing skills brought up to spec.

### Routing (FEAT-002)

- Authoritative `docs/routing-table.md` (14 rows derived from real
  history). Lead consults at session start.
- Production-promotion row explicitly requires human approval — no
  automation.
- FEAT-008: brief-me surfaces a reminder when the routing-table
  mtime exceeds 30 days. Encourages a monthly review.

### Workflow state (FEAT-006)

- New `blocked` + `escalated_to_human` workflow badges with
  `--note <reason>` and `--blocked-by <artifact-id>` flags.
- `write-final-synthesis` refuses to run while escalated unless
  `--force`.
- `brief-me` + `summarizeWorkflowState` surface both as pending
  badges. AL plugin (v0.1.21) consumes these signals end-to-end.

### Lead, builder, reviewer prompts (FEAT-003, FEAT-011)

- `agents/lead.md` rewritten — 196 → 169 lines (under 200-line cap).
  New "Composition formula" + "Where to load specifics" sections
  point at the durable docs/skills rather than restating discipline
  inline.
- `agents/builder.md` (FEAT-011) gains a TDD policy table:
  required on net-new behavior + bug reproducers; optional on
  refactors of tested code; skipping silently is a review finding.
  Procedure of record: superpowers `test-driven-development` skill.
- `agents/reviewer.md` (FEAT-011) gains a TDD gate section that
  enforces failing-test-first on net-new behavior.

### Docs (FEAT-004, FEAT-010)

- `docs/architecture/architecture.md` polished: Phase 1 status
  table, autonomous-loop sync line, tooling-gates section.
- New `docs/governance.md`: skill ownership, agent prompt size bar,
  routing-table review cadence, artifact retention, lessons →
  standards pipeline, three-test rule for specialist-agent
  admission, defer-by-default.
- `docs/` directory namespaced into `architecture/`, `process/`,
  `history/`, `standards/`, `backlog/` to match Astragenie.Standards
  shape. 19 flat doc files moved via `git mv`; all internal refs
  rewritten.

### Tooling (cross-cutting)

- `tsconfig.json` added with `checkJs: true` / `noEmit`; `npm run
  typecheck` wired into CI between format:check and tests. JSDoc
  annotations added on session-cost, cost-advisor, crew.mjs entry
  points to satisfy tsc.
- `superpowers` plugin verified enabled in `~/.claude/settings.json`
  for global TDD + systematic-debugging + verification-before-
  completion skill discovery.

### Companion plugin sync

| Capability                                   | crew   | autonomous-loop |
|----------------------------------------------|--------|-----------------|
| blocked + escalated_to_human (writer)        | ≥0.2.0 | —               |
| Honors crew gates in slice flow (reader)     | —      | ≥0.1.21         |
| Iteration cap + cost-alert + snapshot loop   | —      | ≥0.1.20         |

Pin both together; older AL against newer crew silently misses the
new gate signals.

### Tests + gates

- 41/41 tests pass (35 → 41, six added across FEAT-006 + FEAT-008).
- typecheck + lint + format + validate-skills + validate-manifests
  + e2e-smoke all clean on every push.

### Backlog after Phase 1

Closed: FEAT-001 / FEAT-002 / FEAT-003 / FEAT-004 / FEAT-006 /
FEAT-007 / FEAT-008 / FEAT-010 / FEAT-011.

Intentionally deferred:

- **FEAT-005** (dotnet/csharp-conventions domain skill) — build when
  the first .cs work appears.
- **FEAT-009** (artifact index file) — build when artifact-tree
  grep exceeds ~2s.

## v0.1.26 — 2026-05-22

### Removed
- **Commit bridge feature removed in its entirety.** The bridge was an
  opt-in `PostToolUse` hook that minted Crew artifacts from commits
  matching a preset pattern; in practice it was never adopted beyond
  exploration. Deletion reclaims ~700 lines (lib + tests + commands +
  docs) and one PostToolUse-hook surface for downstream repos to worry
  about.
  - `scripts/lib/bridge-installer.mjs` (463 lines)
  - `scripts/lib/plugin-identity.mjs` (sole consumer was the bridge)
  - `tests/bridge-installer.test.mjs` (14 tests)
  - `commands/install-commit-bridge.md` + `commands/install-wiggin-bridge.md`
  - CLI subcommands: `install-commit-bridge`,
    `backfill-commit-bridge`, `list-bridge-presets`,
    `install-wiggin-bridge`, `backfill-wiggin-bridge`
  - README Install section "optional follow-up" block
  - `commands/adopt.md` step 12 bridge probe
  - `docs/process/adoption-checklist.md` bridge sections
  - `installer/welcome.mjs` optional bridge hint
- Companion `autonomous-loop/skills/loop-discipline/SKILL.md` lost its
  one-line reference to the bridge as well.

### Migration
Repos with a bridge already installed will keep the generated
`.claude/hooks/commit_bridge.sh` + `PostToolUse` settings entry — no
runtime breakage. The CLI commands for re-installing or reconfiguring
the bridge are simply gone. Manual cleanup: delete
`.claude/hooks/commit_bridge.sh` and the matching `PostToolUse` entry
in `.claude/settings.json` if you want to remove the hook entirely.

### Notes
- Tests: 35/35 pass (down from 49 — the 14 missing tests are the
  bridge suite that no longer exists).

## v0.1.25 — 2026-05-22

### Changed
Final lint-cleanup pass. **Lint warning count: 8 → 0.**

- `validate-manifests.mjs::validateManifests` 16 → off list. Extracted
  `isMissing`, `checkRequiredFields`, `checkVersions`,
  `checkOwnMarketplaceEntry`, `checkMarketplaceEntries`.
- `briefing/collect.mjs::parseHeaderFields` 18 → off list via
  `parseRunTitle`, `parseUsd`, `parseDurationMs` helpers.
- `artifacts.mjs::renderCostReportHeader` 16 → off list via
  `formatCount` helper.
- `briefing/render.mjs::buildBlockedOrMissing` 18 → off list. Static
  `PENDING_BADGE_MESSAGES` + `MISSING_WRITE_MESSAGES` maps + extracted
  `collectGateFailureMessages` + `collectRepoStateMessages`.
- `briefing/render.mjs::recommendedNextStep` 19 → off list. Same
  pattern — `NEXT_STEP_FROM_PENDING` / `NEXT_STEP_FROM_MISSING` maps,
  `GATE_NEXT_STEP_SPECS` + `collectGateFailureNextStep`,
  `repoStateNextStep` probe helper.
- `wakeup.mjs::buildWakeUpBrief` 124 lines → off list. Summary block
  extracted into `buildWakeUpSummary`.
- `session-cost.mjs::computeSessionCost` 22 / 146 lines → off list.
  Extracted `priceByModel`, `computeSourceBreakdown`, `buildModelMix`,
  `computeSizeStats`, `collectFileReReadEntries`, `buildToolUsage`.

### Notes
- Lint output is now clean. All 49 tests pass.

## v0.1.24 — 2026-05-22

### Changed
- **`briefing/collect.mjs::parseCostReportText`** complexity 34 → split
  into `parseHeaderFields`, `parseTokenFields`, `parseDiagnosticFields`,
  `parseOutcomeFields`, `bodyNum`. Composer reads top-down.
- **`artifacts.mjs::renderCostReportFrontmatter`** complexity 27 → 16
  via `[predicate, line-builder][]` table with lazy interpolation.
- **`artifacts.mjs::renderCostReportHeader`** complexity 22 → 16 via
  small `formatDuration`/`formatTokens`/`formatCacheHit`/`formatUsd`/
  `formatBool` helpers.
- **`session-cost.mjs::autoDetectSourceProject`** + `listActiveProjectDirs`
  both 18-25 → off list. Extracted shared helpers
  `listJsonlInDir`, `listProjectDirEntries`,
  `countInWindowAssistantTurns`. Caller bodies now ~10 lines each.
- **`session-cost.mjs::handleAssistantTurn`** complexity 23 → off list.
  Split into `recordTokenUsage` + `recordToolUse` + `TOOL_COUNTERS`
  table dispatch for Skill/Agent counters.
- **`workflow-state.mjs::hasPendingGates`** complexity 18 → off list.
  Predicates moved into `PENDING_GATE_CHECKS` array.
- **`workflow-state.mjs::hasCompletedPhaseEvidence`** complexity 19 →
  off list. Field accessors moved into `GATE_STATUS_GETTERS` +
  `PHASE_ARTIFACT_GETTERS` arrays.
- **`workflow-state.mjs::summarizeMissingArtifactWritesForRun`**
  complexity 23 → off list. Gate-to-artifact mapping moved into
  `MISSING_WRITE_SPECS` table with `gate(g)` / `artifact(a)` /
  `code` fields.

### Notes
- Lint warning count: 15 → 8. All remaining within 5 of threshold;
  further cuts have diminishing returns.
- All 49 tests pass.

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
- **`docs/standards/code-conventions.md`**: per-repo coding conventions adapted
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
- `docs/history/reference-repo-plan.md` replaced hard-coded
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
