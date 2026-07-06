# Crew

[![test](https://github.com/astragenie/dev-team/actions/workflows/test.yml/badge.svg)](https://github.com/astragenie/dev-team/actions/workflows/test.yml)
[![release](https://img.shields.io/github/v/tag/astragenie/dev-team?label=release&sort=semver)](https://github.com/astragenie/dev-team/releases)
[![license](https://img.shields.io/github/license/astragenie/dev-team)](LICENSE)

A Claude Code plugin for dispatcher-guided engineering work with bounded subagents, parallel quality gates, and inspectable handoffs.

## What it does

Crew gives Claude Code a dispatcher-guided workflow model with **23 first-party agents** across multiple tiers. The slash commands (`/crew:build`, `/crew:fix`, `/crew:ship`) ARE the dispatchers — they read inline routing tables and fan out specialists. There is no `lead` agent role; orchestration is a concept, not a callable subagent.

**Implementation agents (FEAT-tag routed by `/crew:build`):**

- **fullstack-dev** — cross-layer TypeScript + .NET 10 implementation
- **backend-dev** — server-side TypeScript / .NET (ASP.NET Core, EF Core)
- **frontend-dev** — React + Vite + TypeScript UI work
- **aiplugin-dev** — Claude Code plugin authoring (prompts, skills, hooks, MCP)
- **dev-lite** — surgical mechanical edits (≤2 files, ≤50 LOC; typos, renames, format)

**Review + validate gates:**

- **reviewer** — generalist code review with FEAT-concern-tag lens
- **reviewer-lite** — fast review for light-path diffs (single dispatch with stack skill auto-load)
- **csharp-reviewer** — stack-quality review for `.cs` diffs (async / EF Core / ASP.NET / null safety)
- **verifier** — behavior validation; owned by `/crew:ship` + pre-push hook
- **integrator** — live wire-up smoke for SPLIT_BUILD slices
- **qa-expert** — test coverage gap analysis; dispatched from `/crew:ship`

**Specialists:**

- **architect** — ADR authoring, system design, database schema, API contracts
- **uxdesigner** — UI flows, component hierarchies, accessibility specs
- **document-writer** — release notes, ADRs, API reference, CHANGELOG
- **performance-engineer** — latency, throughput, Core Web Vitals
- **release-engineer** — deployment evidence, environment transitions
- **researcher** / **investigator** — read-only investigation
- **refactor** — quality-sweep scans

Each agent has strict ownership rules, structured start/completion reports, and explicit handoffs. A library of **69 skills** across 4 tiers (`universal/`, `workflow/`, `domain/`, `meta/`) supplies the procedural knowledge agents load on demand. The `skills/universal/builder-mindset/` skill carries the cross-builder posture (senior engineer mindset, Astra principles, code-review heuristics, TDD policy) so builder prompts stay focused on stack-specific work.

In practice, the highest-value default mode is:

- the user runs `/crew:build` / `/crew:fix` / `/crew:ship`
- the slash command reads FEAT tags + routing tables, picks specialists
- builder edits → 2 parallel reviewers → push gate runs verifier → `/crew:ship` files PR with auto-fix loop

The user runs slash commands and reads the resulting artifacts — no menu of agents, no command graph to memorize.

The next product direction is an evidence-gated validation loop: local validation, review, PR, dev deploy validation, dev logs/metrics, production promotion, and production monitoring. See [docs/process/validation-loop.md](docs/process/validation-loop.md).

For the broader implementation order and rename plan, see [docs/architecture/product-roadmap.md](docs/architecture/product-roadmap.md).

For the Engineering OS design (composition formula, skill tiers, routing, memory tiers, anti-patterns), see [docs/architecture/architecture.md](docs/architecture/architecture.md).

For ownership, prompt size bar, lessons-to-standards pipeline, and the three-test rule for specialist agents, see [docs/governance.md](docs/governance.md).

## Install

**Requirements:** Node.js 22.6+ (the plugin uses `--experimental-strip-types` to run TypeScript sources without a build step).

Add the central astra marketplace and install the plugin in Claude Code:

```
/plugin marketplace add sergeymilashico/astra-marketplace
/plugin install crew@astra
```

The companion plugins live in the same marketplace:

```
/plugin install loop@astra
/plugin install cortex@astra
```

Verify locally with `bun run test`. Pinned release: `v0.52.4`.

> **Runtime dependency:** Bun ≥ 1.3 is required at install time. The Crew hook entries (`hooks/check-*.ts`, `hooks/preflight-shell.ts`, `hooks/record-read-content.ts`) run under Bun for fast cold start (~40 ms vs ~180 ms on Node). The installer fails loud if Bun is missing — install from <https://bun.sh>.

> **Upgrading from `crew-dev` / `autonomous-loop`?** See [docs/process/rebrand-migration.md](docs/process/rebrand-migration.md) for the one-time uninstall + reinstall sequence. The `loop` plugin auto-migrates consumer-repo state (`.claude/autonomous-loop.json` → `.claude/loop.json`, CLAUDE.md markers) on first `/loop:install`.

## Commands

The public surface should stay small.

Preferred entry points:

- `/crew:brief-me` — get a fixed-structure briefing on current objective, recent activity, blockers, reminders, and next step
- `/crew:build` — build or extend capability
- `/crew:fix` — investigate and fix broken behavior
- `/crew:review` — run the review phase on completed work
- `/crew:validate` — run the validation phase on runnable or observable behavior
- `/crew:ship` — move work through PR, deployment, and post-deploy evidence gates
- `/crew:adopt` — adopt an existing repo into the workflow
- `/crew:init` — initialize a new repo with the harness
- `/crew:install` — install or update the managed global framework memory

Everything else should be treated as internal, advanced, or debugging-oriented workflow plumbing:

- `parallel-review`
- `wake-up-brief`
- `audit-repo`
- claims / approvals commands
- direct artifact-writing commands

The user should mostly talk to the lead. The lead should infer `build`, `fix`, `review`, `validate`, and `ship` from normal conversation when the intent is clear.
The lead should also notice when work is ready to move into shipping stages and recommend `ship` without waiting for the user to remember the command.
`/crew:brief-me` should be the normal first command when the user wants a crisp situational report before continuing.

## Install

Install via the Claude Code plugin flow:

```
claude plugin install crew
```

For local development, clone and register as a directory marketplace:

```
git clone https://github.com/astragenie/dev-team.git
```

Then add it as a local marketplace in `~/.claude/plugins/known_marketplaces.json`.

### Global setup

Crew keeps one managed global memory copy for framework-level rules:

- `~/.claude/crew/constitution.md`
- `~/.claude/crew/workflow.md`
- `~/.claude/crew/metadata.json`

Project repos should not each get their own copied constitution and workflow. They should keep only repo-specific rules plus repo-local state, artifacts, and hooks.

After installing or updating the plugin, run:

```text
/crew:install
```

This writes or updates the managed global copy and adds `@` references to your global `~/.claude/CLAUDE.md`.

Why this exists:

- Claude memory can import stable files from `~/.claude/`
- plugin install does not automatically rewrite global `CLAUDE.md`
- one managed global copy avoids stale per-repo framework copies

If a plugin update changes constitution or workflow behavior, rerun `/crew:install` once.

### How configuration layers work

| Layer                   | Location              | Scope     | Who edits                  |
| ----------------------- | --------------------- | --------- | -------------------------- |
| Constitution + workflow | `~/.claude/crew/`     | All repos | Plugin-managed global copy |
| Global user rules       | `~/.claude/CLAUDE.md` | All repos | User                       |
| Repo rules              | `CLAUDE.md`           | This repo | Team                       |

**Repo CLAUDE.md overrides constitution defaults.** The constitution provides baseline team rules (ownership, review gates, handoffs). Teams customize per-repo via CLAUDE.md without touching the constitution.

### Per-repo bootstrap

To adopt an existing repo into the workflow, use:

```text
/crew:adopt
```

The raw CLI bootstrap command still exists for debugging and scripting:

```bash
node "<plugin-path>/scripts/crew.ts" bootstrap --repo .
```

## Customizing agents

Agents support two-tier custom instructions, same model as Claude Code settings:

| Level  | Path                       | Scope          |
| ------ | -------------------------- | -------------- |
| Global | `~/.claude/crew/<role>.md` | All repos      |
| Repo   | `.claude/crew/<role>.md`   | This repo only |

Both files are read if they exist. Repo instructions take precedence over global on conflict.

Use these files to customize what Crew agents do beyond the framework baseline.

Good uses:

- tell the reviewer which extra standards or skills to apply
- tell the builder about repo-specific coding expectations
- tell the deployer about environment-specific safety rules
- tell the lead about project habits you want it to remember

The framework keeps the baseline behavior.
Your agent instruction files define the repo- or team-specific extensions.

### Review customization

The review model is:

- Crew baseline review always applies
  - correctness
  - regressions
  - test gaps
  - scope discipline
- repo or global reviewer instructions add extra review gates, standards, and skills

That means you should put your review program in:

- `~/.claude/crew/reviewer.md` for machine-wide defaults
- `.claude/crew/reviewer.md` for repo-specific review behavior

The reviewer will read those files before review, and the lead should dispatch review using them as the source of truth for extra review standards.

### Examples

`~/.claude/crew/reviewer.md` (global):

```markdown
- For Go repos, use our Go review skill and check dependency-injection, context handling, and error wrapping.
- For Python repos, use our Python review skill and check typing, async boundaries, and test quality.
- For security-sensitive changes, add a security review gate.
```

`.claude/crew/builder.md` (repo-level):

```markdown
- Follow strict typing — no `Any` unless unavoidable
- All new functions must have tests
```

`.claude/crew/reviewer.md` (repo-level):

```markdown
- For this repo, always review against our internal API compatibility rules.
- For Go code, apply the team's configured Go review skill.
- Call out blockers, suggestions, and nits separately.
```

If you want to change how Crew behaves in a repo, you can also ask the lead to help write or update these files for you.
For example:

```text
Update our reviewer instructions so Go reviews always apply our internal Go standards and separate blockers from nits.
```

## Agent models

Default model assignments:

| Agent      | Model  |
| ---------- | ------ |
| lead       | opus   |
| builder    | opus   |
| reviewer   | opus   |
| validator  | opus   |
| deployer   | opus   |
| researcher | sonnet |

## Optional integrations

This repo ships an opt-in `.mcp.json` declaring [context7](https://github.com/upstash/context7) as a stdio MCP server. context7 returns live, version-correct library documentation, used by the researcher, builder, and reviewer agents to avoid stale-knowledge bias.

Tools exposed:

- `context7.resolve-library-id` — map a package name to a context7 library id
- `context7.get-library-docs` — fetch current docs for a resolved id

Routing for "library / API uncertainty" lives in [docs/routing-table.md](docs/routing-table.md). For Microsoft technologies the crew prefers `microsoft-docs:microsoft-code-reference` (when present); context7 covers everything else.

To opt out, delete the `context7` entry from `.mcp.json` (or remove the file). To pin a different version, edit the `args` line (server is pinned to `@upstash/context7-mcp@3.0.0` by default).

The server is invoked via `npx -y` on first use; no global install required. Cost is the upstream service's free / rate-limited tier — no Anthropic billing change.

## What to commit

Commit the stable operating layer:

- `CLAUDE.md`
- `.claude/crew/` (custom agent instructions)
- `.claude/settings.json` (shared project settings)

Do **not** commit transient coordination state:

```gitignore
.claude/logs/
.claude/artifacts/crew/
.claude/state/crew/
.claude/settings.local.json
```

## Project structure

```
agents/          — 12 first-party agents: lead, builder, builder-fe, builder-be, reviewer, validator, deployer, integrator, researcher, architect, uxdesigner, refactor
agents/3rdparty/ — vendored specialist agents (delegated to by architect, uxdesigner, copywriter)
commands/        — small public surface plus internal/debug commands
skills/          — 34 skills across universal/, workflow/, domain/, meta/ tiers
hooks/           — event logging wiring
scripts/         — CLI tooling and helpers
docs/            — design docs and specs
```

## License

MIT
