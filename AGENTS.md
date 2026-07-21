# dev-team (Crew plugin) — Agent Instructions

Crew (`crew-plugin` / marketplace name `crew`, v0.67.0) is a Claude Code plugin: dispatcher-guided
engineering workflow with 23 first-party agents, 49 skills across 4 tiers, and inspectable
handoffs. This repo ships that plugin — it has no server, no container, no hosted runtime.
"Deploying" means cutting a versioned release consumers pin to. Full mission + decisions:
`CLAUDE.md`. Product surface (`agents/`, `commands/`, `skills/`, `.claude-plugin/`) is out of scope
for this file — that's what the plugin ships, not how this repo is built.

## Commands

Requires Node.js 22.6+ (`--experimental-strip-types`, no build step) and Bun ≥ 1.3 (hooks runtime).

```sh
bun install                                    # or: npm ci
bun run test                                   # bun test --timeout 60000 tests/ (no --parallel: bun#5090)
bun run test:node                              # node:test fallback
bun run lint                                   # Biome, zero-warning gate
bun run format:check                           # Biome format check
bun run typecheck                              # tsc --noEmit
node ./scripts/validate-manifests.ts           # plugin.json <-> package.json version parity
node ./scripts/validate-skills.ts              # skill frontmatter + tier + line-cap
node ./scripts/validate-agents.ts              # agent prompt schema + ≤350-line cap
node ./scripts/e2e-smoke.ts                    # end-to-end smoke, temp sample repo
```

## CI gates

`.github/workflows/test.yml` (self-hosted; docs/markdown/backlog-only PRs skip `checks`+`test` via
a changed-files fast path — `docs/ci-fast-path.md`). Both `checks` and `test` delegate to
`astragenie/common/.github/workflows/reusable-plugin-ci.yml@v1`:

- **`checks`** (once): ~14 hard validators (`check-redundant-read.ts` hook,
  `validate-{manifests,skills,agents,tool-baseline,agent-refs,dispatch-graph,workflows,slices,
  badges,loop-state,bundles,configs,org-refs}.ts`, `validate-routing-table.ts --coverage-only`) +
  2 fixture-loop checks (`validate-contracts.ts`, `validate-ux-spec.ts` against
  `tests/fixtures/{openapi,ux-specs}/`, each asserting a known-broken fixture correctly fails) +
  4 advisory validators (`validate-{syntheses,adr-template,backlog-drift}.ts`,
  `validate-routing-table.ts` full) + `bun run {lint,format:check,typecheck}` + Linux-only
  `e2e:smoke` / `e2e:smoke:ux` (each retried 3x).
- **`test`** (3-way matrix): `bun run test:shard` sharded via `scripts/test-shard.ts` — no
  `--parallel` inside a shard (bun#5090), parallelism comes from the file-list split across shards.
- **`gate`** (always runs, the required check): passes if docs-only, or if `checks` + every `test`
  shard succeeded.

This list drifts fast — re-verify against `.github/workflows/test.yml` itself before trusting this
paragraph on anything but the broad shape.

## Release workflow

1. CI green on `main`.
2. Update `CHANGELOG.md` — new dated top section, grouped by FEAT.
3. Bump `version` in **both** `package.json` and `.claude-plugin/plugin.json` —
   `validate-manifests.ts` hard-fails CI if only one moves. `marketplace.json` is **not** in this
   repo (registry lives in `astragenie/astra-marketplace`); see the astra-marketplace exception in
   `CLAUDE.md`.
4. Update the pinned-release line in `README.md`.
5. Commit `chore(release): vX.Y.Z — <summary>`, tag annotated (`git tag -a vX.Y.Z`), push
   `--follow-tags`, verify the tag + green CI on GitHub.

Pre-1.0 semver-ish: minor = new commands/skills or a closed backlog phase; patch = bugfix/doc/skill
polish.

## Structure

```
agents/{23 .md files}, agents/3rdparty/   first-party + vendored specialist agent prompts
commands/                                  small public surface + internal/debug commands
skills/{universal,workflow,domain,meta}/   49 skills, 4 tiers (see docs/architecture/architecture.md)
hooks/                                     event logging + enforcement (gate-guard, artifact-lock)
scripts/                                   CLI tooling (Node, .ts, --experimental-strip-types)
docs/                                      see docs/README.md for the full map
.claude/artifacts/{crew,loop}/             durable cross-machine history — COMMITTED, not ignored
```

Backlog lives at `.claude/artifacts/loop/backlog/{pending,triaged,in-progress,done}/` — the single
authoritative tree. `docs/backlog/` keeps only non-state files (`product-backlog.md`, templates).
Decisions (DEC-NNN) live at `.claude/artifacts/loop/decisions/`, not `docs/decisions/` (which keeps
only the template + a pointer) — see `docs/decisions/README.md`.

## Style

- ESM / Node.js throughout; CLI scripts run on Node (`--experimental-strip-types`), Bun runs
  test/lint/format/typecheck. See `docs/standards/code-conventions.md` (self-contained, authoritative
  for this repo).
- Agent prompts ≤350 lines (`scripts/validate-agents.ts`); skills ≤200 lines
  (`scripts/validate-skills.ts`). Push detail into a skill the agent loads on demand rather than
  growing a prompt.
- Lint output must stay clean — zero warnings.

## Credentials

No product secrets (this is a client-only plugin). Dev/CI needs: `NODE_AUTH_TOKEN` /
`NPM_TOKEN` for private `@astragenie/*` packages (astramem-client, gepa-core, memory-provider,
plugin-std), resolved via 1Password (`op run`), never hardcoded in `.npmrc`. Full setup:
`../kb/12-research/productivity-2026-07/token-vault-setup.md` (machine-local path). Optional
`.mcp.json` integrations (`context7`, `astramem`) read `MEMORY_API_URL` / `MEMORY_BEARER` from shell
env, fail-silent if absent — see `README.md` "Optional integrations".

## Never-do

- No `process.exit(N)` from library functions.
- No hand-rolled duplicate of what `@astragenie/plugin-std` or `@astragenie/gepa-core` already
  provides — extract shared logic there instead (see `plugins-common` note in `CLAUDE.md`).
- No editing `astragenie/astra-marketplace`'s `marketplace.json` from this repo's session except
  the narrow tagged-release exception in `CLAUDE.md` — default is: that edit happens in
  `astra-marketplace`'s own session.
- No force-push to `main`, no deleting tags, no skipping hooks (`--no-verify`) without explicit
  user request.
- No publishing a release with failing CI, even if locally green.
