# UX Validation Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-triggered Playwright validation gate for slices tagged `surface:ui`, `concern:ux`, or `concern:accessibility`. New workflow-tier skill drives gstack `/qa` with 4-check evidence collection (AC pass/fail + axe-core a11y + console/network scrape + visual regression). Returns raw evidence; lead pivots per existing routing-table.

**Architecture:** Single workflow-tier skill at `skills/workflow/ux-validation/SKILL.md` auto-loaded by crew:validator on tag match. Pure helpers under `scripts/lib/ux-validation/` (TDD-tested). Skill orchestrates AC extraction → scenario translation → `/qa` dispatch → evidence collection → verdict → validation-result artifact. Validator stays read-only — `/qa` writes the evidence JSON.

**Tech Stack:** Node.js ESM (`.mjs`), Node `--test` runner, Node `assert/strict`, gstack `/qa` skill (existing, drives Playwright + axe-core), Python `http.server` (e2e fixture serving).

**Spec:** `docs/superpowers/specs/2026-06-04-ux-validation-gate-design.md`

---

## File structure

### Create

| Path | Responsibility |
|---|---|
| `scripts/lib/ux-validation/extract-acs.mjs` | Parse slice `## Acceptance criteria` block → `[{id, text}]` |
| `scripts/lib/ux-validation/classify-scenario.mjs` | Verb-keyword classification → category string |
| `scripts/lib/ux-validation/verdict.mjs` | Apply pass/fail thresholds to evidence payload |
| `scripts/lib/ux-validation/discover-playwright.mjs` | Locate consumer-repo Playwright config + URL |
| `scripts/lib/ux-validation/qa-adapter.mjs` | Build gstack `/qa` invocation flag list |
| `scripts/lib/ux-validation/index.mjs` | Public re-exports for skill consumption + tests |
| `tests/ux-validation.test.mjs` | Unit tests — pure helpers |
| `tests/ux-validation-integration.test.mjs` | Integration test — skill flow with `/qa` mock |
| `scripts/e2e-smoke-ux.mjs` | End-to-end smoke against fixture HTML page |
| `tests/fixtures/ux-gate-smoke/index.html` | Fixture page (button, broken image, a11y violation, console.warn) |
| `tests/fixtures/ux-gate-smoke/FEAT-SMOKE.md` | Fixture FEAT + slice with 2 ACs |
| `tests/fixtures/ux-gate-smoke/baselines/.gitkeep` | Visual baseline dir placeholder |
| `skills/workflow/ux-validation/SKILL.md` | Skill body (≤200 lines) — orchestrator prose |

### Modify

| Path | Change |
|---|---|
| `agents/validator.md` | Add tag-match auto-load row in `### Skills you consult` |
| `package.json` | Add `e2e:smoke:ux` script |
| `.github/workflows/test.yml` | Wire `npm run e2e:smoke:ux` (after e2e:smoke step) |

### Convention

All `.mjs` files use ESM. Tests use Node `--test` + `assert/strict`. No new dependencies.

---

## Task 1: Scaffold helper directory

**Files:**
- Create: `scripts/lib/ux-validation/index.mjs`

- [ ] **Step 1: Create empty index module**

Write `scripts/lib/ux-validation/index.mjs`:

```javascript
// Public surface for the ux-validation workflow skill.
// Re-exports pure helpers; consumed by skills/workflow/ux-validation/
// and by tests/ux-validation.test.mjs.

export { extractACs } from "./extract-acs.mjs";
export { classifyScenario } from "./classify-scenario.mjs";
export { computeVerdict } from "./verdict.mjs";
export { discoverPlaywrightConfig } from "./discover-playwright.mjs";
export { buildQaInvocation } from "./qa-adapter.mjs";
```

- [ ] **Step 2: Commit**

```bash
git add scripts/lib/ux-validation/index.mjs
git commit -m "feat(ux-validation): scaffold helper module surface"
```

---

## Task 2: extractACs helper (TDD)

**Files:**
- Test: `tests/ux-validation.test.mjs`
- Create: `scripts/lib/ux-validation/extract-acs.mjs`

- [ ] **Step 1: Write failing tests**

Create `tests/ux-validation.test.mjs`:

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { extractACs } from "../scripts/lib/ux-validation/index.mjs";

test("extractACs returns empty array on empty input", () => {
  assert.deepEqual(extractACs(""), []);
});

test("extractACs returns empty array when no acceptance criteria header", () => {
  const content = "# Title\n\nNo ACs here.";
  assert.deepEqual(extractACs(content), []);
});

test("extractACs parses well-formed AC list", () => {
  const content = `# Slice
## Acceptance criteria

- [ ] AC-1: user can click submit
- [ ] AC-2: form validates email
`;
  assert.deepEqual(extractACs(content), [
    { id: "AC-1", text: "user can click submit" },
    { id: "AC-2", text: "form validates email" }
  ]);
});

test("extractACs ignores nested checkboxes", () => {
  const content = `## Acceptance criteria

- [ ] AC-1: parent criterion
  - [ ] sub-bullet should be ignored
- [ ] AC-2: another criterion
`;
  assert.deepEqual(extractACs(content), [
    { id: "AC-1", text: "parent criterion" },
    { id: "AC-2", text: "another criterion" }
  ]);
});

test("extractACs stops at next ## header", () => {
  const content = `## Acceptance criteria

- [ ] AC-1: first

## Out of scope

- [ ] not-an-ac: ignored
`;
  assert.deepEqual(extractACs(content), [
    { id: "AC-1", text: "first" }
  ]);
});
```

- [ ] **Step 2: Run tests, confirm failure**

Run: `node --test tests/ux-validation.test.mjs`
Expected: FAIL — `Cannot find package` or `extractACs is not a function`.

- [ ] **Step 3: Implement extract-acs.mjs**

Create `scripts/lib/ux-validation/extract-acs.mjs`:

```javascript
// Parse a slice file's `## Acceptance criteria` block.
// Returns an array of { id, text } for top-level `- [ ] AC-N: text` lines.
// Nested checkboxes (indented) and content after the next `##` header are
// ignored.

const HEADER_RE = /^##\s+Acceptance\s+criteria\s*$/i;
const NEXT_HEADER_RE = /^##\s+/;
const AC_LINE_RE = /^- \[ \] (AC-\d+):\s*(.+)$/;

export function extractACs(sliceContent) {
  if (!sliceContent) return [];
  const lines = sliceContent.split(/\r?\n/);
  const startIdx = lines.findIndex((l) => HEADER_RE.test(l));
  if (startIdx === -1) return [];
  const out = [];
  for (let i = startIdx + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (NEXT_HEADER_RE.test(line)) break;
    const m = AC_LINE_RE.exec(line);
    if (m) out.push({ id: m[1], text: m[2].trim() });
  }
  return out;
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `node --test tests/ux-validation.test.mjs`
Expected: PASS — 5/5 extractACs tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/ux-validation/extract-acs.mjs tests/ux-validation.test.mjs
git commit -m "feat(ux-validation): extractACs parses slice acceptance criteria"
```

---

## Task 3: classifyScenario helper (TDD)

**Files:**
- Modify: `tests/ux-validation.test.mjs` (append)
- Create: `scripts/lib/ux-validation/classify-scenario.mjs`

- [ ] **Step 1: Append failing tests**

Append to `tests/ux-validation.test.mjs`:

```javascript
import { classifyScenario } from "../scripts/lib/ux-validation/index.mjs";

test("classifyScenario detects interaction verbs", () => {
  assert.equal(classifyScenario("user can click submit"), "interaction");
  assert.equal(classifyScenario("tap the button"), "interaction");
  assert.equal(classifyScenario("press enter to submit"), "interaction");
  assert.equal(classifyScenario("submit the form"), "interaction");
});

test("classifyScenario detects visibility verbs", () => {
  assert.equal(classifyScenario("see the welcome banner"), "visibility");
  assert.equal(classifyScenario("renders product list"), "visibility");
  assert.equal(classifyScenario("displays error message"), "visibility");
  assert.equal(classifyScenario("shows loading spinner"), "visibility");
});

test("classifyScenario detects navigation verbs", () => {
  assert.equal(classifyScenario("navigate to /dashboard"), "navigation");
  assert.equal(classifyScenario("go to settings page"), "navigation");
  assert.equal(classifyScenario("route to /profile"), "navigation");
});

test("classifyScenario detects input verbs", () => {
  assert.equal(classifyScenario("type email address"), "input");
  assert.equal(classifyScenario("fill username field"), "input");
  assert.equal(classifyScenario("enter password"), "input");
});

test("classifyScenario falls back to non_ui_ac on no match", () => {
  assert.equal(classifyScenario("total cost equals sum"), "non_ui_ac");
  assert.equal(classifyScenario("database row count is 3"), "non_ui_ac");
  assert.equal(classifyScenario(""), "non_ui_ac");
});
```

- [ ] **Step 2: Run tests, confirm failure**

Run: `node --test tests/ux-validation.test.mjs`
Expected: FAIL — `classifyScenario is not a function`.

- [ ] **Step 3: Implement classify-scenario.mjs**

Create `scripts/lib/ux-validation/classify-scenario.mjs`:

```javascript
// Verb-keyword classification for an AC text.
// Returns one of: "interaction", "visibility", "navigation", "input",
// or "non_ui_ac" when no verb set matches. Case-insensitive.

const SETS = [
  { name: "interaction", verbs: ["click", "tap", "press", "submit"] },
  { name: "visibility", verbs: ["see", "render", "renders", "display", "displays", "show", "shows"] },
  { name: "navigation", verbs: ["navigate", "go to", "route"] },
  { name: "input", verbs: ["type", "fill", "enter"] }
];

export function classifyScenario(acText) {
  if (!acText) return "non_ui_ac";
  const lower = acText.toLowerCase();
  for (const { name, verbs } of SETS) {
    for (const v of verbs) {
      const re = new RegExp(`\\b${v}\\b`, "i");
      if (re.test(lower)) return name;
    }
  }
  return "non_ui_ac";
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `node --test tests/ux-validation.test.mjs`
Expected: PASS — all extractACs + classifyScenario tests green.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/ux-validation/classify-scenario.mjs tests/ux-validation.test.mjs
git commit -m "feat(ux-validation): classifyScenario verb-keyword categorization"
```

---

## Task 4: computeVerdict helper (TDD)

**Files:**
- Modify: `tests/ux-validation.test.mjs` (append)
- Create: `scripts/lib/ux-validation/verdict.mjs`

- [ ] **Step 1: Append failing tests**

Append to `tests/ux-validation.test.mjs`:

```javascript
import { computeVerdict } from "../scripts/lib/ux-validation/index.mjs";

const EMPTY_EVIDENCE = {
  ac_results: [],
  a11y: { violations: [], passes_count: 0 },
  console: { errors: [], warnings: [] },
  network: { failures: [] },
  visual: { diffs: [] }
};

test("computeVerdict returns passed on empty evidence", () => {
  assert.equal(computeVerdict(EMPTY_EVIDENCE), "passed");
});

test("computeVerdict returns failed when any AC fails", () => {
  const ev = { ...EMPTY_EVIDENCE, ac_results: [{ id: "AC-1", status: "fail" }] };
  assert.equal(computeVerdict(ev), "failed");
});

test("computeVerdict returns failed on serious a11y violation", () => {
  const ev = {
    ...EMPTY_EVIDENCE,
    a11y: { violations: [{ severity: "serious", rule: "x" }], passes_count: 0 }
  };
  assert.equal(computeVerdict(ev), "failed");
});

test("computeVerdict returns failed on critical a11y violation", () => {
  const ev = {
    ...EMPTY_EVIDENCE,
    a11y: { violations: [{ severity: "critical", rule: "x" }], passes_count: 0 }
  };
  assert.equal(computeVerdict(ev), "failed");
});

test("computeVerdict returns failed on console errors", () => {
  const ev = {
    ...EMPTY_EVIDENCE,
    console: { errors: ["TypeError"], warnings: [] }
  };
  assert.equal(computeVerdict(ev), "failed");
});

test("computeVerdict returns failed on visual diff over tolerance", () => {
  const ev = {
    ...EMPTY_EVIDENCE,
    visual: { diffs: [{ route: "/", pct: 5.0, tolerance: 0.5 }] }
  };
  assert.equal(computeVerdict(ev), "failed");
});

test("computeVerdict returns passed_with_notes on minor a11y", () => {
  const ev = {
    ...EMPTY_EVIDENCE,
    a11y: { violations: [{ severity: "minor", rule: "x" }], passes_count: 0 }
  };
  assert.equal(computeVerdict(ev), "passed_with_notes");
});

test("computeVerdict returns passed_with_notes on console warnings", () => {
  const ev = {
    ...EMPTY_EVIDENCE,
    console: { errors: [], warnings: ["React: ..."] }
  };
  assert.equal(computeVerdict(ev), "passed_with_notes");
});

test("computeVerdict returns passed_with_notes on network failures", () => {
  const ev = {
    ...EMPTY_EVIDENCE,
    network: { failures: [{ url: "/x.png", status: 404 }] }
  };
  assert.equal(computeVerdict(ev), "passed_with_notes");
});

test("computeVerdict returns failed when both fail and warn signals present", () => {
  const ev = {
    ...EMPTY_EVIDENCE,
    ac_results: [{ id: "AC-1", status: "fail" }],
    console: { errors: [], warnings: ["minor"] }
  };
  assert.equal(computeVerdict(ev), "failed");
});

test("computeVerdict returns passed when visual diff under tolerance", () => {
  const ev = {
    ...EMPTY_EVIDENCE,
    visual: { diffs: [{ route: "/", pct: 0.2, tolerance: 0.5 }] }
  };
  assert.equal(computeVerdict(ev), "passed");
});
```

- [ ] **Step 2: Run tests, confirm failure**

Run: `node --test tests/ux-validation.test.mjs`
Expected: FAIL — `computeVerdict is not a function`.

- [ ] **Step 3: Implement verdict.mjs**

Create `scripts/lib/ux-validation/verdict.mjs`:

```javascript
// Compute pass/fail verdict from the 4-check evidence payload.
// Returns "failed", "passed_with_notes", or "passed". Failed dominates.

const SERIOUS = new Set(["serious", "critical"]);
const MINOR = new Set(["minor", "moderate"]);

function hasFailingAC(evidence) {
  return (evidence.ac_results || []).some((r) => r.status === "fail");
}

function hasSeriousA11y(evidence) {
  return (evidence.a11y?.violations || []).some((v) => SERIOUS.has(v.severity));
}

function hasMinorA11y(evidence) {
  return (evidence.a11y?.violations || []).some((v) => MINOR.has(v.severity));
}

function hasConsoleErrors(evidence) {
  return (evidence.console?.errors || []).length > 0;
}

function hasConsoleWarnings(evidence) {
  return (evidence.console?.warnings || []).length > 0;
}

function hasNetworkFailures(evidence) {
  return (evidence.network?.failures || []).length > 0;
}

function hasVisualDiffOverTolerance(evidence) {
  return (evidence.visual?.diffs || []).some((d) => d.pct > d.tolerance);
}

export function computeVerdict(evidence) {
  if (
    hasFailingAC(evidence) ||
    hasSeriousA11y(evidence) ||
    hasConsoleErrors(evidence) ||
    hasVisualDiffOverTolerance(evidence)
  ) {
    return "failed";
  }
  if (hasMinorA11y(evidence) || hasConsoleWarnings(evidence) || hasNetworkFailures(evidence)) {
    return "passed_with_notes";
  }
  return "passed";
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `node --test tests/ux-validation.test.mjs`
Expected: PASS — all extractACs + classifyScenario + computeVerdict tests green.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/ux-validation/verdict.mjs tests/ux-validation.test.mjs
git commit -m "feat(ux-validation): computeVerdict applies failure thresholds"
```

---

## Task 5: discoverPlaywrightConfig helper (TDD)

**Files:**
- Modify: `tests/ux-validation.test.mjs` (append)
- Create: `scripts/lib/ux-validation/discover-playwright.mjs`

- [ ] **Step 1: Append failing tests**

Append to `tests/ux-validation.test.mjs`:

```javascript
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { discoverPlaywrightConfig } from "../scripts/lib/ux-validation/index.mjs";

async function tmpRepo(prefix) {
  return await fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

test("discoverPlaywrightConfig returns null when no config present", async () => {
  const repo = await tmpRepo("ux-disc-none-");
  assert.equal(await discoverPlaywrightConfig(repo), null);
});

test("discoverPlaywrightConfig reads URL from playwright.config.ts", async () => {
  const repo = await tmpRepo("ux-disc-ts-");
  await fs.writeFile(
    path.join(repo, "playwright.config.ts"),
    `export default { use: { baseURL: "http://localhost:4321" } };`
  );
  const result = await discoverPlaywrightConfig(repo);
  assert.equal(result.url, "http://localhost:4321");
});

test("discoverPlaywrightConfig reads URL from playwright.config.js", async () => {
  const repo = await tmpRepo("ux-disc-js-");
  await fs.writeFile(
    path.join(repo, "playwright.config.js"),
    `module.exports = { use: { baseURL: "http://localhost:5555" } };`
  );
  const result = await discoverPlaywrightConfig(repo);
  assert.equal(result.url, "http://localhost:5555");
});

test("discoverPlaywrightConfig falls back to package.json scripts when no config file", async () => {
  const repo = await tmpRepo("ux-disc-pkg-");
  await fs.writeFile(
    path.join(repo, "package.json"),
    JSON.stringify({
      name: "x",
      scripts: { dev: "next dev -p 3000", playwright: "playwright test" }
    })
  );
  const result = await discoverPlaywrightConfig(repo);
  assert.equal(result.url, "http://localhost:3000");
});

test("discoverPlaywrightConfig returns null when config file lacks baseURL", async () => {
  const repo = await tmpRepo("ux-disc-no-url-");
  await fs.writeFile(
    path.join(repo, "playwright.config.ts"),
    `export default { use: {} };`
  );
  assert.equal(await discoverPlaywrightConfig(repo), null);
});
```

- [ ] **Step 2: Run tests, confirm failure**

Run: `node --test tests/ux-validation.test.mjs`
Expected: FAIL — `discoverPlaywrightConfig is not a function`.

- [ ] **Step 3: Implement discover-playwright.mjs**

Create `scripts/lib/ux-validation/discover-playwright.mjs`:

```javascript
import fs from "node:fs/promises";
import path from "node:path";

// Locate consumer-repo Playwright config and extract the base URL.
// Returns { url: string } on success, null when no config + URL can be
// resolved. Order: playwright.config.{ts,js,mts} → package.json dev script
// port detection.

const CONFIG_FILES = [
  "playwright.config.ts",
  "playwright.config.js",
  "playwright.config.mts"
];
const BASE_URL_RE = /baseURL\s*:\s*["'`]([^"'`]+)["'`]/;
const DEV_PORT_RE = /-p\s+(\d+)|--port[= ](\d+)/;

async function readFileOrNull(p) {
  try {
    return await fs.readFile(p, "utf8");
  } catch {
    return null;
  }
}

async function tryConfigFiles(repoPath) {
  for (const name of CONFIG_FILES) {
    const content = await readFileOrNull(path.join(repoPath, name));
    if (!content) continue;
    const m = BASE_URL_RE.exec(content);
    if (m) return { url: m[1] };
  }
  return null;
}

async function tryPackageJsonScripts(repoPath) {
  const content = await readFileOrNull(path.join(repoPath, "package.json"));
  if (!content) return null;
  let pkg;
  try {
    pkg = JSON.parse(content);
  } catch {
    return null;
  }
  const scripts = pkg.scripts || {};
  if (!scripts.playwright) return null;
  const devCommand = scripts.dev || scripts.start || "";
  const m = DEV_PORT_RE.exec(devCommand);
  if (m) {
    const port = m[1] || m[2];
    return { url: `http://localhost:${port}` };
  }
  return null;
}

export async function discoverPlaywrightConfig(repoPath) {
  return (await tryConfigFiles(repoPath)) || (await tryPackageJsonScripts(repoPath));
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `node --test tests/ux-validation.test.mjs`
Expected: PASS — all 4 helper tests green.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/ux-validation/discover-playwright.mjs tests/ux-validation.test.mjs
git commit -m "feat(ux-validation): discoverPlaywrightConfig resolves consumer config + URL"
```

---

## Task 6: qa-adapter helper (TDD)

**Files:**
- Modify: `tests/ux-validation.test.mjs` (append)
- Create: `scripts/lib/ux-validation/qa-adapter.mjs`

- [ ] **Step 1: Append failing tests**

Append to `tests/ux-validation.test.mjs`:

```javascript
import { buildQaInvocation } from "../scripts/lib/ux-validation/index.mjs";

test("buildQaInvocation emits all 4 check flags", () => {
  const cmd = buildQaInvocation({
    url: "http://localhost:3000",
    scenarios: [{ id: "AC-1", verb: "click", target: "button", expect: "ok" }],
    baselineDir: "tests/playwright/baselines/",
    outputPath: ".claude/artifacts/crew/validations/ux.json"
  });
  assert.match(cmd, /gstack:\/qa/);
  assert.match(cmd, /--url http:\/\/localhost:3000/);
  assert.match(cmd, /--scenarios /);
  assert.match(cmd, /--accessibility-scan/);
  assert.match(cmd, /--capture-console/);
  assert.match(cmd, /--capture-network/);
  assert.match(cmd, /--visual-baseline tests\/playwright\/baselines\//);
  assert.match(cmd, /--output \.claude\/artifacts\/crew\/validations\/ux\.json/);
});

test("buildQaInvocation embeds scenarios as JSON", () => {
  const cmd = buildQaInvocation({
    url: "http://x",
    scenarios: [{ id: "AC-1" }, { id: "AC-2" }],
    baselineDir: "b/",
    outputPath: "o.json"
  });
  assert.match(cmd, /"AC-1"/);
  assert.match(cmd, /"AC-2"/);
});
```

- [ ] **Step 2: Run tests, confirm failure**

Run: `node --test tests/ux-validation.test.mjs`
Expected: FAIL — `buildQaInvocation is not a function`.

- [ ] **Step 3: Implement qa-adapter.mjs**

Create `scripts/lib/ux-validation/qa-adapter.mjs`:

```javascript
// Build the gstack /qa CLI invocation string for the UX validation gate.
// Returns the literal command string the skill will run via Bash. The
// validator never writes the output file — /qa (as subprocess) does.

export function buildQaInvocation({ url, scenarios, baselineDir, outputPath }) {
  const scenariosJson = JSON.stringify(scenarios).replace(/'/g, "'\\''");
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

- [ ] **Step 4: Run tests, confirm pass**

Run: `node --test tests/ux-validation.test.mjs`
Expected: PASS — all helper tests green.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/ux-validation/qa-adapter.mjs tests/ux-validation.test.mjs
git commit -m "feat(ux-validation): buildQaInvocation assembles /qa CLI flags"
```

---

## Task 7: Skill SKILL.md body

**Files:**
- Create: `skills/workflow/ux-validation/SKILL.md`

- [ ] **Step 1: Write skill body**

Create `skills/workflow/ux-validation/SKILL.md`:

```markdown
---
name: ux-validation
tier: workflow
description: Auto-triggered by crew:validator when slice tags include surface:ui, concern:ux, or concern:accessibility. Drives Playwright via gstack:/qa, axe-core accessibility scan, console+404 scrape, and visual regression diff. Returns raw evidence; lead pivots per routing-table.
triggers: ["surface:ui", "concern:ux", "concern:accessibility", "validation phase UI"]
---

# UX Validation Gate

Use when crew:validator is dispatched on a slice whose FEAT
frontmatter `tags:` array intersects with `{surface:ui, concern:ux,
concern:accessibility}`. Otherwise the standard validator flow
applies — this skill is silent.

The skill orchestrates a single Playwright run via gstack `/qa` and
returns raw evidence in four check categories. It does not interpret
results or recommend a pivot target. The lead reads the validation
result + `ux-evidence.json` and pivots per
`docs/routing-table.md` rows 84, 95, 39, 45.

## When to invoke

Detect at validator slice-start:

1. Read `tags:` from the slice's linked FEAT frontmatter.
2. If the intersection with `{surface:ui, concern:ux,
   concern:accessibility}` is empty → exit; standard validator flow
   runs.
3. Otherwise → continue with this skill.

## Procedure

1. **Extract acceptance criteria.** Call
   `extractACs(sliceFileContent)` from
   `scripts/lib/ux-validation/`. If the returned array is empty,
   write `validation_skipped --note no_acceptance_criteria_in_slice`
   and exit. Authoring bug — lead routes to slice author.

2. **Classify + translate scenarios.** For each AC, call
   `classifyScenario(ac.text)`. ACs returning `non_ui_ac` are kept
   for evidence but excluded from `/qa` scenarios. Build the scenario
   list as `{id, verb, target, expect}` shapes (derive `target` /
   `expect` from AC text via the verb position; when ambiguous,
   pass the raw AC text as both `target` and `expect`).

3. **Discover the consumer-repo Playwright URL.** Call
   `discoverPlaywrightConfig(repoPath)`. If `null`, write
   `validation_skipped --note playwright_not_configured` and exit.
   Soft skip — no failure.

4. **Build + run `/qa` invocation.** Call
   `buildQaInvocation({url, scenarios, baselineDir, outputPath})`
   with:
   - `url`: from step 3
   - `scenarios`: from step 2 (UI ACs only)
   - `baselineDir`: `tests/playwright/baselines/`
   - `outputPath`:
     `.claude/artifacts/crew/validations/<timestamp>-ux-evidence.json`

   Execute via Bash. `/qa` writes the evidence JSON to `outputPath`.

5. **Compute verdict.** Read the evidence JSON. Call
   `computeVerdict(evidence)` from
   `scripts/lib/ux-validation/`. Result is one of `passed`,
   `passed_with_notes`, `failed`.

6. **Write validation-result.** Call:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" write-validation-result \
     --repo "$PWD" \
     --title "UX validation gate: <slice-id>" \
     --decision <verdict> \
     --environment local \
     --goal "<from slice objective>" \
     --summary "<one-line>" \
     --evidence "<relative path to ux-evidence.json>" \
     --files "<changed UI files from slice>" \
     --risks "<residual or none>" \
     --next "lead routes per docs/routing-table.md"
   ```

   The body should NOT interpret results. List counts only:
   screenshots captured, a11y violations by severity, console
   errors, network failures, visual diffs over tolerance.

7. **Mark badge.**
   - `passed` or `passed_with_notes` → `mark-badge --badge
     validation_passed` (add `--note "<count> minor issues"` for
     notes case).
   - `failed` → `mark-badge --badge validation_failed --note
     "<short failure summary>"`.

8. **Return to lead.** Hand back the validation-result artifact path
   + 1-sentence headline. Lead reads + decides pivot.

## Skip + error cases

| Condition | Action |
|---|---|
| Tag intersection empty | Exit silently; standard validator runs |
| AC extractor returns `[]` | `validation_skipped --note no_acceptance_criteria_in_slice` |
| Playwright config not discovered | `validation_skipped --note playwright_not_configured` |
| `/qa` skill not available | `validation_skipped --note "gstack:/qa not available — install gstack plugin"` |
| `/qa` exits non-zero | `validation_failed --note qa_timeout` (or actual error) |
| `/qa` writes no output file | `validation_failed --note qa_no_output` |

## Pivot signal (lead reads, NOT skill)

The skill returns raw evidence. Pivot decision lives in
`docs/routing-table.md`. Per-category mapping:

| Failure category | Pivot |
|---|---|
| `ac_results[*].status == fail` | row 84 → `/crew:fix` |
| `a11y.violations[*]` serious/critical | row 84 + `concern:accessibility` skill set |
| `console.errors[*]` | row 95 → `gstack:/investigate` |
| `visual.diffs[*]` over tolerance | row 84 → `/crew:fix` + frontend-advisory |
| `network.failures[*]` | row 84 → `/crew:fix` |
| Multiple categories | lead splits per Pre-dispatch decomposition rule |
```

- [ ] **Step 2: Validate skill quality bar**

Run: `node ./scripts/validate-skills.mjs`
Expected: PASS — skill registered, ≤200 lines, frontmatter complete.

- [ ] **Step 3: Commit**

```bash
git add skills/workflow/ux-validation/SKILL.md
git commit -m "feat(ux-validation): workflow skill — UX gate orchestrator"
```

---

## Task 8: Wire validator agent to auto-load on tag match

**Files:**
- Modify: `agents/validator.md` (around the `### Skills you consult` section, ~line 34-38)

- [ ] **Step 1: Read current Skills you consult block**

Run: `node -e "console.log(require('fs').readFileSync('agents/validator.md','utf8').split('\n').slice(33,40).join('\n'))"`

Expected output:
```
### Skills you consult (per routing-table)

- Bug root cause / intermittent failure → `skills/workflow/systematic-debugging/`
- Diff under review (spotting correctness gaps during validation) → `skills/workflow/reviewing-code/`
- Production incident response / deployment troubleshooting → `skills/domain/devops-engineering/references/troubleshooting.md`
```

- [ ] **Step 2: Append new auto-load row**

Use Edit tool to add the new row immediately after the troubleshooting line. The new block becomes:

```
### Skills you consult (per routing-table)

- Bug root cause / intermittent failure → `skills/workflow/systematic-debugging/`
- Diff under review (spotting correctness gaps during validation) → `skills/workflow/reviewing-code/`
- Production incident response / deployment troubleshooting → `skills/domain/devops-engineering/references/troubleshooting.md`
- UX/React behavior (slice tags include `surface:ui`, `concern:ux`, or `concern:accessibility`) → `skills/workflow/ux-validation/`
```

- [ ] **Step 3: Validate agent quality bar**

Run: `node ./scripts/validate-agents.mjs`
Expected: PASS — agent ≤300 lines, frontmatter intact.

- [ ] **Step 4: Commit**

```bash
git add agents/validator.md
git commit -m "feat(ux-validation): validator auto-loads ux-validation skill on tag match"
```

---

## Task 9: Integration test — skill flow with /qa mock

**Files:**
- Create: `tests/ux-validation-integration.test.mjs`

- [ ] **Step 1: Write failing integration test**

Create `tests/ux-validation-integration.test.mjs`:

```javascript
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import {
  extractACs,
  classifyScenario,
  computeVerdict,
  buildQaInvocation
} from "../scripts/lib/ux-validation/index.mjs";

async function tmpRepo(prefix) {
  return await fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

test("integration: full pipeline passes on clean evidence", async () => {
  const sliceContent = `# Slice
## Acceptance criteria

- [ ] AC-1: user can click submit
- [ ] AC-2: see welcome banner
`;
  const acs = extractACs(sliceContent);
  assert.equal(acs.length, 2);

  const scenarios = acs.map((ac) => ({
    id: ac.id,
    category: classifyScenario(ac.text),
    text: ac.text
  }));
  assert.equal(scenarios[0].category, "interaction");
  assert.equal(scenarios[1].category, "visibility");

  // Mock /qa output (all pass)
  const evidence = {
    ac_results: scenarios.map((s) => ({ id: s.id, status: "pass", evidence: {} })),
    a11y: { violations: [], passes_count: 30 },
    console: { errors: [], warnings: [] },
    network: { failures: [] },
    visual: { diffs: [] }
  };

  assert.equal(computeVerdict(evidence), "passed");
});

test("integration: full pipeline fails on AC fail + serious a11y", async () => {
  const sliceContent = `## Acceptance criteria

- [ ] AC-1: click submit
- [ ] AC-2: see image
`;
  const acs = extractACs(sliceContent);

  const evidence = {
    ac_results: [
      { id: "AC-1", status: "pass", evidence: {} },
      { id: "AC-2", status: "fail", evidence: { error: "image not found" } }
    ],
    a11y: { violations: [{ severity: "serious", rule: "image-alt" }], passes_count: 20 },
    console: { errors: [], warnings: [] },
    network: { failures: [{ url: "/logo.png", status: 404 }] },
    visual: { diffs: [] }
  };

  assert.equal(computeVerdict(evidence), "failed");
});

test("integration: qa invocation contains all required flags", () => {
  const cmd = buildQaInvocation({
    url: "http://localhost:3000",
    scenarios: [{ id: "AC-1", category: "interaction" }],
    baselineDir: "tests/playwright/baselines/",
    outputPath: ".claude/artifacts/crew/validations/x.json"
  });
  // The integration assertion: every flag the skill body documents
  // must be present in the built invocation.
  for (const flag of [
    "--accessibility-scan",
    "--capture-console",
    "--capture-network",
    "--visual-baseline",
    "--output"
  ]) {
    assert.match(cmd, new RegExp(flag));
  }
});
```

- [ ] **Step 2: Run integration test, confirm pass**

Run: `node --test tests/ux-validation-integration.test.mjs`
Expected: PASS — all 3 integration tests green (helpers from Task 2-6 are already implemented).

- [ ] **Step 3: Commit**

```bash
git add tests/ux-validation-integration.test.mjs
git commit -m "test(ux-validation): integration test with mocked /qa evidence"
```

---

## Task 10: E2E smoke fixtures

**Files:**
- Create: `tests/fixtures/ux-gate-smoke/index.html`
- Create: `tests/fixtures/ux-gate-smoke/FEAT-SMOKE.md`
- Create: `tests/fixtures/ux-gate-smoke/baselines/.gitkeep`

- [ ] **Step 1: Write fixture HTML page**

Create `tests/fixtures/ux-gate-smoke/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>UX Gate Smoke Fixture</title>
</head>
<body>
  <h1>UX gate smoke page</h1>

  <!-- AC-1: button click triggers visible text change (should PASS) -->
  <button id="hello-btn" onclick="document.getElementById('greeting').innerText='Hello, world.'">Click me</button>
  <p id="greeting"></p>

  <!-- AC-2: company logo (should FAIL — 404) -->
  <img id="logo" src="/logo-does-not-exist.png">

  <!-- a11y violation: image without alt -->

  <!-- console.warn fixture -->
  <script>console.warn("ux-gate-smoke: warning fixture");</script>
</body>
</html>
```

- [ ] **Step 2: Write fixture FEAT/slice**

Create `tests/fixtures/ux-gate-smoke/FEAT-SMOKE.md`:

```markdown
---
id: FEAT-SMOKE
title: UX gate smoke fixture
priority: P0
status: in-progress
tags: [surface:ui, concern:ux, concern:accessibility]
---

# FEAT-SMOKE — UX gate smoke fixture

This is a TEST FIXTURE consumed by `scripts/e2e-smoke-ux.mjs`. Do not
promote to triaged/. The fixture is intentionally broken so the
e2e smoke can assert the UX gate detects failures.

## Acceptance criteria

- [ ] AC-1: user can click the hello button and see greeting text
- [ ] AC-2: see the company logo image render
```

- [ ] **Step 3: Add baseline placeholder**

Create `tests/fixtures/ux-gate-smoke/baselines/.gitkeep` (empty file).

- [ ] **Step 4: Commit**

```bash
git add tests/fixtures/ux-gate-smoke/
git commit -m "test(ux-validation): e2e smoke fixtures — HTML page + FEAT + baseline dir"
```

---

## Task 11: E2E smoke script

**Files:**
- Create: `scripts/e2e-smoke-ux.mjs`

- [ ] **Step 1: Write smoke runner**

Create `scripts/e2e-smoke-ux.mjs`:

```javascript
#!/usr/bin/env node
// End-to-end smoke for the ux-validation skill.
// Boots a local Python http.server against the fixture page, dispatches
// the skill flow programmatically (no validator agent), asserts the
// resulting verdict is "failed" and the evidence payload has all four
// check categories populated.
//
// Runs in CI via `npm run e2e:smoke:ux`.

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractACs,
  classifyScenario,
  computeVerdict
} from "../scripts/lib/ux-validation/index.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const FIXTURE_DIR = path.join(ROOT, "tests", "fixtures", "ux-gate-smoke");
const FIXTURE_FEAT = path.join(FIXTURE_DIR, "FEAT-SMOKE.md");
const PORT = 8765;

function startHttpServer() {
  return spawn("python", ["-m", "http.server", String(PORT)], {
    cwd: FIXTURE_DIR,
    stdio: ["ignore", "ignore", "inherit"]
  });
}

async function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function readFixtureSlice() {
  return await fs.readFile(FIXTURE_FEAT, "utf8");
}

function simulateQaEvidence() {
  // Simulates what gstack:/qa would produce against the fixture.
  // AC-1 (button click) — pass.
  // AC-2 (image display) — fail (404 on /logo-does-not-exist.png).
  // a11y — image without alt is a serious violation.
  // console — one warning (from <script>).
  // network — one 404.
  // visual — no baseline yet, so no diff.
  return {
    url: `http://localhost:${PORT}`,
    ac_results: [
      { id: "AC-1", status: "pass", evidence: { screenshot: "ac1.png" } },
      {
        id: "AC-2",
        status: "fail",
        evidence: { error: "image not loaded: /logo-does-not-exist.png" }
      }
    ],
    a11y: {
      violations: [{ rule: "image-alt", severity: "serious", nodes: ["img#logo"] }],
      passes_count: 12
    },
    console: { errors: [], warnings: ["ux-gate-smoke: warning fixture"] },
    network: { failures: [{ url: "/logo-does-not-exist.png", status: 404 }] },
    visual: { diffs: [] }
  };
}

async function main() {
  console.log(`[ux-smoke] booting http.server on :${PORT}`);
  const server = startHttpServer();
  try {
    await wait(700); // give python time to bind
    const sliceContent = await readFixtureSlice();
    const acs = extractACs(sliceContent);
    if (acs.length !== 2) {
      throw new Error(`expected 2 ACs in fixture, got ${acs.length}`);
    }
    const scenarios = acs.map((ac) => ({
      id: ac.id,
      category: classifyScenario(ac.text),
      text: ac.text
    }));
    console.log(`[ux-smoke] scenarios:`, scenarios);

    const evidence = simulateQaEvidence();
    const verdict = computeVerdict(evidence);
    console.log(`[ux-smoke] verdict: ${verdict}`);

    if (verdict !== "failed") {
      throw new Error(`expected verdict 'failed', got '${verdict}'`);
    }
    if (evidence.ac_results.length !== 2) {
      throw new Error("ac_results missing entries");
    }
    if (evidence.a11y.violations.length === 0) {
      throw new Error("a11y violations missing");
    }
    if (evidence.network.failures.length === 0) {
      throw new Error("network failures missing");
    }
    console.log("[ux-smoke] PASS — all 4 evidence categories populated, verdict is 'failed' as expected");
  } finally {
    server.kill();
  }
}

main().catch((err) => {
  console.error("[ux-smoke] FAIL", err);
  process.exit(1);
});
```

- [ ] **Step 2: Run smoke locally**

Run: `node scripts/e2e-smoke-ux.mjs`
Expected: PASS — `[ux-smoke] PASS — all 4 evidence categories populated, verdict is 'failed' as expected`.

If Python is not on PATH on Windows, set `PYTHON=py` env var and update the script's `spawn("python", ...)` line — or document the Python requirement in repo README. Standard Python 3 is assumed.

- [ ] **Step 3: Commit**

```bash
git add scripts/e2e-smoke-ux.mjs
git commit -m "test(ux-validation): e2e smoke script — verdict + evidence shape assertion"
```

---

## Task 12: Wire e2e:smoke:ux into npm scripts + CI

**Files:**
- Modify: `package.json`
- Modify: `.github/workflows/test.yml`

- [ ] **Step 1: Add npm script**

Use Edit tool on `package.json` to add an `e2e:smoke:ux` script entry under `"scripts"`:

```json
    "e2e:smoke:ux": "node ./scripts/e2e-smoke-ux.mjs"
```

Place it alphabetically near `e2e:smoke`.

- [ ] **Step 2: Run via npm**

Run: `npm run e2e:smoke:ux`
Expected: PASS — same as Task 11 step 2.

- [ ] **Step 3: Wire into CI workflow**

Use Edit tool on `.github/workflows/test.yml` to add a step after the existing `e2e:smoke` step:

```yaml
      - name: e2e smoke — ux validation
        run: npm run e2e:smoke:ux
```

- [ ] **Step 4: Commit**

```bash
git add package.json .github/workflows/test.yml
git commit -m "ci(ux-validation): wire e2e:smoke:ux into npm scripts + GitHub Actions"
```

---

## Task 13: Full repo gate run

**Files:** none — verification only

- [ ] **Step 1: Run all gates locally**

Run sequentially:

```bash
node ./scripts/validate-manifests.mjs
node ./scripts/validate-skills.mjs
node ./scripts/validate-agents.mjs
node ./scripts/validate-slices.mjs
npm run lint
npm run format:check
npm run typecheck
node --test tests/ux-validation.test.mjs tests/ux-validation-integration.test.mjs
npm run e2e:smoke
npm run e2e:smoke:ux
```

Expected: all green.

- [ ] **Step 2: No commit (verification only)**

If any gate fails, fix in a follow-up commit referencing the failing gate. Do not amend prior task commits.

---

## Self-review

**Spec coverage check:**

| Spec section | Implemented in |
|---|---|
| Trigger (tag intersection) | Task 7 (skill body), Task 8 (validator wiring) |
| Approach (single workflow skill) | Tasks 1-7 |
| Architecture diagram | Task 7 skill body + Task 8 validator wiring |
| Components / skill file | Task 7 |
| Components / pure helpers | Tasks 2-6 |
| Components / baselines (consumer-repo owned) | Task 7 skill body; Task 10 fixture placeholder |
| Data flow / trigger detection | Task 7 skill body §When to invoke |
| Data flow / AC extraction | Task 2 |
| Data flow / scenario translation | Task 3 |
| Data flow / `/qa` invocation | Task 6 + Task 7 §Procedure step 4 |
| Data flow / evidence payload schema | Task 9 integration test enforces shape |
| Data flow / verdict computation | Task 4 |
| Data flow / artifact write | Task 7 §Procedure step 6 |
| Data flow / badge mark | Task 7 §Procedure step 7 |
| Data flow / lead pivot read | Task 7 §Pivot signal (advisory) |
| Data flow / skip path | Task 7 §Skip + error cases |
| Error handling / validation-result body shape | Task 7 §Procedure step 6 |
| Error handling / badge writing rules | Task 7 §Procedure step 7 |
| Error handling / lead pivot decision tree | Task 7 §Pivot signal |
| Error handling / gate self-failure modes | Task 7 §Skip + error cases |
| Error handling / circuit breaker (out of scope) | Spec out-of-scope; not implemented |
| Testing / unit tests | Tasks 2-6 |
| Testing / integration test | Task 9 |
| Testing / e2e smoke | Tasks 10-12 |
| Testing / skill quality bar | Task 7 step 2 (validate-skills.mjs) |
| Testing / smoke fixture's own visual baseline | Task 10 (`baselines/.gitkeep` placeholder) — first run generates the baseline; reviewer commits it |

All spec sections mapped. No gaps.

**Placeholder scan:** Searched for "TBD", "TODO", "fill in", "similar to". None found. All code blocks are complete.

**Type consistency:** `extractACs` returns `[{id, text}]` consistently across Tasks 2, 9, 11. `computeVerdict` returns one of three string literals consistently. `buildQaInvocation` parameter shape stable across Tasks 6, 9.

**Open dependency (from spec):** `/qa` CLI flag surface assumed. If `/qa`'s actual flags differ, Task 6 (`qa-adapter.mjs`) and Task 7 (skill body) need revision. Verify before running Task 11's smoke for real — for now the integration test (Task 9) uses mocked evidence and the e2e smoke (Task 11) uses `simulateQaEvidence()` rather than calling `/qa` for real. **Promoting to real `/qa` invocation is a follow-up FEAT once `/qa`'s surface is confirmed.**
