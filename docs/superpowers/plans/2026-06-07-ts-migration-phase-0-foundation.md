# TS Migration — Phase 0: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay TypeScript tooling foundation for the hero-crew repo without renaming any existing `.mjs` source. Ship three shared TS modules (`result.ts`, `ids.ts`, `schemas.ts`), flip `tsconfig.json` to strict for new TS files only (existing `.mjs` keeps loose JSDoc-only checking), bump CI to Node 22, run typecheck + test on both extensions, and capture a baseline metrics doc for subsequent phases to measure against.

**Architecture:** `tsconfig.json` widens `include` to accept `.ts` files; flips `strict: true` + related options; sets `checkJs: false` so existing `.mjs` files are not strict-checked during migration (migrate-first thesis — files become strict when renamed). New TS modules in `scripts/lib/` provide the type/error-model foundation: `Result<T,E>` (typed domain errors), branded id types (`RepoPath`, `SliceId`, …), Zod schemas validating JSON-on-disk boundaries. Test runner gains `--experimental-strip-types` flag; CI Node bumped 20 → 22 (min strip-types stable version 22.6+). Baseline doc records current LoC, lint warning count, brief-me timings.

**Tech Stack:** TypeScript 6 (already installed), Zod 3 (new dep), Node 22.6+ with `--experimental-strip-types`, ESLint 9 flat config, `node --test`.

**Spec reference:** `docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md` § Phase 0.

**Out of scope for Phase 0 (deferred to subsequent phase plans):**
- Renaming any existing `.mjs` to `.ts` (Phase 1).
- Tightening ESLint thresholds (Phase 5 ratchet).
- Adding `@typescript-eslint` plugin (Phase 1 — needs at least one `.ts` source file to enforce on).
- Perf wins 1–10 (parallel track, separate plan).

---

## File Structure

**Created:**
- `scripts/lib/result.ts` — `Result<T,E>` type + `ok`, `err`, `map`, `flatMap` helpers
- `scripts/lib/ids.ts` — branded types: `RepoPath`, `SliceId`, `FeatId`, `ArtifactPath`, `CostReportPath`, `BadgeName` + smart-constructor functions
- `scripts/lib/schemas.ts` — Zod schemas (Phase 0 ships only `WorkflowStateSchema`; subsequent phases add more)
- `tests/result.test.ts` — Result helpers unit tests
- `tests/ids.test.ts` — branded-id smart constructor tests
- `tests/schemas.test.ts` — WorkflowStateSchema unit + fixture-driven tests
- `tests/fixtures/workflow-state-valid.json` — happy-path fixture for schema test
- `tests/fixtures/workflow-state-invalid.json` — failure-case fixture for schema test
- `scripts/validate-typegraph.mjs` — advisory CI gate; runs `tsc --noEmit` and reports for `scripts/lib/**` only
- `docs/architecture/ts-migration-baseline.md` — baseline metrics snapshot

**Modified:**
- `tsconfig.json` — strict flags, widened include, `checkJs: false`
- `package.json` — `zod` dep, `typecheck` script tweak (already exists, keep), `test` script gets `--experimental-strip-types`, new `validate:typegraph` script
- `.github/workflows/test.yml` — Node 20 → 22, add `node ./scripts/validate-typegraph.mjs` (advisory), `node --test` invocation updated for strip-types
- `README.md` — min Node 22.6+ note in install section
- `CLAUDE.md` — min Node 22.6+ note in "Local commands" section
- `scripts/e2e-smoke.mjs` — pass `--experimental-strip-types` when spawning the harness against the sample repo
- `scripts/e2e-smoke-ux.mjs` — same

---

## Task 1: Add Zod dependency and verify local Node

**Files:**
- Modify: `package.json` — add `zod` to `devDependencies`
- No new tests yet (Task 5 will exercise the dep).

- [ ] **Step 1.1: Confirm local Node version supports strip-types**

```bash
node --version
```

Expected: `v22.6.0` or higher (e.g. `v24.16.0`). If lower, stop and ask the user to upgrade before continuing — the rest of the plan assumes Node ≥22.6.

- [ ] **Step 1.2: Add zod to devDependencies**

Run:

```bash
npm install --save-dev zod@^3
```

This installs `zod` (latest 3.x) and updates `package.json` + `package-lock.json`. No code uses it yet — Task 5 will.

- [ ] **Step 1.3: Verify install**

Run:

```bash
node -e "console.log(require('zod').z.string().parse('hi'))"
```

Expected output:

```
hi
```

If the require fails, re-run `npm install` and retry.

- [ ] **Step 1.4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(phase-0): add zod ^3 devDependency for boundary schemas"
```

---

## Task 2: Widen tsconfig and flip to strict (with checkJs: false)

**Files:**
- Modify: `tsconfig.json`

- [ ] **Step 2.1: Replace tsconfig contents**

Open `tsconfig.json` and replace it with the following exact contents:

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowJs": true,
    "checkJs": false,
    "noEmit": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "useUnknownInCatchVariables": true,
    "verbatimModuleSyntax": false,
    "isolatedModules": false,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "types": ["node"]
  },
  "include": [
    "scripts/**/*.ts",
    "scripts/**/*.mjs",
    "tests/**/*.ts",
    "hooks/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
```

Three behavior changes vs the previous config:

1. `strict: true` (was implicitly off via `strict: false`). All standards-required strict options now on.
2. `checkJs: false` (was `true`). Existing `.mjs` files are no longer type-checked — they migrate one-by-one in subsequent phases. This is the migrate-first thesis: a file enters strict-land at rename time, not before.
3. `include` widened to pick up `.ts` files in `scripts/`, `tests/`, `hooks/`. Excludes drop `tests` and `.claude`. `node_modules` stays excluded.

- [ ] **Step 2.2: Run typecheck — expect clean**

```bash
npm run typecheck
```

Expected: exit code 0, no output (or `tsc` silent success). Since `checkJs: false` and no `.ts` files exist yet, there is nothing to check.

If errors appear, the JSDoc was being relied upon for type info — that means `checkJs: false` shifted behavior. Restore `checkJs: true` and investigate before continuing.

- [ ] **Step 2.3: Commit**

```bash
git add tsconfig.json
git commit -m "chore(phase-0): tsconfig strict for .ts; checkJs false during migration"
```

---

## Task 3: Create `lib/result.ts` with Result<T,E> + helpers

**Files:**
- Create: `scripts/lib/result.ts`
- Create: `tests/result.test.ts`

- [ ] **Step 3.1: Write the failing test**

Create `tests/result.test.ts` with the following exact contents:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ok, err, map, flatMap, type Result } from '../scripts/lib/result.ts';

test('ok wraps a value', () => {
  const r = ok(42);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value, 42);
});

test('err wraps an error', () => {
  const r = err({ code: 'oops' as const });
  assert.equal(r.ok, false);
  if (!r.ok) assert.deepEqual(r.error, { code: 'oops' });
});

test('map transforms ok value, leaves err unchanged', () => {
  const okIn: Result<number, { code: 'x' }> = ok(2);
  const mapped = map(okIn, (n) => n * 5);
  assert.equal(mapped.ok, true);
  if (mapped.ok) assert.equal(mapped.value, 10);

  const errIn: Result<number, { code: 'x' }> = err({ code: 'x' });
  const mappedErr = map(errIn, (n) => n * 5);
  assert.equal(mappedErr.ok, false);
  if (!mappedErr.ok) assert.deepEqual(mappedErr.error, { code: 'x' });
});

test('flatMap chains Result-returning functions', () => {
  const parse = (s: string): Result<number, { code: 'parse'; raw: string }> => {
    const n = Number(s);
    return Number.isFinite(n) ? ok(n) : err({ code: 'parse', raw: s });
  };
  const startOk = ok('7') as Result<string, { code: 'parse'; raw: string }>;
  const chained = flatMap(startOk, parse);
  assert.equal(chained.ok, true);
  if (chained.ok) assert.equal(chained.value, 7);

  const startBad = ok('not-a-number') as Result<string, { code: 'parse'; raw: string }>;
  const chainedBad = flatMap(startBad, parse);
  assert.equal(chainedBad.ok, false);
  if (!chainedBad.ok) assert.deepEqual(chainedBad.error, { code: 'parse', raw: 'not-a-number' });
});
```

- [ ] **Step 3.2: Run the test — expect failure**

```bash
node --test --experimental-strip-types tests/result.test.ts
```

Expected: failure with `ERR_MODULE_NOT_FOUND` for `../scripts/lib/result.ts` (file does not exist yet).

- [ ] **Step 3.3: Implement `scripts/lib/result.ts`**

Create `scripts/lib/result.ts` with the following exact contents:

```typescript
/**
 * Typed Result for domain operations with expected failure modes.
 *
 * Use for: validation errors, business-rule violations, not-found, conflicts.
 * Do NOT use for: infrastructure errors (fs ENOENT, network) — those still throw
 * and are caught at the CLI entrypoint and mapped to exit codes.
 *
 * See: standards/typescript/coding-conventions.md §Result, §Discriminated unions.
 */
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export const map = <T, U, E>(r: Result<T, E>, f: (t: T) => U): Result<U, E> =>
  r.ok ? ok(f(r.value)) : r;

export const flatMap = <T, U, E>(
  r: Result<T, E>,
  f: (t: T) => Result<U, E>
): Result<U, E> => (r.ok ? f(r.value) : r);
```

- [ ] **Step 3.4: Run the test — expect pass**

```bash
node --test --experimental-strip-types tests/result.test.ts
```

Expected: `# pass 4`, exit 0.

- [ ] **Step 3.5: Run typecheck**

```bash
npm run typecheck
```

Expected: exit 0. Strict mode checks `result.ts` cleanly.

- [ ] **Step 3.6: Commit**

```bash
git add scripts/lib/result.ts tests/result.test.ts
git commit -m "feat(phase-0): Result<T,E> with ok/err/map/flatMap helpers"
```

---

## Task 4: Create `lib/ids.ts` with branded id types

**Files:**
- Create: `scripts/lib/ids.ts`
- Create: `tests/ids.test.ts`

- [ ] **Step 4.1: Write the failing test**

Create `tests/ids.test.ts` with the following exact contents:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RepoPath,
  SliceId,
  FeatId,
  ArtifactPath,
  CostReportPath,
  BadgeName
} from '../scripts/lib/ids.ts';

test('RepoPath constructor brands a string', () => {
  const p = RepoPath('C:\\work\\mega\\hero-crew');
  // structural type is still string at runtime
  assert.equal(typeof p, 'string');
  assert.equal(p as unknown as string, 'C:\\work\\mega\\hero-crew');
});

test('SliceId, FeatId, ArtifactPath, CostReportPath, BadgeName all brand strings', () => {
  const s = SliceId('SLICE-42');
  const f = FeatId('FEAT-100');
  const a = ArtifactPath('.claude/artifacts/crew/runs/foo.md');
  const c = CostReportPath('.claude/artifacts/crew/cost/bar.md');
  const b = BadgeName('review_required');
  assert.equal(s as unknown as string, 'SLICE-42');
  assert.equal(f as unknown as string, 'FEAT-100');
  assert.equal(a as unknown as string, '.claude/artifacts/crew/runs/foo.md');
  assert.equal(c as unknown as string, '.claude/artifacts/crew/cost/bar.md');
  assert.equal(b as unknown as string, 'review_required');
});
```

- [ ] **Step 4.2: Run the test — expect failure**

```bash
node --test --experimental-strip-types tests/ids.test.ts
```

Expected: `ERR_MODULE_NOT_FOUND` for `../scripts/lib/ids.ts`.

- [ ] **Step 4.3: Implement `scripts/lib/ids.ts`**

Create `scripts/lib/ids.ts` with the following exact contents:

```typescript
/**
 * Branded string types for domain identifiers. Prevents accidental string-mixing
 * at call sites — e.g. passing a SliceId where a FeatId is expected is now a
 * compile error.
 *
 * See: standards/typescript/coding-conventions.md §Branded types for IDs.
 */

declare const __brand: unique symbol;
export type Brand<T, B> = T & { readonly [__brand]: B };

export type RepoPath = Brand<string, 'RepoPath'>;
export type SliceId = Brand<string, 'SliceId'>;
export type FeatId = Brand<string, 'FeatId'>;
export type ArtifactPath = Brand<string, 'ArtifactPath'>;
export type CostReportPath = Brand<string, 'CostReportPath'>;
export type BadgeName = Brand<string, 'BadgeName'>;

export const RepoPath = (s: string): RepoPath => s as RepoPath;
export const SliceId = (s: string): SliceId => s as SliceId;
export const FeatId = (s: string): FeatId => s as FeatId;
export const ArtifactPath = (s: string): ArtifactPath => s as ArtifactPath;
export const CostReportPath = (s: string): CostReportPath => s as CostReportPath;
export const BadgeName = (s: string): BadgeName => s as BadgeName;
```

- [ ] **Step 4.4: Run the test — expect pass**

```bash
node --test --experimental-strip-types tests/ids.test.ts
```

Expected: `# pass 2`, exit 0.

- [ ] **Step 4.5: Run typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 4.6: Commit**

```bash
git add scripts/lib/ids.ts tests/ids.test.ts
git commit -m "feat(phase-0): branded id types (RepoPath, SliceId, FeatId, …)"
```

---

## Task 5: Create `lib/schemas.ts` with WorkflowStateSchema

**Files:**
- Create: `scripts/lib/schemas.ts`
- Create: `tests/schemas.test.ts`
- Create: `tests/fixtures/workflow-state-valid.json`
- Create: `tests/fixtures/workflow-state-invalid.json`

- [ ] **Step 5.1: Create the valid fixture**

Create `tests/fixtures/workflow-state-valid.json` with the following exact contents:

```json
{
  "version": "1.0",
  "updatedAt": "2026-06-07T00:00:00.000Z",
  "currentRun": null,
  "recentRuns": []
}
```

- [ ] **Step 5.2: Create the invalid fixture**

Create `tests/fixtures/workflow-state-invalid.json` with the following exact contents:

```json
{
  "version": 1,
  "updatedAt": "yesterday"
}
```

This violates the schema in three ways: `version` should be string, `updatedAt` should be ISO 8601, and `currentRun`/`recentRuns` are required-but-missing.

- [ ] **Step 5.3: Write the failing test**

Create `tests/schemas.test.ts` with the following exact contents:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { WorkflowStateSchema } from '../scripts/lib/schemas.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(path.join(here, 'fixtures', name), 'utf8'));

test('WorkflowStateSchema accepts a valid empty state', () => {
  const result = WorkflowStateSchema.safeParse(fixture('workflow-state-valid.json'));
  assert.equal(result.success, true);
});

test('WorkflowStateSchema rejects malformed state and reports issues', () => {
  const result = WorkflowStateSchema.safeParse(fixture('workflow-state-invalid.json'));
  assert.equal(result.success, false);
  if (!result.success) {
    const codes = result.error.issues.map((i) => i.path.join('.')).sort();
    // version, updatedAt, currentRun, recentRuns all flagged
    assert.ok(codes.includes('version'), `expected 'version' in issues: ${codes.join(', ')}`);
    assert.ok(codes.includes('updatedAt'), `expected 'updatedAt' in issues: ${codes.join(', ')}`);
  }
});

test('WorkflowStateSchema accepts the live repo workflow-state.json', () => {
  const liveStatePath = path.join(here, '..', '.claude', 'state', 'crew', 'workflow-state.json');
  let raw: string;
  try {
    raw = readFileSync(liveStatePath, 'utf8');
  } catch {
    // OK to skip if the file does not exist in a fresh clone
    return;
  }
  const result = WorkflowStateSchema.safeParse(JSON.parse(raw));
  assert.equal(
    result.success,
    true,
    result.success
      ? ''
      : `live workflow-state.json failed schema: ${JSON.stringify(result.error.issues, null, 2)}`
  );
});
```

- [ ] **Step 5.4: Run the test — expect failure**

```bash
node --test --experimental-strip-types tests/schemas.test.ts
```

Expected: `ERR_MODULE_NOT_FOUND` for `../scripts/lib/schemas.ts`.

- [ ] **Step 5.5: Implement `scripts/lib/schemas.ts`**

Create `scripts/lib/schemas.ts` with the following exact contents:

```typescript
/**
 * Zod schemas for every JSON-on-disk boundary the crew CLI reads or writes.
 *
 * Phase 0 ships only WorkflowStateSchema. Subsequent phase plans add:
 * - CostReportFrontmatterSchema
 * - FeatFrontmatterSchema
 * - SliceFrontmatterSchema
 * - MarketplaceSchema
 * - PluginManifestSchema
 * - HandoffArtifactSchema
 * - ReviewArtifactSchema
 * - ValidationArtifactSchema
 * - DeploymentArtifactSchema
 *
 * See: standards/typescript/coding-conventions.md §Runtime validation with Zod,
 *      docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md §Boundary validation policy.
 */
import { z } from 'zod';

const IsoDate = z.string().refine(
  (s) => !Number.isNaN(Date.parse(s)),
  { message: 'expected ISO 8601 date string' }
);

const GateEntry = z.object({
  status: z.string(),
  updatedAt: IsoDate,
  note: z.string().optional()
});

const DeploymentGates = z.object({
  dev: GateEntry.nullable(),
  prod: GateEntry.nullable()
});

const RunGates = z.object({
  review: GateEntry.nullable(),
  validation: GateEntry.nullable(),
  deployment: DeploymentGates,
  blocked: GateEntry.nullable(),
  escalation: GateEntry.nullable()
});

const RunArtifacts = z.object({
  runBrief: z.string().nullable(),
  handoffs: z.array(z.string()),
  reviewResult: z.string().nullable(),
  validationPlan: z.string().nullable(),
  validationResult: z.string().nullable(),
  deploymentChecks: z.object({
    dev: z.string().nullable(),
    prod: z.string().nullable()
  }),
  finalSynthesis: z.string().nullable()
});

const WorkflowRun = z.object({
  title: z.string(),
  goal: z.string(),
  mode: z.string(),
  status: z.string(),
  startedAt: IsoDate,
  updatedAt: IsoDate,
  completedAt: IsoDate.optional(),
  next: z.string(),
  gates: RunGates,
  artifacts: RunArtifacts
});

export const WorkflowStateSchema = z.object({
  version: z.string(),
  updatedAt: IsoDate,
  currentRun: WorkflowRun.nullable(),
  recentRuns: z.array(WorkflowRun)
});

export type WorkflowState = z.infer<typeof WorkflowStateSchema>;
```

- [ ] **Step 5.6: Run the test — expect pass**

```bash
node --test --experimental-strip-types tests/schemas.test.ts
```

Expected: `# pass 3`, exit 0. The "live repo workflow-state.json" test parses the real file under `.claude/state/crew/`. If it fails, the schema needs adjustment to match real-world data — fix the schema, do not loosen the test.

If the live file fails to parse, dump the issues:

```bash
node --experimental-strip-types -e "import('./scripts/lib/schemas.ts').then(m => { const raw = require('fs').readFileSync('.claude/state/crew/workflow-state.json', 'utf8'); const r = m.WorkflowStateSchema.safeParse(JSON.parse(raw)); console.log(r.success ? 'OK' : JSON.stringify(r.error.issues, null, 2)); })"
```

Adjust `schemas.ts` until the live file passes.

- [ ] **Step 5.7: Run typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 5.8: Commit**

```bash
git add scripts/lib/schemas.ts tests/schemas.test.ts tests/fixtures/workflow-state-valid.json tests/fixtures/workflow-state-invalid.json
git commit -m "feat(phase-0): schemas.ts with WorkflowStateSchema + fixture tests"
```

---

## Task 6: Update test runner to use `--experimental-strip-types`

**Files:**
- Modify: `package.json` — `scripts.test`

- [ ] **Step 6.1: Read current scripts.test**

Open `package.json`. Locate the line:

```json
"test": "node --test",
```

- [ ] **Step 6.2: Update test script**

Replace it with:

```json
"test": "node --test --experimental-strip-types",
```

- [ ] **Step 6.3: Run full test suite**

```bash
npm test
```

Expected: every existing `.mjs` test plus the new `.ts` tests pass. Tally should include `tests/result.test.ts`, `tests/ids.test.ts`, `tests/schemas.test.ts`. If a `.mjs` test fails, the strip-types flag is interfering with `.mjs` execution; investigate before continuing. (Strip-types is opt-in per file — `.mjs` files should be unaffected.)

- [ ] **Step 6.4: Commit**

```bash
git add package.json
git commit -m "chore(phase-0): test runner adds --experimental-strip-types"
```

---

## Task 7: Add `validate:typegraph` advisory script

**Files:**
- Create: `scripts/validate-typegraph.mjs`
- Modify: `package.json` — `scripts.validate:typegraph`

This script runs `tsc --noEmit` and reports the type status of `scripts/lib/**` separately from the rest of the repo. Advisory in Phase 0 (continue-on-error in CI); becomes blocking in Phase 5.

- [ ] **Step 7.1: Create the script**

Create `scripts/validate-typegraph.mjs` with the following exact contents:

```javascript
#!/usr/bin/env node
// Phase 0 advisory gate: runs tsc --noEmit and reports.
// Becomes blocking in Phase 5 once every .mjs has migrated.
// See: docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md §Testing strategy.

import { spawnSync } from 'node:child_process';

const result = spawnSync('npx', ['tsc', '--noEmit'], {
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

if (result.status === 0) {
  console.log('validate-typegraph: PASS');
  process.exit(0);
}

console.error('validate-typegraph: type errors above (advisory in Phase 0)');
process.exit(0); // advisory — does not fail the build yet
```

- [ ] **Step 7.2: Add script to package.json**

Open `package.json`. In the `"scripts"` object, add this line (insert after `"validate:slices"`):

```json
"validate:typegraph": "node ./scripts/validate-typegraph.mjs",
```

- [ ] **Step 7.3: Run the validator**

```bash
npm run validate:typegraph
```

Expected output:

```
validate-typegraph: PASS
```

Exit code 0.

- [ ] **Step 7.4: Commit**

```bash
git add scripts/validate-typegraph.mjs package.json
git commit -m "feat(phase-0): validate-typegraph advisory script + npm script"
```

---

## Task 8: Bump CI Node version 20 → 22, add typegraph gate

**Files:**
- Modify: `.github/workflows/test.yml`

- [ ] **Step 8.1: Read the current workflow**

Open `.github/workflows/test.yml`. Locate the `setup-node` step:

```yaml
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
```

- [ ] **Step 8.2: Bump Node version**

Change `'20'` to `'22'`:

```yaml
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
```

- [ ] **Step 8.3: Add validate:typegraph as advisory step**

Locate the line:

```yaml
      - run: npm run typecheck
```

Immediately AFTER that line, insert:

```yaml
      - name: Validate type-graph (advisory, becomes blocking in Phase 5)
        continue-on-error: true
        run: npm run validate:typegraph
```

- [ ] **Step 8.4: Run the full local CI sequence**

```bash
npm ci && \
  node ./scripts/validate-manifests.mjs && \
  node ./scripts/validate-skills.mjs && \
  node ./scripts/validate-agents.mjs && \
  node ./scripts/validate-slices.mjs && \
  npm run lint && \
  npm run format:check && \
  npm run typecheck && \
  npm run validate:typegraph && \
  npm test && \
  node ./scripts/e2e-smoke.mjs
```

Expected: every step exits 0. If `e2e-smoke.mjs` fails, see Task 9 — it may need the strip-types flag.

- [ ] **Step 8.5: Commit**

```bash
git add .github/workflows/test.yml
git commit -m "ci(phase-0): bump Node to 22 + advisory validate:typegraph gate"
```

---

## Task 9: Update `e2e-smoke.mjs` to pass `--experimental-strip-types` when spawning

**Files:**
- Modify: `scripts/e2e-smoke.mjs`
- Modify: `scripts/e2e-smoke-ux.mjs`

The e2e smokes spawn `node ./scripts/crew.mjs` (or similar) against a temp sample repo. Phase 0 does not rename `crew.mjs` to TS so the smoke calls do not strictly need the flag yet — but the smoke harness should propagate it so future phases (entrypoint cutover in Phase 3.1) Just Work.

- [ ] **Step 9.1: Locate spawn calls in `e2e-smoke.mjs`**

Run:

```bash
grep -n "spawnSync\|execSync\|spawn(" scripts/e2e-smoke.mjs
```

For each `node` invocation found, ensure `--experimental-strip-types` is in the args array (insert it as the first element after `node`). Example:

```javascript
// before
spawnSync('node', ['./scripts/crew.mjs', 'brief-me', '--repo', sampleRepo], { stdio: 'inherit' });

// after
spawnSync('node', ['--experimental-strip-types', './scripts/crew.mjs', 'brief-me', '--repo', sampleRepo], { stdio: 'inherit' });
```

- [ ] **Step 9.2: Same for `e2e-smoke-ux.mjs`**

```bash
grep -n "spawnSync\|execSync\|spawn(" scripts/e2e-smoke-ux.mjs
```

Apply the same `--experimental-strip-types` insertion to every `node` spawn.

- [ ] **Step 9.3: Run both smokes**

```bash
npm run e2e:smoke
npm run e2e:smoke:ux
```

Expected: both exit 0.

- [ ] **Step 9.4: Commit**

```bash
git add scripts/e2e-smoke.mjs scripts/e2e-smoke-ux.mjs
git commit -m "chore(phase-0): e2e smokes spawn node with --experimental-strip-types"
```

---

## Task 10: Update README and CLAUDE.md for Node 22.6+ minimum

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

- [ ] **Step 10.1: Add Node version note to README**

Open `README.md`. Find the install / quick-start section (look for "install" or "requirements"). Add the following line near the top of that section:

```markdown
**Requirements:** Node.js 22.6+ (the plugin uses `--experimental-strip-types` to run TypeScript sources without a build step).
```

If no install section exists, add a new top-level `## Requirements` section immediately after the project description.

- [ ] **Step 10.2: Add Node version note to CLAUDE.md**

Open `CLAUDE.md`. Find the `## Local commands` section. Replace its heading with the following (add a single line beneath the heading):

```markdown
## Local commands

Requires Node 22.6+ (strip-types runtime; see `docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md`).
```

- [ ] **Step 10.3: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs(phase-0): require Node 22.6+ in README + CLAUDE.md"
```

---

## Task 11: Capture baseline metrics

**Files:**
- Create: `docs/architecture/ts-migration-baseline.md`

- [ ] **Step 11.1: Gather LoC**

Run:

```bash
find scripts hooks tests -name '*.mjs' -not -path '*/node_modules/*' -not -path '*/.claude/worktrees/*' | xargs wc -l | tail -1
```

Note the total number.

- [ ] **Step 11.2: Gather ESLint warning count**

Run:

```bash
npm run lint 2>&1 | tail -5
```

Note the warning + error counts shown by ESLint (`✖ N problems (E errors, W warnings)`).

- [ ] **Step 11.3: Capture brief-me timings (5 runs each, cold + warm)**

For a cold measurement, kill any caches first:

```bash
# Windows PowerShell: no OS-level FS cache flush available; just run after restart or accept measurement noise
time node ./scripts/crew.mjs brief-me --repo "$PWD" > /dev/null 2>&1
```

Run 5 times. Note p50 and p95 (sort, pick median and second-to-max).

For warm, re-run immediately 5 times. Note p50 and p95.

For cost-aggregate timing, run:

```bash
time node ./scripts/crew.mjs brief-me --repo "$PWD" > /dev/null 2>&1
```

5 times after at least one full brief-me has primed the cache.

- [ ] **Step 11.4: Write the baseline doc**

Create `docs/architecture/ts-migration-baseline.md` with the following structure — fill in the exact numbers gathered in Steps 11.1–11.3:

```markdown
# TS Migration Baseline — 2026-06-07

Captured at Phase 0 close, before any `.mjs` rename. Subsequent phase plans update this doc with their post-phase numbers.

**Machine spec:** Windows 11, NVMe SSD, 32 GB RAM, Node v<exact-version>.

**Commit at baseline:** `<short-sha-of-task-12-commit>`

## Code metrics

| Metric | Value |
|---|---|
| `.mjs` LoC under `scripts/`, `hooks/`, `tests/` | <number from Step 11.1> |
| ESLint problems | <E errors, W warnings from Step 11.2> |
| `.ts` files | 3 (`scripts/lib/result.ts`, `scripts/lib/ids.ts`, `scripts/lib/schemas.ts`) |
| Tests | <count> total |

## Performance — brief-me

5 runs per scenario. p50 = median, p95 = second-to-max.

| Scenario | p50 | p95 |
|---|---|---|
| brief-me cold | <ms> | <ms> |
| brief-me warm | <ms> | <ms> |
| brief-me cost-aggregate warm | <ms> | <ms> |

## Cost discipline

- Recent slice cost average: $80.10 (5 slice reports).
- Sonnet share of model spend: 20.9% (target: ≥70%; adjacent initiative).

## Notes

- `tsconfig.json`: `strict: true, checkJs: false` — only `.ts` files type-checked.
- `validate:typegraph` is advisory; becomes blocking in Phase 5.
- Subsequent phase plans append a new row to each table at phase close.
```

- [ ] **Step 11.5: Commit**

```bash
git add docs/architecture/ts-migration-baseline.md
git commit -m "docs(phase-0): TS migration baseline metrics snapshot"
```

---

## Task 12: Final verification + Phase 0 retrospective commit

**Files:**
- (none — verification only)

- [ ] **Step 12.1: Run every CI gate locally one more time**

```bash
npm ci && \
  npm run lint && \
  npm run format:check && \
  npm run typecheck && \
  npm run validate:typegraph && \
  node ./scripts/validate-manifests.mjs && \
  node ./scripts/validate-skills.mjs && \
  node ./scripts/validate-agents.mjs && \
  node ./scripts/validate-slices.mjs && \
  npm test && \
  npm run e2e:smoke && \
  npm run e2e:smoke:ux
```

Expected: every step exits 0. If anything fails, halt the plan and investigate.

- [ ] **Step 12.2: Verify git state**

```bash
git status --short
```

Expected: clean (or `.claude/worktrees/` only — intentional WIP).

```bash
git log --oneline main^11..main
```

Expected: 11 commits, one per task (Tasks 1–11 each committed; Task 12 has no code change so no commit).

- [ ] **Step 12.3: Verify Node version banner in README and CLAUDE.md**

```bash
grep -A1 -B1 "22.6" README.md CLAUDE.md
```

Expected: matching lines in both files.

- [ ] **Step 12.4: Smoke-test a fresh clone install (optional but recommended)**

```bash
cd /tmp || cd $TEMP
rm -rf hero-crew-phase0-verify
git clone "$OLDPWD" hero-crew-phase0-verify
cd hero-crew-phase0-verify
npm ci
npm test
```

Expected: all tests pass on a fresh clone with Node 22+.

Return to the original repo:

```bash
cd "$OLDPWD"
```

- [ ] **Step 12.5: Report Phase 0 done**

Phase 0 is complete. The repo now has:

- `tsconfig.json` strict + `.ts` files type-checked, `.mjs` files unchecked
- `scripts/lib/result.ts` + `ids.ts` + `schemas.ts` (with `WorkflowStateSchema`) shipped
- Tests for all three modules + a live-fixture schema test
- `node --test --experimental-strip-types` runs both `.mjs` and `.ts` tests
- CI on Node 22 with advisory `validate:typegraph` gate
- README + CLAUDE.md updated for Node 22.6+
- Baseline metrics doc captured

**Next step:** invoke `writing-plans` again with the spec to produce **Phase 1 — leaf migration** plan, beginning with slice 1.1 (`scope-estimate`, `ux-validation/classify-scenario`, `ux-validation/discover-playwright`).

---

## Self-Review Notes

**Spec coverage check — Phase 0 only:**

- ✅ tsconfig strict toggle (Task 2)
- ✅ `--experimental-strip-types` in every node invocation: package.json (Task 6), hooks (no `.mjs` hooks invoked during Phase 0; deferred to Phase 3.2), CI workflow (Task 8 via `npm test` + advisory typegraph), e2e-smoke (Task 9)
- ✅ Min-Node 22.6+ in README + CLAUDE.md (Task 10)
- ✅ `lib/result.ts` + `lib/ids.ts` + `lib/schemas.ts` (Tasks 3–5)
- ✅ `npm run typecheck` CI blocking (already present in the workflow before this plan; Task 8 verifies)
- ❌ `typescript-eslint` flat-config plugin install — deferred to Phase 1 (needs at least one `.ts` source under enforcement to be useful; Phase 0 has only 3 small modules where the lint plus is marginal vs the install/config churn)
- ✅ Phase 0 retrospective baseline doc (Task 11)
- ✅ `validate-typegraph` proposed new gate, advisory at first (Task 7)

The `typescript-eslint` deferral is the only spec deviation. Rationale: Phase 0's foundation files are 3 modules totalling ~80 lines of strict TS — `tsc --noEmit` already catches the issues `typescript-eslint` would. Adding the plugin needs ~30 lines of flat-config edits + a parser dep + tuning for the mixed `.mjs`/`.ts` repo, and would be wasted effort if Phase 1 changes the config anyway when adding `@typescript-eslint/no-floating-promises` and friends. Decision recorded; revisit at Phase 1 kickoff.

**Placeholder scan:** none.

**Type consistency:** `Result<T, E>`, `ok`/`err`/`map`/`flatMap` signatures match between `result.ts` and the tests. Branded id constructors (`RepoPath`, `SliceId`, …) names match between `ids.ts` and tests. `WorkflowStateSchema` name matches between `schemas.ts`, the test, and the spec's boundary-validation policy.
