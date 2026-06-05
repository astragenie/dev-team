# FEAT-B: Observability & Artifact Trail — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface hook health in brief-me, fix 4 stale synthesis artifacts, and add a validate-syntheses CI gate.

**Architecture:** Three independent sub-deliverables. (1) All 4 hook scripts emit structured `hook_error` events to `events.jsonl`; a new `collectHookHealth` function reads the tail and the `## Hook health` section appears in brief-me output. (2) Four synthesis artifacts with "Grade missing" placeholders get linked to their actual grade files. (3) A new `validate-syntheses.mjs` script errors on any synthesis containing literal `Grade missing` or `<timestamp>` — added to CI as an advisory gate.

Note: AC-5 from the spec (validate-skills impl-ref check) is covered by FEAT-C Task 2 and is already planned there; FEAT-B does not duplicate it.

**Tech Stack:** Node.js ESM, `node:fs/promises`, `node:path`, existing `scripts/lib/briefing/collect.mjs`, `scripts/lib/wakeup.mjs`, `scripts/lib/briefing.mjs`

---

## Pre-flight notes

- All 4 hooks already have `.catch()` handlers that call `logEvent(...)` with event type `cost-hygiene:uncaught`. FEAT-B replaces these with a `logHookError(hookName, error)` helper that emits `{ ts, type: "hook_error", hook, error }`.
- `scripts/lib/wakeup.mjs` already reads the last N events from `events.jsonl` — hookHealth piggybacks on the same read.
- Synthesis files are in `.claude/artifacts/crew/runs/`: `feat033-slice10-final-synthesis.md`, `feat030-slice11-final-synthesis.md`, `feat032-slice12-final-synthesis.md`, `feat034-slice13-final-synthesis.md`.
- Grade files are under `.claude/artifacts/loop/grades/`. Run `ls .claude/artifacts/loop/grades/` at implementation time to find the correct filenames for each slice.

---

## File Structure

| File | Change |
|------|--------|
| `hooks/check-redundant-read.mjs` | MODIFY — emit `hook_error` events |
| `hooks/record-read-content.mjs` | MODIFY — emit `hook_error` events |
| `hooks/preflight-shell.mjs` | MODIFY — emit `hook_error` events |
| `hooks/check-subagent-return.mjs` | MODIFY — emit `hook_error` events |
| `scripts/lib/briefing/collect.mjs` | MODIFY — add `collectHookHealth` export |
| `scripts/lib/wakeup.mjs` | MODIFY — add `hookHealth` to `buildWakeUpBrief` return |
| `scripts/lib/briefing.mjs` | MODIFY — add `## Hook health` section to output |
| `.claude/artifacts/crew/runs/feat033-slice10-final-synthesis.md` | MODIFY — fix placeholders |
| `.claude/artifacts/crew/runs/feat030-slice11-final-synthesis.md` | MODIFY — fix placeholders |
| `.claude/artifacts/crew/runs/feat032-slice12-final-synthesis.md` | MODIFY — fix placeholders |
| `.claude/artifacts/crew/runs/feat034-slice13-final-synthesis.md` | MODIFY — fix placeholders |
| `scripts/validate-syntheses.mjs` | CREATE — CI gate for stale placeholders |
| `tests/validate-syntheses.test.mjs` | CREATE — unit tests |

---

### Task 1: Hook error events

All 4 hook scripts need a `logHookError(hookName, error)` helper and updated `.catch()` calls.

**Files:**
- Modify: `hooks/check-redundant-read.mjs`
- Modify: `hooks/record-read-content.mjs`
- Modify: `hooks/preflight-shell.mjs`
- Modify: `hooks/check-subagent-return.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/hook-error-events.test.mjs`:

```js
// tests/hook-error-events.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Helper: write a fake events.jsonl with a hook_error event and return parsed lines
async function parseEvents(dir) {
  const p = path.join(dir, ".claude", "logs", "events.jsonl");
  try {
    const text = await fs.readFile(p, "utf8");
    return text.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

import { logHookError } from "../hooks/hook-error.mjs";

test("logHookError emits structured hook_error event to events.jsonl", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hook-err-"));
  await logHookError(dir, "check-redundant-read", new Error("test error"));
  const events = await parseEvents(dir);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "hook_error");
  assert.equal(events[0].hook, "check-redundant-read");
  assert.match(events[0].error, /test error/);
  assert.ok(events[0].ts, "must have timestamp");
  await fs.rm(dir, { recursive: true, force: true });
});

test("logHookError does not throw when logs dir does not exist", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hook-err2-"));
  // no .claude/logs dir — logHookError must create it
  await assert.doesNotReject(() => logHookError(dir, "preflight-shell", new Error("oops")));
  await fs.rm(dir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
node --test tests/hook-error-events.test.mjs
```

Expected: FAIL — `Cannot find module '../hooks/hook-error.mjs'`

- [ ] **Step 3: Create `hooks/hook-error.mjs`**

```js
// hooks/hook-error.mjs
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Append a structured hook_error event to .claude/logs/events.jsonl.
 * Never throws — best-effort only.
 * @param {string} repoPath
 * @param {string} hookName
 * @param {unknown} error
 */
export async function logHookError(repoPath, hookName, error) {
  try {
    const dir = path.join(repoPath, ".claude", "logs");
    await fs.mkdir(dir, { recursive: true });
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      type: "hook_error",
      hook: hookName,
      error: String(error)
    });
    await fs.appendFile(path.join(dir, "events.jsonl"), line + "\n", "utf8");
  } catch {
    // give up silently — hook must not block Claude
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```
node --test tests/hook-error-events.test.mjs
```

Expected: 2/2 pass.

- [ ] **Step 5: Update hooks to use logHookError**

In each of the 4 hook files, replace the existing `.catch()` handler. The pattern is identical in all 4:

**Before (all 4 hooks):**
```js
main().catch(async (err) => {
  try {
    await logEvent(process.cwd(), "uncaught", "unknown", String(err));
  } catch {
    // give up
  }
  process.exit(0);
});
```

**After (all 4 hooks — substitute correct hook name):**
```js
import { logHookError } from "./hook-error.mjs";
// ...
main().catch(async (err) => {
  await logHookError(process.cwd(), "<hook-name>", err);
  process.exit(0);
});
```

Hook names to use:
- `check-redundant-read.mjs` → `"check-redundant-read"`
- `record-read-content.mjs` → `"record-read-content"`
- `preflight-shell.mjs` → `"preflight-shell"`
- `check-subagent-return.mjs` → `"check-subagent-return"`

Also add the `import { logHookError }` at the top of each file alongside existing imports.

- [ ] **Step 6: Run full test suite**

```
node --test && npm run lint
```

Expected: all pass, 0 lint warnings.

- [ ] **Step 7: Commit**

```
git add hooks/hook-error.mjs hooks/check-redundant-read.mjs hooks/record-read-content.mjs hooks/preflight-shell.mjs hooks/check-subagent-return.mjs tests/hook-error-events.test.mjs
git commit -m "feat(hooks): emit structured hook_error events to events.jsonl"
```

---

### Task 2: collectHookHealth + wake-up hookHealth field

Add a `collectHookHealth` function that reads the last 100 events from `events.jsonl`, counts `hook_error` events per hook in the last 24 hours, and wire it into `buildWakeUpBrief`.

**Files:**
- Modify: `scripts/lib/briefing/collect.mjs` (add `collectHookHealth` export near end of file)
- Modify: `scripts/lib/wakeup.mjs` (add hookHealth to `buildWakeUpBrief` return)

- [ ] **Step 1: Write the failing test**

Create `tests/collect-hook-health.test.mjs`:

```js
// tests/collect-hook-health.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

async function makeRepo(events) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hook-health-"));
  const logsDir = path.join(dir, ".claude", "logs");
  await fs.mkdir(logsDir, { recursive: true });
  const lines = events.map((e) => JSON.stringify(e)).join("\n") + "\n";
  await fs.writeFile(path.join(logsDir, "events.jsonl"), lines, "utf8");
  return dir;
}

import { collectHookHealth } from "../scripts/lib/briefing/collect.mjs";

test("collectHookHealth returns empty hooks array when no events.jsonl", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hook-health-empty-"));
  const result = await collectHookHealth(dir);
  assert.deepEqual(result.hooks, []);
  await fs.rm(dir, { recursive: true, force: true });
});

test("collectHookHealth counts hook_error events per hook in last 24h", async () => {
  const now = new Date();
  const recent = new Date(now - 60 * 60 * 1000).toISOString(); // 1h ago
  const old = new Date(now - 25 * 60 * 60 * 1000).toISOString(); // 25h ago
  const dir = await makeRepo([
    { ts: recent, type: "hook_error", hook: "preflight-shell", error: "oops" },
    { ts: recent, type: "hook_error", hook: "preflight-shell", error: "again" },
    { ts: old, type: "hook_error", hook: "check-redundant-read", error: "old" },
    { ts: recent, type: "other_event", hook: "preflight-shell", error: "ignored" }
  ]);
  const result = await collectHookHealth(dir);
  const ps = result.hooks.find((h) => h.name === "preflight-shell");
  assert.ok(ps, "must include preflight-shell");
  assert.equal(ps.errorCount24h, 2);
  // old event outside 24h window must not count for check-redundant-read
  const crr = result.hooks.find((h) => h.name === "check-redundant-read");
  assert.ok(!crr || crr.errorCount24h === 0, "old events must be excluded");
  await fs.rm(dir, { recursive: true, force: true });
});

test("collectHookHealth marks hooks with errors as yellow", async () => {
  const ts = new Date().toISOString();
  const dir = await makeRepo([
    { ts, type: "hook_error", hook: "record-read-content", error: "err" }
  ]);
  const result = await collectHookHealth(dir);
  const h = result.hooks.find((h) => h.name === "record-read-content");
  assert.ok(h, "must find hook");
  assert.equal(h.status, "yellow");
  await fs.rm(dir, { recursive: true, force: true });
});

test("collectHookHealth returns green status for hooks with no errors", async () => {
  const ts = new Date().toISOString();
  const dir = await makeRepo([
    { ts, type: "hook_error", hook: "check-subagent-return", error: "err" }
  ]);
  const result = await collectHookHealth(dir);
  // preflight-shell not seen → should still appear as green or not appear
  const noErrors = result.hooks.filter((h) => h.errorCount24h === 0);
  noErrors.forEach((h) => assert.equal(h.status, "green"));
  await fs.rm(dir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
node --test tests/collect-hook-health.test.mjs
```

Expected: FAIL — `collectHookHealth is not a function`

- [ ] **Step 3: Add `collectHookHealth` to `scripts/lib/briefing/collect.mjs`**

Add this function near the end of the file, before the final exports section:

```js
const KNOWN_HOOKS = [
  "check-redundant-read",
  "record-read-content",
  "preflight-shell",
  "check-subagent-return"
];
const HOOK_HEALTH_TAIL = 100;
const HOOK_HEALTH_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * @param {string} repoPath
 * @returns {Promise<{ hooks: Array<{name: string, errorCount24h: number, status: "green"|"yellow"}> }>}
 */
export async function collectHookHealth(repoPath) {
  const eventsPath = path.join(repoPath, ".claude", "logs", "events.jsonl");
  const raw = await readRecentJsonl(eventsPath, HOOK_HEALTH_TAIL);
  const cutoff = Date.now() - HOOK_HEALTH_WINDOW_MS;
  const counts = new Map();
  for (const e of raw) {
    if (e.type !== "hook_error" || typeof e.hook !== "string") continue;
    const ts = new Date(e.ts).getTime();
    if (isNaN(ts) || ts < cutoff) continue;
    counts.set(e.hook, (counts.get(e.hook) ?? 0) + 1);
  }
  const hooks = KNOWN_HOOKS.map((name) => {
    const errorCount24h = counts.get(name) ?? 0;
    return { name, errorCount24h, status: /** @type {"green"|"yellow"} */ (errorCount24h > 0 ? "yellow" : "green") };
  });
  return { hooks };
}
```

Note: `readRecentJsonl` and `path` are already imported at the top of `collect.mjs`.

- [ ] **Step 4: Run test to verify it passes**

```
node --test tests/collect-hook-health.test.mjs
```

Expected: 4/4 pass.

- [ ] **Step 5: Wire hookHealth into `buildWakeUpBrief` in `scripts/lib/wakeup.mjs`**

In `buildWakeUpBrief` (line 314), add `collectHookHealth` to the `Promise.all` array:

```js
// At top of file, add import:
import { collectHookHealth } from "./briefing/collect.mjs";

// In buildWakeUpBrief, add to Promise.all:
const [
  openApprovals,
  claims,
  sprint,
  workflowState,
  latestDeploymentGuidance,
  latestRunBrief,
  latestFinalSynthesis,
  latestHandoff,
  latestReview,
  latestValidationPlan,
  latestValidationResult,
  latestDeploymentCheck,
  hookHealth        // <-- add
] = await Promise.all([
  listApprovals(repoPath, { status: "open", createIfMissing: !readOnly }),
  // ...all existing entries...
  latestArtifactByPrefix(repoPath, DEPLOYMENTS_DIR, "deployment-check"),
  collectHookHealth(repoPath)   // <-- add last
]);
```

Then add `hookHealth` to the return object of `buildWakeUpBrief` (look for the `return {` near line 395–430). Add `hookHealth` as a top-level field:

```js
return {
  repoPath,
  // ...existing fields...
  hookHealth
};
```

- [ ] **Step 6: Run full test suite**

```
node --test && npm run lint
```

Expected: all pass.

- [ ] **Step 7: Commit**

```
git add scripts/lib/briefing/collect.mjs scripts/lib/wakeup.mjs tests/collect-hook-health.test.mjs
git commit -m "feat(observability): collectHookHealth reads events.jsonl; hookHealth in wake-up brief"
```

---

### Task 3: ## Hook health section in brief-me

Add a `## Hook health` section to the `buildBriefingReport` output in `scripts/lib/briefing.mjs`.

**Files:**
- Modify: `scripts/lib/briefing.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/brief-me-hook-health.test.mjs`:

```js
// tests/brief-me-hook-health.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

// Test the hook health section formatter directly
import { formatHookHealthSection } from "../scripts/lib/briefing.mjs";

test("formatHookHealthSection returns green header when all hooks clean", () => {
  const health = {
    hooks: [
      { name: "check-redundant-read", errorCount24h: 0, status: "green" },
      { name: "record-read-content", errorCount24h: 0, status: "green" },
      { name: "preflight-shell", errorCount24h: 0, status: "green" },
      { name: "check-subagent-return", errorCount24h: 0, status: "green" }
    ]
  };
  const section = formatHookHealthSection(health);
  assert.match(section, /##\s+Hook health/);
  assert.match(section, /green|✓|all clean/i);
  assert.doesNotMatch(section, /yellow|error/i);
});

test("formatHookHealthSection shows error count for yellow hooks", () => {
  const health = {
    hooks: [
      { name: "preflight-shell", errorCount24h: 3, status: "yellow" },
      { name: "check-redundant-read", errorCount24h: 0, status: "green" }
    ]
  };
  const section = formatHookHealthSection(health);
  assert.match(section, /preflight-shell/);
  assert.match(section, /3/);
});
```

- [ ] **Step 2: Run test to verify it fails**

```
node --test tests/brief-me-hook-health.test.mjs
```

Expected: FAIL — `formatHookHealthSection is not a function`

- [ ] **Step 3: Add `formatHookHealthSection` to `scripts/lib/briefing.mjs`**

Add this function before `buildBriefingReport`:

```js
/**
 * @param {{ hooks: Array<{name: string, errorCount24h: number, status: string}> }} health
 * @returns {string}
 */
export function formatHookHealthSection(health) {
  const yellow = (health.hooks ?? []).filter((h) => h.status === "yellow");
  if (yellow.length === 0) {
    return "## Hook health\n\nAll hooks clean (0 errors in last 24h).\n";
  }
  const lines = yellow.map((h) => `- **${h.name}**: ${h.errorCount24h} error(s) in last 24h`);
  return `## Hook health\n\n${lines.join("\n")}\n`;
}
```

Then wire it into `buildBriefingReport`. Add `hookHealth` to the parallel fetches and include the section in the return:

```js
export async function buildBriefingReport(repoPath) {
  const [
    wakeUpBrief,
    gitActivity,
    deploymentClues,
    autonomousLoopBrief,
    costs,
    routingTable,
    costHealth,
    costAggregate,
    hookHealth          // <-- add
  ] = await Promise.all([
    buildWakeUpBrief(repoPath, { readOnly: true }),
    // ...existing entries...
    collectCostAggregate(repoPath),
    collectHookHealth(repoPath)   // <-- add last
  ]);
  // ...existing code...
  return {
    repoPath: wakeUpBrief.repoPath,
    // ...existing fields...
    hookHealth,
    sections: {
      // ...existing sections...
      hookHealth: formatHookHealthSection(hookHealth)
    }
  };
}
```

Also add the import at the top of briefing.mjs:
```js
import { collectHookHealth } from "./briefing/collect.mjs";
```

- [ ] **Step 4: Run test to verify it passes**

```
node --test tests/brief-me-hook-health.test.mjs
```

Expected: 2/2 pass.

- [ ] **Step 5: Run full test suite**

```
node --test && npm run lint
```

Expected: all pass.

- [ ] **Step 6: Commit**

```
git add scripts/lib/briefing.mjs tests/brief-me-hook-health.test.mjs
git commit -m "feat(brief-me): add ## Hook health section with per-hook error counts"
```

---

### Task 4: Fix stale synthesis artifacts

Replace "Grade missing" and `<timestamp>` placeholder in 4 synthesis files.

**Files:**
- Modify: `.claude/artifacts/crew/runs/feat033-slice10-final-synthesis.md`
- Modify: `.claude/artifacts/crew/runs/feat030-slice11-final-synthesis.md`
- Modify: `.claude/artifacts/crew/runs/feat032-slice12-final-synthesis.md`
- Modify: `.claude/artifacts/crew/runs/feat034-slice13-final-synthesis.md`

- [ ] **Step 1: Find grade files for each slice**

```
ls .claude/artifacts/loop/grades/ | grep -i "slice.1[0-3]\|slice_1[0-3]\|SLICE-1[0-3]"
```

Note down the filenames for SLICE-10, SLICE-11, SLICE-12, SLICE-13.

- [ ] **Step 2: Find actual handoff files for each slice**

```
ls .claude/artifacts/crew/handoffs/ | grep -i "slice.1[0-3]\|slice_1[0-3]"
```

Note down the actual handoff filenames.

- [ ] **Step 3: Update feat033-slice10-final-synthesis.md**

Replace the two placeholder lines:

```
- Grade missing — synthesis is incomplete
- Slice handoff: `.claude/artifacts/crew/handoffs/<timestamp>-slice-10-complete.md`
```

With:

```
- Grade: see `.claude/artifacts/loop/grades/<actual-grade-filename-for-slice-10>`
- Slice handoff: `.claude/artifacts/crew/handoffs/<actual-handoff-filename-for-slice-10>`
```

Use exact filenames found in Steps 1 and 2. If no grade file exists for a slice, replace with: `- Grade: not recorded (grade run was skipped for this slice)`.

- [ ] **Step 4: Repeat for the other 3 synthesis files**

Apply the same substitution pattern to:
- `feat030-slice11-final-synthesis.md` (SLICE-11)
- `feat032-slice12-final-synthesis.md` (SLICE-12)
- `feat034-slice13-final-synthesis.md` (SLICE-13)

- [ ] **Step 5: Verify no placeholders remain**

```
grep -r "Grade missing\|<timestamp>" .claude/artifacts/crew/runs/
```

Expected: no output (zero matches).

- [ ] **Step 6: Commit**

```
git add .claude/artifacts/crew/runs/feat033-slice10-final-synthesis.md .claude/artifacts/crew/runs/feat030-slice11-final-synthesis.md .claude/artifacts/crew/runs/feat032-slice12-final-synthesis.md .claude/artifacts/crew/runs/feat034-slice13-final-synthesis.md
git commit -m "fix(syntheses): replace Grade missing + timestamp placeholders in SLICE-10/11/12/13"
```

---

### Task 5: validate-syntheses.mjs CI gate

Create a script that errors when any synthesis artifact contains `Grade missing` or a `<timestamp>` literal.

**Files:**
- Create: `scripts/validate-syntheses.mjs`
- Create: `tests/validate-syntheses.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// tests/validate-syntheses.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

async function makeRunsDir(files) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "synth-val-"));
  const runsDir = path.join(dir, ".claude", "artifacts", "crew", "runs");
  await fs.mkdir(runsDir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    await fs.writeFile(path.join(runsDir, name), content, "utf8");
  }
  return dir;
}

import { validateSyntheses } from "../scripts/validate-syntheses.mjs";

test("validateSyntheses passes when no synthesis files exist", async () => {
  const dir = await makeRunsDir({});
  const result = await validateSyntheses(dir);
  assert.equal(result.errors.length, 0);
  await fs.rm(dir, { recursive: true, force: true });
});

test("validateSyntheses passes on clean synthesis file", async () => {
  const dir = await makeRunsDir({
    "foo-final-synthesis.md": "# Synthesis\n## Grade\ntest_confidence: 0.85\n"
  });
  const result = await validateSyntheses(dir);
  assert.equal(result.errors.length, 0);
  await fs.rm(dir, { recursive: true, force: true });
});

test("validateSyntheses errors on Grade missing placeholder", async () => {
  const dir = await makeRunsDir({
    "bad-final-synthesis.md": "# Synthesis\n- Grade missing — synthesis is incomplete\n"
  });
  const result = await validateSyntheses(dir);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /Grade missing/);
  await fs.rm(dir, { recursive: true, force: true });
});

test("validateSyntheses errors on timestamp placeholder", async () => {
  const dir = await makeRunsDir({
    "bad2-final-synthesis.md":
      "# Synthesis\n- Handoff: `.claude/artifacts/crew/handoffs/<timestamp>-complete.md`\n"
  });
  const result = await validateSyntheses(dir);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /<timestamp>/);
  await fs.rm(dir, { recursive: true, force: true });
});

test("validateSyntheses checks only final-synthesis files not other runs", async () => {
  const dir = await makeRunsDir({
    "2026-run-brief-foo.md": "Grade missing here but not a synthesis",
    "2026-final-synthesis-clean.md": "# OK synthesis\nAll good.\n"
  });
  const result = await validateSyntheses(dir);
  assert.equal(result.errors.length, 0);
  await fs.rm(dir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
node --test tests/validate-syntheses.test.mjs
```

Expected: FAIL — `Cannot find module '../scripts/validate-syntheses.mjs'`

- [ ] **Step 3: Create `scripts/validate-syntheses.mjs`**

```js
#!/usr/bin/env node
// Validates that no final-synthesis artifact contains stale placeholder text.
import fs from "node:fs/promises";
import path from "node:path";

const RUNS_DIR = [".claude", "artifacts", "crew", "runs"];
const STALE_PATTERNS = [/Grade missing/, /<timestamp>/];

/**
 * @param {string} repoPath
 * @returns {Promise<{ errors: string[] }>}
 */
export async function validateSyntheses(repoPath) {
  const runsDir = path.join(repoPath, ...RUNS_DIR);
  let entries;
  try {
    entries = await fs.readdir(runsDir);
  } catch {
    return { errors: [] };
  }
  const synthFiles = entries.filter((name) => name.includes("final-synthesis"));
  const errors = [];
  for (const name of synthFiles) {
    const text = await fs.readFile(path.join(runsDir, name), "utf8");
    for (const pat of STALE_PATTERNS) {
      if (pat.test(text)) {
        errors.push(`${name}: contains stale placeholder matching ${pat}`);
        break;
      }
    }
  }
  return { errors };
}

// CLI entry point
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const repoPath = process.argv[2] || process.cwd();
  const { errors } = await validateSyntheses(repoPath);
  if (errors.length > 0) {
    console.error("validate-syntheses: stale placeholders found:");
    errors.forEach((e) => console.error("  " + e));
    process.exit(1);
  } else {
    console.log("validate-syntheses: all synthesis files clean");
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```
node --test tests/validate-syntheses.test.mjs
```

Expected: 5/5 pass.

- [ ] **Step 5: Verify the script passes on current repo**

```
node ./scripts/validate-syntheses.mjs
```

Expected: `validate-syntheses: all synthesis files clean` (after Task 4 has fixed the placeholders).

If this runs before Task 4 finishes: expected failure is acceptable — fix synthesis files first.

- [ ] **Step 6: Run full suite + lint**

```
node --test && npm run lint && npm run format:check
```

Expected: all pass.

- [ ] **Step 7: Commit**

```
git add scripts/validate-syntheses.mjs tests/validate-syntheses.test.mjs
git commit -m "feat(validate-syntheses): CI gate for stale Grade missing + timestamp placeholders"
```

---

### Task 6: Final verification

- [ ] **Step 1: Run full test suite**

```
node --test 2>&1 | tail -8
```

Expected:
```
ℹ tests N
ℹ pass N
ℹ fail 0
```

(N = current count + ~13 new tests from Tasks 1–5)

- [ ] **Step 2: Run all validators**

```
npm run lint && npm run format:check && node ./scripts/validate-manifests.mjs && node ./scripts/validate-skills.mjs && node ./scripts/validate-agents.mjs && node ./scripts/validate-syntheses.mjs
```

Expected: all exit 0, lint 0 warnings, validate-syntheses clean.

- [ ] **Step 3: Final commit if anything was auto-formatted**

```
git add -p
git commit -m "chore: format fixes after FEAT-B observability"
```
