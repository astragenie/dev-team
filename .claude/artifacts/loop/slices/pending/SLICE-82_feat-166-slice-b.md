---
id: SLICE-82
title: FEAT-166 SLICE-B — quick / spike / release workflows + ${env} substitution + slice-frontmatter routing
status: pending
feature: FEAT-166
phase: null
priority: P2
target_release: null
requires_validation: true
developer_type: agent
estimated_complexity: medium
autonomous_safe: false
created: 2026-06-19
updated: 2026-06-19
depends_on: [SLICE-78]
touches_files:
  - .claude/workflows.yaml
  - scripts/lib/workflow-config.ts
  - scripts/lib/slice-linker/dispatch.mts
  - scripts/validate-workflows.ts
  - scripts/validate-slices.ts
  - tests/scripts/lib/workflow-config.test.ts
  - tests/scripts/lib/workflow-config.env-sub.test.ts
  - tests/scripts/lib/slice-linker/dispatch.golden-trace.test.ts
  - tests/scripts/lib/slice-linker/dispatch.slice-routing.test.ts
  - tests/fixtures/dispatch-traces/quick.golden.json
  - tests/fixtures/dispatch-traces/spike.golden.json
  - tests/fixtures/dispatch-traces/release.golden.json
  - tests/fixtures/workflows/circular-routing.yaml
  - tests/fixtures/workflows/missing-env.yaml
  - tests/fixtures/workflows/with-env-default.yaml
  - docs/standards/workflow-schema.md
  - agents/lead.md
touches_files_confidence: declared
---
# SLICE-82 — FEAT-166 Part B: quick / spike / release workflows + `${env:VAR}` substitution + slice-frontmatter routing

Implements **FEAT-166 SLICE-B** per the FEAT body's "Per-slice decomposition suggestion". Builds on SLICE-78's schema + loader + reference dispatcher by (a) adding three new workflows (`quick`, `spike`, `release`), (b) opt-in `${env:VAR[:-default]}` substitution at YAML load time, (c) slice-frontmatter `workflow:` routing through the dispatcher, and (d) hardening `validate-workflows.ts` against new failure modes (workflow-name uniqueness — implicit via YAML map keys but explicit per fixture; missing `require_user_approval` on `release` deployer; circular workflow routing).

> **Zero-regression mandate.** `SLICE-78` shipped a byte-exact golden trace for `regular` — `tests/fixtures/dispatch-traces/regular.golden.json`. This slice MUST NOT change that file or its referenced behavior. The existing `dispatch.golden-trace.test.ts` re-run is the contract; reviewer rejects on any byte diff.

## Objective

Extend `.claude/workflows.yaml` with three additional workflows + a runtime hint mechanism for deployer user-approval; introduce a narrowly-scoped `${env:VAR}` interpolation that only fires on values explicitly tagged with the marker; wire slice-frontmatter `workflow:` selection through `planDispatch` and `validate-slices.ts`; document the schema in `docs/standards/workflow-schema.md`. Lead.md gets at most a one-sentence breadcrumb update.

## In scope

### 1. Edit: `.claude/workflows.yaml` — add three workflows

Append to existing file. Field shapes mirror `regular` (no new top-level fields).

```yaml
  quick:
    description: Light slice — single combined inspector+verifier, no fanout
    phases:
      - role: builder
        agent: crew:fullstack-dev
        emit: handoff
      - role: reviewer_validator
        agent: crew:inspector-verifier
        parallel: 1
        trigger:
          on: handoff_written
          from: builder
        gate:
          policy: all_pass
          fail_action: route_to_fix

  spike:
    description: Throwaway exploration — builder only, no review/validate gates
    phases:
      - role: builder
        agent: crew:fullstack-dev
        emit: handoff

  release:
    description: Release slice — builder + 2 reviewers + validator + deployer (user approval required)
    phases:
      - role: builder
        agent: crew:fullstack-dev
        emit: handoff
      - role: reviewer
        parallel_dispatch:
          group: [crew:inspector, crew:inspector, crew:verifier]
          policy: wait_for_all
          halt_on: any_FAIL
        aggregation:
          halt_on_any_FAIL: true
          wait_for_all: true
        gate:
          policy: all_pass
          fail_action: route_to_fix
      - role: validator
        agent: crew:verifier
        gate:
          policy: blocking
      - role: deployer
        agent: crew:release-engineer
        require_user_approval: true
        gate:
          policy: blocking
```

### 2. Edit: `scripts/lib/workflow-config.ts` — `${env:VAR}` substitution

**Decision (env-sub syntax): `${env:VAR}` and `${env:VAR:-default}`.**

Rejected `$VAR` (too greedy, collides with literal shell-style values) and bare `${VAR}` (collides with future template extensions). The `${env:` prefix is the opt-in marker; only strings whose *entire value* matches the form `${env:NAME}` or `${env:NAME:-default}` are substituted. Embedded interpolation (e.g. `"prefix-${env:X}-suffix"`) is NOT supported in v1 (deferred; future schema bump).

**New typed error + constant + helper:**

- `export class EnvSubstitutionError extends Error` with `readonly variable: string` and constructor that produces message `Environment variable "${variable}" not set and no default provided`. Sets `this.name = "EnvSubstitutionError"`.
- `const ENV_SUB_RE = /^\$\{env:([A-Z_][A-Z0-9_]*)(?::-(.*))?\}$/`
- Internal helper `substituteEnv(value: unknown): unknown` — when given a string matching `ENV_SUB_RE`, returns `process.env[var]` or the default capture group, else throws `EnvSubstitutionError`. Recurses into plain objects and arrays (no class instances, no functions). Non-matching strings are returned as-is.
- Apply substitution **after** YAML parse and **before** Zod validation in `loadWorkflowConfig`: `parsed = substituteEnv(parsed)` between the parseYaml try-block and the `WorkflowConfigSchema.safeParse(parsed)` call.

**Scope rule:** substitution operates on values only — not keys. Keys are validated as-is by Zod.

### 3. Edit: `scripts/lib/slice-linker/dispatch.mts` — slice-frontmatter routing + runtime hints

Add fields and behavior; do not remove anything.

- Extend `DispatchPhase` with `require_user_approval?: boolean`. When the source phase carries `require_user_approval: true`, propagate verbatim. Add JSDoc: "Deployer-phase runtime hint: orchestrator must block on user input before invoking the agent."
- `planDispatch(opts)` already accepts `sliceWorkflow?: string`; no signature change. Confirm test coverage for each new workflow name (`quick`, `spike`, `release`).
- When `sliceWorkflow === "spike"`, returned plan has length 1 and gate is `"none"`. When `sliceWorkflow === "quick"`, plan has length 2; phase[1].gate is `"all_pass"` and `parallel === 1`. When `sliceWorkflow === "release"`, plan has length 4; phase[3].require_user_approval === true.

### 4. Edit: `scripts/validate-workflows.ts` — new checks

Three additions, each producing one grep-able stderr line on failure:

1. **`release` user-approval invariant.** If a workflow's name is `release` AND it contains a phase with `role: deployer`, then that phase MUST have `require_user_approval: true`. Error format: `VALIDATE-WORKFLOWS error: release <phase-index> deployer phase missing require_user_approval: true`.
2. **Circular workflow routing.** Build a directed graph: workflow A "routes to" workflow B iff any phase in A has `routing.tag_routes` value matching the literal string `workflow:<B>` (a future-reserved syntax). The validator walks each workflow's adjacency and rejects any cycle. For v1 (no workflows actually route to other workflows) this check is a stub that returns `[]` but is wired in and tested via `tests/fixtures/workflows/circular-routing.yaml` which DOES exercise the path. Error format: `VALIDATE-WORKFLOWS error: (config) (routing) cycle detected: <A> -> <B> -> ... -> <A>`.
3. **Workflow-name format.** Workflow keys must match `/^[a-z][a-z0-9_-]*$/`. Error format: `VALIDATE-WORKFLOWS error: (config) (name) workflow name "<key>" must match /^[a-z][a-z0-9_-]*$/`.

(Workflow-name uniqueness is implicit via YAML map keys — `yaml` package collapses duplicate keys; document this in `docs/standards/workflow-schema.md` and add a fixture test that asserts duplicate keys produce a parse error or last-write-wins per YAML 1.2.)

### 5. Edit: `scripts/validate-slices.ts` — slice-frontmatter `workflow:` field

Add an optional `workflow: z.string().optional()` field to the existing slice frontmatter Zod schema. When present, the validator MUST:
- Load `.claude/workflows.yaml` (use `loadWorkflowConfig` from `scripts/lib/workflow-config.ts`).
- Assert the slice's `workflow` value exists in `config.workflows`. Missing → error: `VALIDATE-SLICES error: <slice-id> workflow "<value>" not declared in .claude/workflows.yaml (available: <list>)`.

When `workflow` is absent, no error (slice uses `default_workflow`).

### 6. Create: `tests/fixtures/dispatch-traces/{quick,spike,release}.golden.json`

Byte-exact reference plans the new tests assert against. Below are the committed contents (whitespace-sensitive — committed verbatim).

`quick.golden.json`:
```json
[
  { "role": "builder", "agent": "crew:fullstack-dev", "parallel": 1, "gate": "none" },
  { "role": "reviewer_validator", "agent": "crew:inspector-verifier", "parallel": 1, "gate": "all_pass" }
]
```

`spike.golden.json`:
```json
[
  { "role": "builder", "agent": "crew:fullstack-dev", "parallel": 1, "gate": "none" }
]
```

`release.golden.json`:
```json
[
  { "role": "builder", "agent": "crew:fullstack-dev", "parallel": 1, "gate": "none" },
  {
    "role": "reviewer",
    "agent": "",
    "parallel": 3,
    "gate": "all_pass",
    "parallel_dispatch": { "group": ["crew:inspector", "crew:inspector", "crew:verifier"], "policy": "wait_for_all", "halt_on": "any_FAIL" },
    "aggregation": { "halt_on_any_FAIL": true, "wait_for_all": true }
  },
  { "role": "validator", "agent": "crew:verifier", "parallel": 1, "gate": "blocking" },
  { "role": "deployer", "agent": "crew:release-engineer", "parallel": 1, "gate": "blocking", "require_user_approval": true }
]
```

### 7. Tests

#### Extend `tests/scripts/lib/slice-linker/dispatch.golden-trace.test.ts`

Add four cases. All use `bun:test` matching SLICE-78 convention.

1. **AC: quick golden trace.** `planDispatch({ repoRoot, sliceWorkflow: "quick", changedFiles: ["scripts/lib/foo.ts"] })` deep-equals `tests/fixtures/dispatch-traces/quick.golden.json`.
2. **AC: spike golden trace.** `planDispatch({ repoRoot, sliceWorkflow: "spike", changedFiles: ["scripts/lib/foo.ts"] })` deep-equals `spike.golden.json` (length 1, no gate phases).
3. **AC: release golden trace.** `planDispatch({ repoRoot, sliceWorkflow: "release", changedFiles: ["scripts/lib/foo.ts"] })` deep-equals `release.golden.json`; assert `plan[3].require_user_approval === true`.
4. **AC: SLICE-78 regression.** Existing `regular` golden test re-runs and continues to pass byte-equal against `regular.golden.json` (unchanged).

#### New: `tests/scripts/lib/slice-linker/dispatch.slice-routing.test.ts`

Mock a temporary slice file with `workflow: quick` in frontmatter; assert `planDispatch` invoked with `sliceWorkflow: "quick"` returns the quick plan. (Direct unit test — no slice-file IO needed inside `planDispatch`; the caller supplies the workflow string. This test documents the contract end-to-end: slice frontmatter parse → string → planDispatch.)

#### New: `tests/scripts/lib/workflow-config.env-sub.test.ts`

Three cases:

1. **Substitution succeeds when env var set.** Fixture `with-env-default.yaml` contains `description: ${env:CREW_TEST_DESC}`. Test sets `process.env.CREW_TEST_DESC = "hello"` before load, asserts loaded workflow description === `"hello"`, restores env after.
2. **Substitution falls back to default when env var unset.** Fixture entry `description: ${env:CREW_UNSET_VAR:-fallback-value}`. Test deletes `process.env.CREW_UNSET_VAR`, asserts loaded value === `"fallback-value"`.
3. **Missing env var with no default throws.** Fixture `missing-env.yaml` contains `description: ${env:CREW_DEFINITELY_UNSET}`. Test asserts `loadWorkflowConfig` throws `EnvSubstitutionError` whose `.variable === "CREW_DEFINITELY_UNSET"`.

#### Extend `tests/scripts/lib/workflow-config.test.ts`

Add **AC: each new workflow loads.** `loadWorkflowConfig(repoRoot)` returns `config.workflows` containing all four keys `["regular", "quick", "spike", "release"]`.

#### New fixture: `tests/fixtures/workflows/circular-routing.yaml`

Two workflows whose `routing.tag_routes` reference each other via the reserved `workflow:<name>` syntax. The validator must detect the cycle and emit the precise error string above. (This is a forward-compat stub — no real workflow uses cross-workflow routing today.)

### 8. Edit: `agents/lead.md` — single breadcrumb addition

Replace the SLICE-78 sentence (`SLICE-78 lands regular only; SLICE-B adds quick / spike / release.`) with: `Workflows: regular (default) · quick · spike · release. Schema: docs/standards/workflow-schema.md.` Single sentence; no other edits. If post-edit line count exceeds the frontmatter `maxLines:` cap, bump cap by at most 1.

### 9. New: `docs/standards/workflow-schema.md` (≤180 lines)

One-pass reference document mirroring `docs/standards/build-bundle-schema.md` shape. Sections:

1. **Purpose** — what `.claude/workflows.yaml` configures and where loaders consume it.
2. **Schema** — all fields with types (mirror Zod schema from `scripts/lib/workflow-config.ts`).
3. **Built-in workflows** — table of `regular | quick | spike | release` with one-line use case + phase shape.
4. **Slice frontmatter** — how `workflow: <name>` is set + fallback to `default_workflow`.
5. **`${env:VAR}` substitution** — exact syntax (`${env:VAR}`, `${env:VAR:-default}`), value-only scope, no-embedded-interpolation rule, `EnvSubstitutionError` semantics.
6. **Validation rules** — list every `validate-workflows.ts` check + exit-code/stderr-line format.
7. **Rationale (DEC links)** — preserves SLICE-78 DEC-TBD-1 (cross-repo field parity).

## Out of scope

- **SLICE-C: substantive `agents/lead.md` refactor** (loading workflow at slice start, embedding phase list into dispatch plan).
- **`crew:fix` workflow shape.** Punted again per FEAT body.
- **Embedded `${env:VAR}` interpolation** inside larger strings (e.g. `"prefix-${env:X}-suffix"`).
- **Cross-workflow runtime routing.** The validator detects cycles in the reserved `workflow:<name>` syntax, but no workflow actually routes to another at runtime in this slice.
- **Per-phase model override.** Out per FEAT body.
- **Loop-repo `src/scripts/lib/slice-linker/dispatch.mts` vendoring.** Hero-crew owns the contract via golden traces; the loop-repo session handles its own dispatch wiring in a follow-up commit cycle (cross-repo coordination identical to SLICE-78).

## Acceptance criteria

- [ ] **AC-1: All four workflows load.** Given the committed `.claude/workflows.yaml`, When `loadWorkflowConfig(repoRoot)` runs, Then the returned `config.workflows` has keys `["regular", "quick", "spike", "release"]` (order-independent). Verified by `bun test tests/scripts/lib/workflow-config.test.ts`.

- [ ] **AC-2: SLICE-78 regression.** Given `changedFiles: ["scripts/lib/foo.ts"]` and `sliceWorkflow: undefined`, When `planDispatch` runs, Then output deep-equals the unchanged `tests/fixtures/dispatch-traces/regular.golden.json`. Verified by the existing test in `dispatch.golden-trace.test.ts`.

- [ ] **AC-3: quick golden trace.** `planDispatch({ sliceWorkflow: "quick", changedFiles: ["scripts/lib/foo.ts"] })` deep-equals `quick.golden.json` (length 2, phase[1].agent === `"crew:inspector-verifier"`, phase[1].parallel === 1, phase[1].gate === `"all_pass"`).

- [ ] **AC-4: spike golden trace.** `planDispatch({ sliceWorkflow: "spike", changedFiles: ["scripts/lib/foo.ts"] })` deep-equals `spike.golden.json` (length 1, phase[0].gate === `"none"`).

- [ ] **AC-5: release golden trace + user-approval hint.** `planDispatch({ sliceWorkflow: "release", changedFiles: ["scripts/lib/foo.ts"] })` deep-equals `release.golden.json`; `plan[3].role === "deployer"` AND `plan[3].require_user_approval === true`.

- [ ] **AC-6: env substitution — present.** Given `process.env.CREW_TEST_DESC = "hello"` and a fixture with `description: ${env:CREW_TEST_DESC}`, When `loadWorkflowConfig` runs, Then loaded `description === "hello"`.

- [ ] **AC-7: env substitution — default fallback.** Given `delete process.env.CREW_UNSET_VAR` and a fixture with `description: ${env:CREW_UNSET_VAR:-fallback-value}`, When `loadWorkflowConfig` runs, Then loaded `description === "fallback-value"`.

- [ ] **AC-8: env substitution — missing throws typed error.** Given no env var set and a fixture with `description: ${env:CREW_DEFINITELY_UNSET}`, When `loadWorkflowConfig` runs, Then it throws `EnvSubstitutionError` whose `.variable === "CREW_DEFINITELY_UNSET"`.

- [ ] **AC-9: validator catches missing release user-approval.** Given a fixture `release-no-approval.yaml` with a `release` workflow whose deployer phase omits `require_user_approval`, When `node ./scripts/validate-workflows.ts --config <fixture>` runs, Then exit code is 1 and stderr contains `VALIDATE-WORKFLOWS error: release` AND the literal substring `require_user_approval`.

- [ ] **AC-10: validator catches circular workflow routing.** Given `tests/fixtures/workflows/circular-routing.yaml`, When `node ./scripts/validate-workflows.ts --config <fixture>` runs, Then exit code is 1 and stderr contains `cycle detected:`.

- [ ] **AC-11: slice-frontmatter routing wired.** Given a temporary slice file with `workflow: quick` in frontmatter, When `validate-slices.ts` parses it, Then it loads `.claude/workflows.yaml`, confirms `"quick"` exists, and exits 0. When the value is `workflow: nonexistent`, exit code is 1 and stderr contains `workflow "nonexistent" not declared`.

- [ ] **AC-12: validator passes on committed config.** Given the committed `.claude/workflows.yaml`, When `node ./scripts/validate-workflows.ts` runs, Then exit code is 0 and stdout contains `Workflows OK: 4 workflow(s) validated`.

- [ ] **AC-13: lead.md edit is minimal.** `git diff HEAD~1 -- agents/lead.md | grep -c '^+'` ≤ 3, and `maxLines:` bump ≤ 1.

- [ ] **AC-14: full local gate green.** `bun run lint && bun run format:check && bun run typecheck && bun run test && node ./scripts/validate-manifests.ts && node ./scripts/validate-skills.ts && node ./scripts/validate-agents.ts && node ./scripts/validate-dispatch-graph.ts && node ./scripts/validate-slices.ts && node ./scripts/validate-workflows.ts` — all exit 0.

## Files to create / modify

### Create
- `C:\work\mega\hero-crew\tests\fixtures\dispatch-traces\quick.golden.json`
- `C:\work\mega\hero-crew\tests\fixtures\dispatch-traces\spike.golden.json`
- `C:\work\mega\hero-crew\tests\fixtures\dispatch-traces\release.golden.json`
- `C:\work\mega\hero-crew\tests\fixtures\workflows\circular-routing.yaml`
- `C:\work\mega\hero-crew\tests\fixtures\workflows\missing-env.yaml`
- `C:\work\mega\hero-crew\tests\fixtures\workflows\with-env-default.yaml`
- `C:\work\mega\hero-crew\tests\fixtures\workflows\release-no-approval.yaml`
- `C:\work\mega\hero-crew\tests\scripts\lib\workflow-config.env-sub.test.ts`
- `C:\work\mega\hero-crew\tests\scripts\lib\slice-linker\dispatch.slice-routing.test.ts`
- `C:\work\mega\hero-crew\docs\standards\workflow-schema.md`

### Modify
- `C:\work\mega\hero-crew\.claude\workflows.yaml` (append 3 workflows)
- `C:\work\mega\hero-crew\scripts\lib\workflow-config.ts` (`${env:VAR}` substitution + `EnvSubstitutionError`)
- `C:\work\mega\hero-crew\scripts\lib\slice-linker\dispatch.mts` (`require_user_approval` propagation)
- `C:\work\mega\hero-crew\scripts\validate-workflows.ts` (3 new checks)
- `C:\work\mega\hero-crew\scripts\validate-slices.ts` (slice `workflow:` field)
- `C:\work\mega\hero-crew\tests\scripts\lib\workflow-config.test.ts` (4-workflow load case)
- `C:\work\mega\hero-crew\tests\scripts\lib\slice-linker\dispatch.golden-trace.test.ts` (3 new golden-trace cases + regression assertion)
- `C:\work\mega\hero-crew\agents\lead.md` (single breadcrumb sentence; possibly `maxLines:` +1)

## Verification commands

```bash
# AC-1 + AC-2 + new workflow loads
bun test tests/scripts/lib/workflow-config.test.ts

# AC-3 / AC-4 / AC-5 / AC-11 — golden traces + slice routing
bun test tests/scripts/lib/slice-linker/dispatch.golden-trace.test.ts
bun test tests/scripts/lib/slice-linker/dispatch.slice-routing.test.ts

# AC-6 / AC-7 / AC-8 — env substitution
bun test tests/scripts/lib/workflow-config.env-sub.test.ts

# AC-9 / AC-10 — validator new checks
node ./scripts/validate-workflows.ts --config tests/fixtures/workflows/release-no-approval.yaml || echo "expected fail"
node ./scripts/validate-workflows.ts --config tests/fixtures/workflows/circular-routing.yaml || echo "expected fail"

# AC-12 — validator on committed config
node ./scripts/validate-workflows.ts

# AC-13 — lead.md edit minimal
git diff HEAD~1 -- agents/lead.md | grep -c '^+'

# AC-14 — full local gate
bun run lint && bun run format:check && bun run typecheck && bun run test \
  && node ./scripts/validate-manifests.ts && node ./scripts/validate-skills.ts \
  && node ./scripts/validate-agents.ts && node ./scripts/validate-dispatch-graph.ts \
  && node ./scripts/validate-slices.ts && node ./scripts/validate-workflows.ts
```

## Regression risk mitigation

Three layers, paralleling SLICE-78:

1. **SLICE-78 golden untouched.** `regular.golden.json` and its three tests in `dispatch.golden-trace.test.ts` re-run as-is; any byte diff is a fail.
2. **Each new workflow has its own golden.** `quick`, `spike`, `release` each get a committed JSON fixture so future schema edits trip an explicit diff.
3. **Env substitution scoped narrowly.** Only strings whose ENTIRE value matches `${env:VAR}` or `${env:VAR:-default}` are touched. A pre-test fixture confirms that strings containing the literal `${env:` substring inside a longer value remain unchanged (no embedded interpolation).

## Developer-type assessment

- **developer_type: agent** — application-layer schema extension + small CLI additions + new test fixtures. Pattern mirrors SLICE-78 (same loader, same dispatcher, same validator). Estimated complexity ≤ 6 hours.
- **autonomous_safe: false** — preserved from FEAT-166. Touches the autonomous-loop dispatcher contract (`planDispatch`); even though the SLICE-78 golden is regression-pinned, a subtle bug in env substitution or `require_user_approval` propagation could silently break a release-tagging slice in a future run. Human-in-loop review required. Reviewer A must independently re-derive each new golden trace from the YAML and compare to the committed fixture.

## Reviewer ladder

- **Reviewer A: `crew:inspector`** — correctness, regression-risk gate.
  - Independently re-compute the expected `quick` / `spike` / `release` phase plans from `.claude/workflows.yaml` and confirm byte-equality with the committed golden fixtures.
  - Confirm `regular.golden.json` is unchanged on disk (`git diff --exit-code -- tests/fixtures/dispatch-traces/regular.golden.json`).
  - Confirm env-substitution code path does NOT touch keys, only values.
  - Confirm `release` workflow's deployer phase has `require_user_approval: true` AND the validator rejects its absence.
- **Reviewer B: `crew:3rdparty:typescript-reviewer`** — TS quality.
  - Typed `EnvSubstitutionError` exposed with `.variable: string`; no generic `Error` throws.
  - Env substitution recursion is bounded (plain objects/arrays only — no class instance traversal).
  - `validate-workflows.ts` stderr lines all follow the existing `VALIDATE-WORKFLOWS error: <workflow> <phase-index> <reason>` shape; new error formats grep-able.
  - No `process.exit(N)` from library functions.

## Open questions (defaults provided — buildable as-is)

1. **`${env:VAR}` vs `$VAR` vs `${VAR}`.** **Decision in spec:** `${env:VAR}` and `${env:VAR:-default}`. Reviewer may request a different prefix, but the marker MUST be opt-in (not bare `${VAR}`).
2. **`workflow:` slice-frontmatter alias.** Some teams prefer `dispatch:` as the key. **Default:** stick with `workflow:` matching FEAT body. Reviewer may request alias support — accept as out-of-scope addition for SLICE-C.
3. **Circular-routing check.** v1 has no real cross-workflow routing, so the check is a forward-compat stub with a fixture-only exercise. **Default:** ship the stub. Reviewer may request deferral — decline; the check is cheap and the fixture proves the wire.

## Done when

- All AC PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`.
- `bun run test` + all validators green per AC-14.
- Feature FEAT-166 stays `in-progress` (SLICE-C still owes its close — use `/loop:slice complete --keep-feature-open`).
- Crew `final-synthesis` artifact written.
- Inspector + verifier review-results both filed with `approved` or `approved_with_notes`. Reviewer A independently re-derived all three new goldens before approving.
