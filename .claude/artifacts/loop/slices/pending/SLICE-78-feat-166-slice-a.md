---
id: SLICE-78
title: Declarative workflow YAML — schema + loader + dispatcher refactor (regular only)
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
touches_files:
  - .claude/workflows.yaml
  - scripts/lib/workflow-config.ts
  - scripts/lib/slice-linker/dispatch.mts
  - scripts/validate-workflows.ts
  - tests/scripts/lib/workflow-config.test.ts
  - tests/scripts/lib/slice-linker/dispatch.golden-trace.test.ts
  - tests/fixtures/workflows/regular.yaml
  - tests/fixtures/workflows/invalid-phase-order.yaml
  - tests/fixtures/workflows/unknown-role.yaml
  - .github/workflows/test.yml
touches_files_confidence: declared
---

# SLICE-78 — FEAT-166 Part A: workflow YAML schema + loader + zero-behavior-change dispatcher refactor

Implements **FEAT-166 SLICE-A** per the FEAT body's "Per-slice decomposition suggestion". Ships the declarative workflow definition surface (`workflows.yaml` + Zod schema + loader + validator script) and rewires the autonomous-loop dispatcher to consume `expandWorkflow('regular')` instead of a hard-coded phase sequence. **Zero behavior change for any existing slice** — `regular` is the new `default_workflow` and must match today's dispatch trace bit-for-bit (golden trace test mandatory).

> **Path-layout note (read first).** The FEAT body (authored against the loop-plugin repo) references `src/scripts/lib/slice-linker/dispatch.mts` and `agents/crew/lead.md`. This repo (hero-crew) has no `src/` tree and a flat `agents/lead.md`. The slice-linker code lives in the loop plugin repo; this slice ships the **schema + loader + validator script + tests + golden trace fixture** in hero-crew, AND a reference dispatcher rewrite **co-located with the loader** at `scripts/lib/slice-linker/dispatch.mts` so the loop repo can vendor it via a single import path. The actual loop-repo `slice-linker/dispatch.mts` edit lands in the companion loop-repo session — this slice's golden trace fixture is the contract the loop session must satisfy. See "Cross-repo coordination" below.

## Objective

Land the declarative workflow surface with **one** workflow defined (`regular`) and prove the new loader's `expandWorkflow('regular')` output drives the same phase trace the autonomous-loop dispatcher emits today. SLICE-B adds `quick` / `spike` / `release`; SLICE-C updates `agents/lead.md` for interactive-path consumption. Lead prompt edits in THIS slice are forbidden beyond the minimum reference (see "Out of scope").

## In scope

### 1. New file: `.claude/workflows.yaml`

```yaml
version: 1
default_workflow: regular

workflows:
  regular:
    description: Standard slice — builder + 2 parallel reviewers + validator
    phases:
      - role: builder
        agent: crew:fullstack-dev
        emit: handoff
      - role: reviewer
        agent: crew:inspector
        parallel: 2
        trigger:
          on: handoff_written
          from: builder
        gate:
          policy: all_pass
          fail_action: route_to_fix
      - role: validator
        agent: crew:verifier
        gate:
          policy: blocking
        skip_when: changed_files matches "^docs/"
```

Only `regular` is defined this slice. `quick` / `spike` / `release` from the FEAT body are intentionally deferred to SLICE-B.

### 2. New file: `scripts/lib/workflow-config.ts` (Bun/Node TS, ≤200 lines)

ESM TypeScript per ADR-002 (Node 22 strip-types runtime for CLI / Bun for tests). Mirror `scripts/lib/schemas.ts` import shape (`import { z } from "zod"`).

**Exports:**

- `WorkflowConfigSchema` (Zod) covering: `version: 1`, `default_workflow: string`, `workflows: Record<string, WorkflowDefinition>`.
- `WorkflowPhaseSchema` (Zod) covering: `role` (enum: `builder | reviewer | reviewer_validator | validator | deployer`), `agent: string`, optional `parallel: number.int().min(1).max(4)`, optional `emit: "handoff"`, optional `trigger: { on: string; from: string }`, optional `gate: { policy: "all_pass" | "blocking" | "advisory"; fail_action?: "route_to_fix" }`, optional `skip_when: string`, optional `require_user_approval: boolean`.
- `type WorkflowConfig = z.infer<typeof WorkflowConfigSchema>`
- `type WorkflowDefinition = WorkflowConfig["workflows"][string]`
- `type WorkflowPhase = WorkflowDefinition["phases"][number]`
- `async loadWorkflowConfig(repoRoot: string): Promise<WorkflowConfig>` — reads `<repoRoot>/.claude/workflows.yaml`, parses with `yaml` package, validates with Zod, returns typed config. Throws `WorkflowConfigNotFoundError` (typed) if the file is missing, `WorkflowConfigParseError` if YAML invalid, `WorkflowConfigShapeError` if Zod fails (with `zod` error path included).
- `expandWorkflow(config: WorkflowConfig, name?: string): WorkflowDefinition` — returns the named workflow, or `config.workflows[config.default_workflow]` when `name` is undefined / empty. Throws `UnknownWorkflowError` (typed) if `name` is given but missing from `workflows`.

**No `${env}` substitution this slice.** The FEAT body mentions it; mark as TODO comment and defer to SLICE-B with the other new workflows (otherwise it's untested code). Open question gets a default answer here: not needed for `regular`.

**No `process.exit(N)` from any library function** (repo rule 6 in CLAUDE.md). Errors are thrown; only the validator CLI's `main()` may set `process.exitCode`.

### 3. New file: `scripts/lib/slice-linker/dispatch.mts` (reference dispatcher)

Hero-crew's reference implementation for the loop plugin to vendor. Replaces the hard-coded phase sequence with `expandWorkflow(config, slice.workflow)`.

**Exports:**

- `type DispatchPhase = { role: string; agent: string; parallel: number; gate: "all_pass" | "blocking" | "advisory" | "none"; skipReason?: string }`
- `async planDispatch(opts: { repoRoot: string; sliceWorkflow?: string; changedFiles: string[] }): Promise<DispatchPhase[]>` — calls `loadWorkflowConfig` + `expandWorkflow`, evaluates `skip_when` against `changedFiles`, returns the ordered phase plan with parallelism normalized (default 1) and gate policy normalized. Pure function — no side effects, no dispatch calls. The actual `Agent` tool call sequence stays in the loop plugin; this function returns the plan only.

**`skip_when` evaluation (v1, narrowly scoped):** support only `changed_files matches "<regex>"` exactly. Any other expression throws `UnsupportedSkipExpressionError`. Full expression language stays deferred (per FEAT body "Out of scope").

**Behavior contract for `regular` (golden trace):** the returned phase plan for `regular` MUST be byte-equal to:

```json
[
  { "role": "builder",   "agent": "crew:fullstack-dev", "parallel": 1, "gate": "none" },
  { "role": "reviewer",  "agent": "crew:inspector",     "parallel": 2, "gate": "all_pass" },
  { "role": "validator", "agent": "crew:verifier",      "parallel": 1, "gate": "blocking" }
]
```

…when `changedFiles` contains at least one non-`docs/` path. When ALL changed files match `^docs/`, the validator entry's gate becomes `"skipped"` and a `skipReason` is set (`"changed_files matches \"^docs/\""`).

### 4. New file: `scripts/validate-workflows.ts` (CI gate)

CLI script following `scripts/validate-dispatch-graph.ts` shape (shebang, `await main().catch()` at bottom, `process.exitCode` for failures, stderr observability per DEC-024). Performs:

1. `loadWorkflowConfig(repoRoot)` — Zod failures bubble up as exit 1.
2. **Phase order check** — for every workflow, phases must appear in non-decreasing role-precedence order using the precedence map `{ builder: 0, reviewer: 1, reviewer_validator: 1, validator: 2, deployer: 3 }`. Mismatch → push descriptive error.
3. **Parallelism cap** — every `parallel` value ≤ 4. Out-of-range → error.
4. **Agent existence** — every `agent: crew:<name>` must resolve to a file at `agents/<name>.md`. Missing → error.
5. **Default workflow exists** — `config.default_workflow` must be a key in `config.workflows`. Missing → error.
6. **Stderr observability:** one grep-able line per failure: `VALIDATE-WORKFLOWS error: <workflow> <phase-index> <reason>`. Success prints `Workflows OK: <N> workflow(s) validated` to stdout.

**Peer-dispatch whitelist consistency** mentioned in the FEAT body is deferred to SLICE-B (the new workflows in SLICE-B introduce more agents that need cross-checking against `PEER_DISPATCH_ALLOWLIST`; `regular` only uses `crew:fullstack-dev`, `crew:inspector`, `crew:verifier` — all already-existing primary agents not on the peer-dispatch allowlist because they're orchestrator-dispatched per the constitution).

### 5. Edit: `.github/workflows/test.yml`

Add one step after `validate-dispatch-graph.ts` (line 31) and before `validate-slices.ts` (line 32):

```yaml
      - run: node ./scripts/validate-workflows.ts
```

Hard gate (no `continue-on-error`), parity with the other validators.

### 6. Edit: `agents/lead.md` (minimum reference only — DO NOT REFACTOR)

The FEAT body mentions a `lead.md` edit. This slice limits it to **one** addition: a single line under the existing routing-table reference pointing at the new `.claude/workflows.yaml` so future readers don't lose the breadcrumb. **No structural refactor, no new section, no policy change** — the substantive lead refactor is SLICE-C's scope.

Exact addition (insert verbatim, single sentence, no surrounding edits):

> Per-slice dispatch shape: `.claude/workflows.yaml` (`default_workflow: regular`). Loader: `scripts/lib/workflow-config.ts`. (SLICE-78 lands `regular` only; SLICE-B adds `quick` / `spike` / `release`.)

Placement: directly after line 175's existing `Phase → artifact (owner): …` paragraph. If post-edit line count exceeds `maxLines: 305` in lead.md frontmatter, builder MUST bump the cap to `306` in the same commit (one-line bump only — do NOT use this slice as cover for further lead.md churn).

### 7. Tests

#### `tests/scripts/lib/workflow-config.test.ts` (new — Bun `test` runtime per CLAUDE.md `bun run test`)

Use `import { test, describe, expect } from "bun:test"` (matches existing tests like `tests/render-universal-skills.test.ts`). Fixture files under `tests/fixtures/workflows/`.

Required cases (≥ 3 — six listed; all mandatory):

1. **Happy path — load + expand default.** Given `tests/fixtures/workflows/regular.yaml` (the same shape as `.claude/workflows.yaml`), When `loadWorkflowConfig(fixtureRoot)` + `expandWorkflow(config)` is called with no name, Then the returned `WorkflowDefinition` has `phases.length === 3`, `phases[0].role === "builder"`, `phases[1].parallel === 2`, `phases[2].gate.policy === "blocking"`.

2. **Named workflow lookup.** Given the same fixture, When `expandWorkflow(config, "regular")` is called, Then it returns the same object as the default-name call (referential equality).

3. **Unknown workflow throws typed error.** Given the same fixture, When `expandWorkflow(config, "nonexistent")` is called, Then it throws `UnknownWorkflowError` whose `.message` contains the literal substring `nonexistent` and `.availableWorkflows` array contains `"regular"`.

4. **Missing file throws typed error.** Given an empty temp directory (no `.claude/workflows.yaml`), When `loadWorkflowConfig(tempRoot)` is called, Then it throws `WorkflowConfigNotFoundError` whose `.searchedPath` ends with `.claude/workflows.yaml`.

5. **Invalid phase order fails validator.** Given `tests/fixtures/workflows/invalid-phase-order.yaml` (validator phase before builder phase), When `node ./scripts/validate-workflows.ts --config <fixture>` is invoked, Then exit code is 1 and stderr contains `VALIDATE-WORKFLOWS error:` and the literal substring `phase order`.

6. **Unknown role fails Zod schema.** Given `tests/fixtures/workflows/unknown-role.yaml` (a phase with `role: archivist`), When `loadWorkflowConfig(fixtureRoot)` is called, Then it throws `WorkflowConfigShapeError` whose `.message` contains both `role` and `archivist`.

#### `tests/scripts/lib/slice-linker/dispatch.golden-trace.test.ts` (new — **regression-risk mitigation: the golden trace**)

This is the hard contract that proves zero behavior change. The fixture is the byte-exact JSON trace the today-hard-coded dispatch produces for a `regular` slice — committed alongside this slice as `tests/fixtures/dispatch-traces/regular.golden.json`. Loop repo's `slice-linker/dispatch.mts` edit (companion session) MUST match this fixture; if the loop session lands first and the trace differs, this slice's reviewer rejects the change.

```typescript
import { test, expect } from "bun:test";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { planDispatch } from "../../../../scripts/lib/slice-linker/dispatch.mts";

test("golden trace — regular workflow with code changes", async () => {
  const repoRoot = process.cwd();
  const plan = await planDispatch({
    repoRoot,
    sliceWorkflow: undefined, // exercises default_workflow path
    changedFiles: ["scripts/lib/foo.ts"]
  });
  const golden = JSON.parse(
    await readFile(path.join("tests/fixtures/dispatch-traces/regular.golden.json"), "utf8")
  );
  expect(plan).toEqual(golden);
});

test("golden trace — regular workflow with docs-only changes (validator skipped)", async () => {
  const repoRoot = process.cwd();
  const plan = await planDispatch({
    repoRoot,
    sliceWorkflow: "regular",
    changedFiles: ["docs/standards/foo.md", "docs/governance.md"]
  });
  expect(plan[2].gate).toBe("skipped");
  expect(plan[2].skipReason).toContain("^docs/");
});

test("golden trace — explicit regular name matches default-fallback plan", async () => {
  const repoRoot = process.cwd();
  const namedPlan = await planDispatch({
    repoRoot,
    sliceWorkflow: "regular",
    changedFiles: ["scripts/lib/foo.ts"]
  });
  const defaultPlan = await planDispatch({
    repoRoot,
    sliceWorkflow: undefined,
    changedFiles: ["scripts/lib/foo.ts"]
  });
  expect(namedPlan).toEqual(defaultPlan);
});
```

Fixture `tests/fixtures/dispatch-traces/regular.golden.json` content (committed verbatim):

```json
[
  { "role": "builder",   "agent": "crew:fullstack-dev", "parallel": 1, "gate": "none" },
  { "role": "reviewer",  "agent": "crew:inspector",     "parallel": 2, "gate": "all_pass" },
  { "role": "validator", "agent": "crew:verifier",      "parallel": 1, "gate": "blocking" }
]
```

## Cross-repo coordination

The loop-repo `src/scripts/lib/slice-linker/dispatch.mts` rewrite is OUT of this slice's diff scope but IN this slice's contract scope. Sequencing:

1. This hero-crew slice ships first: schema + loader + reference dispatcher + golden fixture + validator + CI gate.
2. Loop-repo companion session vendors `workflow-config.ts` (copy or import via its plugin discovery) and rewrites `src/scripts/lib/slice-linker/dispatch.mts` to call the loader, asserting its output matches the same `regular.golden.json` fixture.
3. If the loop session can't be opened in this autonomous run, the slice still closes: the reference dispatcher and golden fixture stand as the contract; loop session catches up in SLICE-A's follow-up commit cycle.

## Out of scope

- **`quick` / `spike` / `release` workflows.** SLICE-B.
- **Substantive `agents/lead.md` refactor.** SLICE-C. The single-line breadcrumb above is the ONLY lead.md edit permitted this slice.
- **`${env}` substitution in YAML.** Deferred to SLICE-B.
- **Slice-frontmatter `workflow:` field plumbing in `validate-slices.ts`.** SLICE-B brings in the per-slice override; this slice's loader honors a `sliceWorkflow` argument but no slice file actually sets it yet, so no validator edit needed here.
- **`crew:fix` flow workflow shape.** Open question in FEAT-166 line 156-157, explicitly punted to SLICE-B per FEAT body.
- **Peer-dispatch whitelist consistency check** in the new validator — deferred to SLICE-B per "agent existence" rule scope above.
- **Per-phase model override.** Out per FEAT body.
- **Workflow versioning / migration tooling.** `version: 1` field is reserved but unused; out per FEAT body.
- **Touching `agents/3rdparty/*.md`.** Vendored prompts, untouched.
- **Touching `scripts/lib/slice-linker/dispatch.mts` to perform actual subagent dispatch.** `planDispatch` returns a plan; the loop repo owns the runtime `Agent`-call sequence.

## Acceptance criteria

- [ ] **AC-1: workflow-config loader gates clean.** Given the repo at slice HEAD, When `bun run lint scripts/lib/workflow-config.ts scripts/lib/slice-linker/dispatch.mts scripts/validate-workflows.ts && bun run typecheck` runs, Then exit code is 0 and zero warnings emitted.

- [ ] **AC-2: `loadWorkflowConfig` validates `.claude/workflows.yaml` shape.** Given the committed `.claude/workflows.yaml`, When `loadWorkflowConfig(repoRoot)` runs, Then it returns a `WorkflowConfig` with `version === 1`, `default_workflow === "regular"`, and `Object.keys(workflows).length === 1`.

- [ ] **AC-3: `expandWorkflow` resolves default and named.** See test cases 1 + 2 in `workflow-config.test.ts`. Both must pass via `bun test tests/scripts/lib/workflow-config.test.ts`.

- [ ] **AC-4: Golden trace passes byte-equal for code-change slice.** Given a `changedFiles: ["scripts/lib/foo.ts"]` input, When `planDispatch` is called with `sliceWorkflow: undefined`, Then the returned array deep-equals `tests/fixtures/dispatch-traces/regular.golden.json`. Verified by `bun test tests/scripts/lib/slice-linker/dispatch.golden-trace.test.ts`.

- [ ] **AC-5: Golden trace honors `skip_when` for docs-only slice.** Given `changedFiles: ["docs/x.md"]`, When `planDispatch` runs, Then `plan[2].gate === "skipped"` and `plan[2].skipReason` matches the literal `^docs/` substring.

- [ ] **AC-6: `validate-workflows.ts` flags phase-order violation.** Given `tests/fixtures/workflows/invalid-phase-order.yaml`, When `node ./scripts/validate-workflows.ts --config <fixture>` runs, Then exit code is 1 and stderr contains `VALIDATE-WORKFLOWS error:` plus `phase order`.

- [ ] **AC-7: `validate-workflows.ts` passes on committed config.** Given the committed `.claude/workflows.yaml`, When `node ./scripts/validate-workflows.ts` runs (no `--config`, defaults to repo root), Then exit code is 0 and stdout contains the literal `Workflows OK: 1 workflow(s) validated`.

- [ ] **AC-8: CI wiring present.** Given the slice's final commit, When `grep -c 'validate-workflows.ts' .github/workflows/test.yml` runs, Then output is exactly `1` (single new step), and the step sits between `validate-dispatch-graph.ts` and `validate-slices.ts`.

- [ ] **AC-9: lead.md edit is minimal.** Given the slice's final commit, When `git diff HEAD~1 -- agents/lead.md | grep -c '^+'` runs, Then output is ≤ 3 (one new sentence + at most a one-line `maxLines:` bump + the trailing newline). Lead post-edit line count ≤ frontmatter `maxLines:` value (no validator breach).

- [ ] **AC-10: Full local gate green.** Given the slice's final commit, When `bun run lint && bun run format:check && bun run typecheck && bun run test && node ./scripts/validate-manifests.ts && node ./scripts/validate-skills.ts && node ./scripts/validate-agents.ts && node ./scripts/validate-dispatch-graph.ts && node ./scripts/validate-slices.ts && node ./scripts/validate-workflows.ts` runs, Then every command exits 0.

## Files to create / modify

### Create

- `C:\work\mega\hero-crew\.claude\workflows.yaml`
- `C:\work\mega\hero-crew\scripts\lib\workflow-config.ts`
- `C:\work\mega\hero-crew\scripts\lib\slice-linker\dispatch.mts`
- `C:\work\mega\hero-crew\scripts\validate-workflows.ts`
- `C:\work\mega\hero-crew\tests\scripts\lib\workflow-config.test.ts`
- `C:\work\mega\hero-crew\tests\scripts\lib\slice-linker\dispatch.golden-trace.test.ts`
- `C:\work\mega\hero-crew\tests\fixtures\workflows\regular.yaml`
- `C:\work\mega\hero-crew\tests\fixtures\workflows\invalid-phase-order.yaml`
- `C:\work\mega\hero-crew\tests\fixtures\workflows\unknown-role.yaml`
- `C:\work\mega\hero-crew\tests\fixtures\dispatch-traces\regular.golden.json`

### Modify

- `C:\work\mega\hero-crew\.github\workflows\test.yml` (single new validator step)
- `C:\work\mega\hero-crew\agents\lead.md` (single new sentence; possibly `maxLines:` bump by 1)

## Verification commands

```bash
# AC-1
bun run lint scripts/lib/workflow-config.ts scripts/lib/slice-linker/dispatch.mts scripts/validate-workflows.ts
bun run typecheck

# AC-2 / AC-3 / loader unit tests
bun test tests/scripts/lib/workflow-config.test.ts

# AC-4 / AC-5 / golden trace
bun test tests/scripts/lib/slice-linker/dispatch.golden-trace.test.ts

# AC-6 / AC-7
node ./scripts/validate-workflows.ts --config tests/fixtures/workflows/invalid-phase-order.yaml || echo "expected fail"
node ./scripts/validate-workflows.ts

# AC-8
grep -c 'validate-workflows.ts' .github/workflows/test.yml

# AC-9
git diff HEAD~1 -- agents/lead.md | grep -c '^+'

# AC-10 — full local gate
bun run lint && bun run format:check && bun run typecheck && bun run test \
  && node ./scripts/validate-manifests.ts && node ./scripts/validate-skills.ts \
  && node ./scripts/validate-agents.ts && node ./scripts/validate-dispatch-graph.ts \
  && node ./scripts/validate-slices.ts && node ./scripts/validate-workflows.ts
```

## Regression risk mitigation — the golden trace test

The single largest risk in this slice is silently changing dispatch behavior for some existing slice category. Mitigation has three layers:

1. **Golden trace fixture committed verbatim.** `tests/fixtures/dispatch-traces/regular.golden.json` is the byte-exact contract. Any change to `planDispatch`'s output for the `regular` workflow trips the test.
2. **Default-fallback equivalence test.** AC-3 case 2 + golden test case 3 prove `expandWorkflow(config)` and `expandWorkflow(config, "regular")` return identical results — so existing slices (which don't set `workflow:`) cannot diverge from explicitly-named-regular slices.
3. **Cross-repo contract.** The loop-repo `dispatch.mts` rewrite (out of this slice's diff) must satisfy the same fixture. If the loop session lands first with a mismatched trace, this slice's reviewer rejects it. If this slice lands first, the loop session's golden test catches drift on its side.

If reviewers want a fourth layer, the loop-repo session can additionally snapshot a real autonomous-loop run (single slice, dispatch trace captured to disk) and assert byte-equality against the same JSON — but that's a loop-repo concern, not in scope here.

## Developer-type assessment

- **developer_type: agent** — the work is application-layer schema + loader + small CLI, repeatable pattern (mirrors `validate-dispatch-graph.ts` + `schemas.ts` shapes), under 8 hours estimated complexity. No subjective UI judgment. No undocumented legacy knowledge required.
- **autonomous_safe: false** — preserved from FEAT-166's body. This slice rewires the autonomous-loop dispatcher (even though behavior is preserved by contract). Human-in-loop on review is required because a wrong golden fixture or a subtle loader bug would silently break every subsequent autonomous-loop run. Reviewer must independently re-compute the expected `regular` plan from `.claude/workflows.yaml` and compare to the fixture, not just trust the test.

## Done when

- All AC PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`.
- Build / test commands per `.claude/loop.json` pass.
- Feature FEAT-166 stays `in-progress` (SLICE-B and SLICE-C still owe their closes — use `/loop:slice complete --keep-feature-open`).
- Crew `final-synthesis` artifact written.
- Inspector + verifier review-results both filed with `approved` or `approved_with_notes`. Reviewer A independently re-derives the golden fixture from the YAML before approving.

## Reviewer ladder

- **Reviewer A: `crew:inspector`** — correctness, regression-risk gate. Specific focus:
  - Independently re-compute the expected `regular` phase plan from `.claude/workflows.yaml` and confirm it matches the committed `regular.golden.json` byte-for-byte.
  - Confirm `expandWorkflow(config)` and `expandWorkflow(config, "regular")` produce referentially-equal output (default fallback ≡ named lookup).
  - Confirm `agents/lead.md` edit is exactly one sentence + at most a one-line `maxLines:` bump — no scope creep into SLICE-C territory.
  - Confirm validator covers phase-order + parallelism cap + agent existence + default-workflow existence; no skipped checks.
- **Reviewer B: `crew:3rdparty:typescript-reviewer`** — TS quality. Carry-overs from SLICE-69 / SLICE-75:
  - No `process.exit(N)` from library functions (`loadWorkflowConfig`, `expandWorkflow`, `planDispatch`); only `main()` may set `process.exitCode`.
  - Narrow `unknown` properly in YAML parse error paths; errors typed (`WorkflowConfigNotFoundError` etc.), not generic `Error`.
  - No floating Promises.
  - Zod schemas use existing project conventions (mirror `scripts/lib/schemas.ts` style — `z.object({ ... })`, named const for re-use).

## Open questions (defaults provided — buildable as-is)

1. **CLI `--config` flag in `validate-workflows.ts`.** Spec says the flag is supported for testing the negative fixtures. **Default:** required (tests need it). Reviewer may request an env-var alternative — accept.
2. **Lead `maxLines:` bump.** Current cap is 305; spec permits a +1 bump if the one-sentence addition tips it over. **Default:** bump in same commit, no separate change. Reviewer may request the cap stay at 305 and the sentence go in a tighter position — accept.
3. **Golden fixture location.** Spec puts it under `tests/fixtures/dispatch-traces/`. **Default:** that path. Reviewer may suggest `tests/fixtures/workflows/regular.golden.json` instead to co-locate with workflow fixtures — accept either.

## Notes for the builder

- The reference dispatcher (`scripts/lib/slice-linker/dispatch.mts`) is a **plan generator**, not a runtime dispatcher. It returns the phase list; the loop repo owns the actual `Agent` tool calls. Resist any urge to call `Agent` from this file.
- Use `bun:test` not `node:test` for the new tests (matches the existing `tests/render-universal-skills.test.ts` pattern + the `bun run test` script in `package.json`).
- `yaml` package: `import { parse as parseYaml } from "yaml"` mirrors `scripts/validate-contracts.ts` line 19. Use the same import.
- `zod`: `import { z } from "zod"` mirrors `scripts/lib/schemas.ts` line 18.
- Closing ceremony: `/loop:slice complete --id SLICE-78 --keep-feature-open` (FEAT-166 owes SLICE-B and SLICE-C still).
