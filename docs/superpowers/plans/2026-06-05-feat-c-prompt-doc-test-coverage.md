# FEAT-C: Prompt & Doc Test Coverage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add structural keyword tests for all 5 agent prompts and an Implementation-reference consistency check in validate-skills.mjs so prompt/doc changes fail CI when key terms disappear.

**Architecture:** Two independent additions — (1) `tests/agent-prompt-content.test.mjs` reads each agent file and asserts required keywords exist using `node:test` + `node:assert/strict`, same pattern as `tests/architect-feature.test.mjs`; (2) a new `checkImplementationRef` function in `scripts/validate-skills.mjs` that parses the `## Implementation` section for a `.mjs` path + exported function name and warns when the export can't be found.

**Tech Stack:** Node.js ESM, `node:test`, `node:assert/strict`, `node:fs/promises`, `node:path`

---

## Pre-flight notes

- AC-3 (warn on absent `last_reviewed`) is **already implemented** in `validate-skills.mjs` line 104 — `checkRecommendedFields` warns on missing `last_reviewed`. No code change needed.
- AC-4 (negative classify-scenario tests) was **already added** in commit `895085f` this session — `classifyScenario does not over-match compound words` test covers showcase/clickable/pressing. No code change needed.
- Remaining work: AC-1 (agent keyword tests) + AC-2 (validate-skills Implementation ref check, part of FEAT-B spec but fits here as it touches validate-skills).

---

## File Structure

| File | Change |
|------|--------|
| `tests/agent-prompt-content.test.mjs` | CREATE — keyword assertions per agent |
| `scripts/validate-skills.mjs` | MODIFY lines ~100-170 — add `checkImplementationRef` |
| `tests/validate-skills-impl-ref.test.mjs` | CREATE — tests for the new implementation ref check |

---

### Task 1: Agent prompt keyword tests

**Files:**
- Create: `tests/agent-prompt-content.test.mjs`

These tests read each agent file and assert required keywords are present. If a future edit drops a key term, CI fails with a clear message.

- [ ] **Step 1: Write the test file**

```js
// tests/agent-prompt-content.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const A = (name) => path.join(repoRoot, "agents", name);

async function readAgent(name) {
  return fs.readFile(A(name), "utf8");
}

// builder.md
test("builder.md contains DONE_WITH_CONCERNS status", async () => {
  const t = await readAgent("builder.md");
  assert.ok(t.includes("DONE_WITH_CONCERNS"), "builder must document DONE_WITH_CONCERNS status");
});
test("builder.md contains write-handoff requirement", async () => {
  const t = await readAgent("builder.md");
  assert.ok(t.includes("write-handoff"), "builder must reference write-handoff artifact");
});
test("builder.md contains mark-badge blocked path", async () => {
  const t = await readAgent("builder.md");
  assert.ok(t.includes("mark-badge") && t.includes("blocked"), "builder must document mark-badge blocked");
});
test("builder.md contains validation_skipped badge", async () => {
  const t = await readAgent("builder.md");
  assert.ok(t.includes("validation_skipped"), "builder must document validation_skipped badge");
});
test("builder.md contains size: light gate", async () => {
  const t = await readAgent("builder.md");
  assert.ok(t.includes("size: light") || t.includes("size:light"), "builder must document size:light gate");
});

// reviewer.md
test("reviewer.md contains Test Adequacy field", async () => {
  const t = await readAgent("reviewer.md");
  assert.ok(t.includes("Test Adequacy"), "reviewer must reference Test Adequacy field");
});
test("reviewer.md contains needs_fix decision", async () => {
  const t = await readAgent("reviewer.md");
  assert.ok(t.includes("needs_fix"), "reviewer must document needs_fix decision");
});
test("reviewer.md contains write-review-result command", async () => {
  const t = await readAgent("reviewer.md");
  assert.ok(t.includes("write-review-result"), "reviewer must reference write-review-result");
});
test("reviewer.md contains mark-badge review_skipped path", async () => {
  const t = await readAgent("reviewer.md");
  assert.ok(t.includes("review_skipped"), "reviewer must document review_skipped badge");
});
test("reviewer.md contains write-handoff requirement", async () => {
  const t = await readAgent("reviewer.md");
  assert.ok(t.includes("write-handoff"), "reviewer must reference write-handoff");
});

// validator.md
test("validator.md contains validation_skipped badge", async () => {
  const t = await readAgent("validator.md");
  assert.ok(t.includes("validation_skipped"), "validator must document validation_skipped badge");
});
test("validator.md contains write-validation-result command", async () => {
  const t = await readAgent("validator.md");
  assert.ok(
    t.includes("write-validation-result"),
    "validator must reference write-validation-result"
  );
});
test("validator.md contains mark-badge blocked path", async () => {
  const t = await readAgent("validator.md");
  assert.ok(t.includes("blocked"), "validator must document blocked badge path");
});
test("validator.md contains write-handoff requirement", async () => {
  const t = await readAgent("validator.md");
  assert.ok(t.includes("write-handoff"), "validator must reference write-handoff");
});
test("validator.md contains PASS or FAIL evidence language", async () => {
  const t = await readAgent("validator.md");
  assert.ok(t.includes("PASS") && t.includes("FAIL"), "validator must document PASS/FAIL outcomes");
});

// deployer.md
test("deployer.md contains write-deployment-check command", async () => {
  const t = await readAgent("deployer.md");
  assert.ok(
    t.includes("write-deployment-check"),
    "deployer must reference write-deployment-check"
  );
});
test("deployer.md contains mark-badge blocked path", async () => {
  const t = await readAgent("deployer.md");
  assert.ok(t.includes("blocked"), "deployer must document blocked badge path");
});
test("deployer.md contains dev.stable gate reference", async () => {
  const t = await readAgent("deployer.md");
  assert.ok(t.includes("dev.stable"), "deployer must reference dev.stable gate");
});
test("deployer.md contains write-handoff requirement", async () => {
  const t = await readAgent("deployer.md");
  assert.ok(t.includes("write-handoff"), "deployer must reference write-handoff");
});
test("deployer.md contains production promotion approval requirement", async () => {
  const t = await readAgent("deployer.md");
  assert.ok(
    t.includes("production") && (t.includes("approval") || t.includes("explicit")),
    "deployer must require explicit approval for production promotion"
  );
});

// lead.md
test("lead.md contains mark-badge reference", async () => {
  const t = await readAgent("lead.md");
  assert.ok(t.includes("mark-badge"), "lead must reference mark-badge");
});
test("lead.md contains write-handoff reference", async () => {
  const t = await readAgent("lead.md");
  assert.ok(t.includes("write-handoff"), "lead must reference write-handoff");
});
test("lead.md contains write-run-brief reference", async () => {
  const t = await readAgent("lead.md");
  assert.ok(t.includes("write-run-brief"), "lead must reference write-run-brief");
});
test("lead.md contains write-final-synthesis reference", async () => {
  const t = await readAgent("lead.md");
  assert.ok(t.includes("write-final-synthesis"), "lead must reference write-final-synthesis");
});
test("lead.md contains review gate language", async () => {
  const t = await readAgent("lead.md");
  assert.ok(
    t.includes("review_required") || t.includes("review_skipped"),
    "lead must document review gate badge"
  );
});
```

- [ ] **Step 2: Run tests to verify they pass on current agent files**

```
node --test tests/agent-prompt-content.test.mjs
```

Expected: all 25 pass. If any fail, the keyword is genuinely missing from the agent file — check `agents/<role>.md` and either add the keyword or adjust the assertion to match what's actually there.

- [ ] **Step 3: Commit**

```
git add tests/agent-prompt-content.test.mjs
git commit -m "test(agents): structural keyword tests for all 5 agent prompts"
```

---

### Task 2: Validate-skills Implementation reference check

This extends `scripts/validate-skills.mjs` to warn when a skill's `## Implementation` section names a `.mjs` function that can't be found as an export in the referenced file.

Pattern matched: `` `scripts/lib/path/file.mjs` — `functionName(...)` `` or `` `scripts/lib/path/file.mjs` ``

**Files:**
- Modify: `scripts/validate-skills.mjs` — add `checkImplementationRef` function and call it
- Create: `tests/validate-skills-impl-ref.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// tests/validate-skills-impl-ref.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Helper: create a temp skill dir, write SKILL.md, write (or skip) the referenced lib file
async function withSkill(skillContent, libContent, fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "feat-c-"));
  const skillPath = path.join(dir, "SKILL.md");
  await fs.writeFile(skillPath, skillContent, "utf8");
  if (libContent !== null) {
    const libDir = path.join(dir, "scripts", "lib");
    await fs.mkdir(libDir, { recursive: true });
    await fs.writeFile(path.join(libDir, "mylib.mjs"), libContent, "utf8");
  }
  try {
    await fn(dir, skillPath);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

import { checkImplementationRef } from "../scripts/validate-skills.mjs";

test("checkImplementationRef: no ## Implementation section → no warnings", async () => {
  await withSkill("---\nname: foo\ntier: workflow\ndescription: test\n---\n# Foo\n", null, async (dir) => {
    const warnings = [];
    await checkImplementationRef("# Foo\n", dir, "foo", warnings);
    assert.equal(warnings.length, 0);
  });
});

test("checkImplementationRef: valid export → no warnings", async () => {
  const skill = "---\nname: foo\ntier: workflow\ndescription: test\n---\n## Implementation\n\n`scripts/lib/mylib.mjs` — `buildFoo(acs, sliceContent)`\n";
  const lib = "export function buildFoo(acs, sliceContent) { return []; }\n";
  await withSkill(skill, lib, async (dir) => {
    const warnings = [];
    await checkImplementationRef(skill, dir, "foo", warnings);
    assert.equal(warnings.length, 0);
  });
});

test("checkImplementationRef: missing export → warns", async () => {
  const skill = "---\nname: foo\ntier: workflow\ndescription: test\n---\n## Implementation\n\n`scripts/lib/mylib.mjs` — `buildFoo(acs, sliceContent)`\n";
  const lib = "export function buildBar() {}\n"; // buildFoo not exported
  await withSkill(skill, lib, async (dir) => {
    const warnings = [];
    await checkImplementationRef(skill, dir, "foo", warnings);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /buildFoo/);
  });
});

test("checkImplementationRef: referenced file missing → warns", async () => {
  const skill = "---\nname: foo\ntier: workflow\ndescription: test\n---\n## Implementation\n\n`scripts/lib/mylib.mjs` — `buildFoo(acs)`\n";
  await withSkill(skill, null, async (dir) => {
    const warnings = [];
    await checkImplementationRef(skill, dir, "foo", warnings);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /mylib\.mjs/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
node --test tests/validate-skills-impl-ref.test.mjs
```

Expected: FAIL — `checkImplementationRef is not a function` (not exported yet)

- [ ] **Step 3: Add checkImplementationRef to validate-skills.mjs**

Open `scripts/validate-skills.mjs`. After the `checkSectionHeadings` function (around line 125), add:

```js
/** @param {string} text @param {string} repoRoot @param {string} label @param {string[]} warnings */
async function checkImplementationRef(text, repoRoot, label, warnings) {
  const implMatch = text.match(/^##\s+Implementation\s*\n([\s\S]*?)(?=^##\s|\z)/m);
  if (!implMatch) return;
  const body = implMatch[1];
  // Match: `scripts/lib/path/file.mjs` — `funcName(...)`
  const refRe = /`(scripts\/lib\/[^`]+\.mjs)`(?:[^`]*`([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\()?/g;
  let m;
  while ((m = refRe.exec(body)) !== null) {
    const [, relPath, funcName] = m;
    const absPath = path.join(repoRoot, relPath);
    let content;
    try {
      content = await fs.readFile(absPath, "utf8");
    } catch {
      warnings.push(`${label}: ## Implementation references ${relPath} which does not exist`);
      continue;
    }
    if (funcName && !new RegExp(`export[^;]*\\b${funcName}\\b`).test(content)) {
      warnings.push(
        `${label}: ## Implementation references ${funcName} but it is not exported from ${relPath}`
      );
    }
  }
}
```

Then export it by adding `export` to the function declaration (change `async function checkImplementationRef` → `export async function checkImplementationRef`).

In the main `validateSkills` loop (around line 165, inside the per-skill loop), add after `checkSectionHeadings`:

```js
    await checkImplementationRef(text, SKILLS_ROOT, label, warnings);
```

Note: `validateSkills` must become `async` if it isn't already. Check the function signature.

- [ ] **Step 4: Run test to verify it passes**

```
node --test tests/validate-skills-impl-ref.test.mjs
```

Expected: 4/4 pass

- [ ] **Step 5: Run full suite + lint**

```
node --test
npm run lint
npm run format:check
npm run validate:skills
```

Expected: all pass, 0 warnings. If `format:check` fails, run `npm run format` first.

- [ ] **Step 6: Commit**

```
git add scripts/validate-skills.mjs tests/validate-skills-impl-ref.test.mjs
git commit -m "feat(validate-skills): warn when ## Implementation export reference is stale"
```

---

### Task 3: Final verification

- [ ] **Step 1: Run full test suite**

```
node --test 2>&1 | tail -8
```

Expected:
```
ℹ tests 347
ℹ pass 347
ℹ fail 0
```

(318 current + 25 agent-keyword + 4 impl-ref = 347)

- [ ] **Step 2: Run all validators**

```
npm run lint && npm run format:check && node ./scripts/validate-manifests.mjs && node ./scripts/validate-skills.mjs && node ./scripts/validate-agents.mjs
```

Expected: all exit 0, lint 0 warnings.

- [ ] **Step 3: Final commit if anything was auto-formatted**

```
git add -p
git commit -m "chore: format fixes after FEAT-C test coverage"
```
