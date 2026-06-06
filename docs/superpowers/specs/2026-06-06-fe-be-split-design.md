# Frontend/Backend Builder Split — Design

**Date**: 2026-06-06
**Author**: brainstormed via `/superpowers:brainstorming`
**Target release**: v0.16.0
**Status**: design — awaiting user review

## Problem

`/crew:orchestrate-slice` (v0.15.0) already runs `crew:uxdesigner` in
parallel with a single `crew:builder`. The single builder still owns
all implementation work — frontend (React/TS) and backend (server +
DB) — and runs them sequentially inside one agent context. This caps
parallelism and forces one model to context-switch between two stacks.

The user wants to split that single builder into specialists (frontend
and backend) that run concurrently from a shared contract, so a slice
that has both UI and API work completes in roughly the time of the
slower side instead of FE+BE serially.

Today's `crew:uxdesigner` produces a UX spec covering interaction
flows, component hierarchy, state transitions, copy, and a11y. Alone
that's **not enough** for a frontend builder working in isolation: it
omits data wire shapes, error wire shapes, auth and rate-limit
behavior, and how to mock the backend during dev. Solving the
isolation problem is part of this design.

## Goals

- Two new specialist agents (`crew:builder-fe`, `crew:builder-be`)
  dispatchable in parallel by `/crew:orchestrate-slice`.
- One new verification agent (`crew:integrator`) that proves the two
  sides interoperate live, not just on paper.
- Contract artifact format upgraded so both builders can work without
  blocking on each other.
- Existing single-builder path stays intact for single-stack slices
  (including this plugin's own internals). No regressions in current
  orchestration.
- BE side stack-agnostic from day one (C#/.NET, Node, Python, Go —
  routed by FEAT `stack:*` tag).

## Non-goals

- OpenAPI/JSON-Schema emission. TS types are the executable contract;
  OpenAPI can be a later FEAT if demand surfaces.
- Polyglot FE (Vue/Svelte/etc.). React/TS only; other frameworks
  deferred until a real slice needs them.
- Auto-generated FE API clients (orval, tRPC). MSW handlers from
  contracts.ts cover the isolation use case; client codegen is a
  future FEAT.
- Cross-browser integration smoke. Integrator runs single-browser
  Playwright; broader matrices belong to validator if ever needed.
- Real production data in integration smoke. Integrator uses
  `SAMPLES` exported by contracts.ts as seed data.

## Approach (recommended)

**Approach A — Conditional split.** A new `SPLIT_BUILD` flag is
computed during orchestrate-slice classification. When true, the
parallel-specialist DAG fires. When false, the existing single-builder
path runs unchanged.

Why A over the alternatives:

- **Approach B (always split)** wastes half the dispatches on
  single-stack slices and pollutes the artifact directory with empty
  "no UI in scope" handoffs. The current backlog for this plugin is
  mostly single-stack.
- **Approach C (sequential FE-after-BE)** loses the parallelism the
  user explicitly wants. Sequential is strictly slower than today's
  single builder.

## Architecture

### Agent fleet

| Agent | Role | Skills routed | Status |
|---|---|---|---|
| `crew:builder-fe` | React + TS UI implementation + FE tests + a11y (React-only for v0.16.0; other frameworks deferred) | `react-engineering`, `typescript-pro`, `frontend-advisory`, plus FEAT `concern:*` co-loads | NEW |
| `crew:builder-be` | Server + DB + BE tests (any stack) | `backend-advisory`, `database-architecture`, `contract-codegen`, plus stack-specific (`csharp-pro`, `python-pro`, etc.) routed by FEAT `stack:*` tag | NEW |
| `crew:integrator` | Live wire-up smoke: one happy-path AC exercised end-to-end | `integration-smoke` workflow skill | NEW |
| `crew:builder` | Single-builder fallback for fullstack-by-design slices + single-language plugin internals | unchanged | NARROWED |

### Classification additions in orchestrate-slice Step 0

`SPLIT_BUILD = true` when ALL hold:

- tags include `surface:ui` OR `stack:react`
- tags include `surface:api` OR `surface:schema` OR `stack:csharp` OR
  `stack:node` OR `stack:python` OR `stack:go`
- slice frontmatter does NOT have `skip: ["split-build"]`

Otherwise `SPLIT_BUILD = false` and the existing single-builder path
runs.

### Contract artifact format

Architect (Step 1 of orchestrate-slice) emits TWO files per FEAT,
both FEAT-scoped (shared across slices).

**File 1**: `.claude/artifacts/crew/designs/<FEAT-ID>-contracts.md`
(existing path, contents narrowed). Mandatory sections after this
change:

```markdown
## Behavior Constraints
auth scheme, rate limits, idempotency keys, retry policy,
event ordering and delivery guarantees, side effects

## Data Contracts
DB tables, indexes, foreign keys, migration intent
(no type duplication — see contracts.ts)

## Revisions
## Revision — SLICE-NN entries appended as slices progress
```

Removed from markdown (now lives only in `.ts`): TypeScript
Interfaces, API Contracts, Event Schemas as types, Sample Payloads,
Error Cases as shapes.

**File 2**: `.claude/artifacts/crew/designs/<FEAT-ID>-contracts.ts`
(NEW). Mandatory exports:

```typescript
// Request / response types
export interface Thing { ... }
export interface CreateThingRequest { ... }
export type CreateThingResponse =
  | { status: 201; body: Thing }
  | { status: 400; body: { error: 'validation'; fields: string[] } }
  | { status: 409; body: { error: 'duplicate' } };

// Route constants
export const ROUTES = {
  createThing: 'POST /api/things',
  getThing: 'GET /api/things/:id',
} as const;

// Seed data used by MSW handlers and integrator
export const SAMPLES = {
  happyCreate: { request: {...}, response: {...} },
  emptyList: { response: { items: [] } },
  validationError: { request: {...}, response: {...} },
} as const;
```

Markdown is canonical for humans and ops/DB content; `.ts` is canonical
for types/routes/error shapes and is the source for FE mocks and BE
codegen.

**Revision rule**: revisions append `## Revision — SLICE-NN` to
markdown AND fully overwrite the `.ts` file. The `.ts` file is
derived; the markdown carries history.

### BE consumption of `contracts.ts`

`builder-be` runs codegen as its first step via the new
`skills/domain/contract-codegen/` skill. The skill defines per-stack
recipes:

- C# → NSwag / Refitter on `contracts.ts` → C# DTOs and interfaces
- Python → `datamodel-code-generator`
- Go → `tygo` or hand-rolled if unavailable
- Node → no codegen; consumed directly

Generated types are committed so reviewer can see them.

### Orchestrate-slice DAG (SPLIT_BUILD = true case)

```
Step 0   classify (+ SPLIT_BUILD flag)
Step 1   architect → contracts.md + contracts.ts
Step 2+3 parallel (single message, three Agent calls):
            crew:uxdesigner       → UX spec
            crew:builder-fe       → FE diff + FE handoff
            crew:builder-be       → BE diff + BE handoff
Step 3.5 crew:integrator          → live smoke artifact (NEW step)
Step 4   crew:reviewer            → reviews BOTH diffs + integrator
Step 5   crew:validator           → full AC validation
Step 6   copywriter (when RELEASE_CONTENT)
Step 7   doc-writer (when DOCS_NEEDED)
Step 8   final synthesis
```

Race-safety: each parallel agent writes its own artifact at a
deterministic path; no shared mutable state. UX spec remains
slice-scoped (`<FEAT>-ux-<SLICE>.md`). Builder handoffs scoped by
role: `builder-fe-<SLICE>.md`, `builder-be-<SLICE>.md`.

Step 3.5 fires ONLY when both `builder-fe` AND `builder-be` PASS
self-verify. If either fails, integrator is skipped, failure surfaces
to the user, and recovery goes through `/crew:fix` routed to the
failing side.

### Integrator agent

`agents/integrator.md`:

- Inputs: contracts.ts path, contracts.md path, FE handoff path, BE
  handoff path, slice file, the one happy-path AC text.
- Procedure (per `skills/workflow/integration-smoke/` skill):
  1. Detect run commands from `.claude/loop.json`
     `stack.run.{fe,be}` (or fallback package.json / `dotnet run` /
     `python -m`).
  2. Start BE in background; wait for health check (default
     `GET /health` returns 200 within 30s; configurable).
  3. Override FE mocks: `VITE_USE_MSW=false` or stack equivalent.
  4. Start FE in background; wait for ready.
  5. Execute one happy-path scenario:
     - `surface:ui` tagged → Playwright headless
     - `surface:api` only → curl chain
     Record request/response per hop, DOM snapshot if UI, last 50
     lines of BE log.
  6. Tear down FE + BE.
  7. Write `.claude/artifacts/crew/integrations/<SLICE-NN>-integration.md`
     with PASS/FAIL, the AC exercised, evidence, drift notes, next
     step pointer.
- Out of scope: full AC matrix (validator owns), cross-browser, perf
  testing, real production data.
- Skipped when `SPLIT_BUILD = false` or slice frontmatter
  `skip: ["integrator"]`.

### Reviewer step changes

When `SPLIT_BUILD = true`, reviewer's required review-result sections:

- Contract Conformance (FE) — PASS or FAIL with specific deviations
- Contract Conformance (BE) — PASS or FAIL with specific deviations
- UX Spec Conformance — PASS or FAIL (existing)
- Integration Conformance — PASS if integrator artifact shows live
  smoke green; FAIL otherwise

When `SPLIT_BUILD = false`, current reviewer behavior unchanged.

### Validator short-circuit

If integrator artifact already exercised the slice's happy-path AC
live AND no remaining AC requires multi-scenario coverage, validator
may mark PASS by reference to the integrator artifact. Saves a
dispatch on simple slices. The short-circuit decision is recorded in
the validation artifact so the trail stays auditable.

### UX spec sufficiency — the user's original concern

Current uxdesigner output covers interaction, components, states,
copy, a11y. It does NOT cover wire-level data shapes, error wire
shapes, auth, rate limits, or mock-during-dev strategy.

This design closes the gap two ways:

1. `builder-fe` consumes THREE artifacts: UX spec, contracts.ts,
   contracts.md. UX spec stays in its lane (visual + interaction);
   contracts cover data and behavior.
2. Uxdesigner prompt in orchestrate-slice gets a new mandatory
   section instruction:

```markdown
## API touchpoints
For each user action that triggers a network call, name the
contracts.ts endpoint and exported type.

Example:
- "User clicks Save" → POST /api/things (CreateThingRequest)
- "List page loads" → GET /api/things (ListThingsResponse)
```

This binds UX to contracts without duplicating shapes. Reviewer can
verify every API touchpoint maps to a real contracts.ts entry.

### builder-fe agent (`agents/builder-fe.md`)

Inherits from `agents/builder.md` (TDD policy, report contract,
handoff-before-stop, context ceiling, shell pre-check, context
efficiency). Diffs:

Frontmatter: `name: builder-fe`, `color: cyan`, description scoped to
React + TS implementation consuming contracts.ts + UX spec (React-only
for v0.16.0 per non-goals).

Owned scope:
- `*.tsx`, `*.ts` under `src/`, `app/`, `web/`, `frontend/`,
  `packages/ui*/`, `apps/*/web/`
- `*.css`, `*.module.css`, `*.scss`
- FE test files (`*.test.tsx`, `*.spec.ts` colocated)
- MSW handlers / fixture files (`src/mocks/**`, `tests/fixtures/**`)
- FE-only config (`vite.config.*`, frontend `tsconfig.json`,
  `tailwind.config.*`)

Forbidden:
- Server code (`*.cs`, `*.py`, `*.go`, server `*.ts` under
  `api/`, `server/`)
- DB migrations, SQL files
- `contracts.ts` and `contracts.md` (read-only — surface drift via
  help_request, do not edit)

Skill routing:
- `skills/domain/react-engineering/`
- `skills/domain/typescript-pro/`
- `skills/domain/frontend-advisory/`
- FEAT `concern:accessibility` → `skills/domain/a11y-advisory/`
  (when present)
- FEAT `concern:ux` → re-read UX spec at start

Start acknowledgement additions:
- `contracts.ts path consumed`
- `UX spec path consumed (or none)`
- `Mock strategy: MSW | fixtures | inline`
- whether MSW handlers generated from contracts.ts

Self-verify additions:
- `npm run test:fe` or `vitest run --project fe`
- a11y check when `concern:accessibility` tagged

Contract drift handling: if implementation needs a shape not in
contracts.ts, STOP, write a `help_request` handoff, do not invent.
Architect revises contracts.ts and builders re-dispatch.

### builder-be agent (`agents/builder-be.md`)

Inherits from `agents/builder.md`. Diffs:

Frontmatter: `name: builder-be`, `color: orange`, description scoped
to server + DB + BE tests across any backend stack.

Owned scope:
- Server code under `api/`, `server/`, `services/`, `backend/`,
  `apps/*/api/`, language-rooted dirs (`src/Server.*`, etc.)
- DB migrations, SQL files, EF migrations, Alembic files,
  `prisma/schema.prisma` when backend-only
- BE test files
- BE-only config (`appsettings.json`, `Dockerfile.api`, server
  `.csproj`, `pyproject.toml`, `go.mod`)

Forbidden:
- FE code (mirror of FE's forbidden list)
- UX spec files
- `contracts.ts` and `contracts.md` (read-only)

Skill routing:
- `skills/domain/backend-advisory/`
- `skills/domain/database-architecture/`
- `skills/domain/contract-codegen/` (NEW — runs codegen from
  contracts.ts to native types per stack)
- Tag-routed per FEAT `stack:*`:
  - `stack:csharp` → `skills/domain/csharp-pro/` (NEW; first slice)
  - `stack:node` → `skills/domain/typescript-pro/` (backend variant)
  - `stack:python` → `skills/domain/python-pro/`
  - `stack:go` → `skills/domain/go-pro/` (gated on demand)

Start acknowledgement additions:
- `contracts.ts codegen target`
- `contracts.md sections consumed`
- `Stack detected`

Self-verify additions:
- Stack-native test runner (`dotnet test`, `pytest`, `go test`,
  `npm run test:be`)
- Migration dry-run when DB changes
  (`dotnet ef migrations script --idempotent`, etc.)

## Rollout — FEAT decomposition

Six FEATs, sequenced. SPEC ships when all six are green.

| FEAT | Title | Files touched | Depends on |
|---|---|---|---|
| FEAT-A | Architect emits `contracts.ts` + narrowed markdown | `agents/architect.md`, `commands/orchestrate-slice.md` (Step 1), `scripts/validate-contracts.mjs` (NEW), `docs/standards/contract-artifact-schema.md` (NEW) | — |
| FEAT-B | Uxdesigner adds `## API touchpoints` mandatory section | `agents/uxdesigner.md`, `commands/orchestrate-slice.md` (Step 2 prompt), `scripts/validate-ux-spec.mjs` (NEW) | FEAT-A |
| FEAT-C | `crew:builder-fe` agent + FE-only routing | `agents/builder-fe.md` (NEW), `docs/routing-table.md`, `skills/domain/frontend-advisory/` polish | FEAT-A |
| FEAT-D | `crew:builder-be` agent + `contract-codegen` skill | `agents/builder-be.md` (NEW), `skills/domain/contract-codegen/SKILL.md` (NEW), `docs/routing-table.md` | FEAT-A |
| FEAT-E | `crew:integrator` agent + `integration-smoke` skill | `agents/integrator.md` (NEW), `skills/workflow/integration-smoke/SKILL.md` (NEW), `.claude/loop.json` `stack.run.{fe,be}` schema | FEAT-C, FEAT-D |
| FEAT-F | orchestrate-slice DAG wiring: classify SPLIT_BUILD, parallel dispatch, integrator gate, reviewer changes | `commands/orchestrate-slice.md`, `agents/reviewer.md`, e2e smoke fixtures | FEAT-A..E |

Each FEAT decomposes into 2–4 slices via `/loop:spec-decompose`.

SPEC-level acceptance: `/crew:orchestrate-slice` running against a
synthetic SPLIT_BUILD fixture slice produces FE diff + BE diff +
integrator artifact + reviewer artifact with all conformance sections
PASS, all in one orchestration run.

Release: v0.16.0 (minor — new commands/agents per CLAUDE.md release
rules). Marketplace bump in the same release commit. CHANGELOG groups
all six FEATs under one release section.

## Risk register

| Risk | Mitigation |
|---|---|
| Builder-fe and builder-be both edit a shared `package.json` in single-package-json monorepos | Lockfile policy: only builder-fe edits root `package.json` for FE deps; builder-be edits `apps/api/*.csproj` etc. In a single-`package.json` repo, SPLIT_BUILD is forbidden until restructure. Dispatch-time validator blocks the conflict. |
| FEAT tag drift between architect's intent and slice tags | `/loop:backlog-enrich` already populates contract/UX flags; extend it to populate SPLIT_BUILD too. Single source of routing truth, no per-slice retagging. |
| Integration smoke flakes on first run (env not provisioned) | Integrator skill includes pre-flight: check DB reachable, secrets present, ports free. On missing prereqs, skip-and-block with `help_request` rather than a false fail. |
| Codegen drift (BE native types out of sync with contracts.ts) | `skills/domain/contract-codegen/` defines codegen as builder-be's FIRST step; generated types are committed; CI gate compares the hash of regenerated output against committed output. |
| Existing single-stack slices regress on the current path | Classification falls back to `SPLIT_BUILD = false` → current `crew:builder` path unchanged. Covered by retaining the existing e2e smoke fixture. No regression by construction. |
| Both builders attempt the same contract drift fix in parallel | Drift handling is `help_request` only — builders do not edit contracts. Architect owns revisions; serialized through Step 1 re-dispatch. |
| Integrator boots BE that needs secrets not in the dev env | Integrator pre-flight checks for required env vars listed in `.claude/loop.json` `stack.integration.env_required`. Missing vars → skip-and-block. |

## Open questions

None at design time. Items deferred to FEAT slicing:

- Exact CLI shape for `scripts/validate-contracts.mjs` (validates
  contracts.ts compiles and exports the mandatory shapes).
- Whether `SAMPLES` is `as const` in contracts.ts or a separate
  `contracts.samples.ts` file (cosmetic, decided in FEAT-A slice 1).
- Whether `concern:auth` should co-load a dedicated `auth-advisory`
  skill (deferred — not blocking for v0.16.0).
- Playwright is not currently a plugin dependency. FEAT-E slice 1
  decides whether to vendor it as a devDependency of the integrator
  skill, expect the consumer repo to provide it, or use a lighter
  alternative (e.g. `node:test` + `fetch` for `surface:api` flows
  and only require Playwright for `surface:ui`).
