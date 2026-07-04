# Agent capabilities schema

Each agent prompt under `agents/**/*.md` may declare a `capabilities:` block in its YAML frontmatter. The dispatcher agent reads these blocks to route work to the right specialist.

## Block shape

```yaml
capabilities:
  role: [implementer]                    # required — see Roles below
  surfaces: [api, schema]                # optional — what the agent works on
  stacks: [csharp, typescript, python]   # optional — tech stacks it knows
  concerns: [refactor]                   # optional — cross-cutting concerns
  scopes: [normal, wide]                 # optional — size bands it handles
  lens: [correctness, regressions]       # optional — review/validate lens (reviewers + validators only)
  priority: 10                           # required — tie-breaker (higher wins)
```

Missing fields are treated as **wildcard match** (no constraint). Empty fields are valid but discouraged — use omission instead.

## Roles (enum)

- `architect` — designs ADRs, schemas, API contracts, governance docs.
- `implementer` — writes/edits code that ships behavior.
- `reviewer` — read-only review of completed work.
- `validator` — runs the change against scenarios; produces evidence.
- `deployer` — moves changes through environments.
- `researcher` — read-only investigation, locating code, surfacing facts.
- `orchestrator` — dispatches other agents (dispatcher only; not routed to).

An agent may declare multiple roles when it genuinely fills both. (LOW-tier slices are gated by `reviewer` + `verifier` dispatched concurrently — there is no combined review+validate agent.)

## Surfaces (enum, extensible)

What the agent works on. Common values:

- `ui` — React / Vue / Angular / Flutter components, CSS
- `api` — server endpoints, OpenAPI / REST / GraphQL
- `schema` — database tables, ORM models, migrations
- `infra` — Terraform, cloud, deployment manifests
- `docs` — README, CHANGELOG, customer-facing docs
- `agent-prompts` — `.md` files under `agents/`, `skills/`, `commands/`
- `scripts` — `.ts` / `.js` / `.py` under `scripts/`, CI glue

## Stacks (enum, extensible)

Tech stacks the agent knows. Common: `typescript`, `react`, `vue`, `angular`, `csharp`, `python`, `go`, `java`, `terraform`, `postgres`, `mysql`, `mongodb`, `redis`, `aws`, `azure`, `gcp`, `flutter`, `dart`, `react-native`, `swift`, `kotlin`.

## Concerns (enum, extensible)

Cross-cutting concerns. Common: `security`, `performance`, `accessibility`, `refactor`, `quality`, `governance`, `observability`, `test-coverage`, `test-infra`, `e2e`, `data`, `cloud`, `cost`, `ux`, `architecture`, `scalability`.

## Scopes (enum)

Size band the agent handles best:

- `trivial` — 1-file edit OR ≤5 lines.
- `normal` — typical slice (2-3 files, ≤200 lines).
- `wide` — cross-cutting refactor, multi-module changes.

## Lens (reviewer-/validator-only, enum, extensible)

Review/validation perspective. Common: `correctness`, `regressions`, `security`, `performance`, `accessibility`, `design`, `architecture`, `stack-quality`, `test-coverage`, `e2e`, `wire-up`, `locate`, `assumption-challenge`.

## Priority (integer)

Tie-breaker when ≥2 agents match equally on capabilities. Higher wins.

Guideline:
- 10: canonical specialist for its niche (e.g. `csharp-reviewer` for `stack:csharp` review).
- 8: capable but specialized (e.g. `expert-react-frontend-engineer` for React 19.2-specific features).
- 5–7: generalist or fallback (e.g. `builder` for mixed work, `frontend-developer` for multi-framework UI).

## Selection algorithm (dispatcher-side, pseudo)

```
matches = agents.filter(a =>
  (slice.role === undefined || a.capabilities.role ∩ slice.role) &&
  (slice.surfaces === undefined || a.capabilities.surfaces ∩ slice.surfaces) &&
  (slice.stacks === undefined || a.capabilities.stacks ∩ slice.stacks) &&
  (slice.concerns === undefined || a.capabilities.concerns ⊇ slice.concerns) &&
  (slice.scopes === undefined || a.capabilities.scopes ∩ slice.scopes)
)
sort by (capability_overlap_score DESC, priority DESC)
return top-N (1 for solo, 2-4 for fan-out review)
```

Missing capability fields on the agent side = match anything on that dimension.

## Backward compatibility

Agents WITHOUT a `capabilities:` block remain dispatchable by exact-name from the dispatcher's inline routing table. The capability registry is additive — adding capabilities improves discoverability; their absence does not break the dispatcher.s existing routes.

## Where capabilities live

- Per-agent frontmatter (Option A — chosen 2026-06-11 by user).
- No centralized YAML aggregator (deferred; can be derived later if needed).
- Schema enforcement: optional. `scripts/validate-agents.ts` could be extended to validate the block against this schema. Currently advisory.

## Special-case agents (no capabilities block)

- `(removed v0.41)` — the dispatcher is the orchestrator; never routed TO by the dispatcher.
- `agents/parallel-runner.md` — reserved for non-FEAT parallel orchestration. Lead dispatches via `/crew:parallel` skill, not by capability match.
