# FEAT-025: Enable noImplicitAny — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable `noImplicitAny: true` in tsconfig.json so LSP and tsc agree on diagnostics, eliminating recurring noise. 808 errors across 29 files resolved via JSDoc annotations with zero runtime change.

**Architecture:** Five slices, each annotating ~6 files grouped by functional area. Slices 1-4 add JSDoc annotations while keeping `noImplicitAny: false` in tsconfig (CI never breaks). Slice 5 flips the flag. Each slice is independently committable and CI-green. Builder dispatches one slice at a time.

**Tech Stack:** JSDoc `@param` / `@type` annotations in Node.js ESM (.mjs). `tsc --noEmit --noImplicitAny` for per-slice verification. No runtime changes — annotations are comments only.

---

## Strategy

- **tsconfig stays at `noImplicitAny: false` through slices 1-4.** Each slice verifies its own files with `npx tsc --noEmit --noImplicitAny 2>&1 | grep <file>` → expect zero output. CI never breaks.
- **Slice 5 flips the flag.** By this point all 29 files are annotated. `npx tsc --noEmit` exits 0 with the flag enabled.
- **Type selection:** use specific types where obvious (`repoPath: string`, `label: string`, `title: string`). Use `any` only where the function genuinely accepts multiple types. Use `Record<string, any>` for object bags (fields, flags, config).
- **No `// @ts-ignore` or `// @ts-expect-error`.** Fix with proper annotations.
- **No multi-line docblocks.** One `@param` line per parameter. Inline `/** @type {X} */` for variable declarations.

## Annotation patterns

### Function parameters (TS7006)
```js
// Before:
function foo(repoPath, label, value) {

// After:
/** @param {string} repoPath @param {string} label @param {any} value */
function foo(repoPath, label, value) {
```

### Object literal properties (TS7018)
```js
// Before:
const flags = { owner: null, summary: null, ... };

// After:
/** @type {Record<string, string | boolean | null>} */
const flags = { owner: null, summary: null, ... };
```

### Arrow function parameters (TS7006 in callbacks)
```js
// Before:
arr.filter((e) => e.name === "x")

// After:
arr.filter((/** @type {any} */ e) => e.name === "x")
```

### Property access on untyped destructured param (TS2339)
```js
// Before:
function foo(repoPath, opts = {}) {
  const { createIfMissing } = opts;

// After:
/** @param {string} repoPath @param {Record<string, any>} [opts] */
function foo(repoPath, opts = {}) {
  const { createIfMissing } = opts;
```

### Object literal with typed properties (TS7018 on many props)
```js
// Before:
const result = { reports: [], target: null, baseline: null };

// After:
/** @type {{ reports: any[], target: any, baseline: any }} */
const result = { reports: [], target: null, baseline: null };
```

### FLAG_SPEC indexing (TS7053)
```js
// Before:
const spec = FLAG_SPEC[token];

// After:
const spec = /** @type {Record<string, {key: string, boolean?: boolean}>} */ (FLAG_SPEC)[token];
```

---

## File map

| Slice | Files | Errors | Area |
|---|---|---|---|
| 1 | crew.mjs, validate-manifests.mjs, validate-skills.mjs, validate-slices.mjs, outcome-linkage.mjs, fleet.mjs | 217 | CLI + validators + misc |
| 2 | workflow-state.mjs, claims.mjs, approvals.mjs, deployment-guidance.mjs, briefing.mjs, wakeup.mjs | 241 | State + infrastructure |
| 3 | session-cost.mjs, cost-advisor.mjs, briefing/render.mjs, briefing/collect.mjs, artifacts.mjs | 280 | Cost + briefing + artifacts |
| 4 | installer.mjs + 11 installer/*.mjs files | 59 | Installer subsystem |
| 5 | tsconfig.json | 0 | Flag flip |

---

## Task 1: CLI + validators + misc (6 files, ~217 errors)

**Files:**
- Modify: `scripts/crew.mjs` (142 errors)
- Modify: `scripts/validate-manifests.mjs` (19 errors)
- Modify: `scripts/validate-skills.mjs` (32 errors)
- Modify: `scripts/validate-slices.mjs` (2 errors)
- Modify: `scripts/lib/outcome-linkage.mjs` (12 errors)
- Modify: `scripts/lib/fleet.mjs` (10 errors)

### Step 1.1: Identify errors per file

```bash
for f in scripts/crew.mjs scripts/validate-manifests.mjs scripts/validate-skills.mjs scripts/validate-slices.mjs scripts/lib/outcome-linkage.mjs scripts/lib/fleet.mjs; do echo "=== $f ===" && npx tsc --noEmit --noImplicitAny 2>&1 | grep "^${f//\\/\\\\}" | head -5 && echo "..."; done
```

- [ ] Run the command, note the error patterns per file

### Step 1.2: Annotate crew.mjs

The `parseArgs` function has ~60 TS7018 errors from the `flags` object literal. Fix with ONE `@type`:

```js
/** @type {Record<string, string | boolean | null>} */
const flags = {
  repo: process.cwd(),
  // ... existing properties unchanged
```

The `parseArgs` function parameter:
```js
/** @param {string[]} argv */
function parseArgs(argv) {
```

The `FLAG_SPEC` indexing at `const spec = FLAG_SPEC[token]`:
```js
const spec = /** @type {Record<string, {key: string, boolean?: boolean}>} */ (FLAG_SPEC)[token];
```

For all other function parameters in the file, add `@param` annotations using the patterns above. Common types in crew.mjs:
- `repoPath` → `string`
- `title`, `feature`, `phase` → `string`
- `advisor` → `Record<string, any>`
- `md` → `string`
- `value` → `any`

- [ ] Add `@type` to flags object literal
- [ ] Add `@param` to `parseArgs`
- [ ] Fix FLAG_SPEC indexing
- [ ] Annotate remaining function parameters

### Step 1.3: Annotate validate-manifests.mjs

Read the file first. Most errors will be function parameters. Apply `@param` annotations.

- [ ] Add JSDoc annotations to all flagged functions

### Step 1.4: Annotate validate-skills.mjs

32 errors. Read and annotate. Watch for the `warnings` array (TS7005 — `implicitly has 'any[]' type`). Fix with:
```js
/** @type {string[]} */
const warnings = [];
```

- [ ] Add JSDoc annotations to all flagged functions and variables

### Step 1.5: Annotate validate-slices.mjs

2 errors (parameters `pendingDir` and `text`). Quick:
```js
/** @param {string} pendingDir */
async function listSliceFiles(pendingDir) {
```
```js
/** @param {string} text */
function findPlaceholders(text) {
```

- [ ] Add the two @param annotations

### Step 1.6: Annotate outcome-linkage.mjs + fleet.mjs

12 + 10 errors. Read each, add `@param` annotations.

- [ ] Annotate outcome-linkage.mjs
- [ ] Annotate fleet.mjs

### Step 1.7: Verify zero errors for these files

```bash
npx tsc --noEmit --noImplicitAny 2>&1 | grep -E "^scripts/(crew|validate-manifests|validate-skills|validate-slices|lib/outcome-linkage|lib/fleet)\.mjs"
```

Expected: no output (zero errors for these 6 files).

- [ ] Run the command, confirm no output

### Step 1.8: Run full CI + commit

```bash
npm run lint && npm run format:check && npm run typecheck && npm test
```

Expected: all pass (typecheck still uses `noImplicitAny: false` — no regressions).

```bash
npx prettier --write scripts/crew.mjs scripts/validate-manifests.mjs scripts/validate-skills.mjs scripts/validate-slices.mjs scripts/lib/outcome-linkage.mjs scripts/lib/fleet.mjs
```

```bash
git add scripts/crew.mjs scripts/validate-manifests.mjs scripts/validate-skills.mjs scripts/validate-slices.mjs scripts/lib/outcome-linkage.mjs scripts/lib/fleet.mjs
git commit -m "chore(types): annotate CLI + validators for noImplicitAny (FEAT-025 slice 1/5)

JSDoc @param/@type annotations on crew.mjs, validate-manifests.mjs,
validate-skills.mjs, validate-slices.mjs, outcome-linkage.mjs, fleet.mjs.
217 implicit-any errors resolved. Runtime unchanged.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

- [ ] Format, lint, test, commit

---

## Task 2: State + infrastructure (6 files, ~241 errors)

**Files:**
- Modify: `scripts/lib/workflow-state.mjs` (142 errors)
- Modify: `scripts/lib/claims.mjs` (30 errors)
- Modify: `scripts/lib/approvals.mjs` (28 errors)
- Modify: `scripts/lib/deployment-guidance.mjs` (39 errors)
- Modify: `scripts/lib/briefing.mjs` (2 errors)
- Modify: `scripts/lib/wakeup.mjs` (41 errors)

### Step 2.1: Identify errors per file

```bash
for f in scripts/lib/workflow-state.mjs scripts/lib/claims.mjs scripts/lib/approvals.mjs scripts/lib/deployment-guidance.mjs scripts/lib/briefing.mjs scripts/lib/wakeup.mjs; do echo "=== $f ===" && npx tsc --noEmit --noImplicitAny 2>&1 | grep "^${f//\\/\\\\}" | head -5 && echo "..."; done
```

- [ ] Run the command, note the error patterns

### Step 2.2: Annotate workflow-state.mjs

Heaviest lib (142 errors). Expect many function params + object literal properties in state-management functions. Use `Record<string, any>` for state objects, `string` for repoPath/badge/note, `any` for polymorphic values.

- [ ] Read file, add JSDoc annotations to all flagged positions

### Step 2.3: Annotate claims.mjs + approvals.mjs

Both have functions accepting `(repoPath, opts = {})` patterns. Fix with:
```js
/** @param {string} repoPath @param {Record<string, any>} [opts] */
```

Watch for TS2339 errors ("Property X does not exist on type '{}'") on destructured opts — these are fixed by typing the opts parameter as `Record<string, any>`.

- [ ] Annotate claims.mjs
- [ ] Annotate approvals.mjs

### Step 2.4: Annotate deployment-guidance.mjs + briefing.mjs + wakeup.mjs

- [ ] Annotate deployment-guidance.mjs (39 errors)
- [ ] Annotate briefing.mjs (2 errors)
- [ ] Annotate wakeup.mjs (41 errors)

### Step 2.5: Verify + CI + commit

```bash
npx tsc --noEmit --noImplicitAny 2>&1 | grep -E "^scripts/lib/(workflow-state|claims|approvals|deployment-guidance|briefing|wakeup)\.mjs"
```

Expected: no output.

```bash
npx prettier --write scripts/lib/workflow-state.mjs scripts/lib/claims.mjs scripts/lib/approvals.mjs scripts/lib/deployment-guidance.mjs scripts/lib/briefing.mjs scripts/lib/wakeup.mjs
npm run lint && npm run format:check && npm run typecheck && npm test
```

```bash
git add scripts/lib/workflow-state.mjs scripts/lib/claims.mjs scripts/lib/approvals.mjs scripts/lib/deployment-guidance.mjs scripts/lib/briefing.mjs scripts/lib/wakeup.mjs
git commit -m "chore(types): annotate state + infra libs for noImplicitAny (FEAT-025 slice 2/5)

JSDoc annotations on workflow-state.mjs, claims.mjs, approvals.mjs,
deployment-guidance.mjs, briefing.mjs, wakeup.mjs. 241 errors resolved.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

- [ ] Format, lint, test, commit

---

## Task 3: Cost + briefing + artifacts (5 files, ~280 errors)

**Files:**
- Modify: `scripts/lib/session-cost.mjs` (80 errors)
- Modify: `scripts/lib/cost-advisor.mjs` (44 errors)
- Modify: `scripts/lib/briefing/render.mjs` (53 errors)
- Modify: `scripts/lib/briefing/collect.mjs` (51 errors)
- Modify: `scripts/lib/artifacts.mjs` (52 errors)

### Step 3.1: Identify errors per file

```bash
for f in scripts/lib/session-cost.mjs scripts/lib/cost-advisor.mjs scripts/lib/briefing/render.mjs scripts/lib/briefing/collect.mjs scripts/lib/artifacts.mjs; do echo "=== $f ===" && npx tsc --noEmit --noImplicitAny 2>&1 | grep "^${f//\\/\\\\}" | head -5 && echo "..."; done
```

- [ ] Run the command, note patterns

### Step 3.2: Annotate session-cost.mjs

80 errors. Many numeric computations + token counting. Use `number` for numeric params, `string` for paths, `Record<string, any>` for parsed JSON objects.

- [ ] Read file, add JSDoc annotations

### Step 3.3: Annotate cost-advisor.mjs

44 errors. Functions parse cost-report bodies + produce recommendations. Use `string` for body/label, `any[]` for report arrays, `Record<string, any>` for advisor objects.

Watch for the object literal at line ~461 with multiple typed properties (TS7018). Use:
```js
/** @type {{ reports: any[], target: any, baseline: any, recommendations: any[] }} */
```

- [ ] Annotate cost-advisor.mjs

### Step 3.4: Annotate briefing/render.mjs + briefing/collect.mjs

Both part of the briefing subsystem. `render.mjs` takes pre-collected data and produces markdown. `collect.mjs` reads files and produces the data.

- [ ] Annotate briefing/render.mjs (53 errors)
- [ ] Annotate briefing/collect.mjs (51 errors)

### Step 3.5: Annotate artifacts.mjs

52 errors. The render functions `(f) => [...]` need `/** @param {Record<string, any>} f */`. The `renderField`, `renderListField` helpers need `(label: string, value: any)`. The existing `/** @type {import('node:fs').Dirent[]} */` cast on line ~505 must be preserved.

- [ ] Annotate artifacts.mjs (preserve existing Dirent[] cast)

### Step 3.6: Verify + CI + commit

```bash
npx tsc --noEmit --noImplicitAny 2>&1 | grep -E "^scripts/lib/(session-cost|cost-advisor|briefing/render|briefing/collect|artifacts)\.mjs"
```

Expected: no output.

```bash
npx prettier --write scripts/lib/session-cost.mjs scripts/lib/cost-advisor.mjs scripts/lib/briefing/render.mjs scripts/lib/briefing/collect.mjs scripts/lib/artifacts.mjs
npm run lint && npm run format:check && npm run typecheck && npm test
```

```bash
git add scripts/lib/session-cost.mjs scripts/lib/cost-advisor.mjs scripts/lib/briefing/render.mjs scripts/lib/briefing/collect.mjs scripts/lib/artifacts.mjs
git commit -m "chore(types): annotate cost + briefing + artifacts for noImplicitAny (FEAT-025 slice 3/5)

JSDoc annotations on session-cost.mjs, cost-advisor.mjs, briefing/render.mjs,
briefing/collect.mjs, artifacts.mjs. 280 errors resolved.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

- [ ] Format, lint, test, commit

---

## Task 4: Installer subsystem (12 files, ~59 errors)

**Files:**
- Modify: `scripts/lib/installer.mjs` (12 errors)
- Modify: `scripts/lib/installer/legacy-migration.mjs` (11 errors)
- Modify: `scripts/lib/installer/util.mjs` (8 errors)
- Modify: `scripts/lib/installer/settings.mjs` (8 errors)
- Modify: `scripts/lib/installer/welcome.mjs` (4 errors)
- Modify: `scripts/lib/installer/claude-md.mjs` (4 errors)
- Modify: `scripts/lib/installer/global.mjs` (3 errors)
- Modify: `scripts/lib/installer/gitignore.mjs` (3 errors)
- Modify: `scripts/lib/installer/repo-guides.mjs` (2 errors)
- Modify: `scripts/lib/installer/harness-files.mjs` (2 errors)
- Modify: `scripts/lib/installer/templates.mjs` (1 error)
- Modify: `scripts/lib/installer/audit.mjs` (1 error)

### Step 4.1: Annotate all installer files

59 total errors across 12 small files. Each file has 1-12 errors — mostly function parameters. Read each, add `@param` annotations. All in the same functional area (harness installation).

- [ ] Annotate installer.mjs
- [ ] Annotate installer/legacy-migration.mjs
- [ ] Annotate installer/util.mjs
- [ ] Annotate installer/settings.mjs
- [ ] Annotate installer/welcome.mjs
- [ ] Annotate installer/claude-md.mjs
- [ ] Annotate installer/global.mjs
- [ ] Annotate installer/gitignore.mjs
- [ ] Annotate installer/repo-guides.mjs
- [ ] Annotate installer/harness-files.mjs
- [ ] Annotate installer/templates.mjs
- [ ] Annotate installer/audit.mjs

### Step 4.2: Verify + CI + commit

```bash
npx tsc --noEmit --noImplicitAny 2>&1 | grep "^scripts/lib/installer"
```

Expected: no output.

```bash
npx prettier --write scripts/lib/installer.mjs scripts/lib/installer/*.mjs
npm run lint && npm run format:check && npm run typecheck && npm test
```

```bash
git add scripts/lib/installer.mjs scripts/lib/installer/*.mjs
git commit -m "chore(types): annotate installer subsystem for noImplicitAny (FEAT-025 slice 4/5)

JSDoc annotations on installer.mjs and 11 installer/*.mjs files.
59 errors resolved.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

- [ ] Format, lint, test, commit

---

## Task 5: Flip the flag (1 file, 0 new errors)

**Files:**
- Modify: `tsconfig.json`

### Step 5.1: Full verification before flip

All 29 files should now have zero errors under `--noImplicitAny`:

```bash
npx tsc --noEmit --noImplicitAny 2>&1
```

Expected: no output, exit 0. If any errors remain, fix them before proceeding.

- [ ] Run the command, confirm zero errors

### Step 5.2: Flip the flag

In `tsconfig.json`, change:
```json
"noImplicitAny": false
```
to:
```json
"noImplicitAny": true
```

- [ ] Edit tsconfig.json

### Step 5.3: Full CI suite

```bash
npm run lint && npm run format:check && npm run typecheck && npm test && node ./scripts/validate-manifests.mjs && node ./scripts/validate-skills.mjs && node ./scripts/validate-slices.mjs && node ./scripts/e2e-smoke.mjs
```

Expected: ALL pass. `npm run typecheck` now runs with `noImplicitAny: true`.

- [ ] Run full CI, confirm all green

### Step 5.4: Close FEAT-025 + commit

Move `docs/backlog/pending/FEAT-025.md` to `docs/backlog/done/FEAT-025.md` and set `status: done`.

```bash
mv docs/backlog/pending/FEAT-025.md docs/backlog/done/FEAT-025.md
```

Edit the frontmatter to change `status: pending` → `status: done`.

```bash
git add tsconfig.json docs/backlog/done/FEAT-025.md docs/backlog/pending/FEAT-025.md
git commit -m "chore(types): enable noImplicitAny in tsconfig (FEAT-025 slice 5/5)

808 implicit-any errors resolved across 29 files in slices 1-4.
LSP and tsc now agree on diagnostics — no more recurring noise.
No runtime changes; all 71+ tests pass.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

- [ ] Move FEAT-025 to done, commit

---

## Post-delivery verification

After all 5 slices land:

1. `npm run typecheck` — exits 0 with `noImplicitAny: true`
2. `npm test` — 71+ tests pass
3. Start a new session → LSP should show zero `×` errors on scripts/**/*.mjs (only `✶` warnings if any remain from other strict flags)
4. `git log --oneline v0.3.5..HEAD` — should show 5 `chore(types):` commits + 1 `feat(crew):` (decision allow-list already landed)
