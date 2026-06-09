# Loop↔Crew State Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One authoritative loop-state root per repo, enforced by a versioned schema contract, dispatcher-level config resolution, state write-guards, and a `loop doctor` detect/repair command; hero-crew migrates to a single backlog tree.

**Architecture:** The loop repo (C:\work\mega\loop) owns the contract: plain-JS validators in `src/scripts/lib/state-schemas.mts`, config resolved once in the `loop.mts` dispatcher and threaded into every runner, all state writes guarded by `src/scripts/lib/state-paths.mts`, and a new `doctor` command. hero-crew consumes loop v0.36.0, deletes its path overrides, migrates `docs/backlog/` into `.claude/artifacts/loop/backlog/`, and adds a thin CI guard of its own (CI runners have no plugin cache).

**Tech Stack:** TypeScript `.mts` sources compiled by `tsc` (`npm run build` → `scripts/`, `npm run build:tests` → `tests/`), `node --test`, no new dependencies. Imports between `.mts` files use compiled `.mjs` extensions (repo convention, see `src/scripts/lib/decisions-store.mts:5`).

**Spec:** `docs/superpowers/specs/2026-06-10-loop-crew-state-contract-design.md` (hero-crew repo)

---

## Part A — loop repo. All paths relative to `C:\work\mega\loop`.

### Task 1: Schema validators (`state-schemas.mts`)

**Files:**
- Create: `src/scripts/lib/state-schemas.mts`
- Create: `src/tests/state-schemas.test.mts`

- [ ] **Step 1: Write the failing test**

```ts
// src/tests/state-schemas.test.mts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateFeat,
  validateSlice,
  validateGrade,
  validateDecision,
  validateLoopJson
} from "../scripts/lib/state-schemas.mjs";

const GOOD_FEAT = {
  id: "FEAT-144",
  status: "pending",
  priority: null,
  category: "bug",
  target_release: null,
  created: "2026-06-10",
  updated: "2026-06-10",
  depends_on: [],
  slices: [],
  derived_from: null
};

test("validateFeat accepts a canonical FEAT frontmatter", () => {
  const r = validateFeat(GOOD_FEAT);
  assert.equal(r.ok, true, r.issues.join("; "));
});

test("validateFeat rejects bad id, status, dates, and array shapes", () => {
  const r = validateFeat({
    ...GOOD_FEAT,
    id: "FEAT-x",
    status: "shipped",
    created: "yesterday",
    depends_on: "FEAT-001"
  });
  assert.equal(r.ok, false);
  assert.equal(r.issues.length, 4, r.issues.join("; "));
});

test("validateFeat tolerates missing schemaVersion and accepts 1", () => {
  assert.equal(validateFeat({ ...GOOD_FEAT, schemaVersion: 1 }).ok, true);
  assert.equal(validateFeat(GOOD_FEAT).ok, true); // absent => v1
  assert.equal(validateFeat({ ...GOOD_FEAT, schemaVersion: 99 }).ok, false);
});

test("validateSlice accepts the slice-template shape", () => {
  const r = validateSlice({
    id: "SLICE-12",
    status: "pending",
    feature: "FEAT-144",
    phase: null,
    priority: null,
    target_release: null,
    requires_validation: false,
    created: "2026-06-10",
    updated: "2026-06-10"
  });
  assert.equal(r.ok, true, r.issues.join("; "));
});

test("validateSlice rejects bad id and non-FEAT feature link", () => {
  const r = validateSlice({ id: "S12", status: "pending", feature: "feat-1" });
  assert.equal(r.ok, false);
  assert.ok(r.issues.some((i) => i.includes("id")));
  assert.ok(r.issues.some((i) => i.includes("feature")));
});

test("validateGrade requires a slice link", () => {
  assert.equal(validateGrade({ slice: "SLICE-12" }).ok, true);
  assert.equal(validateGrade({}).ok, false);
});

test("validateDecision requires id/title/status", () => {
  assert.equal(
    validateDecision({ id: "DEC-044", title: "T", status: "accepted" }).ok,
    true
  );
  assert.equal(validateDecision({ id: "DEC-x", title: "", status: "" }).ok, false);
});

test("validateLoopJson requires schemaVersion 1 and string path overrides", () => {
  assert.equal(validateLoopJson({ schemaVersion: 1 }).ok, true);
  assert.equal(
    validateLoopJson({ schemaVersion: 1, loop: { backlogRoot: 42 } }).ok,
    false
  );
  assert.equal(validateLoopJson({}).ok, false);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run build && npm run build:tests && node --test tests/state-schemas.test.mjs`
Expected: FAIL — `Cannot find module .../state-schemas.mjs`

- [ ] **Step 3: Implement**

```ts
// src/scripts/lib/state-schemas.mts
// Versioned validators for loop-owned state files. Schema v1.
// Plain JS checks, no deps. Every validator returns { ok, issues }.

export interface ValidationResult {
  ok: boolean;
  issues: string[];
}

const FEAT_ID = /^FEAT-\d{3,}$/;
const SLICE_ID = /^SLICE-\d+$/;
const DEC_ID = /^DEC-\d+$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const FEAT_STATUSES = new Set(["pending", "triaged", "in-progress", "done"]);
const PRIORITIES = new Set(["P0", "P1", "P2", "P3"]);

type Fm = Record<string, unknown>;

function result(issues: string[]): ValidationResult {
  return { ok: issues.length === 0, issues };
}

function checkVersion(fm: Fm, issues: string[]) {
  // Absent => v1 (pre-contract files). Only v1 is known.
  if (fm.schemaVersion !== undefined && fm.schemaVersion !== 1) {
    issues.push(`schemaVersion: unknown version ${String(fm.schemaVersion)}`);
  }
}

function checkIsoDate(fm: Fm, key: string, issues: string[]) {
  if (typeof fm[key] !== "string" || !ISO_DATE.test(fm[key] as string)) {
    issues.push(`${key}: expected YYYY-MM-DD, got ${JSON.stringify(fm[key])}`);
  }
}

function checkStringArray(fm: Fm, key: string, issues: string[]) {
  const v = fm[key];
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) {
    issues.push(`${key}: expected string array, got ${JSON.stringify(v)}`);
  }
}

export function validateFeat(fm: Fm): ValidationResult {
  const issues: string[] = [];
  if (typeof fm.id !== "string" || !FEAT_ID.test(fm.id)) {
    issues.push(`id: expected FEAT-NNN, got ${JSON.stringify(fm.id)}`);
  }
  if (typeof fm.status !== "string" || !FEAT_STATUSES.has(fm.status)) {
    issues.push(`status: expected one of ${[...FEAT_STATUSES].join("|")}, got ${JSON.stringify(fm.status)}`);
  }
  if (fm.priority !== null && fm.priority !== undefined && !PRIORITIES.has(fm.priority as string)) {
    issues.push(`priority: expected null or P0..P3, got ${JSON.stringify(fm.priority)}`);
  }
  checkIsoDate(fm, "created", issues);
  if (fm.updated !== undefined) checkIsoDate(fm, "updated", issues);
  checkStringArray(fm, "depends_on", issues);
  checkStringArray(fm, "slices", issues);
  checkVersion(fm, issues);
  return result(issues);
}

export function validateSlice(fm: Fm): ValidationResult {
  const issues: string[] = [];
  if (typeof fm.id !== "string" || !SLICE_ID.test(fm.id)) {
    issues.push(`id: expected SLICE-NN, got ${JSON.stringify(fm.id)}`);
  }
  if (typeof fm.status !== "string" || fm.status.length === 0) {
    issues.push(`status: expected non-empty string`);
  }
  if (fm.feature !== null && fm.feature !== undefined) {
    if (typeof fm.feature !== "string" || !FEAT_ID.test(fm.feature)) {
      issues.push(`feature: expected null or FEAT-NNN, got ${JSON.stringify(fm.feature)}`);
    }
  }
  if (fm.requires_validation !== undefined && typeof fm.requires_validation !== "boolean") {
    issues.push(`requires_validation: expected boolean`);
  }
  if (fm.created !== undefined) checkIsoDate(fm, "created", issues);
  checkVersion(fm, issues);
  return result(issues);
}

export function validateGrade(fm: Fm): ValidationResult {
  const issues: string[] = [];
  if (typeof fm.slice !== "string" || !SLICE_ID.test(fm.slice)) {
    issues.push(`slice: expected SLICE-NN, got ${JSON.stringify(fm.slice)}`);
  }
  checkVersion(fm, issues);
  return result(issues);
}

export function validateDecision(fm: Fm): ValidationResult {
  const issues: string[] = [];
  if (typeof fm.id !== "string" || !DEC_ID.test(fm.id)) {
    issues.push(`id: expected DEC-NNN, got ${JSON.stringify(fm.id)}`);
  }
  if (typeof fm.title !== "string" || fm.title.length === 0) {
    issues.push(`title: expected non-empty string`);
  }
  if (typeof fm.status !== "string" || fm.status.length === 0) {
    issues.push(`status: expected non-empty string`);
  }
  checkVersion(fm, issues);
  return result(issues);
}

export function validateLoopJson(cfg: Fm): ValidationResult {
  const issues: string[] = [];
  if (cfg.schemaVersion !== 1) {
    issues.push(`schemaVersion: expected 1, got ${JSON.stringify(cfg.schemaVersion)}`);
  }
  const loop = cfg.loop as Fm | undefined;
  if (loop !== undefined) {
    for (const [k, v] of Object.entries(loop)) {
      if (/Root$|Path$|Dir$/.test(k) && typeof v !== "string") {
        issues.push(`loop.${k}: path override must be a string, got ${JSON.stringify(v)}`);
      }
    }
  }
  return result(issues);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run build && npm run build:tests && node --test tests/state-schemas.test.mjs`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/scripts/lib/state-schemas.mts src/tests/state-schemas.test.mts
git commit -m "feat(contract): state-schemas v1 validators for FEAT/slice/grade/decision/loop.json"
```

### Task 2: Dispatcher-level config resolution

**Files:**
- Modify: `src/scripts/loop.mts` (dispatch site + `COMMANDS` context; `runBacklogSubcommand` signature; `runBacklogAdd`)
- Create: `src/tests/dispatcher-config.test.mts`

- [ ] **Step 1: Write the failing regression test (FEAT-144 class)**

```ts
// src/tests/dispatcher-config.test.mts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const LOOP = path.resolve("scripts/loop.mjs");

test("backlog add honors loop.json backlogRoot override", async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), "loop-cfg-"));
  try {
    await fs.mkdir(path.join(repo, ".claude"), { recursive: true });
    await fs.writeFile(
      path.join(repo, ".claude", "loop.json"),
      JSON.stringify({ schemaVersion: 1, loop: { backlogRoot: "docs/backlog" } })
    );
    await run("node", [LOOP, "backlog", "add", "--repo", repo, "--title", "T1"]);
    const created = await fs.readdir(path.join(repo, "docs", "backlog", "pending"));
    assert.ok(
      created.some((f) => /^FEAT-\d+\.md$/.test(f)),
      `expected FEAT file in configured root, found: ${created.join(",")}`
    );
    // And nothing in the default root
    const defaultRoot = path.join(repo, ".claude", "artifacts", "loop", "backlog");
    const defaultExists = await fs.access(defaultRoot).then(() => true, () => false);
    assert.equal(defaultExists, false, "default root must not be created when overridden");
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

test("no module outside loop.mts/config-resolver imports resolveConfig", async () => {
  const libDir = path.resolve("src/scripts/lib");
  const offenders: string[] = [];
  for (const f of await fs.readdir(libDir)) {
    if (!f.endsWith(".mts") || f === "config-resolver.mts") continue;
    const text = await fs.readFile(path.join(libDir, f), "utf8");
    if (/from\s+["']\.\/config-resolver\.mjs["']/.test(text) && /resolveConfig/.test(text)) {
      offenders.push(f);
    }
  }
  assert.deepEqual(offenders, [], `lib modules must take config as a param: ${offenders.join(",")}`);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run build && npm run build:tests && node --test tests/dispatcher-config.test.mjs`
Expected: FAIL — FEAT file lands in `.claude/artifacts/loop/backlog/pending` instead of `docs/backlog/pending` (and/or offender list non-empty).

- [ ] **Step 3: Resolve config once in the dispatcher**

In `src/scripts/loop.mts`, find the dispatch site (`grep -n "COMMANDS\[" src/scripts/loop.mts`). Before invoking the handler, resolve config and add it to the context object:

```ts
const { resolveConfig } = await import("./lib/config-resolver.mjs");
const config = await resolveConfig(repoPath);
// existing: await handler({ repoPath, flags, positionals })
await handler({ repoPath, flags, positionals, config });
```

Update the `COMMANDS` handler context type so every handler receives `config`. Then change the backlog chain end-to-end:

```ts
// COMMANDS entry:
backlog: ({ repoPath, flags, positionals, config }) =>
  runBacklogSubcommand(repoPath, positionals, flags, config),

// runBacklogSubcommand: add `config` param, pass to each runner it calls.
// runBacklogAdd: add `config` param and pass it through:
const result = await addFeature(repoPath, {
  title,
  priority: flags.priority,
  category: flags.category,
  target_release: flags.targetRelease,
  body: resolvedBody,
  config
});
```

- [ ] **Step 4: Sweep the remaining subcommand runners (mechanical, enforced by the static test)**

Run: `grep -n "resolveConfig" src/scripts/loop.mts src/scripts/lib/*.mts`

For every hit **inside `loop.mts` handlers**: delete the local `resolveConfig` call and use `config` from the context. For every hit **inside `src/scripts/lib/*.mts`**: change the function to accept `config` as a parameter (callers in `loop.mts` now have it) and delete the import. The static test from Step 1 fails until the sweep is complete — it is the completion criterion, not judgment.

- [ ] **Step 5: Run to verify pass**

Run: `npm run build && npm run build:tests && node --test tests/dispatcher-config.test.mjs`
Expected: PASS (2 tests)

- [ ] **Step 6: Run the full loop suite (no regressions)**

Run: `npm test`
Expected: all tests pass (≈1091 baseline at v0.35.0)

- [ ] **Step 7: Commit**

```bash
git add src/scripts/loop.mts src/scripts/lib src/tests/dispatcher-config.test.mts
git commit -m "fix(cli): resolve config once in dispatcher, thread into every runner (FEAT-144 class)"
```

### Task 3: State write-guard (`state-paths.mts`)

**Files:**
- Create: `src/scripts/lib/state-paths.mts`
- Create: `src/tests/state-paths.test.mts`
- Modify: `src/scripts/lib/backlog-writer.mts` (wrap its `fs.writeFile`/`fs.rename` targets)

- [ ] **Step 1: Write the failing test**

```ts
// src/tests/state-paths.test.mts
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { resolveStateRoots, assertStatePath } from "../scripts/lib/state-paths.mjs";

const repo = path.resolve("/tmp/fake-repo");

test("resolveStateRoots returns roots from config overrides + defaults", () => {
  const roots = resolveStateRoots(repo, { loop: { backlogRoot: "docs/backlog" } });
  assert.ok(roots.some((r) => r === path.join(repo, "docs/backlog")));
  assert.ok(roots.some((r) => r === path.join(repo, ".claude/artifacts/loop")));
});

test("assertStatePath accepts a target inside a resolved root", () => {
  assert.doesNotThrow(() =>
    assertStatePath(repo, undefined, path.join(repo, ".claude/artifacts/loop/backlog/pending/FEAT-001.md"))
  );
});

test("assertStatePath throws loudly for a target outside all roots", () => {
  assert.throws(
    () => assertStatePath(repo, undefined, path.join(repo, "src", "FEAT-001.md")),
    /outside the resolved state roots/
  );
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run build && npm run build:tests && node --test tests/state-paths.test.mjs`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```ts
// src/scripts/lib/state-paths.mts
// Single chokepoint for "is this path loop-owned state?". Writers call
// assertStatePath before any fs.writeFile/rename of state files so a
// misrouted root fails loudly instead of silently forking a second tree.
import path from "node:path";
import {
  artifactRoot,
  backlogRoot,
  backlogPath,
  slicesRoot,
  specsRoot,
  gradesRoot,
  decisionsRoot,
  releasesRoot,
  retroRoot
} from "./paths.mjs";

type Config = Record<string, unknown> | undefined | null;

export function resolveStateRoots(repoPath: string, config: Config): string[] {
  const c = config ?? undefined;
  const roots = [
    artifactRoot(repoPath, c),
    backlogRoot(repoPath, c),
    backlogPath(repoPath, c),
    slicesRoot(repoPath, c),
    specsRoot(repoPath, c),
    gradesRoot(repoPath, c),
    decisionsRoot(repoPath, c),
    releasesRoot(repoPath, c),
    retroRoot(repoPath, c)
  ];
  return [...new Set(roots.map((r) => path.resolve(r)))];
}

export function assertStatePath(repoPath: string, config: Config, target: string): void {
  const resolved = path.resolve(target);
  const roots = resolveStateRoots(repoPath, config);
  const inside = roots.some((root) => resolved === root || resolved.startsWith(root + path.sep));
  if (!inside) {
    throw new Error(
      `state write refused: ${resolved} is outside the resolved state roots:\n  ${roots.join("\n  ")}`
    );
  }
}
```

- [ ] **Step 4: Wire `backlog-writer.mts` through the guard**

In `src/scripts/lib/backlog-writer.mts`, import the guard and call it before each write/rename of a FEAT file (in `addFeature`, `moveFeature`, and any other function that writes under the backlog root):

```ts
import { assertStatePath } from "./state-paths.mjs";
// before fs.writeFile(filePath, ...):
assertStatePath(repoPath, config, filePath);
```

- [ ] **Step 5: Run to verify pass + no regressions**

Run: `npm run build && npm run build:tests && node --test tests/state-paths.test.mjs tests/backlog.test.mjs`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/scripts/lib/state-paths.mts src/scripts/lib/backlog-writer.mts src/tests/state-paths.test.mts
git commit -m "feat(contract): state write-guard — refuse writes outside resolved state roots"
```

### Task 4: Validate frontmatter at write time

**Files:**
- Modify: `src/scripts/lib/backlog-writer.mts:34-70` (`addFeature`)
- Modify: `src/tests/backlog.test.mjs` source — `src/tests/backlog.test.mts` (add case)

- [ ] **Step 1: Write the failing test (append to `src/tests/backlog.test.mts`)**

```ts
test("addFeature refuses to write schema-invalid frontmatter", async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), "loop-schema-"));
  try {
    await assert.rejects(
      // priority "P9" violates schema v1
      addFeature(repo, { title: "Bad", priority: "P9" }),
      /priority/
    );
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run build && npm run build:tests && node --test tests/backlog.test.mjs`
Expected: FAIL — no rejection (file written with priority P9)

- [ ] **Step 3: Implement in `addFeature` (after building `frontmatter`, before writing)**

```ts
import { validateFeat } from "./state-schemas.mjs";
// ...
const check = validateFeat(frontmatter);
if (!check.ok) {
  throw new Error(`addFeature: schema-invalid frontmatter — ${check.issues.join("; ")}`);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run build && npm run build:tests && node --test tests/backlog.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/scripts/lib/backlog-writer.mts src/tests/backlog.test.mts
git commit -m "feat(contract): backlog writer validates FEAT frontmatter before write"
```
