# FEAT-F: `/crew:orchestrate-slice` DAG wiring (SPLIT_BUILD) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the new agents (`crew:builder-fe`, `crew:builder-be`, `crew:integrator`) into `/crew:orchestrate-slice`. Add SPLIT_BUILD classification to Step 0. Add parallel three-Agent dispatch at Step 2+3. Add Step 3.5 (integrator) that fires only after both builders self-verify PASS. Update `agents/reviewer.md` to require Contract Conformance (FE), Contract Conformance (BE), UX Spec Conformance, and Integration Conformance sections when SPLIT_BUILD is true. Ship the e2e smoke fixture proving the full DAG runs.

**Architecture:** All previous FEATs (A–E) shipped reusable assets (skills, agents, validators). FEAT-F is the integration: the orchestrator now classifies slices into single-builder vs split-builder paths, dispatches accordingly, and the reviewer gates on the new conformance sections. Single-stack slices keep the current path; new path activates only when classification fires. End-to-end smoke proves a synthetic SPLIT_BUILD slice produces FE diff + BE diff + integrator artifact + reviewer PASS in one orchestration run. Depends on FEAT-A through FEAT-E.

**Tech Stack:** Markdown command edits, existing `tests/orchestrate-slice.test.mjs` patterns, e2e smoke harness (`scripts/e2e-smoke.mjs`), `validate-agents.mjs`.

---

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `commands/orchestrate-slice.md` | MODIFY | Add SPLIT_BUILD classification + parallel dispatch + Step 3.5 + reviewer prompt changes |
| `agents/reviewer.md` | MODIFY | Require conformance sections when SPLIT_BUILD |
| `tests/orchestrate-slice.test.mjs` | MODIFY | Cover SPLIT_BUILD classification + dispatch ordering |
| `tests/fixtures/slices/split-build-demo.md` | NEW | Synthetic slice with both FE + BE tags |
| `tests/fixtures/slices/single-stack-demo.md` | NEW | Synthetic slice with only BE tag (negative-of-SPLIT) |
| `scripts/e2e-smoke.mjs` | MODIFY | Add a SPLIT_BUILD scenario to the smoke loop |
| `CHANGELOG.md` | MODIFY | Add v0.16.0 section grouping FEAT-A..F |
| `package.json` | MODIFY | Bump version to 0.16.0 |
| `.claude-plugin/marketplace.json` | MODIFY | Bump version to 0.16.0 |

---

## Task 1: Failing test for SPLIT_BUILD classification

**Files:**
- Create: `tests/fixtures/slices/split-build-demo.md`
- Create: `tests/fixtures/slices/single-stack-demo.md`
- Modify: `tests/orchestrate-slice.test.mjs`

- [ ] **Step 1: Author the split-build fixture slice**

Create `tests/fixtures/slices/split-build-demo.md`:

```markdown
---
slice: SLICE-901
feat: FEAT-DEMO
tags:
  - surface:ui
  - surface:api
  - stack:react
  - stack:csharp
needs_contract: true
needs_ux: true
---

# SLICE-901 — Split build demo

## Acceptance Criteria

- POST /things creates a Thing and returns 201 with the created object
- UI button "Save" triggers the create and shows "Saved!" toast
- a11y: focus ring visible on Save button
```

- [ ] **Step 2: Author the single-stack fixture slice**

Create `tests/fixtures/slices/single-stack-demo.md`:

```markdown
---
slice: SLICE-902
feat: FEAT-DEMO
tags:
  - surface:api
  - stack:csharp
needs_contract: true
---

# SLICE-902 — Single stack BE-only demo

## Acceptance Criteria

- GET /things returns the list
- 404 on unknown id
```

- [ ] **Step 3: Read the existing orchestrate-slice test**

Run: `cat tests/orchestrate-slice.test.mjs | head -80` to find the classification-test pattern.

- [ ] **Step 4: Append failing tests for SPLIT_BUILD classification**

Append to `tests/orchestrate-slice.test.mjs`:

```javascript
import { classifySlice } from "../scripts/orchestrate-slice-classify.mjs"; // NEW module — Task 2 creates it

test("classifySlice: SPLIT_BUILD true when both surface:ui and surface:api present", async () => {
  const result = await classifySlice({
    slicePath: "tests/fixtures/slices/split-build-demo.md",
  });
  assert.equal(result.SPLIT_BUILD, true);
  assert.equal(result.NEEDS_CONTRACT, true);
  assert.equal(result.NEEDS_UX, true);
});

test("classifySlice: SPLIT_BUILD false when only backend stack tag", async () => {
  const result = await classifySlice({
    slicePath: "tests/fixtures/slices/single-stack-demo.md",
  });
  assert.equal(result.SPLIT_BUILD, false);
  assert.equal(result.NEEDS_CONTRACT, true);
  assert.equal(result.NEEDS_UX, false);
});

test("classifySlice: SPLIT_BUILD false when slice has skip: [\"split-build\"]", async () => {
  const tmp = "tests/fixtures/slices/skip-split-demo.md";
  await (await import("node:fs/promises")).writeFile(
    tmp,
    "---\nslice: SLICE-903\ntags: [surface:ui, surface:api, stack:react, stack:csharp]\nskip: [\"split-build\"]\n---\n\n# SLICE-903\n\n## Acceptance Criteria\n- demo\n",
    "utf8",
  );
  const result = await classifySlice({ slicePath: tmp });
  assert.equal(result.SPLIT_BUILD, false);
  await (await import("node:fs/promises")).unlink(tmp);
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `node --test tests/orchestrate-slice.test.mjs`
Expected: FAIL on the new tests — module `orchestrate-slice-classify.mjs` doesn't exist.

- [ ] **Step 6: Commit**

```bash
git add tests/fixtures/slices/split-build-demo.md tests/fixtures/slices/single-stack-demo.md tests/orchestrate-slice.test.mjs
git commit -m "test(FEAT-F): failing SPLIT_BUILD classification tests + fixtures"
```

---

## Task 2: Extract classification into a testable module

**Files:**
- Create: `scripts/orchestrate-slice-classify.mjs`

- [ ] **Step 1: Author the module**

Create `scripts/orchestrate-slice-classify.mjs`:

```javascript
#!/usr/bin/env node

// Pure classification logic extracted from commands/orchestrate-slice.md so it
// is testable and reusable across the CLI + the command prompt. The command
// prompt mirrors the same logic; this module is the source of truth.

import fs from "node:fs/promises";
import { parse as parseYaml } from "yaml";

const FE_SURFACE = new Set(["surface:ui"]);
const FE_STACK = new Set(["stack:react"]);
const BE_SURFACE = new Set(["surface:api", "surface:schema"]);
const BE_STACK = new Set(["stack:csharp", "stack:node", "stack:python", "stack:go"]);

/**
 * @param {object} opts
 * @param {string} opts.slicePath
 */
export async function classifySlice(opts) {
  const text = await fs.readFile(opts.slicePath, "utf8");
  const fm = parseFrontmatter(text);
  /** @type {string[]} */
  const tags = Array.isArray(fm?.tags) ? fm.tags : [];
  const skip = Array.isArray(fm?.skip) ? fm.skip : [];

  const has = (set) => tags.some((t) => set.has(t));
  const FE = has(FE_SURFACE) || has(FE_STACK);
  const BE = has(BE_SURFACE) || has(BE_STACK);

  const NEEDS_CONTRACT =
    fm?.needs_contract === true ||
    (fm?.needs_contract !== false && (has(BE_SURFACE) || (FE && BE)));
  const NEEDS_UX =
    fm?.needs_ux === true ||
    (fm?.needs_ux !== false && FE);
  const SPLIT_BUILD = FE && BE && !skip.includes("split-build");

  return { SPLIT_BUILD, NEEDS_CONTRACT, NEEDS_UX, tags, skip };
}

/** @param {string} text */
function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  return parseYaml(m[1]);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const p = process.argv[2];
  if (!p) {
    console.error("usage: orchestrate-slice-classify.mjs <slice-path>");
    process.exit(2);
  }
  const r = await classifySlice({ slicePath: p });
  console.log(JSON.stringify(r, null, 2));
}
```

- [ ] **Step 2: Run the tests to verify they pass**

Run: `node --test tests/orchestrate-slice.test.mjs`
Expected: PASS (existing tests + 3 new SPLIT_BUILD tests).

- [ ] **Step 3: Commit**

```bash
git add scripts/orchestrate-slice-classify.mjs
git commit -m "feat(FEAT-F): extract SPLIT_BUILD classification module"
```

---

## Task 3: Wire the classification into `commands/orchestrate-slice.md` Step 0

**Files:**
- Modify: `commands/orchestrate-slice.md`

- [ ] **Step 1: Read current Step 0**

Open `commands/orchestrate-slice.md`. Locate "Step 0 — Read and classify slice".

- [ ] **Step 2: Add SPLIT_BUILD to the classification logic block**

In the "Tag heuristics" subsection, add:

```
- tags include BOTH (`surface:ui` OR `stack:react`) AND (`surface:api` OR `surface:schema` OR `stack:csharp` OR `stack:node` OR `stack:python` OR `stack:go`) → `SPLIT_BUILD = true`
- slice frontmatter `skip:` includes `"split-build"` → force `SPLIT_BUILD = false`
- otherwise → `SPLIT_BUILD = false`
```

- [ ] **Step 3: Update the classification summary line**

Find the existing Step 0 summary line:

```
Classification: NEEDS_CONTRACT=<...> NEEDS_UX=<...> BEHAVIOR_CHANGED=<...> RELEASE_CONTENT=<...> DOCS_NEEDED=<...>
```

Replace with:

```
Classification: SPLIT_BUILD=<true|false> NEEDS_CONTRACT=<...> NEEDS_UX=<...> BEHAVIOR_CHANGED=<...> RELEASE_CONTENT=<...> DOCS_NEEDED=<...>
```

- [ ] **Step 4: Add a note pointing to the module**

After the classification rules block, add:

```
The classification logic is also implemented in `scripts/orchestrate-slice-classify.mjs` (the source of truth for SPLIT_BUILD). When in doubt, run:
  node ./scripts/orchestrate-slice-classify.mjs <slice-path>
to see the deterministic answer.
```

- [ ] **Step 5: Run the orchestrate-slice tests**

Run: `node --test tests/orchestrate-slice.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add commands/orchestrate-slice.md
git commit -m "feat(FEAT-F): SPLIT_BUILD classification in orchestrate-slice Step 0"
```

---

## Task 4: Rewrite Step 2+3 for parallel three-Agent dispatch when SPLIT_BUILD

**Files:**
- Modify: `commands/orchestrate-slice.md`

- [ ] **Step 1: Locate "Steps 2 + 3 — UX designer + Builder (parallel when both fire)"**

Find the heading and the dispatch rules section.

- [ ] **Step 2: Replace the dispatch rules block**

Replace the existing rules with:

```markdown
**Dispatch rules:**

- `SPLIT_BUILD = false` AND `NEEDS_UX = false` AND `BEHAVIOR_CHANGED = false` — no implementation work. Skip Steps 2 + 3, jump to Step 4.
- `SPLIT_BUILD = false` AND only `NEEDS_UX = true` — dispatch `crew:uxdesigner` only.
- `SPLIT_BUILD = false` AND only `BEHAVIOR_CHANGED = true` — dispatch `crew:builder` only (single-builder path, unchanged).
- `SPLIT_BUILD = false` AND BOTH true — single message with TWO Agent calls: `crew:uxdesigner` + `crew:builder` (existing v0.15.0 behavior, unchanged).
- `SPLIT_BUILD = true` — single message with THREE Agent calls: `crew:uxdesigner` + `crew:builder-fe` + `crew:builder-be`. All consume the same FEAT-scoped OpenAPI YAML path. Builder handoffs are scoped by role: `builder-fe-<SLICE>.md` and `builder-be-<SLICE>.md`.

Race-safety: each parallel agent writes its own artifact at a deterministic path. No shared mutable state. UX spec stays slice-scoped. OpenAPI YAML is read-only for both builders (drift → help_request).
```

- [ ] **Step 3: Add new prompt blocks for `crew:builder-fe` and `crew:builder-be`**

After the existing "Step 3 prompt — `crew:builder`" block, insert:

````markdown
#### Step 3 (SPLIT_BUILD=true) prompts

##### Step 3a — `crew:builder-fe`

```
Slice: <SLICE-NN title>
Slice file: <absolute path>
OpenAPI YAML: <CONTRACT_YAML_PATH>
Contract markdown: <CONTRACT_MD_PATH>
UX spec: <UX_SPEC_PATH or "none">

Read the OpenAPI YAML before writing any FE code. Your implementation must conform to it. Regenerate orval clients and openapi-msw handlers as your FIRST step (see skills/domain/contract-codegen/ FE recipes).

If you find a gap in the YAML, surface it as help_request — do not invent.

A BE builder is working concurrently on the BE side; do NOT block on it — work from contracts + UX spec only. Integrator will exercise the real wire later.

Implement all acceptance criteria related to FE. Follow TDD: write failing component tests first.

Return the handoff artifact path.
```

Store the returned path as `BUILDER_FE_HANDOFF_PATH`.

##### Step 3b — `crew:builder-be`

```
Slice: <SLICE-NN title>
Slice file: <absolute path>
OpenAPI YAML: <CONTRACT_YAML_PATH>
Contract markdown: <CONTRACT_MD_PATH>
Stack: <derived from FEAT stack:* tag>

Read the OpenAPI YAML before writing any BE code. Your implementation must conform to it. Regenerate native types/stubs as your FIRST step (see skills/domain/contract-codegen/ BE recipes for your stack).

If you find a gap in the YAML, surface it as help_request — do not invent.

A FE builder is working concurrently on the FE side; do NOT block on it — work from contracts only. Integrator will exercise the real wire later.

Implement all acceptance criteria related to BE + DB. Follow TDD: write failing tests first.

Return the handoff artifact path.
```

Store the returned path as `BUILDER_BE_HANDOFF_PATH`.
````

- [ ] **Step 4: Run orchestrate-slice tests**

Run: `node --test tests/orchestrate-slice.test.mjs`
Expected: PASS (tests greping for old strings updated in earlier FEAT-A Task 9).

- [ ] **Step 5: Commit**

```bash
git add commands/orchestrate-slice.md
git commit -m "feat(FEAT-F): orchestrate-slice parallel three-Agent dispatch for SPLIT_BUILD"
```

---

## Task 5: Add Step 3.5 — integrator gate

**Files:**
- Modify: `commands/orchestrate-slice.md`

- [ ] **Step 1: Insert new Step 3.5 block**

After the Step 3 block(s), before Step 4, insert:

````markdown
---

### Step 3.5 — Integrator (SPLIT_BUILD only)

**Skip when `SPLIT_BUILD = false`.**
**Skip when slice frontmatter `skip:` includes `"integrator"`.**

Pre-condition: both `BUILDER_FE_HANDOFF_PATH` and `BUILDER_BE_HANDOFF_PATH` must be set AND each handoff body's `## Self-Verify Gates` section must show PASS for all gates. If either side reports any FAIL: STOP. Print the failing handoff path; tell the user to run `/crew:fix` before re-running orchestrate-slice.

When both PASS, identify the happy-path AC from the slice's Acceptance Criteria — pick the first AC tagged `happy` or, if no explicit tag, the first AC that mentions a status code (e.g. "201", "200") or "shows" / "returns" / "creates".

Dispatch `crew:integrator` with this prompt:

```
Slice: <SLICE-NN title>
Slice file: <absolute path>
OpenAPI YAML: <CONTRACT_YAML_PATH>
Contract markdown: <CONTRACT_MD_PATH>
Builder-fe handoff: <BUILDER_FE_HANDOFF_PATH>
Builder-be handoff: <BUILDER_BE_HANDOFF_PATH>
happy_path_ac: <verbatim AC text>

Run the integration-smoke procedure (see skills/workflow/integration-smoke/). Validate every response against the OpenAPI schema at runtime. Write the artifact at .claude/artifacts/crew/integrations/<SLICE-NN>-integration.md.

Return the artifact path on a single line.
```

Store the returned path as `INTEGRATION_PATH`.

If the artifact's `Outcome:` line reads `FAIL`: STOP. Print the artifact path; tell the user to run `/crew:fix --target integration` before re-running orchestrate-slice.

If `Outcome: SKIP`: continue to Step 4. Reviewer marks Integration Conformance as `N/A — <SKIP reason>`.

If `Outcome: PASS`: continue to Step 4.

---
````

- [ ] **Step 2: Commit**

```bash
git add commands/orchestrate-slice.md
git commit -m "feat(FEAT-F): orchestrate-slice Step 3.5 integrator gate"
```

---

## Task 6: Update reviewer prompt + agent for split conformance

**Files:**
- Modify: `commands/orchestrate-slice.md`
- Modify: `agents/reviewer.md`

- [ ] **Step 1: Update Step 4 reviewer dispatch prompt**

In `commands/orchestrate-slice.md`, find Step 4 ("Reviewer"). Replace the prompt body with:

```
Slice: <SLICE-NN title>
Slice file: <absolute path>
OpenAPI YAML: <CONTRACT_YAML_PATH or "none">
UX spec: <UX_SPEC_PATH or "none">
Integration artifact: <INTEGRATION_PATH or "none">

When SPLIT_BUILD=true:
  Builder-fe handoff: <BUILDER_FE_HANDOFF_PATH>
  Builder-be handoff: <BUILDER_BE_HANDOFF_PATH>
When SPLIT_BUILD=false:
  Builder handoff: <BUILDER_HANDOFF_PATH>

Review the implementation diff(s) for correctness, test coverage, regressions, and contract/UX/integration conformance per the rules in your agent prompt.

Return the review-result artifact path.
```

- [ ] **Step 2: Update `agents/reviewer.md` with the new mandatory sections**

In `agents/reviewer.md`, append (or update) a section on conformance:

```markdown
## SPLIT_BUILD conformance sections

When the dispatch prompt provides both `Builder-fe handoff` and `Builder-be handoff`, your review-result artifact MUST include FOUR sections:

### Contract Conformance (FE)
- `PASS` — FE diff conforms to all wire shapes, routes, and example payloads in the OpenAPI YAML
- `FAIL — <specific deviations>` — list which operationId / type / route differs and how

### Contract Conformance (BE)
- `PASS` — BE diff conforms to all wire shapes, routes, status codes, error responses, and `security` declarations
- `FAIL — <specific deviations>`

### UX Spec Conformance
- `PASS` — FE implementation honors flows, hierarchy, state transitions, copy, a11y in the UX spec
- `FAIL — <specific deviations>`
- `N/A — slice has no user-visible behavior` (rare in SPLIT_BUILD)

### Integration Conformance
- `PASS` — integrator artifact at the provided path shows `Outcome: PASS` AND no `Drift detected` lines
- `FAIL — <reason>` — link the artifact and quote the failing trace line
- `N/A — <SKIP reason>` — integrator artifact shows SKIP; explain in one line

When only a single `Builder handoff` is provided (SPLIT_BUILD=false), keep the existing single Contract Conformance + UX Spec Conformance behavior — do not add the FE/BE/Integration sections.
```

- [ ] **Step 3: Run validate:agents**

Run: `npm run validate:agents`
Expected: PASS — reviewer.md still under 300-line cap.

- [ ] **Step 4: Commit**

```bash
git add commands/orchestrate-slice.md agents/reviewer.md
git commit -m "feat(FEAT-F): reviewer adds FE/BE/Integration Conformance sections for SPLIT_BUILD"
```

---

## Task 6.5: Validator short-circuit on integrator artifact

**Files:**
- Modify: `agents/validator.md`
- Modify: `commands/orchestrate-slice.md`

- [ ] **Step 1: Update validator agent**

In `agents/validator.md`, append:

```markdown
## SPLIT_BUILD short-circuit

When the dispatch prompt provides an `Integration artifact:` path AND its `Outcome:` line reads `PASS`:

- If the slice's Acceptance Criteria are all covered by the happy-path AC the integrator exercised, you MAY mark validation `PASS` by reference. Record this decision in your validation artifact under `## Short-circuit` with one line: `referenced integrator artifact <path>; no additional scenarios needed`.
- If any AC requires multi-scenario coverage NOT exercised by the integrator (auth failure modes, pagination, rate-limit behavior, error envelope shapes beyond the happy path), do NOT short-circuit — run the full scenario set.

The short-circuit decision is auditable in the validation artifact; reviewer can verify it later. Default to running the full set when in doubt.
```

- [ ] **Step 2: Update orchestrate-slice Step 5 prompt to pass the integration artifact**

In `commands/orchestrate-slice.md`, find Step 5 (Validator). Replace the prompt body with:

```
Slice: <SLICE-NN title>
Slice file: <absolute path>
Builder handoff(s): <BUILDER_HANDOFF_PATH or BUILDER_FE_HANDOFF_PATH + BUILDER_BE_HANDOFF_PATH>
Review result: <REVIEW_RESULT_PATH>
Integration artifact: <INTEGRATION_PATH or "none">

Validate that the implementation satisfies all acceptance criteria in the slice file. If an Integration artifact is provided with Outcome: PASS, you may short-circuit per your agent prompt's SPLIT_BUILD short-circuit rule. Otherwise, run the full scenario set.

Return the validation artifact path.
```

- [ ] **Step 3: Run validate:agents**

Run: `npm run validate:agents`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add agents/validator.md commands/orchestrate-slice.md
git commit -m "feat(FEAT-F): validator short-circuit on integrator PASS artifact"
```

---

## Task 7: Add SPLIT_BUILD scenario to e2e smoke

**Files:**
- Modify: `scripts/e2e-smoke.mjs`

- [ ] **Step 1: Read the smoke harness**

Run: `cat scripts/e2e-smoke.mjs | head -60` to understand the existing scenarios.

- [ ] **Step 2: Add the SPLIT_BUILD scenario**

The smoke harness sets up a temp sample repo and runs commands against it. Add a scenario that:

1. Copies `tests/fixtures/openapi/valid-feat.openapi.yaml` into the sample repo as a FEAT-DEMO contract.
2. Copies `tests/fixtures/slices/split-build-demo.md` into the sample repo as `docs/ai-loop/slices/pending/SLICE-901-split-build-demo.md`.
3. Invokes `node ./scripts/orchestrate-slice-classify.mjs docs/ai-loop/slices/pending/SLICE-901-split-build-demo.md` and asserts `SPLIT_BUILD: true` in the JSON output.

Concretely, append a function like:

```javascript
async function scenarioSplitBuildClassification(sampleRoot) {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const { spawnSync } = await import("node:child_process");

  const sliceDir = path.join(sampleRoot, "docs", "ai-loop", "slices", "pending");
  await fs.mkdir(sliceDir, { recursive: true });
  await fs.copyFile(
    path.resolve("tests/fixtures/slices/split-build-demo.md"),
    path.join(sliceDir, "SLICE-901-split-build-demo.md"),
  );

  const result = spawnSync(
    process.execPath,
    [path.resolve("scripts/orchestrate-slice-classify.mjs"), path.join(sliceDir, "SLICE-901-split-build-demo.md")],
    { encoding: "utf8" },
  );
  if (result.status !== 0) throw new Error("classify failed: " + result.stderr);
  const json = JSON.parse(result.stdout);
  if (json.SPLIT_BUILD !== true) {
    throw new Error("expected SPLIT_BUILD true, got: " + JSON.stringify(json));
  }
  console.log("scenarioSplitBuildClassification: PASS");
}
```

Then call `scenarioSplitBuildClassification(sampleRoot)` from the smoke's main flow.

- [ ] **Step 3: Run the smoke**

Run: `npm run e2e:smoke`
Expected: PASS, including the new scenario line `scenarioSplitBuildClassification: PASS`.

- [ ] **Step 4: Commit**

```bash
git add scripts/e2e-smoke.mjs
git commit -m "test(FEAT-F): e2e smoke covers SPLIT_BUILD classification"
```

---

## Task 8: Final self-verify gate

**Files:** none

- [ ] **Step 1: Run all repo gates**

```bash
npm run lint
npm run format:check
npm run typecheck
node --test
npm run validate:manifests
npm run validate:skills
npm run validate:agents
npm run validate:routing-table
npm run validate:slices
npm run validate:contracts -- tests/fixtures/openapi/valid-feat.openapi.yaml
npm run validate:ux-spec -- tests/fixtures/ux-specs/valid-ux-spec.md
npm run e2e:smoke
```

All must exit 0.

- [ ] **Step 2: Run validate:syntheses if present**

Run: `node ./scripts/validate-syntheses.mjs`
Expected: PASS.

- [ ] **Step 3: Write FEAT-F handoff**

```bash
node ./scripts/crew.mjs write-handoff \
  --repo "$PWD" \
  --title "FEAT-F: orchestrate-slice SPLIT_BUILD DAG wiring" \
  --from builder --to lead \
  --summary "orchestrate-slice now classifies and dispatches the FE/BE split path; reviewer enforces FE/BE/UX/Integration conformance; e2e smoke proves the classification" \
  --scope "FEAT-F only — Step 0 classification, Step 2+3 parallel dispatch, Step 3.5 integrator gate, reviewer agent + Step 4 prompt, e2e smoke scenario, classification module" \
  --deliverable "commands/orchestrate-slice.md + agents/reviewer.md + scripts/orchestrate-slice-classify.mjs + e2e smoke scenario + fixtures" \
  --files "commands/orchestrate-slice.md,agents/reviewer.md,scripts/orchestrate-slice-classify.mjs,tests/orchestrate-slice.test.mjs,tests/fixtures/slices/split-build-demo.md,tests/fixtures/slices/single-stack-demo.md,scripts/e2e-smoke.mjs" \
  --confidence high \
  --risks "Integrator dispatch is only validated via classification + DAG narrative — full live wire-up not exercised in plugin's own CI (consumer repo runs it). Acceptable: this plugin is content-heavy, not a runtime." \
  --next "Release prep — CHANGELOG + package.json + marketplace.json bump to 0.16.0"
```

- [ ] **Step 4: Commit handoff**

```bash
git add .claude/artifacts/crew/handoffs/
git commit -m "chore(FEAT-F): handoff artifact for FEAT-F completion"
```

---

## Task 9: Release prep — CHANGELOG + version bumps

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `package.json`
- Modify: `.claude-plugin/marketplace.json`

- [ ] **Step 1: Add CHANGELOG section**

Edit `CHANGELOG.md`. At the top under any "Unreleased" header (or as a new top entry):

```markdown
## v0.16.0 — 2026-MM-DD

Frontend/backend builder split. OpenAPI 3.1 canonical. New agents and skills:

- **FEAT-A** Architect emits OpenAPI YAML (canonical) + derived contracts.ts + narrowed companion markdown. `skills/domain/openapi-authoring/` defines the quality bar; `scripts/validate-contracts.mjs` enforces it (redocly lint + drift gate).
- **FEAT-B** UX specs mandate `## API touchpoints` referencing OpenAPI operationIds. `scripts/validate-ux-spec.mjs` cross-checks references.
- **FEAT-C** `crew:builder-fe` — React + TS specialist consuming OpenAPI via orval + openapi-msw. `skills/domain/contract-codegen/` FE recipes.
- **FEAT-D** `crew:builder-be` — backend specialist supporting C#/.NET, Node, Python, Go (routed by FEAT `stack:*` tag). `skills/domain/contract-codegen/` BE recipes (NSwag/Kiota, datamodel-code-generator+fastapi-code-generator, oapi-codegen, openapi-typescript-codegen).
- **FEAT-E** `crew:integrator` + `skills/workflow/integration-smoke/` — live wire-up smoke with runtime OpenAPI response validation. `.claude/loop.json` `stack.run.{fe,be}` + `stack.integration.env_required` keys.
- **FEAT-F** `/crew:orchestrate-slice` classifies SPLIT_BUILD slices and dispatches the FE+BE+UX trio in parallel. Step 3.5 integrator gate. Reviewer emits FE/BE/UX/Integration conformance sections.

Single-stack slices continue to use the original `crew:builder` path unchanged. SPLIT_BUILD activates only when classification fires.
```

Replace `2026-MM-DD` with today's date.

- [ ] **Step 2: Bump `package.json`**

Edit `package.json` — change `"version": "0.15.0"` to `"version": "0.16.0"`.

- [ ] **Step 3: Bump `.claude-plugin/marketplace.json`**

Edit `.claude-plugin/marketplace.json` — find `plugins[name=crew].version` and change to `"0.16.0"`.

- [ ] **Step 4: Confirm gates one last time**

```bash
npm run lint && npm run format:check && npm run typecheck && node --test && npm run e2e:smoke && npm run validate:manifests
```

All must exit 0.

- [ ] **Step 5: Commit the release prep**

```bash
git add CHANGELOG.md package.json .claude-plugin/marketplace.json
git commit -m "chore(release): v0.16.0 — FE/BE split + OpenAPI canonical + integrator"
```

- [ ] **Step 6: Tag the release (user invokes; do not auto-push)**

Inform the user:

```
Release commit landed locally. To publish v0.16.0, the user runs:

  git tag -a v0.16.0 -m "v0.16.0 — FE/BE split + OpenAPI canonical + integrator"
  git push origin main --follow-tags

(per CLAUDE.md release rules — auto-push and tag creation by an agent is forbidden.)
```
