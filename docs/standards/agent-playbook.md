# Agent add / remove / rename playbook

Operational checklist for changes to `agents/`. Keep this file under 200 lines.

## Where agents live

| Path | Validated | Slash command | Use for |
| --- | --- | --- | --- |
| `agents/<name>.md` | yes (`scripts/validate-agents.ts`) | `crew:<name>` | First-party agents owned by this plugin |
| `agents/3rdparty/<name>.md` | no (validator is one-level-only) | `crew:3rdparty:<name>` | External/community agents we re-ship as-is |
| `agents/<name>/.gepa/` | skipped | n/a | GEPA eval data co-located with an agent |

The validator's `enumerateAgents` (in `scripts/validate-agents.ts`) walks `agents/*.md` only — never recurses. Subdirectory placement is the namespace mechanism. Move = rename.

## Naming

- Filename = `<name>.md`. The `name:` frontmatter MUST match the filename. Enforced by validator.
- Lowercase, kebab-case, single-segment (`cloud-architect`, not `cloud_architect`).
- `prompt_id:` mirrors `name:` (kebab-slug, no leading digit, no `--`, no trailing `-`).
- Avoid suffixes that collide with role names (`*-reviewer`, `*-builder`) unless the agent IS that role.

## Required frontmatter (first-party `agents/*.md`)

```yaml
---
name: <kebab-name>           # MUST match filename
prompt_id: <kebab-name>      # usually identical to name
version: 1.0.0               # semver MAJOR.MINOR.PATCH
model_pinned: opus           # or sonnet / haiku — ADVISORY default, not enforced (see note below)
capabilities:
  role: [<role>]             # architect | reviewer | builder | validator | deployer | researcher
  surfaces: [...]
  concerns: [...]
  scopes: [normal | wide]
  priority: <int>
description: "..."           # routing hint — keep terse, no fake metrics
model: opus                  # actual runtime model
effort: high                 # high | medium | low (advisory)
maxTurns: 20                 # advisory ceiling
tools: [Read, Grep, Glob, Bash, ...]   # explicit allowlist
color: cyan
---
```

If `tools:` includes `Agent`, the agent is in the peer-dispatch tier — must add a `## Peer dispatch` body section with whitelist, blacklist (`MUST NOT dispatch`), and budget line. The validator enforces this for the names in `PEER_DISPATCH_ALLOWLIST`.

### `model_pinned` is advisory, not enforced

`model_pinned` is a **declared-preference default**, predating model routing. No resolver reads it — confirmed against `scripts/lib/models/resolve-model.ts` and its `resolveDispatchModel` / `resolveModelForPhase` / `resolveShapeTier` exports, which look only at `.claude/loop.json` → `loop.modelRouting[phase]` (falling back to `loop.modelRouting.default`, then a hardcoded `opus`), gated by the `crew.json` `features["model-routing"]` toggle. The autonomous wave path uses the equivalent `model-router` in the companion `loop` plugin — same shape, same blind spot. Neither path consults an agent's frontmatter.

Do not read `model_pinned` as a guarantee that a dispatch runs on that model tier — it will not, unless a human manually passes `model:` on the `Agent` tool call. Keep the field when adding or promoting an agent (documents intended tier for humans skimming frontmatter; a placeholder if per-agent routing is ever wired in), but do not silently strip it from existing agents over this note alone — that is 20+ files of churn for a doc-accuracy fix. If `model_pinned`-driven routing becomes real, update this note and `resolve-model.ts`'s header comment together.

Required body sections:

- `## Report contract` — exactly one occurrence, heading match `^##\s+Report contract\b`.
- Identity intro — a single line `You are the <role>` or `You are a/an <role>` outside frontmatter.

Optional but recommended: `## Custom instructions`, `## Delegation map`, `## Workflow badges`.

### The STATUS line is enforced at runtime for builder-tier agents, not advisory prose

Since dev-team#187/#174 (Wave 3 Guard 1, "deliver-before-die"), the `## Report contract`'s
`STATUS ∈ {DONE, BLOCKED, HELP, IN-PROGRESS}` line is a runtime-enforced contract for the
four STATUS-line builder-tier agents (`fullstack-dev`, `backend-dev`, `frontend-dev`,
`aiplugin-dev`), not just prompt-body prose a builder might skip under a truncated dispatch.
A `SubagentStop` hook (`hooks/check-builder-terminal-state.ts` /
`hooks/lib/check-builder-terminal-state.ts`) blocks once when one of those agents is about to
go idle with neither a recognized `DONE:` / `BLOCKED:` / `HELP:` / `IN-PROGRESS:` line nor a
completion-artifact path
(`.claude/artifacts/crew/{handoffs,reviews,validations,deployments,runs,cost,cost-insights,agents}/*.md`)
in its last message — directing the agent to either finish the STATUS line or commit WIP and
report `BLOCKED: <what's left>`. `BLOCKED` is itself a valid terminal state and is never
blocked by this guard — forcing completion on a legitimate stop would convert it into a stuck
loop. One retry only (`stop_hook_active` re-entry guard): a second consecutive stop with no
signal passes through so the dispatcher-level watchdog takes over. Fails open on malformed
input, out-of-scope agents, and a runtime that doesn't populate `last_assistant_message`.
Opt out per-repo via `crew.json features["builder-terminal-state-guard"].enabled=false`
(default `true`).

`dev-lite` is one of `hooks/lib/model-routing-enforce.ts`'s five `BUILDER_TIER_AGENTS` but is
deliberately **excluded** from this guard's scope (`TERMINAL_STATE_GUARD_AGENTS` in
`hooks/lib/check-builder-terminal-state.ts`) — its `## Report contract` ("Receipt IS the
artifact") uses a different, maximally compressed vocabulary that doesn't match the
`DONE:`/`BLOCKED:`/`HELP:`/`IN-PROGRESS:` convention and never writes an artifact path either.
Teaching this hook a second agent's prose format would be fragile; dev-lite's `<=2 files / <=50
LOC` bound also keeps it well clear of the dispatch-death ceiling this guard exists to catch.
Tracked as a low-severity gap in dev-team#226 (receipt-shaped check, not built).

## Required frontmatter (3rdparty)

3rdparty agents are NOT validated. Keep them shaped roughly like first-party for parity, but the schema is whatever upstream ships. Carve-out: bias-prone description blocks (fake numbers, example dialogues with hallucinated metrics) should be stripped before checking in — see `agents/cloud-architect.md` history for the contract-first pattern we expect.

## Validator hard-coded sets

Several gates fire only for named agents. When adding, renaming, or removing one of these names, edit `scripts/validate-agents.ts`:

| Set | Rule it fires |
| --- | --- |
| `PEER_DISPATCH_ALLOWLIST` | Requires `## Peer dispatch` section when `tools:` includes `Agent`. |
| `EVALS_REQUIRED_AGENT_NAMES` | Requires `evals:` frontmatter field. |
| `TASK_UPDATE_BATCHING_REQUIRED` | Requires `TaskUpdate batching` rule in body. |
| `BASH_COALESCING_REQUIRED` | Requires `Coalesce Bash calls` rule in body. |
| `NO_BACKLOG_IDS_REQUIRED` | Forbids `FEAT-NNN` / `DEC-NNN` / `SLICE-NN` in body. |
| `NO_LEAD_REF_REQUIRED` | Forbids `the lead` / `crew:lead` references in body. |
| `UNIVERSALS_DRIFT_REQUIRED` | Requires pre-loaded-universals marker block. |

Tests `tests/agent-topology.test.ts` and `tests/agent-registry.test.ts` may also reference agent names — update them too.

## Add a new first-party agent

1. `git mv` or create `agents/<name>.md` with the frontmatter block above.
2. Write the body. Cap at 350 lines (validator default; override per-agent via `maxLines:` frontmatter).
3. If `tools:` includes `Agent`, add `## Peer dispatch` section AND consider whether to add the name to `PEER_DISPATCH_ALLOWLIST` (to make the section structurally enforced).
4. Add routing-table row in `docs/routing-table.md` under the right section.
5. Add the dispatch pointer in `agents/architect.md` `## Delegation map` if the agent is a design specialist.
6. Update peer-integration sections in any sibling agents that should now hand off to this one.
7. Run `node ./scripts/validate-agents.ts && bun run lint && bun run test`. All green.
8. CHANGELOG entry under the next unreleased section.

## Add a new 3rdparty agent

1. Create `agents/3rdparty/<name>.md`. Keep upstream frontmatter shape but strip fake-metrics example blocks per the contract-first pattern.
2. Add a routing-table row referencing `agents/3rdparty/<name>.md`.
3. Cite as `crew:3rdparty:<name>` in skill / agent peer-integration blocks.
4. No validator changes needed.

## Promote 3rdparty -> first-party

1. `git mv agents/3rdparty/<name>.md agents/<name>.md`.
2. Add the required first-party frontmatter fields (`prompt_id`, `version`, `model`, `model_pinned`, `effort`, `maxTurns`, `color`).
3. Add the `## Report contract` body section if missing.
4. Verify identity intro present.
5. Find-and-replace `crew:3rdparty:<name>` -> `crew:<name>` across `skills/`, `agents/`, `docs/routing-table.md`. Leave `CHANGELOG.md`, `docs/superpowers/specs/`, and `.claude/artifacts/` history alone — those are immutable.
6. Find-and-replace `agents/3rdparty/<name>.md` path refs to `agents/<name>.md`.
7. Run validator + lint + tests.
8. CHANGELOG entry: `feat(agents): promote <name> to first-party`.

## Rename an agent

1. `git mv agents/<old>.md agents/<new>.md`. Update `name:` and `prompt_id:` frontmatter.
2. Grep for `<old>` across the live tree (exclude `CHANGELOG.md`, `docs/superpowers/specs/`, `.claude/artifacts/`):
   ```
   rg "<old>" --type md --type ts --glob '!CHANGELOG.md' --glob '!docs/superpowers/specs/**' --glob '!.claude/artifacts/**'
   ```
3. Update each validator hard-coded set in `scripts/validate-agents.ts` that contains `<old>`.
4. Update slash-command refs (`crew:<old>` -> `crew:<new>`) in skills, agents, routing-table.
5. Update `evals/agents/<old>.yaml` -> `<new>.yaml` if it exists.
6. Update `src/scripts/lib/slice-linker/` dispatch lib if it references the name.
7. Update peer-integration sections in sibling agents.
8. Run validator + lint + tests. Note: slash-command rename is a BREAKING change — bump plugin minor version, document in CHANGELOG.

## Remove an agent

1. Confirm no slice in flight references it (`rg "crew:<name>"` under `.claude/artifacts/loop/backlog/{pending,triaged,in-progress}/`).
2. `git rm agents/<name>.md`.
3. Remove from every validator hard-coded set.
4. Remove routing-table row, peer-integration mentions, delegation-map row.
5. Remove `evals/agents/<name>.yaml` if present.
6. Run validator + lint + tests.
7. CHANGELOG entry: `feat(agents)!: remove <name> (replaced by <successor> | no longer needed because <reason>)`.

## CI gates the change must pass

All hard gates from `CLAUDE.md`:

1. `node ./scripts/validate-manifests.ts`
2. `node ./scripts/validate-skills.ts`
3. `node ./scripts/validate-agents.ts`
4. `node ./scripts/validate-slices.ts`
5. `bun run lint` (zero warnings)
6. `bun run format:check`
7. `bun run typecheck`
8. `bun run test`
9. `node ./scripts/e2e-smoke.ts`

If a rename touches `agents/architect.md` Delegation map or any skill in `skills/workflow/`, dispatch `crew:architect-reviewer` for an independent design review before merge.

## Companion `runner-plugin`

The `runner-plugin` repo (sibling at `../runner-plugin`) has its own `agents/` tree and validators. Agent moves in `dev-team` do NOT propagate. If both plugins need a coordinated rename, file matching PRs in each repo and land them in lockstep — the registry in `astra-marketplace` must point at compatible versions.
