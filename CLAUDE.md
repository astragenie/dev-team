# Repo Instructions — hero-crew

Claude Code plugin: the **Crew** harness. Lead-guided engineering
workflow with bounded subagents, quality gates, and inspectable
handoffs. The companion `autonomous-loop` plugin sits on top of this
one.

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

## Local commands

- `npm test` — full test suite (`node --test`).
- `npm run lint` — ESLint flat config.
- `npm run format` / `npm run format:check` — Prettier.
- `npm run e2e:smoke` — end-to-end smoke against a temp sample repo.
- `node ./scripts/validate-manifests.mjs` — manifest sanity check.

## CI gates

GitHub Actions runs on every push and PR:

1. `npm ci`
2. `node ./scripts/validate-manifests.mjs`
3. `npm run lint`
4. `npm run format:check`
5. `node --test`
6. `node ./scripts/e2e-smoke.mjs`

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

## Backlog discipline

Active backlog under `docs/backlog/{pending,triaged,in-progress,done}/`.
Each FEAT has frontmatter declaring priority, status, and an
`autonomous_safe` flag. Items tagged `autonomous_safe: false` (lead
prompt edits, skill authorship) require a human-in-loop on review even
when picked by the autonomous-loop.

## Safety

Never commit secrets. Never disable hooks (`--no-verify`) without
explicit user request. Never force-push to `main`.
