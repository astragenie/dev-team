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
  blocking on each other. OpenAPI 3.1 is canonical from day one; FE
  mocks/clients and BE stubs/types are all codegen-driven from the
  same YAML.
- Existing single-builder path stays intact for single-stack slices
  (including this plugin's own internals). No regressions in current
  orchestration.
- BE side stack-agnostic from day one (C#/.NET, Node, Python, Go —
  routed by FEAT `stack:*` tag).

## Non-goals

- Polyglot FE (Vue/Svelte/etc.). React/TS only; other frameworks
  deferred until a real slice needs them.
- tRPC or other RPC-paradigm clients. RPC doesn't fit the OpenAPI
  contract surface — out of scope.
- AsyncAPI for event-driven contracts. Reserved as a future FEAT for
  slices tagged `surface:event`; not built in v0.16.0.
- Cross-browser integration smoke. Integrator runs single-browser
  Playwright; broader matrices belong to validator if ever needed.
- Real production data in integration smoke. Integrator uses OpenAPI
  `examples` and per-operation example payloads as seed data.

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

OpenAPI 3.1 is canonical. Architect (Step 1 of orchestrate-slice)
emits ONE hand-authored file + ONE derived file + ONE markdown
companion per FEAT, all FEAT-scoped (shared across slices).

**File 1 (canonical, hand-authored)**:
`.claude/artifacts/crew/designs/<FEAT-ID>-contracts.openapi.yaml`

Mandatory content per the new `skills/domain/openapi-authoring/` skill:

- OpenAPI 3.1 (JSON Schema 2020-12 alignment).
- Every operation has a stable `operationId` (used as the codegen
  symbol on both FE and BE sides).
- Every operation has at least one `examples` per response status
  (200/201/400/404/409 etc.). Examples are the seed data both MSW
  handlers and the integrator agent consume — examples must be real
  payloads, not `{ "foo": "bar" }` placeholders.
- Every operation lists ALL error response codes it can return.
  "Catch-all 500" is not acceptable; specific codes only.
- `components.securitySchemes` defines auth (bearer, OAuth scopes,
  API key). Every operation declares its `security`.
- Custom extensions for behavior the YAML can't express natively:
  - `x-ratelimit: { window: "1m", limit: 100 }`
  - `x-idempotent: true | "idempotency-key-header"`
  - `x-retry: { max: 3, backoff: "exponential" }`

**File 2 (derived, committed)**:
`.claude/artifacts/crew/designs/<FEAT-ID>-contracts.ts`

Regenerated from the YAML by `openapi-typescript`. Committed so
reviewer can read what FE sees and so CI can diff regenerated output
against committed output (drift gate). Contains:

- Operation request/response types per `operationId`
- Path constants
- Schema types per `components.schemas`

Builders consume contracts.ts for TS-native ergonomics; the YAML is
the source of truth. Drift between them is a CI failure.

**File 3 (markdown companion, hand-authored)**:
`.claude/artifacts/crew/designs/<FEAT-ID>-contracts.md`

Narrows to rationale + DB + revision log:

```markdown
## Decision rationale
why this surface shape; alternatives considered; tradeoffs

## Data Contracts
DB tables, indexes, foreign keys, migration intent
(no wire-type duplication — see OpenAPI YAML)

## Revisions
## Revision — SLICE-NN entries appended as slices progress
```

Removed from markdown (now lives only in OpenAPI YAML or derived TS):
auth scheme, rate limits, idempotency, retries, request/response
shapes, error wire shapes, examples, route paths.

**Revision rule**: revisions edit the YAML AND append
`## Revision — SLICE-NN` to markdown. The `.ts` file is regenerated;
never hand-edited. Revisions that change a public operation must
bump `info.version` in the YAML (semver).

### BE consumption of OpenAPI

`builder-be` runs codegen as its first step via the new
`skills/domain/contract-codegen/` skill. The skill defines per-stack
recipes, ALL operating directly on the OpenAPI YAML (not the derived
`.ts` file):

- C# → NSwag (server stubs + DTOs) or Kiota
- Python → `datamodel-code-generator` (models) + `fastapi-code-generator`
  (FastAPI route stubs)
- Go → `oapi-codegen` (server interfaces + types)
- Node → `openapi-typescript-codegen` or hand-rolled handlers
  consuming the derived `.ts`

Generated types are committed. CI gate hashes the regenerated output
against the committed copy on every PR; mismatch fails.

### FE consumption of OpenAPI

`builder-fe` consumes the OpenAPI YAML for mocks and clients:

- **Mocks**: `openapi-msw` or `msw-auto-mock` generates MSW handlers
  from the spec's `examples`. No hand-written mocks.
- **Clients**: `orval` generates a typed FE client (fetch / axios /
  tanstack-query bindings, configurable per FEAT). Drops in
  `src/api/<feat>.ts`.
- **Types**: imported from the derived `contracts.ts` (which itself
  came from the YAML via `openapi-typescript`). Single source of
  truth flows: YAML → orval/openapi-typescript → FE code.

Both `openapi-msw` handlers and `orval` clients are committed
artifacts — reviewer can see them; CI hashes them against regenerated
output (same drift gate as BE).

### Orchestrate-slice DAG (SPLIT_BUILD = true case)

```
Step 0   classify (+ SPLIT_BUILD flag)
Step 1   architect → contracts.openapi.yaml + contracts.md
                  → (CI/script regenerates contracts.ts from YAML)
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

- Inputs: OpenAPI YAML path, contracts.md path, FE handoff path, BE
  handoff path, slice file, the one happy-path AC text.
- Procedure (per `skills/workflow/integration-smoke/` skill):
  1. Detect run commands from `.claude/loop.json`
     `stack.run.{fe,be}` (or fallback package.json / `dotnet run` /
     `python -m`).
  2. Start BE in background; wait for health check (default
     `GET /health` returns 200 within 30s; configurable).
  3. Override FE mocks: `VITE_USE_MSW=false` or stack equivalent.
  4. Start FE in background; wait for ready.
  5. Execute one happy-path scenario derived from the OpenAPI spec:
     - `surface:ui` tagged → Playwright headless. Seed payloads come
       from the spec's `examples` for the operation the AC names.
     - `surface:api` only → curl chain. Each request body uses the
       operation's example payload directly.
     Record request/response per hop, DOM snapshot if UI, last 50
     lines of BE log. Validate every response against the operation's
     declared schema using a runtime OpenAPI validator
     (`openapi-response-validator` or equivalent); shape mismatch
     fails even if status code is correct.
  6. Tear down FE + BE.
  7. Write `.claude/artifacts/crew/integrations/<SLICE-NN>-integration.md`
     with PASS/FAIL, the AC exercised, evidence, drift notes, next
     step pointer.
- Out of scope: full AC matrix (validator owns), cross-browser, perf
  testing, real production data.
- Skipped when `SPLIT_BUILD = false` or slice frontmatter
  `skip: ["integrator"]`.

### Why a dedicated integrator (vs enriching validator)

Three options considered:

| Option | Pros | Cons |
|---|---|---|
| **X. Dedicated `crew:integrator`** (chosen) | Lives in correct DAG slot (before reviewer, so `Integration Conformance` has real evidence). Separate artifact + badge enables `/crew:fix` to route drift → architect vs AC → builder. Agent reasoning interprets flaky-boot logs. Lean prompt (~150 lines, well under 300-line cap). | One more agent in fleet (governance cost). |
| Y. Enrich `crew:validator` with `integration-smoke` skill | Fewer agents to maintain. Conceptually "verifying behavior" fits validator's charter. | Validator becomes heavier — handles BOTH AC matrix AND live smoke; model context-switches between modes. Failure tangling: when validator fails, can't distinguish wire-up from AC#3. DAG mismatch: validator currently runs AFTER reviewer, but integration smoke needs to run BEFORE (so reviewer can mark Integration Conformance). Moving validator earlier breaks contract. Short-circuit optimization disappears (validator can't short-circuit on its own output). |
| Z. Script (not an agent) invoked by orchestrator | Deterministic, zero LLM cost, no prompt to govern. | No reasoning — flaky boots dump raw logs. Heuristics about "happy path" must be encoded in slice frontmatter (rigid). Can't adapt across stacks. |

Pick X. Tradeoff accepted: pay agent-prompt maintenance cost in
exchange for sharp failure routing and reasoning over live evidence.

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

1. `builder-fe` consumes THREE artifacts: UX spec, OpenAPI YAML,
   contracts.md. UX spec stays in its lane (visual + interaction);
   OpenAPI covers data, auth, rate limits; markdown covers rationale +
   DB schema.
2. Uxdesigner prompt in orchestrate-slice gets a new mandatory
   section instruction:

```markdown
## API touchpoints
For each user action that triggers a network call, name the OpenAPI
operationId it triggers.

Example:
- "User clicks Save" → operationId `createThing`
- "List page loads" → operationId `listThings`
```

This binds UX to contracts without duplicating shapes. Reviewer can
verify every API touchpoint maps to a real `operationId` in the
OpenAPI YAML (mechanical check — easy CI gate).

### builder-fe agent (`agents/builder-fe.md`)

Inherits from `agents/builder.md` (TDD policy, report contract,
handoff-before-stop, context ceiling, shell pre-check, context
efficiency). Diffs:

Frontmatter: `name: builder-fe`, `color: cyan`, description scoped to
React + TS implementation consuming OpenAPI YAML + UX spec (React-only
for v0.16.0 per non-goals).

Owned scope:
- `*.tsx`, `*.ts` under `src/`, `app/`, `web/`, `frontend/`,
  `packages/ui*/`, `apps/*/web/`
- `*.css`, `*.module.css`, `*.scss`
- FE test files (`*.test.tsx`, `*.spec.ts` colocated)
- Generated MSW handlers + orval clients under `src/api/**` and
  `src/mocks/**` (committed regenerated output)
- Fixture files (`tests/fixtures/**`)
- FE-only config (`vite.config.*`, frontend `tsconfig.json`,
  `tailwind.config.*`, orval config `orval.config.ts`)

Forbidden:
- Server code (`*.cs`, `*.py`, `*.go`, server `*.ts` under
  `api/`, `server/`)
- DB migrations, SQL files
- OpenAPI YAML, contracts.ts, contracts.md (read-only — surface
  drift via help_request, do not edit). contracts.ts is derived
  from YAML; editing it directly fails CI's drift gate.

Skill routing:
- `skills/domain/react-engineering/`
- `skills/domain/typescript-pro/`
- `skills/domain/frontend-advisory/`
- `skills/domain/contract-codegen/` — for the FE side: run orval +
  openapi-msw against the YAML before any feature work
- FEAT `concern:accessibility` → `skills/domain/a11y-advisory/`
  (when present)
- FEAT `concern:ux` → re-read UX spec at start

Start acknowledgement additions:
- `OpenAPI YAML path consumed`
- `UX spec path consumed (or none)`
- `Generated artifacts: src/api/<feat>.ts (orval), src/mocks/<feat>.ts (openapi-msw)`
- `Mock strategy: openapi-msw from YAML examples`

Self-verify additions:
- Orval + openapi-msw regenerate clean (no diff in `src/api/`
  or `src/mocks/` against committed output)
- `npm run test:fe` or `vitest run --project fe`
- a11y check when `concern:accessibility` tagged

Contract drift handling: if implementation needs a shape not in the
OpenAPI YAML, STOP, write a `help_request` handoff, do not invent.
Architect revises the YAML and builders re-dispatch.

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
- OpenAPI YAML, contracts.ts, contracts.md (read-only)

Skill routing:
- `skills/domain/backend-advisory/`
- `skills/domain/database-architecture/`
- `skills/domain/contract-codegen/` (NEW — runs codegen from
  the OpenAPI YAML to native types/stubs per stack)
- Tag-routed per FEAT `stack:*`:
  - `stack:csharp` → `skills/domain/csharp-pro/` (NEW; first slice)
  - `stack:node` → `skills/domain/typescript-pro/` (backend variant)
  - `stack:python` → `skills/domain/python-pro/`
  - `stack:go` → `skills/domain/go-pro/` (gated on demand)

Start acknowledgement additions:
- `OpenAPI YAML codegen target (path of generated native types/stubs)`
- `contracts.md sections consumed`
- `Stack detected + codegen tool selected (NSwag / datamodel-code-generator / oapi-codegen / openapi-typescript-codegen)`

Self-verify additions:
- Per-stack codegen regenerates clean (no diff against committed
  generated output)
- Stack-native test runner (`dotnet test`, `pytest`, `go test`,
  `npm run test:be`)
- Migration dry-run when DB changes
  (`dotnet ef migrations script --idempotent`, etc.)
- Live request/response validation against OpenAPI runtime validator
  on a smoke test of one endpoint (optional but recommended; full
  validation lives in integrator)

## Rollout — FEAT decomposition

Six FEATs, sequenced. SPEC ships when all six are green.

| FEAT | Title | Files touched | Depends on |
|---|---|---|---|
| FEAT-A | Architect emits OpenAPI YAML (canonical) + derived contracts.ts + narrowed markdown | `agents/architect.md`, `commands/orchestrate-slice.md` (Step 1), `skills/domain/openapi-authoring/SKILL.md` (NEW), `scripts/validate-contracts.mjs` (NEW — runs `redocly lint` + regenerates contracts.ts and diffs vs committed), `docs/standards/contract-artifact-schema.md` (NEW) | — |
| FEAT-B | Uxdesigner adds `## API touchpoints` mandatory section (references OpenAPI operationIds) | `agents/uxdesigner.md`, `commands/orchestrate-slice.md` (Step 2 prompt), `scripts/validate-ux-spec.mjs` (NEW — cross-checks each `operationId` mentioned exists in the YAML) | FEAT-A |
| FEAT-C | `crew:builder-fe` agent + FE-only routing + orval/openapi-msw integration | `agents/builder-fe.md` (NEW), `docs/routing-table.md`, `skills/domain/frontend-advisory/` polish, `skills/domain/contract-codegen/` FE recipes (orval + openapi-msw), reference orval config template | FEAT-A |
| FEAT-D | `crew:builder-be` agent + per-stack OpenAPI codegen | `agents/builder-be.md` (NEW), `skills/domain/contract-codegen/SKILL.md` (NEW — covers NSwag/Kiota for C#, datamodel-code-generator+fastapi-code-generator for Python, oapi-codegen for Go, openapi-typescript-codegen for Node), `docs/routing-table.md` | FEAT-A |
| FEAT-E | `crew:integrator` agent + `integration-smoke` skill (OpenAPI-driven seed data + runtime response validation) | `agents/integrator.md` (NEW), `skills/workflow/integration-smoke/SKILL.md` (NEW), `.claude/loop.json` `stack.run.{fe,be}` schema | FEAT-C, FEAT-D |
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
| Codegen drift (BE/FE generated artifacts out of sync with OpenAPI YAML) | `skills/domain/contract-codegen/` defines codegen as each builder's FIRST step; generated artifacts (`src/api/`, `src/mocks/`, BE stubs, contracts.ts) are committed; CI gate hashes regenerated output against committed output. Mismatch fails CI. |
| OpenAPI authoring quality is poor (missing examples, missing error codes, vague schemas) — codegen produces garbage | `skills/domain/openapi-authoring/` enforces conventions; `scripts/validate-contracts.mjs` runs `redocly lint --extends recommended` + custom rules (every operation has examples for every declared response code, every operation declares `security`, no `additionalProperties: true` unless explicit) as a CI gate. Architect's start acknowledgement must confirm linter PASS. |
| Per-stack codegen tooling not vendored (NSwag, datamodel-code-generator, oapi-codegen, orval) | `skills/domain/contract-codegen/` documents install commands per stack as part of builder's pre-flight. Consumer repos must list required codegen tools in `.claude/loop.json` `stack.codegen.{fe,be}` so the builder can invoke them deterministically. Missing tools → `help_request`, not silent failure. |
| Existing single-stack slices regress on the current path | Classification falls back to `SPLIT_BUILD = false` → current `crew:builder` path unchanged. Covered by retaining the existing e2e smoke fixture. No regression by construction. |
| Both builders attempt the same contract drift fix in parallel | Drift handling is `help_request` only — builders do not edit OpenAPI YAML. Architect owns revisions; serialized through Step 1 re-dispatch. |
| Integrator boots BE that needs secrets not in the dev env | Integrator pre-flight checks for required env vars listed in `.claude/loop.json` `stack.integration.env_required`. Missing vars → skip-and-block. |
| OpenAPI version bumps in revisions break consumer code unexpectedly | Revision rule requires bumping `info.version` (semver) on any public-operation change. Breaking changes (response shape, removed operation) require major bump; reviewer checks the bump matches the change kind. |

## Open questions

None at design time. Items deferred to FEAT slicing:

- Exact CLI shape for `scripts/validate-contracts.mjs`: runs
  `redocly lint --extends recommended`, regenerates contracts.ts via
  `openapi-typescript`, diffs against committed copy. FEAT-A slice 1
  decides whether custom rules (mandatory examples per response code,
  mandatory `security`) live as a Redocly ruleset config or a
  separate JS validator.
- FE client tool choice: orval is the default for v0.16.0, but
  FEAT-C slice 1 confirms after a real spike. Alternative under
  consideration: `openapi-typescript-codegen` (lighter, no query
  binding generation).
- Whether `concern:auth` should co-load a dedicated `auth-advisory`
  skill (deferred — not blocking for v0.16.0; security narrative is
  captured in OpenAPI `securitySchemes`).
- Playwright is not currently a plugin dependency. FEAT-E slice 1
  decides whether to vendor it as a devDependency of the integrator
  skill, expect the consumer repo to provide it, or use a lighter
  alternative (e.g. `node:test` + `fetch` for `surface:api` flows
  and only require Playwright for `surface:ui`).
- Runtime OpenAPI response validator choice
  (`openapi-response-validator` vs `ajv` against `components.schemas`
  with manual operation-level wiring). FEAT-E slice 1 decides based
  on Node ecosystem maturity at implementation time.
