# FEAT-A: Complexity Debt Reduction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all 3 `eslint-disable-next-line complexity` suppressions and split 4 oversized library files (955/874/844/794 lines) into focused sub-modules, keeping all exports backward-compatible.

**Architecture:** Pure structural refactor — no logic changes. Each extraction follows the same pattern: read function body from source file, create a new named file with `export`, add a named import in the original file. All existing tests must pass before and after each step. The 3 eslint-disable suppressed functions are in `scripts/crew.mjs` (lines ~407–469 and ~805–890) and `scripts/lib/artifacts.mjs` (lines ~295–347). The 4 oversized files are in `scripts/lib/`.

**Tech Stack:** Node.js ESM, `node:fs/promises`. No new dependencies.

---

## Pre-flight: understand what you're extracting

Before starting, run these to confirm line counts and suppression locations:

```
wc -l scripts/crew.mjs scripts/lib/artifacts.mjs scripts/lib/briefing/collect.mjs scripts/lib/cost-advisor.mjs scripts/lib/session-cost.mjs scripts/lib/workflow-state.mjs
grep -n "eslint-disable-next-line complexity" scripts/crew.mjs scripts/lib/artifacts.mjs
```

Expected suppressions:
- `scripts/crew.mjs:407` — `maybeEmitCostReport`
- `scripts/crew.mjs:804` — `"cost-slice"` command handler
- `scripts/lib/artifacts.mjs:294` — `renderCostReportFrontmatter`

---

## File Structure

| Source file | Lines | Extract to |
|-------------|-------|-----------|
| `scripts/crew.mjs` | 894 | `scripts/lib/cost-hygiene/emit-cost-report.mjs` (maybeEmitCostReport) |
| `scripts/lib/artifacts.mjs` | 743 | `scripts/lib/cost-hygiene/render-frontmatter.mjs` (renderCostReportFrontmatter) |
| `scripts/crew.mjs` | 894 | `scripts/lib/cost-slice-handler.mjs` (cost-slice command body) |
| `scripts/lib/briefing/collect.mjs` | 955 | `scripts/lib/briefing/collect-cost.mjs` (cost-parsing functions lines ~550–955) |
| `scripts/lib/cost-advisor.mjs` | 874 | `scripts/lib/cost-advisor-thresholds.mjs` (threshold/scoring functions) |
| `scripts/lib/session-cost.mjs` | 844 | `scripts/lib/session-cost-render.mjs` (report rendering functions) |
| `scripts/lib/workflow-state.mjs` | 794 | `scripts/lib/workflow-state-badges.mjs` (applyBadge + BADGE_TABLE, lines ~537–650) |

---

### Task 1: Extract renderCostReportFrontmatter (artifacts.mjs → render-frontmatter.mjs)

**Files:**
- Create: `scripts/lib/cost-hygiene/render-frontmatter.mjs`
- Modify: `scripts/lib/artifacts.mjs` (remove function body, add import, remove eslint-disable)

- [ ] **Step 1: Read the function**

Open `scripts/lib/artifacts.mjs`. Read lines 294–347 (`renderCostReportFrontmatter` function, from the `eslint-disable-next-line` comment through the closing `}`).

Confirm it uses: `fields`, `breakdown`, `outcome`, `totalTokens`, `cacheHitPct`, `variant`. It calls no other functions from `artifacts.mjs` — it only formats values inline.

- [ ] **Step 2: Create the new file**

Create `scripts/lib/cost-hygiene/render-frontmatter.mjs`:

```js
// Extracted from scripts/lib/artifacts.mjs — renderCostReportFrontmatter.
// Kept in cost-hygiene/ because it formats cost-report YAML frontmatter.

/**
 * @param {import("../artifacts.mjs").ArtifactFields} fields
 * @param {import("../session-cost.mjs").CostBreakdown | undefined} breakdown
 * @param {import("../artifacts.mjs").CostOutcome | null} outcome
 * @param {number} totalTokens
 * @param {number | string} cacheHitPct
 * @param {"slice" | "aggregate" | null} [variant]
 */
export function renderCostReportFrontmatter(
  fields,
  breakdown,
  outcome,
  totalTokens,
  cacheHitPct,
  variant = null
) {
  // PASTE the full function body from artifacts.mjs lines 295–347 here (everything between
  // the opening `{` and closing `}`). Do not modify any logic.
}
```

Paste the exact body. Save.

- [ ] **Step 3: Update artifacts.mjs**

In `scripts/lib/artifacts.mjs`:

1. At the top of the file (after existing imports), add:
```js
import { renderCostReportFrontmatter } from "./cost-hygiene/render-frontmatter.mjs";
```

2. Delete lines 293–347 (the `eslint-disable-next-line` comment + the entire `renderCostReportFrontmatter` function body). The import above makes it available.

- [ ] **Step 4: Verify no lint errors**

```
npm run lint
```

Expected: 0 warnings. If TypeScript JSDoc errors appear, check that the `@param` types in the new file match the originals.

- [ ] **Step 5: Run tests**

```
node --test 2>&1 | grep -E "fail|pass" | tail -4
```

Expected: 0 fail. If any tests fail, the extraction changed behavior — compare the pasted body against the original line-for-line.

- [ ] **Step 6: Commit**

```
git add scripts/lib/cost-hygiene/render-frontmatter.mjs scripts/lib/artifacts.mjs
git commit -m "refactor(artifacts): extract renderCostReportFrontmatter — removes eslint-disable"
```

---

### Task 2: Extract maybeEmitCostReport (crew.mjs → emit-cost-report.mjs)

**Files:**
- Create: `scripts/lib/cost-hygiene/emit-cost-report.mjs`
- Modify: `scripts/crew.mjs` (remove function, add import)

- [ ] **Step 1: Read the function**

Open `scripts/crew.mjs`. Read lines 406–469 (the `eslint-disable-next-line` comment + `async function maybeEmitCostReport` through its closing `}`).

The function imports: `workflow-state.mjs`, `session-cost.mjs`, `outcome-linkage.mjs`, `artifacts.mjs`. These are dynamic `await import(...)` calls inside the function body. Keep them as-is (or convert to static imports at the top of the new file — either is fine, but static is cleaner).

- [ ] **Step 2: Create the new file**

Create `scripts/lib/cost-hygiene/emit-cost-report.mjs`:

```js
// Extracted from scripts/crew.mjs — maybeEmitCostReport.
// Handles per-slice + aggregate cost report emission at run completion.

import { loadWorkflowState } from "../workflow-state.mjs";
import { computeSessionCost } from "../session-cost.mjs";
import { collectOutcomeLinkage } from "../outcome-linkage.mjs";
import { writeArtifact } from "../artifacts.mjs";
import { emitCostAdvise } from "./advise.mjs"; // already exists in cost-hygiene/

/**
 * @param {string} repoPath
 * @param {{ runTitle?: string | null, feature?: string | null, phase?: string | null }} [options]
 */
export async function maybeEmitCostReport(repoPath, options = {}) {
  // PASTE full function body from crew.mjs lines 408–469 here.
  // Remove the dynamic await import() calls for the 4 modules above — use the
  // static imports at the top of this file instead (already declared above).
}
```

Note: if `emitCostAdvise` is already in `cost-hygiene/advise.mjs` or similar, adjust the import path. Run `grep -rn "emitCostAdvise\|writeCostAdvise" scripts/` to confirm the actual path.

- [ ] **Step 3: Update crew.mjs**

In `scripts/crew.mjs`:

1. Near the top imports section, add:
```js
import { maybeEmitCostReport } from "./lib/cost-hygiene/emit-cost-report.mjs";
```

2. Delete lines 405–469 (the `eslint-disable-next-line` comment + the entire `maybeEmitCostReport` function). The function is now imported.

- [ ] **Step 4: Verify lint + tests**

```
npm run lint && node --test 2>&1 | grep -E "fail|pass" | tail -4
```

Expected: 0 warnings, 0 fail.

- [ ] **Step 5: Commit**

```
git add scripts/lib/cost-hygiene/emit-cost-report.mjs scripts/crew.mjs
git commit -m "refactor(crew): extract maybeEmitCostReport — removes eslint-disable"
```

---

### Task 3: Extract cost-slice handler (crew.mjs → cost-slice-handler.mjs)

**Files:**
- Create: `scripts/lib/cost-slice-handler.mjs`
- Modify: `scripts/crew.mjs` (replace inline handler body with import)

- [ ] **Step 1: Read the handler**

Open `scripts/crew.mjs`. Read lines ~804–890 (the `// eslint-disable-next-line complexity` comment + the `"cost-slice": async ({ repoPath, flags }) => { ... }` body through its closing `}`).

- [ ] **Step 2: Create the new file**

Create `scripts/lib/cost-slice-handler.mjs`:

```js
// Extracted from scripts/crew.mjs — the cost-slice command handler body.

import { loadWorkflowState } from "./workflow-state.mjs";
import { computeSessionCost } from "./session-cost.mjs";
import { collectOutcomeLinkage } from "./outcome-linkage.mjs";
import { writeArtifact } from "./artifacts.mjs";

/**
 * @param {{ repoPath: string, flags: Record<string, unknown> }} ctx
 */
export async function handleCostSlice({ repoPath, flags }) {
  // PASTE the full handler body here (everything inside the async arrow function).
  // Remove any dynamic await import() calls for the modules imported statically above.
}
```

- [ ] **Step 3: Update crew.mjs**

1. Add import near the top:
```js
import { handleCostSlice } from "./lib/cost-slice-handler.mjs";
```

2. Replace the `"cost-slice"` command handler in crew.mjs with:
```js
  // eslint comments removed — body extracted to lib/cost-slice-handler.mjs
  "cost-slice": handleCostSlice,
```

Note: if the command table expects `async (ctx) => ...` shape rather than a named function, wrap it: `"cost-slice": async (ctx) => handleCostSlice(ctx)`.

- [ ] **Step 4: Verify lint + tests**

```
npm run lint && node --test 2>&1 | grep -E "fail|pass" | tail -4
```

Expected: 0 eslint-disable comments remain in crew.mjs for complexity, 0 test failures.

Confirm with:
```
grep "eslint-disable.*complexity" scripts/crew.mjs scripts/lib/artifacts.mjs
```

Expected: no output (all 3 suppressions gone).

- [ ] **Step 5: Commit**

```
git add scripts/lib/cost-slice-handler.mjs scripts/crew.mjs
git commit -m "refactor(crew): extract cost-slice handler — removes last eslint-disable-complexity"
```

---

### Task 4: Split collect.mjs (955L → collect.mjs + collect-cost.mjs)

`collect.mjs` has two responsibilities: workflow/artifact activity collection (lines 1–550) and cost report parsing + aggregation (lines ~550–955). Split at the boundary.

**Files:**
- Create: `scripts/lib/briefing/collect-cost.mjs`
- Modify: `scripts/lib/briefing/collect.mjs` (keep workflow half, import cost half)

- [ ] **Step 1: Identify the split boundary**

Run:
```
grep -n "^function\|^export\|^async" scripts/lib/briefing/collect.mjs
```

The cost-parsing functions start around line 552 (`parseCostReportText`). Everything from `parseCostReportText` through `fetchAutonomousLoopBrief` (line ~944) is the cost half. The workflow half is lines 1–551 (`collectGitActivity`, `collectRelevantArtifacts`, helpers).

Confirm: the public exports are `collectGitActivity`, `collectRelevantArtifacts`, `collectRecentCosts`, `collectCostHealth`, `collectCostAggregate`, `fetchAutonomousLoopBrief`. The first two stay in collect.mjs; the last four move to collect-cost.mjs.

- [ ] **Step 2: Create collect-cost.mjs**

Create `scripts/lib/briefing/collect-cost.mjs`:

```js
// Cost report parsing and aggregation — extracted from collect.mjs.
// Consumers: scripts/lib/briefing/collect.mjs (re-exports), scripts/lib/wakeup.mjs, etc.

// PASTE lines ~552–955 from collect.mjs here (from parseCostReportText through
// fetchAutonomousLoopBrief including all private helpers in between).
// Add `export` to: collectRecentCosts, collectCostHealth, collectCostAggregate, fetchAutonomousLoopBrief.
// Private helpers (parseCostReportText, listCostReportFilesByMtime, etc.) stay unexported.
```

- [ ] **Step 3: Update collect.mjs**

1. Delete lines ~552–955 from `collect.mjs`.
2. Add at the bottom of `collect.mjs`:
```js
export { collectRecentCosts, collectCostHealth, collectCostAggregate, fetchAutonomousLoopBrief } from "./collect-cost.mjs";
```

This re-export keeps all existing consumers unaffected — they import from `collect.mjs` and still get all 6 exports.

- [ ] **Step 4: Verify line counts + tests**

```
wc -l scripts/lib/briefing/collect.mjs scripts/lib/briefing/collect-cost.mjs
node --test 2>&1 | grep -E "fail|pass" | tail -4
```

Expected: `collect.mjs` < 600L, 0 test failures.

- [ ] **Step 5: Commit**

```
git add scripts/lib/briefing/collect.mjs scripts/lib/briefing/collect-cost.mjs
git commit -m "refactor(briefing): split collect.mjs — cost parsing extracted to collect-cost.mjs"
```

---

### Task 5: Split cost-advisor.mjs (874L → + cost-advisor-thresholds.mjs)

**Files:**
- Create: `scripts/lib/cost-advisor-thresholds.mjs`
- Modify: `scripts/lib/cost-advisor.mjs`

- [ ] **Step 1: Identify threshold/scoring functions**

Run:
```
grep -n "^function\|^export\|^const.*=.*function\|^async" scripts/lib/cost-advisor.mjs | head -30
```

Find all pure functions that only compute thresholds, scores, or category boundaries without reading files or invoking async work. These are the candidates for extraction. Typically: `computeScore`, `categorize`, `applyThreshold`, `deriveGrade`, and similar.

- [ ] **Step 2: Create cost-advisor-thresholds.mjs**

Create `scripts/lib/cost-advisor-thresholds.mjs`:

```js
// Pure threshold/scoring helpers extracted from cost-advisor.mjs.
// No file I/O — all inputs are numbers, outputs are strings/numbers.

// PASTE the identified pure threshold functions here with `export` added.
```

- [ ] **Step 3: Update cost-advisor.mjs**

1. Remove the moved function bodies.
2. Add import:
```js
import { /* extracted names */ } from "./cost-advisor-thresholds.mjs";
```

- [ ] **Step 4: Verify**

```
wc -l scripts/lib/cost-advisor.mjs
node --test 2>&1 | grep -E "fail|pass" | tail -4
```

Expected: `cost-advisor.mjs` < 500L, 0 fail.

- [ ] **Step 5: Commit**

```
git add scripts/lib/cost-advisor.mjs scripts/lib/cost-advisor-thresholds.mjs
git commit -m "refactor(cost-advisor): extract threshold/scoring helpers"
```

---

### Task 6: Split session-cost.mjs (844L → + session-cost-render.mjs)

**Files:**
- Create: `scripts/lib/session-cost-render.mjs`
- Modify: `scripts/lib/session-cost.mjs`

- [ ] **Step 1: Identify rendering functions**

Run:
```
grep -n "^function\|^export" scripts/lib/session-cost.mjs | head -30
```

Report-rendering functions (those that return strings/markdown rather than computing numeric costs) are the extraction candidates. Typically: `formatCostReport`, `renderSection`, `buildMarkdown`, or similar.

- [ ] **Step 2: Create session-cost-render.mjs**

```js
// Report rendering helpers extracted from session-cost.mjs.
// Inputs: cost objects. Outputs: markdown strings. No file I/O.

// PASTE identified rendering functions here with `export` added.
```

- [ ] **Step 3: Update session-cost.mjs**

Remove moved bodies, add import from `./session-cost-render.mjs`.

- [ ] **Step 4: Verify**

```
wc -l scripts/lib/session-cost.mjs
node --test 2>&1 | grep -E "fail|pass" | tail -4
```

Expected: < 500L, 0 fail.

- [ ] **Step 5: Commit**

```
git add scripts/lib/session-cost.mjs scripts/lib/session-cost-render.mjs
git commit -m "refactor(session-cost): extract rendering helpers"
```

---

### Task 7: Split workflow-state.mjs (794L → + workflow-state-badges.mjs)

**Files:**
- Create: `scripts/lib/workflow-state-badges.mjs`
- Modify: `scripts/lib/workflow-state.mjs`

- [ ] **Step 1: Identify badge functions**

Run:
```
grep -n "Badge\|badge\|BADGE" scripts/lib/workflow-state.mjs | head -20
```

Expected candidates: `BADGE_TABLE` constant (line ~537), `applyBadge` (line ~573), `markWorkflowBadge` (line ~598). These form a cohesive badge sub-module.

- [ ] **Step 2: Create workflow-state-badges.mjs**

```js
// Badge application helpers extracted from workflow-state.mjs.
// BADGE_TABLE maps badge names to gate selectors; applyBadge mutates a run.

import { loadWorkflowState } from "./workflow-state.mjs";

// PASTE BADGE_TABLE constant and applyBadge + markWorkflowBadge function bodies here.
// Export: markWorkflowBadge (public), applyBadge (used by registerWorkflowArtifact in workflow-state.mjs).
export { markWorkflowBadge, applyBadge };
```

Note: `markWorkflowBadge` uses `loadWorkflowState` which stays in `workflow-state.mjs` — import it back. Circular import risk: if `workflow-state.mjs` also calls `applyBadge`, use a local copy or re-import from this file.

Check for circular deps with:
```
node --input-type=module <<'EOF'
import "./scripts/lib/workflow-state-badges.mjs"
EOF
```

If circular, keep `applyBadge` in `workflow-state.mjs` and only move `markWorkflowBadge` + `BADGE_TABLE`.

- [ ] **Step 3: Update workflow-state.mjs**

Remove moved bodies. Add import. Re-export `markWorkflowBadge` for backward compat:
```js
export { markWorkflowBadge } from "./workflow-state-badges.mjs";
```

- [ ] **Step 4: Verify**

```
wc -l scripts/lib/workflow-state.mjs scripts/lib/workflow-state-badges.mjs
node --test 2>&1 | grep -E "fail|pass" | tail -4
```

Expected: `workflow-state.mjs` < 500L, 0 fail.

- [ ] **Step 5: Commit**

```
git add scripts/lib/workflow-state.mjs scripts/lib/workflow-state-badges.mjs
git commit -m "refactor(workflow-state): extract badge helpers"
```

---

### Task 8: Final verification

- [ ] **Step 1: Confirm all eslint-disable complexity suppression lines gone**

```
grep -rn "eslint-disable.*complexity" scripts/
```

Expected: no output.

- [ ] **Step 2: Run full suite**

```
node --test 2>&1 | tail -8
npm run lint
npm run format:check
node ./scripts/validate-manifests.mjs
node ./scripts/validate-agents.mjs
```

Expected: all pass, 0 warnings.

- [ ] **Step 3: Confirm AC-3 line counts met**

```
wc -l scripts/lib/briefing/collect.mjs scripts/lib/cost-advisor.mjs scripts/lib/session-cost.mjs scripts/lib/workflow-state.mjs
```

Expected: collect < 600, cost-advisor < 500, session-cost < 500, workflow-state < 500.
