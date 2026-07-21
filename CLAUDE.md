@AGENTS.md

> The include above is the tool-agnostic scaffold guide (commands, CI gates, release steps,
> structure, style, never-do). Everything below is **dev-team-specific**: what this plugin is, the
> decisions an agent must not re-litigate, and where to find volatile state. This file changes
> rarely by design — volatile/dated facts live in `docs/memory.md`; the session protocol below makes
> reading it non-optional.

## Session protocol — memory + verification (mandatory, not advisory)

Before any non-trivial work (feature, fix, review, release):

1. **Read `docs/memory.md` in full** (~80 lines, cheap). It is the source for current release
   version, Phase-1 baseline state, open deferrals, and kb-drift notes — `CLAUDE.md` deliberately
   contains none of that.
2. **Re-verify before relying.** `docs/memory.md` is a cache, not the truth. Check `package.json` /
   `.claude-plugin/plugin.json` versions and `CHANGELOG.md`'s top entry directly before quoting a
   version number; check `git log` for a file before asserting its state is unchanged.
3. **Write-back is part of the task.** Any fact you verify or change (a release cut, a deferred FEAT
   picked up, a kb-drift item resolved) gets written back to `docs/memory.md` in the same
   session — supersede the entry in place, refresh its date. Reviewers should flag a session that
   learns something and doesn't write it back.

## Cross-repo coordination

- **`astra-marketplace`**: default rule is a plugin's `marketplace.json` version bump happens in
  `astra-marketplace`'s own session — this repo gets a narrow, tightly-scoped exception; see the
  HARD RULE section below, don't restate it elsewhere.
- **`plugins-common`**: code shared across ≥2 astra plugins (`packages/gepa-core/`,
  `packages/plugin-kernel/`) lives in `astragenie/plugins-common`, not duplicated here. Edit it from
  **that repo's own session/worktree**, never cross-session from this one (see the HARD RULE below
  + the `cross-repo-edits-require-worktree` memory). `scripts/lib/memory/` (MemoryProvider) is a
  flagged extraction candidate so `dev-team` + `runner-plugin` converge on one provider
  (FEAT-188 S1b/S3b).
- **`loop` (`astragenie/runner-plugin`)**: separate repo, own standalone marketplace. To pick up a
  `loop` release, bump its own `package.json` + its own `marketplace.json`, tag, push there, then
  refresh the local install here.

## Mission

**Crew** is a Claude Code plugin: dispatcher-guided engineering workflow with bounded subagents,
parallel quality gates, and inspectable handoffs. The slash commands (`/crew:build`, `/crew:fix`,
`/crew:ship`, ...) ARE the dispatchers — they read inline routing tables and fan out specialists;
there is no `lead` agent role. The companion `loop` plugin (Wiggin Loop methodology) sits on top of
this one. Full command list + install flow: `README.md`.

## Authority documents (read for any non-trivial work)

- `README.md` — what this plugin is, install instructions, pinned release, agent/skill roster.
- `docs/architecture/architecture.md` — Engineering OS design: composition formula, skill tiers,
  routing approach, memory tiers, anti-patterns, phased roadmap.
- `docs/governance.md` — ownership, prompt size bar, lessons-to-standards pipeline, three-test rule
  for specialist agents.
- `docs/routing-table.md` — authoritative skill/agent routing; `/crew:brief-me` flags staleness.
- `docs/memory.md` — durable facts: current release, Phase-1 baseline, kb-drift notes.
- `docs/README.md` — map of the whole `docs/` tree.
- `CHANGELOG.md` — recent releases (source of truth for current version, not any prose summary).

## Engineering standards

For language-agnostic patterns + SOLID + GoF guidance, consult
[`Astragenie.Standards`](https://github.com/astragenie/standards) if installed at a sibling path.
`docs/standards/code-conventions.md` is self-contained and authoritative for this repo's own ESM /
Node conventions — it does not need the kb link duplicated.

## Decisions not to relitigate

- **Plugin shape**: content-heavy, runtime-light. Durable behavior belongs in `agents/`, `skills/`,
  `commands/`; hooks stay small and auditable; scripts are thin helpers, not a hidden framework
  runtime. Agent prompts ≤350 lines (`docs/governance.md`, enforced by `scripts/validate-agents.ts`,
  FEAT-035) — push specifics into a skill the agent loads on demand.
- **Skill taxonomy** (four tiers — `universal/`, `workflow/`, `domain/`, `meta/`; see
  `docs/architecture/architecture.md`) is fixed. Repo-local overrides live in each *consumer* repo's
  `.claude/skills/`, not here. External-plugin skills (`context7`, `microsoft-docs:*`,
  `plugin-dev:*`, `terraform-*`) are wired via `docs/routing-table.md` rows (FEAT-019).
- **`.claude/artifacts/` is committed**, not ignored — durable cross-machine history (cost reports,
  reviews, handoffs, deployments, run synthesis). Only `.claude/logs/`, `.claude/state/`,
  `.claude/settings.local.json`, `.claude/scheduled_tasks.lock`, `.claude/hooks/`,
  `.claude/worktrees/`, `.claude.backup.*` are machine-local/ignored. This policy is repo-wide across
  the team's repos for consistent `brief-me` / `crew fleet` output.
- **Backlog**: `.claude/artifacts/loop/backlog/{pending,triaged,in-progress,done}/` is the single
  authoritative tree; `docs/backlog/` holds only non-state files. FEATs tagged `autonomous_safe: false`
  (lead prompt edits, skill authorship) require human-in-loop review even when the loop picks them.
- Everything in `@AGENTS.md`'s Never-do still applies.

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

## Ecosystem canon (kb)

`../kb/...` links are filesystem-relative — machine-local, work only on this box. Prefer stable
GitHub URLs for anything an agent must fetch in CI/cloud.

- Agent/prompt-engineering rules: [agent-workflow](../kb/10-ai-rules/20-agent-workflow-standards.md),
  [prompt-engineering](../kb/10-ai-rules/16-prompt-engineering-standards.md),
  [AI evaluation](../kb/10-ai-rules/17-ai-evaluation-standards.md) (relevant to `evals/`, GEPA),
  [memory quality](../kb/10-ai-rules/15-memory-quality-standards.md) (relevant to the astramem
  integration)
- [Security standards](../kb/security/12-security-standards.md) — secrets/token handling
- [Definition of done](../kb/08-engineering/05-definition-of-done.md),
  [minimal-change policy](../kb/08-engineering/07-minimal-change-policy.md)
- Token vault (npm `NODE_AUTH_TOKEN`/`NPM_TOKEN` setup):
  `../kb/12-research/productivity-2026-07/token-vault-setup.md`

Not linked (checked, not applicable): kb's `04-decisions/cross-cutting.md` (Azure/Postgres/YARP/
Aspire — this repo has no deployment or cloud surface), `05-patterns/{wiggin-loop,crew-harness,
phase-gates}.md` (this repo *is* the canonical source those pages describe — linking back would be
circular), `08-saas/*` (no SaaS frontend here), `08-engineering/{06,08,09,10,11,19,21}` (either no
API/deployment surface, or this repo's own `docs/standards/code-conventions.md` + `docs/governance.md`
are already the authoritative local equivalent).

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
