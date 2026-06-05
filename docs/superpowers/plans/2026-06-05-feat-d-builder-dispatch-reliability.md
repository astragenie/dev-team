# FEAT-D: Builder Dispatch Reliability — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `scope-estimate` CLI sub-command, document the context-ceiling recovery protocol in builder and lead agent prompts, and surface model compliance in brief-me.

**Architecture:** Three sub-deliverables. (1) `scripts/crew.mjs scope-estimate` accepts a `--files` list and returns a complexity tier (`light`/`standard`/`heavy`) with a reason string — pure logic, no I/O beyond file stat. (2) `agents/builder.md` gains a `## Context ceiling` section (≤15 lines); `agents/lead.md` gains 2 lines referencing scope-estimate and ceiling recovery in the existing model-selection section. (3) `collectModelCompliance` is added to `scripts/lib/briefing/collect.mjs`; brief-me renders it under the cost section. **autonomous_safe: false** — agent prompt edits (Tasks 3 and 4) require human review before commit.

**Tech Stack:** Node.js ESM, `node:fs/promises`, `node:path`, `node:test`, `node:assert/strict`, existing `scripts/lib/briefing/collect.mjs`, `scripts/lib/briefing.mjs`

---

## Pre-flight notes

- `agents/lead.md` is at **298 lines** (≤300 cap). Any addition must replace an equal number of existing lines, or net additions must keep the file ≤300. The plan below adds exactly 2 lines by appending them to an existing paragraph (no removals needed — going from 298 → 300 is valid).
- `agents/builder.md` is at **190 lines** — ample room for ≤15-line `## Context ceiling` section.
- `scope-estimate` is a pure function: given a list of `{path, lines}` objects it returns `{tier, reason}`. No disk access required from the function itself — callers pass file metadata. The CLI wrapper does the stat calls.
- `collectModelCompliance` reads the latest aggregate cost report (already parsed by `collectCostAggregate`) and computes `sonnetPct` from `modelMix`.

---

## File Structure

| File | Change |
|------|--------|
| `scripts/lib/scope-estimate.mjs` | CREATE — pure `estimateScope({files})` function |
| `scripts/crew.mjs` | MODIFY — add `scope-estimate` sub-command (~line 560, after brief-me handler) |
| `tests/scope-estimate.test.mjs` | CREATE — ≥6 unit tests covering all tier boundaries |
| `agents/builder.md` | MODIFY — add `## Context ceiling` section (≤15 lines) |
| `agents/lead.md` | MODIFY — add 2 lines to model-selection section (stays ≤300) |
| `scripts/lib/briefing/collect.mjs` | MODIFY — add `collectModelCompliance` export |
| `scripts/lib/briefing.mjs` | MODIFY — include modelCompliance in cost section |
| `tests/collect-model-compliance.test.mjs` | CREATE |

---

### Task 1: scope-estimate pure function + tests (TDD)

**Files:**
- Create: `scripts/lib/scope-estimate.mjs`
- Create: `tests/scope-estimate.test.mjs`

- [ ] **Step 1: Write the failing tests**

```js
// tests/scope-estimate.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateScope } from "../scripts/lib/scope-estimate.mjs";

// Each entry: { path: string, lines: number }
// Tier rules:
//   light:    totalLines < 300 AND fileCount <= 2 AND no eslint-disable
//   heavy:    totalLines > 800 OR fileCount >= 6 OR any file has eslintDisable
//   standard: everything else

test("estimateScope returns light for 1 file under 300 lines", () => {
  const result = estimateScope({ files: [{ path: "src/foo.mjs", lines: 150 }] });
  assert.equal(result.tier, "light");
  assert.ok(result.reason.length > 0, "must include reason");
});

test("estimateScope returns light for 2 files, combined < 300", () => {
  const result = estimateScope({
    files: [
      { path: "a.mjs", lines: 100 },
      { path: "b.mjs", lines: 150 }
    ]
  });
  assert.equal(result.tier, "light");
});

test("estimateScope returns standard for 3 files in 300-800 line range", () => {
  const result = estimateScope({
    files: [
      { path: "a.mjs", lines: 200 },
      { path: "b.mjs", lines: 200 },
      { path: "c.mjs", lines: 100 }
    ]
  });
  assert.equal(result.tier, "standard");
});

test("estimateScope returns heavy for total lines > 800", () => {
  const result = estimateScope({
    files: [
      { path: "a.mjs", lines: 500 },
      { path: "b.mjs", lines: 400 }
    ]
  });
  assert.equal(result.tier, "heavy");
  assert.match(result.reason, /lines/i);
});

test("estimateScope returns heavy for fileCount >= 6", () => {
  const files = Array.from({ length: 6 }, (_, i) => ({ path: `f${i}.mjs`, lines: 50 }));
  const result = estimateScope({ files });
  assert.equal(result.tier, "heavy");
  assert.match(result.reason, /file/i);
});

test("estimateScope escalates to heavy when any file has eslintDisable flag", () => {
  const result = estimateScope({
    files: [
      { path: "a.mjs", lines: 100, eslintDisable: true },
      { path: "b.mjs", lines: 80 }
    ]
  });
  assert.equal(result.tier, "heavy");
  assert.match(result.reason, /eslint/i);
});

test("estimateScope returns standard for 2 files just over 300 lines", () => {
  const result = estimateScope({
    files: [
      { path: "a.mjs", lines: 200 },
      { path: "b.mjs", lines: 120 }
    ]
  });
  assert.equal(result.tier, "standard");
});

test("estimateScope returns { tier, reason } shape", () => {
  const result = estimateScope({ files: [] });
  assert.ok("tier" in result, "must have tier");
  assert.ok("reason" in result, "must have reason");
  assert.ok(["light", "standard", "heavy"].includes(result.tier));
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
node --test tests/scope-estimate.test.mjs
```

Expected: FAIL — `Cannot find module '../scripts/lib/scope-estimate.mjs'`

- [ ] **Step 3: Create `scripts/lib/scope-estimate.mjs`**

```js
// scripts/lib/scope-estimate.mjs

const LIGHT_LINES = 300;
const HEAVY_LINES = 800;
const HEAVY_FILES = 6;

/**
 * @typedef {{ path: string, lines: number, eslintDisable?: boolean }} FileEntry
 * @param {{ files: FileEntry[] }} options
 * @returns {{ tier: "light"|"standard"|"heavy", reason: string }}
 */
export function estimateScope({ files }) {
  const totalLines = files.reduce((sum, f) => sum + f.lines, 0);
  const fileCount = files.length;
  const hasEslintDisable = files.some((f) => f.eslintDisable === true);

  if (hasEslintDisable) {
    return { tier: "heavy", reason: `eslint-disable present in scope — complexity acknowledged` };
  }
  if (totalLines > HEAVY_LINES) {
    return { tier: "heavy", reason: `${totalLines} total lines exceeds heavy threshold (${HEAVY_LINES})` };
  }
  if (fileCount >= HEAVY_FILES) {
    return { tier: "heavy", reason: `${fileCount} files meets or exceeds heavy threshold (${HEAVY_FILES})` };
  }
  if (totalLines < LIGHT_LINES && fileCount <= 2) {
    return { tier: "light", reason: `${totalLines} total lines across ${fileCount} file(s) — well within light threshold` };
  }
  return { tier: "standard", reason: `${totalLines} total lines across ${fileCount} file(s)` };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
node --test tests/scope-estimate.test.mjs
```

Expected: 8/8 pass.

- [ ] **Step 5: Commit**

```
git add scripts/lib/scope-estimate.mjs tests/scope-estimate.test.mjs
git commit -m "feat(scope-estimate): pure tier classifier light/standard/heavy"
```

---

### Task 2: scope-estimate CLI sub-command

Wire `estimateScope` into `scripts/crew.mjs` as the `scope-estimate` sub-command.

**Files:**
- Modify: `scripts/crew.mjs` (~line 560, after the `brief-me` handler)

- [ ] **Step 1: Add the sub-command to the `commands` map**

Open `scripts/crew.mjs`. In the `commands` object (around line 290–560), after the `"brief-me"` entry, add:

```js
"scope-estimate": async (/** @type {CommandContext} */ { flags, positionals }) => {
  const { estimateScope } = await import("./lib/scope-estimate.mjs");
  // --files accepts comma-separated "path:lines" or "path:lines:eslintDisable" entries
  // e.g. --files "scripts/crew.mjs:894,scripts/lib/collect.mjs:955:true"
  const rawFiles = (flags.files || positionals.join(",") || "").split(",").filter(Boolean);
  const files = rawFiles.map((entry) => {
    const [p, linesStr, eslintDisableStr] = entry.split(":");
    return {
      path: p || "",
      lines: parseInt(linesStr, 10) || 0,
      eslintDisable: eslintDisableStr === "true"
    };
  });
  return estimateScope({ files });
},
```

Also add the CLI help string (look for the `HELP` or `usage` map near the top of the commands section, around line 290–300):

```js
"scope-estimate": "  node scripts/crew.mjs scope-estimate --files <path:lines,...>",
```

- [ ] **Step 2: Smoke-test the CLI**

```
node scripts/crew.mjs scope-estimate --files "scripts/crew.mjs:894,scripts/lib/briefing/collect.mjs:955" --repo .
```

Expected output (JSON):
```json
{ "tier": "heavy", "reason": "1849 total lines exceeds heavy threshold (800)" }
```

```
node scripts/crew.mjs scope-estimate --files "agents/builder.md:190" --repo .
```

Expected:
```json
{ "tier": "light", "reason": "190 total lines across 1 file(s) — well within light threshold" }
```

- [ ] **Step 3: Run full test suite**

```
node --test && npm run lint
```

Expected: all pass.

- [ ] **Step 4: Commit**

```
git add scripts/crew.mjs
git commit -m "feat(crew): add scope-estimate sub-command (light/standard/heavy tier)"
```

---

### Task 3: builder.md — Context ceiling section

**AUTONOMOUS_SAFE: false — human review required before merge.**

**Files:**
- Modify: `agents/builder.md` (currently 190 lines → will be ≤205 lines after; ≤300 cap)

- [ ] **Step 1: Read the current end of builder.md to find insertion point**

```
node --test tests/validate-agents.test.mjs
```

(Confirm it passes at 190 lines before editing.)

- [ ] **Step 2: Add `## Context ceiling` section**

Open `agents/builder.md`. After the last existing `##` section (or at the very end of the file), add:

```markdown
## Context ceiling

If you reach **40 tool uses** or **80k context tokens** before completing all ACs:

1. Emit status `DONE_WITH_CONCERNS` (not `DONE`).
2. Set concern field: `context_ceiling_reached: true`.
3. List which ACs were completed and which remain.
4. Do **not** attempt inline recovery or partial commits for remaining ACs.

Lead will split the remaining ACs into a fresh bounded task and dispatch a new builder.
```

That is 9 lines of content + surrounding blank lines ≈ 12 lines total. File goes from 190 → ~202 lines. Well within the 300-line cap.

- [ ] **Step 3: Run validate-agents.mjs**

```
node ./scripts/validate-agents.mjs
```

Expected: passes (file ≤300 lines).

- [ ] **Step 4: Run full test suite**

```
node --test && npm run lint
```

Expected: all pass (agent keyword tests for builder.md check `DONE_WITH_CONCERNS` and `context_ceiling_reached` — both now present).

- [ ] **Step 5: Commit (after human review)**

This commit requires human review of the agent prompt change before pushing.

```
git add agents/builder.md
git commit -m "feat(builder): add ## Context ceiling section with DONE_WITH_CONCERNS protocol"
```

---

### Task 4: lead.md — scope-estimate reference + ceiling recovery rule

**AUTONOMOUS_SAFE: false — human review required before merge.**

**Files:**
- Modify: `agents/lead.md` (currently 298 lines → must stay ≤300 lines)

The model-selection section (around line 252–258) ends with:

```
If the slice spec lists file paths + test signatures + AC numbers, the slice is mechanical — Sonnet. Surface the recommendation in the run-brief artifact so the user can override before the slice opens. Full rationale + 5-dimension scoring: `docs/standards/model-selection.md`.
```

- [ ] **Step 1: Add 2 lines to the model-selection section**

After the paragraph ending `...Full rationale + 5-dimension scoring: \`docs/standards/model-selection.md\`.` (around line 258), add exactly these 2 lines:

```markdown
Run `node scripts/crew.mjs scope-estimate --files <path:lines,...>` on the builder's file list before dispatching — `light` → Sonnet; `heavy` → Opus.

On `context_ceiling_reached` from builder: split remaining ACs into a new bounded task; dispatch a fresh builder. Do not recover inline.
```

File goes from 298 → 300 lines. Exactly at cap. Valid.

- [ ] **Step 2: Run validate-agents.mjs**

```
node ./scripts/validate-agents.mjs
```

Expected: passes (lead.md exactly 300 lines ≤ 300).

- [ ] **Step 3: Run agent keyword tests**

```
node --test tests/agent-prompt-content.test.mjs
```

Expected: all pass (lead.md now contains `scope-estimate` reference; existing `mark-badge`, `write-handoff`, `write-run-brief`, `write-final-synthesis` checks still pass).

- [ ] **Step 4: Run full test suite**

```
node --test && npm run lint && node ./scripts/validate-agents.mjs
```

Expected: all pass.

- [ ] **Step 5: Commit (after human review)**

```
git add agents/lead.md
git commit -m "feat(lead): scope-estimate dispatch reference + context_ceiling_reached recovery rule"
```

---

### Task 5: modelCompliance in brief-me

Add `collectModelCompliance` to `collect.mjs` and render it in the cost section of `briefing.mjs`.

**Files:**
- Modify: `scripts/lib/briefing/collect.mjs`
- Modify: `scripts/lib/briefing.mjs`
- Create: `tests/collect-model-compliance.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// tests/collect-model-compliance.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

// computeModelCompliance is a pure helper — export it for direct testing
import { computeModelCompliance } from "../scripts/lib/briefing/collect.mjs";

test("computeModelCompliance returns null for empty cost reports", () => {
  assert.equal(computeModelCompliance([]), null);
});

test("computeModelCompliance computes sonnetPct from modelMix", () => {
  const reports = [
    { modelMix: [{ model: "claude-sonnet-4-6", usdPct: 0.6 }, { model: "claude-opus-4-7", usdPct: 0.4 }] },
    { modelMix: [{ model: "claude-sonnet-4-6", usdPct: 0.8 }, { model: "claude-opus-4-7", usdPct: 0.2 }] }
  ];
  const result = computeModelCompliance(reports);
  assert.ok(result, "must return result");
  assert.ok(result.sonnetPct > 0, "sonnetPct must be > 0");
  // average of 60% + 80% = 70%
  assert.ok(Math.abs(result.sonnetPct - 70) < 1, `expected ~70, got ${result.sonnetPct}`);
});

test("computeModelCompliance flags non-compliant when sonnetPct < 60", () => {
  const reports = [
    { modelMix: [{ model: "claude-sonnet-4-6", usdPct: 0.3 }, { model: "claude-opus-4-7", usdPct: 0.7 }] },
    { modelMix: [{ model: "claude-sonnet-4-6", usdPct: 0.4 }, { model: "claude-opus-4-7", usdPct: 0.6 }] }
  ];
  const result = computeModelCompliance(reports);
  assert.equal(result.compliant, false);
});

test("computeModelCompliance flags compliant when sonnetPct >= 60", () => {
  const reports = [
    { modelMix: [{ model: "claude-sonnet-4-6", usdPct: 0.7 }, { model: "claude-opus-4-7", usdPct: 0.3 }] }
  ];
  const result = computeModelCompliance(reports);
  assert.equal(result.compliant, true);
});

test("computeModelCompliance handles reports without modelMix", () => {
  const reports = [{ modelMix: null }, { modelMix: [{ model: "claude-sonnet-4-6", usdPct: 0.75 }] }];
  const result = computeModelCompliance(reports);
  // Should not throw; should use the one valid report
  assert.ok(result !== null);
});
```

- [ ] **Step 2: Run test to verify it fails**

```
node --test tests/collect-model-compliance.test.mjs
```

Expected: FAIL — `computeModelCompliance is not a function`

- [ ] **Step 3: Add `computeModelCompliance` and `collectModelCompliance` to `collect.mjs`**

Add after `collectCostAggregate` near the end of the file:

```js
/**
 * Compute Sonnet compliance across a set of cost reports.
 * Returns null if no reports with modelMix are available.
 * @param {Array<{modelMix: Array<{model: string, usdPct: number}>|null|undefined}>} reports
 * @returns {{ sonnetPct: number, compliant: boolean, sliceCount: number } | null}
 */
export function computeModelCompliance(reports) {
  const valid = reports.filter((r) => Array.isArray(r.modelMix) && r.modelMix.length > 0);
  if (valid.length === 0) return null;
  const sonnetSlicePcts = valid.map((r) => {
    const entry = r.modelMix.find((m) => /sonnet/i.test(m.model));
    return entry ? entry.usdPct * 100 : 0;
  });
  const sonnetPct = sonnetSlicePcts.reduce((a, b) => a + b, 0) / sonnetSlicePcts.length;
  return {
    sonnetPct: Math.round(sonnetPct * 10) / 10,
    compliant: sonnetPct >= 60,
    sliceCount: valid.length
  };
}

/**
 * @param {string} repoPath
 * @returns {Promise<{ sonnetPct: number, compliant: boolean, sliceCount: number } | null>}
 */
export async function collectModelCompliance(repoPath) {
  const costs = await collectRecentCosts(repoPath, 5);
  return computeModelCompliance(costs.recent);
}
```

- [ ] **Step 4: Run test to verify it passes**

```
node --test tests/collect-model-compliance.test.mjs
```

Expected: 5/5 pass.

- [ ] **Step 5: Wire modelCompliance into briefing.mjs**

In `buildBriefingReport` (`scripts/lib/briefing.mjs`), add `collectModelCompliance` to the parallel fetches:

```js
import { collectModelCompliance } from "./briefing/collect.mjs";

// In buildBriefingReport Promise.all:
const [
  wakeUpBrief,
  gitActivity,
  deploymentClues,
  autonomousLoopBrief,
  costs,
  routingTable,
  costHealth,
  costAggregate,
  modelCompliance    // <-- add
] = await Promise.all([
  // ...existing entries...
  collectCostAggregate(repoPath),
  collectModelCompliance(repoPath)   // <-- add last
]);
```

Add `modelCompliance` to the return object under the cost-related fields:

```js
return {
  // ...existing fields...
  costHealth,
  costAggregate,
  modelCompliance,
  // ...
};
```

- [ ] **Step 6: Run full test suite + validators**

```
node --test && npm run lint && npm run format:check && node ./scripts/validate-agents.mjs
```

Expected: all pass.

- [ ] **Step 7: Commit**

```
git add scripts/lib/briefing/collect.mjs scripts/lib/briefing.mjs tests/collect-model-compliance.test.mjs
git commit -m "feat(brief-me): add modelCompliance field (sonnetPct + compliant) to briefing output"
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

(N = current count + ~21 new tests from Tasks 1–5: 8 scope-estimate + 2 hook-error + 4 hook-health + 2 brief-me-hook-health + 5 model-compliance)

- [ ] **Step 2: Run all validators**

```
npm run lint && npm run format:check && node ./scripts/validate-manifests.mjs && node ./scripts/validate-skills.mjs && node ./scripts/validate-agents.mjs
```

Expected: all exit 0, lint 0 warnings, validate-agents confirms both agent files ≤300 lines.

- [ ] **Step 3: Smoke-test scope-estimate CLI**

```
node scripts/crew.mjs scope-estimate --files "scripts/crew.mjs:894" --repo .
```

Expected: `{ "tier": "heavy", ... }` (894 lines > 800 threshold)

```
node scripts/crew.mjs scope-estimate --files "agents/builder.md:202" --repo .
```

Expected: `{ "tier": "light", ... }`

- [ ] **Step 4: Final commit if anything was auto-formatted**

```
git add -p
git commit -m "chore: format fixes after FEAT-D builder dispatch reliability"
```
