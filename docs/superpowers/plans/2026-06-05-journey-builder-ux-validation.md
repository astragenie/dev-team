# Journey-builder sub-skill for ux-validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `journey-builder` sub-skill and lib module so `ux-validation` can validate a full ordered user journey (navigate → fill → click → assert) instead of parallel per-AC checks.

**Architecture:** New `scripts/lib/ux-validation/journey-builder.mjs` exports `buildJourney(acs, sliceContent)` which checks for an explicit `## User Journey` section in the slice file, then falls back to sorting ACs by verb category. `ux-validation` SKILL.md gains Step 2.5 that calls `buildJourney` and passes the result as `scenario_chain` to the existing `buildQaInvocation`. A new `skills/workflow/journey-builder/SKILL.md` documents the sub-skill contract for standalone reuse (future regression phase).

**Tech Stack:** Node.js ESM, `node:test`, existing `classifyScenario` from `scripts/lib/ux-validation/classify-scenario.mjs`

---

## File map

| Action | Path | Responsibility |
|---|---|---|
| Create | `scripts/lib/ux-validation/journey-builder.mjs` | `buildJourney` — parse override + auto-derive |
| Modify | `scripts/lib/ux-validation/index.mjs` | Re-export `buildJourney` |
| Modify | `scripts/lib/ux-validation/qa-adapter.mjs` | Add `scenario_chain` param (backward compat) |
| Create | `tests/journey-builder.test.mjs` | 10 unit tests |
| Create | `skills/workflow/journey-builder/SKILL.md` | Sub-skill contract doc |
| Modify | `skills/workflow/ux-validation/SKILL.md` | Add Step 2.5 |

---

## Task 1: journey-builder — `## User Journey` override parser

**Files:**
- Create: `scripts/lib/ux-validation/journey-builder.mjs`
- Create: `tests/journey-builder.test.mjs`

- [ ] **Step 1: Create the test file with override tests**

```js
// tests/journey-builder.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { buildJourney } from "../scripts/lib/ux-validation/journey-builder.mjs";

test("explicit ## User Journey parsed: 3 steps", () => {
  const slice = `# Slice\n## User Journey\n\n1. navigate to /dashboard\n2. click "New Project"\n3. fill form: name=Test → expect: form fills\n## Acceptance criteria\n`;
  const result = buildJourney([], slice);
  assert.equal(result.length, 3);
  assert.deepEqual(result[0], { step: 1, verb: "navigate", target: "to /dashboard", expect: "no error / visible", ac_id: null });
  assert.equal(result[2].expect, "form fills");
});

test("override takes precedence over ACs", () => {
  const acs = [{ id: "AC-1", text: "user can click submit" }];
  const slice = `## User Journey\n\n1. navigate to /app\n2. click submit\n`;
  const result = buildJourney(acs, slice);
  assert.equal(result.length, 2);
  assert.equal(result[0].verb, "navigate");
  assert.equal(result[0].ac_id, null); // from override, not from AC
});

test("optional expect defaults to 'no error / visible'", () => {
  const slice = `## User Journey\n\n1. navigate to /app\n2. click button\n`;
  const result = buildJourney([], slice);
  assert.equal(result[0].expect, "no error / visible");
  assert.equal(result[1].expect, "no error / visible");
});

test("unparseable journey line skipped, valid lines parsed", () => {
  const slice = `## User Journey\n\n1. navigate to /app\nthis line is not a step\n2. click submit\n`;
  const result = buildJourney([], slice);
  assert.equal(result.length, 2);
  assert.equal(result[0].verb, "navigate");
  assert.equal(result[1].verb, "click");
});

test("journey section stops at next ## header", () => {
  const slice = `## User Journey\n\n1. navigate to /app\n2. click submit\n## Notes\n3. this line ignored\n`;
  const result = buildJourney([], slice);
  assert.equal(result.length, 2);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
node --test tests/journey-builder.test.mjs
```

Expected: `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '...journey-builder.mjs'`

- [ ] **Step 3: Create the module with override parser only**

```js
// scripts/lib/ux-validation/journey-builder.mjs
import { classifyScenario } from "./classify-scenario.mjs";

/** @typedef {{ step: number, verb: string, target: string, expect: string, ac_id: string | null }} ScenarioStep */

const JOURNEY_HEADER_RE = /^##\s+User Journey\s*$/i;
const NEXT_HEADER_RE = /^##\s+/;
const STEP_LINE_RE = /^\d+\.\s+(.+)$/;
const EXPECT_SPLIT_RE = /\s*→\s*expect:\s*/i;

/** @type {Record<string, number>} */
const CATEGORY_ORDER = { navigation: 0, input: 1, interaction: 2, visibility: 3 };

/**
 * @param {string} sliceContent
 * @returns {ScenarioStep[] | null}
 */
function parseUserJourney(sliceContent) {
  if (!sliceContent) return null;
  const lines = sliceContent.split(/\r?\n/);
  const startIdx = lines.findIndex((l) => JOURNEY_HEADER_RE.test(l));
  if (startIdx === -1) return null;
  const steps = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (NEXT_HEADER_RE.test(line)) break;
    const m = STEP_LINE_RE.exec(line);
    if (!m) continue;
    const [actionPart, expectPart] = m[1].split(EXPECT_SPLIT_RE);
    const firstSpace = actionPart.indexOf(" ");
    const verb = (firstSpace === -1 ? actionPart : actionPart.slice(0, firstSpace)).toLowerCase();
    const target = firstSpace === -1 ? "" : actionPart.slice(firstSpace + 1).trim();
    const expect = expectPart ? expectPart.trim() : "no error / visible";
    steps.push({ step: steps.length + 1, verb, target, expect, ac_id: null });
  }
  return steps;
}

/**
 * @param {Array<{id: string, text: string}>} _acs
 * @returns {ScenarioStep[]}
 */
function deriveFromACs(_acs) {
  return []; // implemented in Task 2
}

/**
 * @param {Array<{id: string, text: string}>} acs
 * @param {string} sliceContent
 * @returns {ScenarioStep[]}
 */
export function buildJourney(acs, sliceContent) {
  const override = parseUserJourney(sliceContent);
  if (override !== null) return override;
  const derived = deriveFromACs(acs);
  return derived.length >= 2 ? derived : [];
}
```

- [ ] **Step 4: Run override tests to verify they pass**

```
node --test tests/journey-builder.test.mjs
```

Expected: 5 pass (override tests), 0 fail

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/ux-validation/journey-builder.mjs tests/journey-builder.test.mjs
git commit -m "feat(ux-validation): journey-builder override parser + tests"
```

---

## Task 2: journey-builder — auto-derive from ACs

**Files:**
- Modify: `scripts/lib/ux-validation/journey-builder.mjs` (fill in `deriveFromACs`)
- Modify: `tests/journey-builder.test.mjs` (add auto-derive tests)

- [ ] **Step 1: Add auto-derive tests to the test file**

Append to `tests/journey-builder.test.mjs`:

```js
test("navigation AC sorts before interaction AC", () => {
  const acs = [
    { id: "AC-1", text: "user clicks submit button" },
    { id: "AC-2", text: "user navigates to /dashboard" }
  ];
  const result = buildJourney(acs, "");
  assert.equal(result[0].ac_id, "AC-2"); // navigation first
  assert.equal(result[1].ac_id, "AC-1"); // interaction second
});

test("tie-breaking by document order within same category", () => {
  const acs = [
    { id: "AC-1", text: "user clicks submit" },
    { id: "AC-2", text: "user clicks cancel" }
  ];
  const result = buildJourney(acs, "");
  assert.equal(result[0].ac_id, "AC-1");
  assert.equal(result[1].ac_id, "AC-2");
});

test("empty AC list returns []", () => {
  assert.deepEqual(buildJourney([], ""), []);
});

test("all non_ui_ac returns []", () => {
  const acs = [
    { id: "AC-1", text: "server returns 200" },
    { id: "AC-2", text: "database record created" }
  ];
  assert.deepEqual(buildJourney(acs, ""), []);
});

test("single UI AC returns [] (< 2 steps)", () => {
  const acs = [{ id: "AC-1", text: "user clicks submit" }];
  assert.deepEqual(buildJourney(acs, ""), []);
});
```

- [ ] **Step 2: Run new tests to verify they fail**

```
node --test tests/journey-builder.test.mjs
```

Expected: 5 new tests fail (`[] != [...]` or similar)

- [ ] **Step 3: Implement `deriveFromACs` in journey-builder.mjs**

Replace the stub `deriveFromACs` function:

```js
/**
 * @param {Array<{id: string, text: string}>} acs
 * @returns {ScenarioStep[]}
 */
function deriveFromACs(acs) {
  const uiACs = acs.filter((ac) => classifyScenario(ac.text) !== "non_ui_ac");
  if (uiACs.length === 0) return [];
  const sorted = [...uiACs].sort((a, b) => {
    const orderA = CATEGORY_ORDER[classifyScenario(a.text)] ?? 99;
    const orderB = CATEGORY_ORDER[classifyScenario(b.text)] ?? 99;
    return orderA - orderB; // stable sort preserves doc order for ties
  });
  return sorted.map((ac, i) => {
    const text = ac.text.trim();
    const firstSpace = text.indexOf(" ");
    const verb = (firstSpace === -1 ? text : text.slice(0, firstSpace)).toLowerCase();
    const target = firstSpace === -1 ? "" : text.slice(firstSpace + 1).trim();
    return { step: i + 1, verb, target, expect: "no error / visible", ac_id: ac.id };
  });
}
```

- [ ] **Step 4: Run all tests**

```
node --test tests/journey-builder.test.mjs
```

Expected: 10 pass, 0 fail

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/ux-validation/journey-builder.mjs tests/journey-builder.test.mjs
git commit -m "feat(ux-validation): journey-builder auto-derive from ACs"
```

---

## Task 3: Export `buildJourney` from index

**Files:**
- Modify: `scripts/lib/ux-validation/index.mjs`

- [ ] **Step 1: Add export**

In `scripts/lib/ux-validation/index.mjs`, append:

```js
export { buildJourney } from "./journey-builder.mjs";
```

- [ ] **Step 2: Verify full test suite still passes**

```
node --test
```

Expected: all existing tests pass, 0 new failures

- [ ] **Step 3: Commit**

```bash
git add scripts/lib/ux-validation/index.mjs
git commit -m "feat(ux-validation): export buildJourney from index"
```

---

## Task 4: `qa-adapter.mjs` — `scenario_chain` param

**Files:**
- Modify: `scripts/lib/ux-validation/qa-adapter.mjs`
- Modify: `tests/journey-builder.test.mjs` (add qa-adapter tests)

- [ ] **Step 1: Add qa-adapter tests to the test file**

Append to `tests/journey-builder.test.mjs`:

```js
import { buildQaInvocation } from "../scripts/lib/ux-validation/qa-adapter.mjs";

test("buildQaInvocation with scenario_chain uses chain as scenarios", () => {
  const chain = [
    { step: 1, verb: "navigate", target: "/app", expect: "page loads", ac_id: "AC-1" }
  ];
  const cmd = buildQaInvocation({
    url: "http://localhost:3000",
    scenarios: [],
    baselineDir: "tests/baselines",
    outputPath: "/tmp/out.json",
    scenario_chain: chain
  });
  assert.ok(cmd.includes('"verb":"navigate"'), `expected chain in cmd, got: ${cmd}`);
});

test("buildQaInvocation without scenario_chain uses scenarios (backward compat)", () => {
  const scenarios = [{ id: "AC-1", verb: "click", target: "button" }];
  const cmd = buildQaInvocation({
    url: "http://localhost:3000",
    scenarios,
    baselineDir: "tests/baselines",
    outputPath: "/tmp/out.json"
  });
  assert.ok(cmd.includes('"id":"AC-1"'), `expected scenarios in cmd, got: ${cmd}`);
  assert.ok(!cmd.includes('"verb":"navigate"'));
});
```

- [ ] **Step 2: Run new tests to verify they fail**

```
node --test tests/journey-builder.test.mjs
```

Expected: 2 new tests fail

- [ ] **Step 3: Update `buildQaInvocation` in qa-adapter.mjs**

Replace the entire file content:

```js
// Build the gstack /qa CLI invocation string for the UX validation gate.
// Returns the literal command string the skill will run via Bash. The
// validator never writes the output file — /qa (as subprocess) does.
// When scenario_chain is provided it is used in place of scenarios (journey mode).

/**
 * @param {{
 *   url: string,
 *   scenarios: Array<Record<string, unknown>>,
 *   baselineDir: string,
 *   outputPath: string,
 *   scenario_chain?: Array<{step: number, verb: string, target: string, expect: string, ac_id: string | null}>
 * }} params
 * @returns {string}
 */
export function buildQaInvocation({ url, scenarios, baselineDir, outputPath, scenario_chain }) {
  const effectiveScenarios = scenario_chain ?? scenarios;
  const scenariosJson = JSON.stringify(effectiveScenarios).replace(/'/g, "'\\''");
  return [
    "gstack:/qa",
    `--url ${url}`,
    `--scenarios '${scenariosJson}'`,
    "--accessibility-scan",
    "--capture-console",
    "--capture-network",
    `--visual-baseline ${baselineDir}`,
    `--output ${outputPath}`
  ].join(" \\\n  ");
}
```

- [ ] **Step 4: Run all tests**

```
node --test tests/journey-builder.test.mjs
```

Expected: 12 pass, 0 fail

- [ ] **Step 5: Run full suite**

```
node --test
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/ux-validation/qa-adapter.mjs tests/journey-builder.test.mjs
git commit -m "feat(ux-validation): qa-adapter scenario_chain param for journey mode"
```

---

## Task 5: `skills/workflow/journey-builder/SKILL.md`

**Files:**
- Create: `skills/workflow/journey-builder/SKILL.md`

- [ ] **Step 1: Create the skill file**

```markdown
---
name: journey-builder
tier: workflow
description: Builds an ordered scenario_chain for ux-validation journey mode. Checks slice file for ## User Journey override; falls back to sorting ACs by verb category (nav → input → action → assertion). Returns [] when < 2 steps derivable. Reusable for future full-feature regression by feeding multiple slices' ACs.
triggers: ["ux-validation Step 2.5", "surface:ui regression", "end-to-end journey validation"]
owner: validator
last_reviewed: 2026-06-05
source_version: "0.10.0"
---

# Journey Builder

Sub-skill invoked by `ux-validation` at Step 2.5. Produces an ordered
`scenario_chain` for a single-slice end-to-end journey run via gstack `/qa`.

## When to use

Invoked by `ux-validation` when `surface:ui`, `concern:ux`, or
`concern:accessibility` is in the slice's FEAT tags AND the validator
wants journey-mode evidence instead of per-AC parallel checks.

Call directly for future regression testing by passing all slices' ACs
for a feature.

## Input

```js
buildJourney(acs, sliceContent)
```

- `acs` — `Array<{id: string, text: string}>` from `extractACs(sliceContent)`
- `sliceContent` — full raw text of the slice file

## Output

`ScenarioStep[]`:

```js
[{ step: 1, verb: "navigate", target: "/dashboard", expect: "no error / visible", ac_id: "AC-1" }]
```

Returns `[]` when fewer than 2 steps can be derived (caller falls back to per-AC mode).

## Override format — `## User Journey` in slice file

```markdown
## User Journey

1. navigate to /dashboard
2. click "New Project" button
3. fill form: name=Test → expect: form validates
4. click "Create" → expect: project card appears
```

Rules:
- Each line: `N. verb target` or `N. verb target → expect: <text>`
- `expect` optional; defaults to `no error / visible`
- Unparseable lines silently skipped
- Section ends at next `##` header

## Auto-derive ordering (no override)

ACs sorted by verb category: `navigation (0) → input (1) → interaction (2) → visibility (3)`
Ties broken by document order. Non-UI ACs excluded.

## Implementation

`scripts/lib/ux-validation/journey-builder.mjs` — `buildJourney(acs, sliceContent)`
```

- [ ] **Step 2: Validate skill file**

```
node ./scripts/validate-skills.mjs
```

Expected: all skills OK, 0 errors

- [ ] **Step 3: Commit**

```bash
git add skills/workflow/journey-builder/SKILL.md
git commit -m "feat(skills): add journey-builder workflow sub-skill"
```

---

## Task 6: Update `ux-validation` SKILL.md — add Step 2.5

**Files:**
- Modify: `skills/workflow/ux-validation/SKILL.md`

- [ ] **Step 1: Locate Step 2 and Step 3 in the skill file**

Open `skills/workflow/ux-validation/SKILL.md`. Find:

```
2. **Classify + translate scenarios.**
```

and:

```
3. **Discover the consumer-repo Playwright URL.**
```

- [ ] **Step 2: Insert Step 2.5 between them**

After the paragraph ending Step 2 (the `{id, verb, target, expect}` sentence), insert:

```markdown
2.5. **Build journey.** Call `buildJourney(acs, sliceContent)` from
   `scripts/lib/ux-validation/journey-builder.mjs`. If the result is
   `[]` (< 2 steps or no UI ACs), skip journey mode and proceed with
   the existing per-AC `scenarios` list from Step 2. Otherwise store
   the result as `scenario_chain` and pass it to `buildQaInvocation`
   at Step 4 in place of `scenarios`.
```

- [ ] **Step 3: Update Step 4 to reference `scenario_chain`**

Find in Step 4:

```
   - `scenarios`: from step 2 (UI ACs only)
```

Replace with:

```
   - `scenarios`: from step 2 (UI ACs only) — used when journey mode is inactive
   - `scenario_chain`: from step 2.5 (ordered journey steps) — when present, passed to `buildQaInvocation` instead of `scenarios`
```

- [ ] **Step 4: Validate skills and agents**

```
node ./scripts/validate-skills.mjs && node ./scripts/validate-agents.mjs
```

Expected: all OK

- [ ] **Step 5: Commit**

```bash
git add skills/workflow/ux-validation/SKILL.md
git commit -m "feat(skills): ux-validation Step 2.5 — journey-builder integration"
```

---

## Task 7: Final gates

- [ ] **Step 1: Full test suite**

```
node --test
```

Expected: all tests pass, 0 fail

- [ ] **Step 2: Lint**

```
npm run lint
```

Expected: exit 0, 0 warnings

- [ ] **Step 3: Format check**

```
npm run format:check
```

If it fails, run `npm run format` then re-run. Expected: exit 0

- [ ] **Step 4: Validate skills + agents**

```
node ./scripts/validate-skills.mjs && node ./scripts/validate-agents.mjs
```

Expected: all OK

- [ ] **Step 5: Typecheck**

```
npm run typecheck
```

Expected: exit 0

- [ ] **Step 6: Final commit if any format fixes applied**

```bash
git add -A
git commit -m "chore: format fixes after journey-builder implementation"
```

Only needed if format auto-fixed anything.
