---
slice: SLICE-77
builder: builder-be
run_id: 20260608T230000Z
files_touched: ["package.json"]
files_read: []
diff_stat: { files: 1, additions: 60, deletions: 1 }
truncated: false
truncation_reason: null
schema_version: 1
---

## Handoff

# Crew

[![test](https://github.com/sergeymilashico/hero-crew/actions/workflows/test.yml/badge.svg)](https://github.com/sergeymilashico/hero-crew/actions/workflows/test.yml)
[![release](https://img.shields.io/github/v/tag/sergeymilashico/hero-crew?label=release&sort=semver)](https://github.com/sergeymilashico/hero-crew/releases)
[![license](https://img.shields.io/github/license/sergeymilashico/hero-crew)](LICENSE)

A Claude Code plugin for lead-guided engineering work with bounded subagents, quality gates, and inspectable handoffs.

## What it does

Crew gives Claude Code a lead-centered workflow model with **12 first-party agents** across 3 tiers:

**Core workflow agents:**
- **lead** — plans, delegates, synthesizes, paces
- **builder** — implements bounded changes within assigned scope
- **reviewer** — validates correctness, regressions, and scope drift
- **researcher** — investigates questions without editing code
- **validator** — checks runnable or observable behavior and returns evidence
- **deployer** — manages environment transition evidence without deciding risky promotion alone

**Specialist agents (new in v0.8.0):**
- **architect** — ADR authoring, system design, database schema, API contracts; delegates to 3rdparty specialists
- **uxdesigner** — UI flows, component hierarchies, accessibility specs; delegates to 3rdparty specialists
- **copywriter** — API docs, release notes, README polish, diagram captions; delegates to 3rdparty specialists

Each agent has strict ownership rules, structured start/completion reports, and explicit handoffs. A library of **34 skills** across 4 tiers (`universal/`, `workflow/`, `domain/`, `meta/`) supplies the procedural knowledge agents load on demand.

In practice, the highest-value default mode is:

- one lead stays user-facing
- the lead infers workflow intent from normal conversation
- the lead uses bounded subagents for smaller focused tasks
- reviewer, validator, and deployer act as quality gates

The user should mostly talk to the lead, not manage a menu of agents or remember a command graph.

The next product direction is an evidence-gated validation loop: local validation, review, PR, dev deploy validation, dev logs/metrics, production promotion, and production monitoring. See [docs/process/validation-loop.md](docs/process/validation-loop.md).

For the broader implementation order and rename plan, see [docs/architecture/product-roadmap.md](docs/architecture/product-roadmap.md).

For the Engineering OS design (composition formula, skill tiers, routing, memory tiers, anti-patterns), see [docs/architecture/architecture.md](docs/architecture/architecture.md).

For ownership, prompt size bar, lessons-to-standards pipeline, and the three-test rule for specialist agents, see [docs/governance.md](docs/governance.md).

## Install

**Requirements:** Node.js 22.6+ (the plugin uses `--experimental-strip-types` to run TypeScript sources without a build step).

Add the marketplace and install the plugin in Claude Code:

```
/plugin marketplace add sergeymilashico/hero-crew
/plugin install crew@astra
```

The companion `loop` plugin lives in the same marketplace:

```
/plugin install loop@astra
```

Verify locally with `npm test`. Pinned release: `v0.14.1`.

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
git clone https://github.com/sergeymilashico/hero-crew.git
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

| Layer | Location | Scope | Who edits |
|-------|----------|-------|-----------|
| Constitution + workflow | `~/.claude/crew/` | All repos | Plugin-managed global copy |
| Global user rules | `~/.claude/CLAUDE.md` | All repos | User |
| Repo rules | `CLAUDE.md` | This repo | Team |

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

| Level | Path | Scope |
|-------|------|-------|
| Global | `~/.claude/crew/<role>.md` | All repos |
| Repo | `.claude/crew/<role>.md` | This repo only |

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

| Agent | Model |
|-------|-------|
| lead | opus |
| builder | opus |
| reviewer | opus |
| validator | opus |
| deployer | opus |
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
agents/3rdparty/ — 21 vendored specialist agents (delegated to by architect, uxdesigner, copywriter)
commands/        — small public surface plus internal/debug commands
skills/          — 34 skills across universal/, workflow/, domain/, meta/ tiers
hooks/           — event logging wiring
scripts/         — CLI tooling and helpers
docs/            — design docs and specs
```

## License

MIT

## Diff

```diff
diff --git a/scripts/crew.ts b/scripts/crew.ts
index 31af8c9..af9bf86 100644
--- a/scripts/crew.ts
+++ b/scripts/crew.ts
@@ -26,6 +26,7 @@ const FLAG_SPEC = {
   "--badge": { key: "badge" },
   "--blocked-by": { key: "blockedBy" },
   "--build": { key: "build" },
+  "--builder": { key: "builder" },
   "--clues": { key: "clues" },
   "--commit-pattern": { key: "commitPattern" },
   "--completed-at": { key: "completedAt" },
@@ -40,11 +41,14 @@ const FLAG_SPEC = {
   "--evidence": { key: "evidence" },
   "--external-deltas": { key: "externalDeltas" },
   "--extra-root": { key: "extraRoot" },
+  "--feat": { key: "feat" },
   "--feature": { key: "feature" },
   "--files": { key: "files" },
+  "--files-read": { key: "filesRead" },
   "--findings": { key: "findings" },
   "--from": { key: "from" },
   "--goal": { key: "goal" },
+  "--handoff": { key: "handoff" },
   "--id": { key: "id" },
   "--kind": { key: "kind" },
   "--logs": { key: "logs" },
@@ -68,11 +72,13 @@ const FLAG_SPEC = {
   "--reviewer": { key: "reviewer" },
   "--reviewer-label": { key: "reviewerLabel" },
   "--risks": { key: "risks" },
+  "--run": { key: "run" },
   "--run-steps": { key: "runSteps" },
   "--run-title": { key: "runTitle" },
   "--source-project": { key: "sourceProject" },
   "--scope": { key: "scope" },
   "--severity": { key: "severity" },
+  "--slice": { key: "slice" },
   "--started-at": { key: "startedAt" },
   "--status": { key: "status" },
   "--summary": { key: "summary" },
@@ -171,7 +177,13 @@ function parseArgs(argv: string[]) {
     testSummary: null,
     testSummarySkipReason: null,
     findings: null,
-    validationEvidence: null
+    validationEvidence: null,
+    builder: null,
+    feat: null,
+    filesRead: null,
+    handoff: null,
+    run: null,
+    slice: null
   };
   const positionals = [];
 
@@ -241,6 +253,8 @@ function usage(target: string | null = null) {
       "  node scripts/crew.mjs mark-badge --repo <path> --badge review_required|review_passed|review_failed|review_skipped|validation_expected|validation_passed|validation_failed|validation_skipped|dev_deploy_expected|dev_checked|dev_failed|dev_skipped|prod_deploy_expected|prod_checked|prod_failed|prod_skipped|blocked|escalated_to_human [--note <text>] [--blocked-by <artifact-id>]",
     "write-run-brief":
       "  node scripts/crew.mjs write-run-brief --repo <path> --title <text> [--goal <text>] [--mode <mode>] [--pace <pace>]",
+    "write-build-bundle":
+      "  node scripts/crew.ts write-build-bundle --repo <path> --slice <SLICE-NN> --builder <builder|builder-be|builder-fe> --run <YYYYMMDDTHHMMSSZ> --handoff <path> [--feat <FEAT-NNN>] [--files <a,b>] [--files-read <c,d>]",
     "write-handoff":
       "  node scripts/crew.mjs write-handoff --repo <path> --title <text> [--from <role>] [--to <role>] [--files <a,b>]",
     "write-review-result":
@@ -563,6 +577,51 @@ const COMMANDS = {
     if (!r.ok) throw r.error;
     return r.value;
   },
+  "write-build-bundle": async ({ repoPath, flags }: CommandContext) => {
+    const { assembleBuildBundle } = await import("./lib/build-bundle/assemble.ts");
+    const fs = await import("node:fs/promises");
+
+    const slice = flags.slice ?? "unknown";
+    const builder = flags.builder;
+    const run = flags.run;
+    const handoffPath = flags.handoff;
+
+    if (!builder || !run || !handoffPath) {
+      process.stderr.write(
+        "[crew] write-build-bundle refused: --builder, --run, and --handoff are required.\n"
+      );
+      process.exit(2);
+    }
+    const validBuilders = new Set(["builder", "builder-be", "builder-fe"]);
+    if (!validBuilders.has(builder)) {
+      process.stderr.write(
+        `[crew] write-build-bundle refused: --builder must be one of ${[...validBuilders].join(", ")}.\n`
+      );
+      process.exit(2);
+    }
+
+    const handoffBody = await fs.readFile(handoffPath, "utf8");
+    const filesTouched = (flags.files ?? "")
+      .split(",")
+      .map((s) => s.trim())
+      .filter((s) => s.length > 0);
+    const filesRead = (flags.filesRead ?? "")
+      .split(",")
+      .map((s) => s.trim())
+      .filter((s) => s.length > 0);
+
+    const result = await assembleBuildBundle({
+      repoPath,
+      sliceId: slice,
+      builderName: builder as "builder" | "builder-be" | "builder-fe",
+      runId: run,
+      ...(flags.feat !== null ? { feat: flags.feat } : {}),
+      handoffBody,
+      filesTouched,
+      filesRead
+    });
+    return result.path;
+  },
   "write-handoff": async ({ repoPath, flags, positionals }: CommandContext) => {
     const { writeArtifact } = await import("./lib/artifacts/write.ts");
     const r = await writeArtifact(repoPath, "handoff", {

```

## Files touched

### package.json

```
{
  "name": "crew-plugin",
  "version": "0.23.0",
  "private": true,
  "type": "module",
  "devDependencies": {
    "@eslint/js": "^9.16.0",
    "@redocly/cli": "^1.34.15",
    "@types/node": "^25.9.1",
    "eslint": "^9.16.0",
    "globals": "^15.13.0",
    "openapi-typescript": "^7.13.0",
    "prettier": "^3.4.2",
    "typescript": "^6.0.3",
    "yaml": "^2.9.0",
    "zod": "^3.25.76"
  },
  "scripts": {
    "test": "node --test --experimental-strip-types",
    "validate:manifests": "node ./scripts/validate-manifests.ts",
    "lint": "eslint scripts eslint.config.mjs",
    "typecheck": "tsc --noEmit",
    "validate:skills": "node ./scripts/validate-skills.ts",
    "validate:agents": "node ./scripts/validate-agents.ts",
    "validate:contracts": "node ./scripts/validate-contracts.ts",
    "validate:routing-table": "node ./scripts/validate-routing-table.ts",
    "validate:slices": "node ./scripts/validate-slices.ts",
    "validate:all": "node --experimental-strip-types scripts/validate-all.ts",
    "validate:typegraph": "node ./scripts/validate-typegraph.ts",
    "validate:ux-spec": "node ./scripts/validate-ux-spec.ts",
    "format": "prettier --write \"scripts/**/*.{mjs,ts}\" \"tests/**/*.{mjs,ts}\"",
    "format:check": "prettier --check \"scripts/**/*.{mjs,ts}\" \"tests/**/*.{mjs,ts}\"",
    "installer:install-global": "node ./scripts/crew.ts install-global",
    "installer:bootstrap": "node ./scripts/crew.ts bootstrap",
    "installer:init": "node ./scripts/crew.ts init",
    "installer:audit": "node ./scripts/crew.ts audit",
    "e2e:smoke": "node ./scripts/e2e-smoke.ts",
    "e2e:smoke:ux": "node ./scripts/e2e-smoke-ux.ts"
  }
}

```

## Files read

