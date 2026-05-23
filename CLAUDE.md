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
[`Astragenie.Standards`](https://github.com/sergeymilashico/Astragenie.Standards)
if it is installed at a sibling path. The ESM conventions are mirrored
at `Astragenie.Standards/docs/javascript/coding-conventions.md`. The
local `docs/standards/code-conventions.md` is self-contained and authoritative
for this repo.

## Plugin shape

The plugin is intentionally content-heavy and runtime-light.

- Durable behavior belongs in `agents/`, `skills/`, and `commands/`.
- Hooks should stay small and auditable.
- Scripts should be thin helpers, not a hidden framework runtime.
- The lead agent prompt is capped at ≤200 lines; specifics live in skills.

## Skill taxonomy

Four tiers (see `docs/architecture/architecture.md` for details):

- `skills/universal/` — always discoverable.
- `skills/workflow/` — invoked per phase (build/review/validate/deploy).
- `skills/domain/` — loaded only when stack matches.
- `skills/meta/` — the OS itself (routing, escalation).

Repo-local overrides live in each consumer repo's `.claude/skills/`.

External-plugin skills (`context7`, `microsoft-docs:*`, `plugin-dev:*`) are wired into agent prompts via `docs/routing-table.md` rows — see FEAT-019 + the architecture doc's "External plugin skills as routed dependencies" subsection for the routing pattern.

## Local commands

- `npm test` — full test suite (`node --test`).
- `npm run lint` — ESLint flat config.
- `npm run format` / `npm run format:check` — Prettier.
- `npm run e2e:smoke` — end-to-end smoke against a temp sample repo.
- `node ./scripts/validate-manifests.mjs` — manifest sanity check.

## CI gates

GitHub Actions (`.github/workflows/test.yml`) runs on every push to `main`
and every PR. All steps are blocking; lint must stay zero-warning.

1. `npm ci`
2. `node ./scripts/validate-manifests.mjs`
3. `node ./scripts/validate-skills.mjs`
4. `npm run lint`
5. `npm run format:check`
6. `npm run typecheck`
7. `node --test`
8. `node ./scripts/e2e-smoke.mjs`

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
3. Bump `version` in:
   - `package.json`
   - `.claude-plugin/marketplace.json` → `plugins[name=crew].version`
4. Commit: `chore(release): vX.Y.Z — <one-line summary>`.
5. Tag annotated: `git tag -a vX.Y.Z -m "vX.Y.Z"`.
6. Push both: `git push origin main --follow-tags`.
7. Verify the tag appears on GitHub and the marketplace manifest is reachable.

### Versioning

Pre-1.0 semver-ish (see `CHANGELOG.md` header):

- **Minor** (`0.X.0`): closes a backlog phase or introduces new commands/skills.
- **Patch** (`0.X.Y`): bugfix, doc polish, skill quality bar updates.
- Bumping `package.json` without bumping `marketplace.json` is a release bug.

### Companion plugin (`loop`)

Lives in a separate repo
(`https://github.com/sergeymilashico/hero-crew-autonomous-loop`) and is
referenced from this repo's `marketplace.json` by version only. To pick up
a `loop` release, bump `plugins[name=loop].version` here and commit
under `chore(marketplace): bump loop to <ver>`.

### Hard rules

- Never force-push `main`. Never delete tags. Never skip hooks (`--no-verify`).
- Never publish a release with failing CI, even locally green.
- No auto-publish hook; releases are user-triggered.
- Pinned-release callout in `README.md` must reference the latest tag.

## Repo rules

1. Validate plugin manifest changes with `node ./scripts/validate-manifests.mjs`.
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

Active backlog under `docs/backlog/{pending,triaged,in-progress,done}/`.
Each FEAT has frontmatter declaring priority, status, and an
`autonomous_safe` flag. Items tagged `autonomous_safe: false` (lead
prompt edits, skill authorship) require a human-in-loop on review even
when picked by the loop.

## Safety

Never commit secrets. Never disable hooks (`--no-verify`) without
explicit user request. Never force-push to `main`.

## v0.2.0 baseline addendum

Phase 1 (Engineering OS) is closed at `v0.2.0` (2026-05-22). Treat the
following as the assumed baseline; consult `CHANGELOG.md` for full detail
and `docs/routing-table.md` for current routing.

- **Skill taxonomy live.** Four tiers (`universal/`, `workflow/`, `domain/`,
  `meta/`) enforced by `scripts/validate-skills.mjs` (quality bar:
  name/tier/description required; ≤200 lines; tier in enum). Add tier to
  frontmatter on every new skill.
- **Routing-table authoritative.** `docs/routing-table.md` is consulted by
  the lead at session start. `brief-me` surfaces a stale-check reminder if
  mtime exceeds 30 days.
- **Workflow badges.** `blocked` and `escalated_to_human` are first-class
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
  per slice and feed `brief-me` cost tables. Average ~$40/slice on
  opus-4-7 with 99.9% cache hit is the current normal.

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
- **Auto-continue.** After the ceremony, scan `docs/specs/` → `docs/backlog/pending/` → `docs/backlog/triaged/` and promote the next item without asking.
- **Phase gate.** When the last slice in a phase completes, run `/loop:phase-gate` before starting the next phase.
- **Worktree parallelism.** Run parallel features in sibling git worktrees — each has its own `.claude/state/`. Cost attribution is auto-scoped per worktree. Use `crew fleet --repo "$PWD"` for a one-glance view. Never check out the same branch twice; never push from inside the loop.

First action when starting the loop: read `.claude/loop/rules.md` → `docs/ai-loop/00-entry/MASTER_PROMPT.md` → `docs/ai-loop/backlog/approved-slices.md`.

<!-- loop:end -->
