# Repo Instructions — hero-crew

Claude Code plugin: the **Crew** harness. Lead-guided engineering
workflow with bounded subagents, quality gates, and inspectable
handoffs. The companion `loop` plugin sits on top of this one.

## Read first

1. `README.md` — what this plugin is, install instructions, pinned release.
2. `docs/architecture/architecture.md` — Engineering OS design: composition formula, skill tiers, routing approach, memory tiers, anti-patterns, phased roadmap.
3. `docs/standards/code-conventions.md` — ESM / Node conventions for this repo.
4. `docs/backlog/product-backlog.md` — current Engineering OS backlog (FEAT-001…FEAT-010).
5. `CHANGELOG.md` — recent releases.

## Engineering standards

For language-agnostic patterns + SOLID + GoF guidance, consult
[`Astragenie.Standards`](https://github.com/astragenie/standards)
if it is installed at a sibling path. The ESM conventions are mirrored
at `Astragenie.Standards/docs/javascript/coding-conventions.md`. The
local `docs/standards/code-conventions.md` is self-contained and authoritative
for this repo.

## Plugin shape

The plugin is intentionally content-heavy and runtime-light.

- Durable behavior belongs in `agents/`, `skills/`, and `commands/`.
- Hooks should stay small and auditable.
- Scripts should be thin helpers, not a hidden framework runtime.
- Agent prompts are capped at ≤350 lines per `docs/governance.md`, enforced by `scripts/validate-agents.ts` (FEAT-035). Specifics live in skills the agent invokes on demand.

## Skill taxonomy

Four tiers (see `docs/architecture/architecture.md` for details):

- `skills/universal/` — always discoverable.
- `skills/workflow/` — invoked per phase (build/review/validate/deploy).
- `skills/domain/` — loaded only when stack matches.
- `skills/meta/` — the OS itself (routing, escalation).

Repo-local overrides live in each consumer repo's `.claude/skills/`.

External-plugin skills (`context7`, `microsoft-docs:*`, `plugin-dev:*`, `terraform-code-generation:*`, `terraform-module-generation:*`) are wired into agent prompts via `docs/routing-table.md` rows — see FEAT-019 + the architecture doc's "External plugin skills as routed dependencies" subsection for the routing pattern.

## Local commands

Requires Node 22.6+ (strip-types runtime; see `docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md`).

- `bun run test` — full test suite via Bun (`bun test --timeout 60000 tests/`; requires Bun 1.3+). No `--parallel` — removed in `a20f9dd9` to work around Bun's `node:test` single-process scheduling bug (bun#5090); `bun run test:node` is the Node.js fallback.
- `bun run lint` — Biome lint.
- `bun run format` / `bun run format:check` — Biome format.
- `bun run e2e:smoke` — end-to-end smoke against a temp sample repo.
- `node ./scripts/validate-manifests.ts` — manifest sanity check (CLI scripts run on Node per ADR-002).

## CI gates

GitHub Actions (`.github/workflows/test.yml`) runs on every push to `main`
and every PR. All steps are blocking; lint must stay zero-warning.

1. `npm ci` (dependency install from `package-lock.json`)
2. `node ./scripts/validate-manifests.ts`
3. `node ./scripts/validate-skills.ts`
4. `node ./scripts/validate-agents.ts`
5. `node ./scripts/validate-slices.ts`
6. `CREW_VALIDATE_ROUTING_TABLE=1 node ./scripts/validate-routing-table.ts` (advisory; `continue-on-error: true`)
7. `bun run lint`
8. `bun run format:check`
9. `bun run typecheck`
10. `bun run test` (Bun test runner — `bun test --timeout 60000 tests/`, no `--parallel`; see bun#5090 note above)
11. `node ./scripts/e2e-smoke.ts`

Node runs dependency install (`npm ci`) and all `./scripts/*.ts` CLI/validators
(the consumer runtime, per ADR-002); Bun runs the test/lint/format/typecheck
package scripts.

The local validators are **hard** CI gates. During reviewer-phase work, the
`plugin-dev:plugin-validator` and `plugin-dev:skill-reviewer` skills are
consulted as **narrative** review aids on top of the CI gates — they catch
triggering-effectiveness and best-practice issues that structural validators
miss. Routing lives in `docs/routing-table.md` ("Plugin shape change",
"Skill shape change") and is enforced by `agents/reviewer.md`.

## Release & deployment

This plugin has no server, no container, and no hosted runtime. "Deploying"
means **cutting a versioned release that consumer installs can pin to**.
Source of truth for what users actually receive is the marketplace manifest.

### Release workflow

1. CI green on `main` (all eight gates above).
2. Update `CHANGELOG.md` — new top section, dated, grouped by FEAT.
3. Bump `version` in **both** in-repo manifests — `validate-manifests.ts` enforces
   `plugin.json` ↔ `package.json` parity as a HARD CI gate, so bumping only one
   fails CI (this bit v0.52.0–v0.52.2):
   - `.claude-plugin/plugin.json` → `version`
   - `package.json` → `version`
   - (`marketplace.json` is NOT in-repo — the registry lives in `astra-marketplace`;
     bump it there as the paired cross-repo commit, see the astra-marketplace HARD RULE.)
4. Commit: `chore(release): vX.Y.Z — <one-line summary>`.
5. Tag annotated: `git tag -a vX.Y.Z -m "vX.Y.Z"`.
6. Push both: `git push origin main --follow-tags`.
7. Verify the tag appears on GitHub, **CI is green on the release commit**, and the
   registry `marketplace.json` in `astra-marketplace` reflects the new version.

### Versioning

Pre-1.0 semver-ish (see `CHANGELOG.md` header):

- **Minor** (`0.X.0`): closes a backlog phase or introduces new commands/skills.
- **Patch** (`0.X.Y`): bugfix, doc polish, skill quality bar updates.
- Bumping `package.json` without bumping `marketplace.json` is a release bug.

### Companion plugin (`loop`)

Lives in a separate repo
(`https://github.com/astragenie/runner-plugin`) and ships from its **own
standalone marketplace** (`loop/.claude-plugin/marketplace.json` in that
repo) — this repo's `marketplace.json` no longer carries a loop entry.
To pick up a `loop` release: bump version in the loop repo's
`package.json` AND its `marketplace.json`, tag, push, then refresh the
local plugin install.

### Shared code (`astragenie/plugins-common`)

Code reused across ≥2 astra plugins (crew/dev-team, runner-plugin,
memory-plugin) lives in the **`astragenie/plugins-common`** Bun-workspaces
monorepo — NOT duplicated per plugin. Today: `packages/gepa-core/`,
`packages/plugin-kernel/`. Publish = push a per-package tag (`gepa-core-v*`)
→ `.github/workflows/release.yml` → `npm publish --provenance` (needs an
`@astragenie` Automation NPM_TOKEN + a `repository` field per package). Edit
it from **that repo's own session/worktree**, never cross-session from here
(see the astra-marketplace HARD RULE + `cross-repo-edits-require-worktree`
memory). MemoryProvider (`scripts/lib/memory/`) is a flagged extraction
candidate so dev-team + runner-plugin share ONE provider (FEAT-188 S1b/S3b).

### Hard rules

- Never force-push `main`. Never delete tags. Never skip hooks (`--no-verify`).
- Never publish a release with failing CI, even locally green.
- No auto-publish hook; releases are user-triggered.
- Pinned-release callout in `README.md` must reference the latest tag.

## Repo rules

1. Validate plugin manifest changes with `node ./scripts/validate-manifests.ts`.
2. Prefer additive changes over rewrites.
3. Keep repo-specific guidance in this file and `docs/architecture/architecture.md`.
4. Favor explicit files and artifacts over implicit memory.
5. Lint output must stay clean. Zero warnings.
6. No `process.exit(N)` from library functions.

## Artifact direction

When adding artifact-producing features, prefer:

- `.claude/logs/events.jsonl` for append-only event logs.
- `.claude/artifacts/crew/` for task handoffs, reviews, validations, deployments, and run summaries.

### What is committed vs ignored

`.claude/artifacts/` is **committed** as durable cross-machine history.
A teammate who clones the repo gets the full record of cost reports,
reviews, handoffs, deployments, validations, and run synthesis — the
working memory of *why* a slice landed the way it did.

Ignored (machine-local only):

- `.claude/logs/` — runtime hook output
- `.claude/state/` — per-session workflow state
- `.claude/settings.local.json`, `.claude/scheduled_tasks.lock`,
  `.claude/hooks/`, `.claude/worktrees/`, `.claude.backup.*`

This policy applies repo-wide across the team's repos for consistency
of `brief-me` and `crew fleet` output across machines.

## Backlog discipline

Active backlog under `.claude/artifacts/loop/backlog/{pending,triaged,in-progress,done}/`
(single authoritative tree since 2026-06-10; the old `docs/backlog/` tree was
merged via `loop doctor --fix` — see
`docs/superpowers/specs/2026-06-10-loop-crew-state-contract-design.md`).
`docs/backlog/` retains only non-state files (`product-backlog.md`, templates).
Each FEAT has frontmatter declaring priority, status, and an
`autonomous_safe` flag. Items tagged `autonomous_safe: false` (lead
prompt edits, skill authorship) require a human-in-loop on review even
when picked by the loop. State-file schema: loop repo `docs/state-contract.md`;
`node ./scripts/validate-loop-state.ts` guards single-tree + unique ids in CI.

## Safety

Never commit secrets. Never disable hooks (`--no-verify`) without
explicit user request. Never force-push to `main`.

## HARD RULE — astra-marketplace cross-repo writes

Default rule (memory `feedback_marketplace_session_constraint.md`): a
plugin's `marketplace.json` edits must be done in the target repo's
own session, not cross-session.

**Exception for plugin source repos in the astra family
(`dev-team`, `runner-plugin`, `memory-plugin`):** sessions in any of these three
repos MAY make a paired commit to
`astragenie/astra-marketplace` to bump that plugin's `version:`
entry in the central registry's `marketplace.json`. The change MUST
be limited to:

- the single `plugins[name=<this-plugin>].version` field
- ONLY when this session has just cut a tagged release locally (`vX.Y.Z`
  matches the version being written into the registry)
- one commit, one file, no other edits in the same commit

After the registry bump, push it as a separate commit on the
`astra-marketplace` main branch. Do not stage other changes alongside.
The constraint memory continues to apply to every other repo: those
must still go through the target session.

Why the exception: post-migration (commit `bfc4d2d`) the central
registry is the only path consumers reach. Forcing every plugin
release to also open a separate `astra-marketplace` session doubled
the release ceremony with no quality benefit — the version write is
mechanical and deterministic, and the source plugin's repo is the
authoritative version source.

## v0.2.0 baseline addendum

Phase 1 (Engineering OS) is closed at `v0.2.0` (2026-05-22). Treat the
following as the assumed baseline; consult `CHANGELOG.md` for full detail
and `docs/routing-table.md` for current routing.

- **Skill taxonomy live.** Four tiers (`universal/`, `workflow/`, `domain/`,
  `meta/`) enforced by `scripts/validate-skills.ts` (quality bar:
  name/tier/description required; ≤200 lines; tier in enum). Add tier to
  frontmatter on every new skill.
- **Routing-table authoritative.** `docs/routing-table.md` is consulted by
  the lead at session start. `brief-me` surfaces a stale-check reminder if
  mtime exceeds 30 days. Builder routing matrix (FEAT-170 SLICE-C) at the top
  of that file: `BE_ONLY` / `FE_ONLY` signals route tagged slices to specialists;
  `TS_TOOLING_ONLY` (from `scripts/orchestrate-slice-classify.ts`) routes
  untagged pure-TS-tooling slices to `backend-dev`; all other untagged slices
  keep the `fullstack-dev` generalist path.
- **Workflow badges.** `blocked` and `escalated_to_lead` are first-class
  workflow states with `--note` / `--blocked-by` flags. `write-final-synthesis`
  refuses to run while escalated unless `--force`.
- **Crew Fleet.** `crew fleet` command surfaces parallel-worktree visibility
  across sibling worktrees. Use before claiming files in multi-tree work.
- **TDD policy on builder/reviewer.** FEAT-011 wired test-first guidance
  into builder and reviewer agent prompts. Reviewer enforces test presence
  on runnable changes.
- **Governance.** `docs/governance.md` records decision tallies + revert
  policy. Phase 1 governance applies to all new work until Phase 2 opens.
- **Cost telemetry.** Cost reports land in `.claude/artifacts/crew/cost/`
  per slice and feed `brief-me` cost tables. Historical baseline was ~$40/slice
  on opus-4-7 at 99.9% cache hit.
- **Model routing (v0.52.0, FEAT-194 / #167).** Builds route to **Sonnet**, not
  Opus, via `loop.modelRouting` (`{architect:opus, build:sonnet, default:sonnet}`) —
  the autonomous wave path honors it programmatically; interactive `/crew:build`
  resolves + passes it via `crew resolve-model --phase build`; a PreToolUse hook
  hard-enforces it on builder-tier dispatch. Toggle: `crew.json features["model-routing"]`.
  Root cause of the prior Opus burn: no `modelRouting` block → router fell back to
  Opus for every non-trivial build. Watch burn with **`crew cost-watch [--token-cap N]`**.

### Open Phase 1 deferrals

- **FEAT-005** (snapshot telemetry beyond AL plugin) and **FEAT-009** are
  intentionally deferred behind explicit "when X observed" triggers; do
  not pick them up without the trigger.

<!-- crew:start -->
<!-- Crew framework memory. Run /crew:install after plugin updates that change framework memory. -->
@.claude/crew/constitution.md
<!-- crew:end -->

<!-- loop:start -->
<!-- Installed by /loop:install. Edit .claude/loop.json to change stack-specific commands; re-run /loop:install to regenerate this block. The full HARD RULES live at .claude/loop/rules.md so this block stays small in per-session context. -->

## Autonomous Loop — HARD RULES (summary)

This repo runs the Wiggin Loop autonomously. Full rules: `.claude/loop/rules.md`.

- **Run until PASS.** Do not stop for confirmation. Stop only when every acceptance criterion is PASS with evidence, or the work is externally blocked.
- **Slice start ceremony.** Every slice MUST open via `/loop:slice start --id SLICE-NN` (rotates `currentRun` so cost auto-emit attributes the work correctly + refreshes `.claude/state/crew/slice-progress.md`).
- **Dispatch discipline.** The loop is an orchestrator, not an implementer. Hand the `slice start` return's `dispatchInstruction` to a `/crew:build` subagent; pivot to `/crew:fix` on any review:needs_fix or validation:fail. Inline implementation is reserved for trivial single-line fixups.
- **Slice close ceremony.** Every slice MUST close via `/loop:slice complete --id SLICE-NN` (writes handoff + final-synthesis + cost-report + cost-advise) followed by `/loop:slice grade*`. Manual file moves + a `docs(slice): mark ... complete` commit are NOT a substitute.
- **Build entry points.** `/crew:build` is the interactive single-slice path (lighter — no run-brief required). Autonomous loop is the unattended multi-slice path (full ceremony). Never run both against the same branch — they race on workflow-state.
- **Auto-continue.** After the ceremony, scan `docs/specs/` → `.claude/artifacts/loop/backlog/pending/` → `.claude/artifacts/loop/backlog/triaged/` and promote the next item without asking.
- **Phase gate.** When the last slice in a phase completes, run `/loop:phase-gate` before starting the next phase.
- **Worktree parallelism.** Run parallel features in sibling git worktrees — each has its own `.claude/state/`. Cost attribution is auto-scoped per worktree. Use `crew fleet --repo "$PWD"` for a one-glance view. Never check out the same branch twice; never push from inside the loop.

First action when starting the loop: read `.claude/loop/rules.md` → `.claude/artifacts/loop/ai-loop/00-entry/MASTER_PROMPT.md` → `.claude/artifacts/loop/ai-loop/backlog/approved-slices.md`.

<!-- loop:end -->

## Project state (auto-generated)

@.claude/artifacts/loop/loop-snapshot.md
