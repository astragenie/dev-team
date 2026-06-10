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

### Task 5: `loop doctor --check`

**Files:**
- Create: `src/scripts/lib/doctor.mts`
- Create: `src/tests/doctor.test.mts`
- Modify: `src/scripts/loop.mts` (register `doctor` in `COMMANDS`)

- [ ] **Step 1: Write the failing detection tests**

```ts
// src/tests/doctor.test.mts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runDoctor } from "../scripts/lib/doctor.mjs";

const FEAT = (id: string, status: string) =>
  `---\nid: ${id}\nstatus: ${status}\npriority: null\ncategory: bug\ntarget_release: null\ncreated: 2026-06-10\nupdated: 2026-06-10\ndepends_on: []\nslices: []\nderived_from: null\n---\n# ${id}: t\n`;

async function makeRepo(): Promise<string> {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), "loop-doctor-"));
  await fs.mkdir(path.join(repo, ".claude/artifacts/loop/backlog/pending"), { recursive: true });
  return repo;
}

test("clean repo: zero findings", async () => {
  const repo = await makeRepo();
  try {
    await fs.writeFile(
      path.join(repo, ".claude/artifacts/loop/backlog/pending/FEAT-001.md"),
      FEAT("FEAT-001", "pending")
    );
    const { findings } = await runDoctor(repo, { fix: false });
    assert.deepEqual(findings, []);
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

test("detects stray tree, id collision, and cross-tree contradiction", async () => {
  const repo = await makeRepo();
  try {
    await fs.mkdir(path.join(repo, "docs/backlog/triaged"), { recursive: true });
    // same id in both trees, different lifecycle state
    await fs.writeFile(
      path.join(repo, ".claude/artifacts/loop/backlog/pending/FEAT-001.md"),
      FEAT("FEAT-001", "pending")
    );
    await fs.writeFile(path.join(repo, "docs/backlog/triaged/FEAT-001.md"), FEAT("FEAT-001", "triaged"));
    const { findings } = await runDoctor(repo, { fix: false });
    const kinds = findings.map((f) => f.kind).sort();
    assert.ok(kinds.includes("stray-tree"), kinds.join(","));
    assert.ok(kinds.includes("id-collision"), kinds.join(","));
    assert.ok(kinds.includes("state-contradiction"), kinds.join(","));
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

test("detects schema-invalid state file in authoritative tree", async () => {
  const repo = await makeRepo();
  try {
    await fs.writeFile(
      path.join(repo, ".claude/artifacts/loop/backlog/pending/FEAT-002.md"),
      `---\nid: FEAT-002\nstatus: shipped\ncreated: 2026-06-10\ndepends_on: []\nslices: []\n---\nbody\n`
    );
    const { findings } = await runDoctor(repo, { fix: false });
    assert.ok(findings.some((f) => f.kind === "schema-invalid" && f.path.includes("FEAT-002")));
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

test("detects config-vs-reality mismatch (configured root empty, default populated)", async () => {
  const repo = await makeRepo();
  try {
    await fs.mkdir(path.join(repo, ".claude"), { recursive: true });
    await fs.writeFile(
      path.join(repo, ".claude/loop.json"),
      JSON.stringify({ schemaVersion: 1, loop: { backlogRoot: "docs/backlog" } })
    );
    await fs.writeFile(
      path.join(repo, ".claude/artifacts/loop/backlog/pending/FEAT-001.md"),
      FEAT("FEAT-001", "pending")
    );
    const { findings } = await runDoctor(repo, { fix: false });
    assert.ok(findings.some((f) => f.kind === "config-mismatch"));
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run build && npm run build:tests && node --test tests/doctor.test.mjs`
Expected: FAIL — module not found

- [ ] **Step 3: Implement detection**

```ts
// src/scripts/lib/doctor.mts
// Detect (and with --fix, repair) loop-state divergence: stray trees,
// id collisions, schema-invalid files, config/reality mismatch,
// cross-tree state contradictions. Detection never mutates.
import fs from "node:fs/promises";
import path from "node:path";
import { resolveConfig } from "./config-resolver.mjs";
import { backlogRoot, artifactRoot, pathExists } from "./paths.mjs";
import { parseFrontmatter } from "./frontmatter.mjs";
import { validateFeat } from "./state-schemas.mjs";

export interface Finding {
  kind: "stray-tree" | "id-collision" | "schema-invalid" | "config-mismatch" | "state-contradiction";
  path: string;
  detail: string;
}

const STATES = ["pending", "triaged", "in-progress", "done"];
// Known historical locations a backlog tree can appear in.
const LEGACY_ROOTS = ["docs/backlog", ".claude/artifacts/loop/backlog"];

interface FeatEntry {
  id: string;
  state: string;
  file: string;
  fm: Record<string, unknown>;
}

async function scanTree(root: string): Promise<FeatEntry[]> {
  const out: FeatEntry[] = [];
  for (const state of STATES) {
    const dir = path.join(root, state);
    if (!(await pathExists(dir))) continue;
    for (const f of await fs.readdir(dir)) {
      if (!/^FEAT-\d+\.md$/.test(f)) continue;
      const file = path.join(dir, f);
      const { frontmatter } = parseFrontmatter(await fs.readFile(file, "utf8"));
      out.push({ id: String(frontmatter.id ?? f.replace(".md", "")), state, file, fm: frontmatter });
    }
  }
  return out;
}

async function treePopulated(root: string): Promise<boolean> {
  return (await scanTree(root)).length > 0;
}

export async function runDoctor(
  repoPath: string,
  opts: { fix: boolean }
): Promise<{ findings: Finding[]; reportPath: string | null }> {
  const config = await resolveConfig(repoPath).catch(() => undefined);
  const authoritative = path.resolve(backlogRoot(repoPath, config));
  const findings: Finding[] = [];

  // 1+5. stray trees + contradictions/collisions across trees
  const authEntries = await scanTree(authoritative);
  const authIds = new Map(authEntries.map((e) => [e.id, e]));
  for (const legacy of LEGACY_ROOTS) {
    const root = path.resolve(repoPath, legacy);
    if (root === authoritative) continue;
    if (!(await treePopulated(root))) continue;
    findings.push({ kind: "stray-tree", path: root, detail: `populated backlog tree outside authoritative root ${authoritative}` });
    for (const e of await scanTree(root)) {
      const auth = authIds.get(e.id);
      if (!auth) continue;
      findings.push({ kind: "id-collision", path: e.file, detail: `${e.id} exists in both trees` });
      if (auth.state !== e.state) {
        findings.push({ kind: "state-contradiction", path: e.file, detail: `${e.id}: ${auth.state} (authoritative) vs ${e.state} (stray)` });
      }
    }
  }

  // 3. schema-invalid files in the authoritative tree
  for (const e of authEntries) {
    const check = validateFeat(e.fm);
    if (!check.ok) {
      findings.push({ kind: "schema-invalid", path: e.file, detail: check.issues.join("; ") });
    }
  }

  // 4. config-vs-reality: configured root empty while another tree is populated
  if (!(await treePopulated(authoritative))) {
    for (const legacy of LEGACY_ROOTS) {
      const root = path.resolve(repoPath, legacy);
      if (root !== authoritative && (await treePopulated(root))) {
        findings.push({ kind: "config-mismatch", path: authoritative, detail: `configured root is empty but ${root} is populated` });
      }
    }
  }

  let reportPath: string | null = null;
  if (opts.fix && findings.length > 0) {
    reportPath = await applyFix(repoPath, config, authoritative, findings);
  }
  return { findings, reportPath };
}
```

(`applyFix` is implemented in Task 6 — for this task add a stub that throws `new Error("doctor --fix not implemented yet")` so `--check` is shippable alone.)

- [ ] **Step 4: Register the command in `src/scripts/loop.mts` `COMMANDS`**

```ts
doctor: async ({ repoPath, flags }) => {
  const { runDoctor } = await import("./lib/doctor.mjs");
  const result = await runDoctor(repoPath, { fix: Boolean(flags.fix) });
  if (flags.check && result.findings.length > 0) {
    console.error(JSON.stringify(result, null, 2));
    process.exitCode = 1;
    return { _suppressDefaultOutput: true };
  }
  return result;
},
```

- [ ] **Step 5: Run to verify pass**

Run: `npm run build && npm run build:tests && node --test tests/doctor.test.mjs`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add src/scripts/lib/doctor.mts src/tests/doctor.test.mts src/scripts/loop.mts
git commit -m "feat(doctor): loop doctor --check — detect stray trees, collisions, schema and config drift"
```

### Task 6: `loop doctor --fix`

**Files:**
- Modify: `src/scripts/lib/doctor.mts` (replace the `applyFix` stub)
- Modify: `src/tests/doctor.test.mts` (add fix tests)

- [ ] **Step 1: Write the failing fix tests**

```ts
test("--fix merges stray tree into authoritative root and writes report first", async () => {
  const repo = await makeRepo();
  try {
    await fs.mkdir(path.join(repo, "docs/backlog/pending"), { recursive: true });
    await fs.writeFile(path.join(repo, "docs/backlog/pending/FEAT-009.md"), FEAT("FEAT-009", "pending"));
    const { reportPath } = await runDoctor(repo, { fix: true });
    assert.ok(reportPath, "report path expected");
    const report = await fs.readFile(reportPath!, "utf8");
    assert.match(report, /FEAT-009/);
    const moved = await fs.readFile(
      path.join(repo, ".claude/artifacts/loop/backlog/pending/FEAT-009.md"),
      "utf8"
    );
    assert.match(moved, /FEAT-009/);
    // re-check is clean
    const second = await runDoctor(repo, { fix: false });
    assert.deepEqual(second.findings, []);
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

test("--fix keeps newest-transition winner on contradiction, loser preserved in conflicts dir", async () => {
  const repo = await makeRepo();
  try {
    await fs.writeFile(
      path.join(repo, ".claude/artifacts/loop/backlog/pending/FEAT-001.md"),
      FEAT("FEAT-001", "pending")
    );
    await fs.mkdir(path.join(repo, "docs/backlog/triaged"), { recursive: true });
    const strayFile = path.join(repo, "docs/backlog/triaged/FEAT-001.md");
    await fs.writeFile(strayFile, FEAT("FEAT-001", "triaged"));
    // make the stray file newer
    const future = new Date(Date.now() + 60_000);
    await fs.utimes(strayFile, future, future);
    await runDoctor(repo, { fix: true });
    // newer stray wins: authoritative tree now has it under triaged/
    const winner = path.join(repo, ".claude/artifacts/loop/backlog/triaged/FEAT-001.md");
    assert.ok(await fs.access(winner).then(() => true, () => false), "winner in triaged/");
    // loser content preserved under doctor/conflicts
    const conflictsDir = path.join(repo, ".claude/artifacts/loop/doctor/conflicts");
    const conflicts = await fs.readdir(conflictsDir);
    assert.ok(conflicts.some((f) => f.includes("FEAT-001")), conflicts.join(","));
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run build && npm run build:tests && node --test tests/doctor.test.mjs`
Expected: FAIL — `doctor --fix not implemented yet`

- [ ] **Step 3: Implement `applyFix`**

```ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const exec = promisify(execFile);

// Newest transition wins. Prefer git commit time; fall back to fs mtime
// (fixture repos and uncommitted files have no git history).
async function lastTouched(repoPath: string, file: string): Promise<number> {
  try {
    const { stdout } = await exec("git", ["log", "-1", "--format=%cI", "--", file], { cwd: repoPath });
    const t = Date.parse(stdout.trim());
    if (!Number.isNaN(t)) return t;
  } catch {
    /* not a git repo or untracked — fall through */
  }
  return (await fs.stat(file)).mtimeMs;
}

async function applyFix(
  repoPath: string,
  config: Record<string, unknown> | undefined,
  authoritative: string,
  findings: Finding[]
): Promise<string> {
  // 1. Report BEFORE any mutation.
  const doctorDir = path.join(artifactRoot(repoPath, config), "doctor");
  await fs.mkdir(path.join(doctorDir, "conflicts"), { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(doctorDir, `${stamp}-report.md`);
  const lines = ["# loop doctor report", "", `repo: ${repoPath}`, `authoritative: ${authoritative}`, "", "## Findings", ""];
  for (const f of findings) lines.push(`- [${f.kind}] ${f.path} — ${f.detail}`);
  await fs.writeFile(reportPath, lines.join("\n") + "\n");

  // 2. Merge each stray tree.
  for (const stray of findings.filter((f) => f.kind === "stray-tree")) {
    for (const e of await scanTree(stray.path)) {
      const destDir = path.join(authoritative, e.state);
      const dest = path.join(destDir, path.basename(e.file));
      await fs.mkdir(destDir, { recursive: true });
      const auth = (await scanTree(authoritative)).find((a) => a.id === e.id);
      if (!auth) {
        await fs.rename(e.file, dest); // simple move
        continue;
      }
      // conflict: newest transition wins, loser preserved
      const [authT, strayT] = await Promise.all([
        lastTouched(repoPath, auth.file),
        lastTouched(repoPath, e.file)
      ]);
      const winner = strayT > authT ? e : auth;
      const loser = strayT > authT ? auth : e;
      const loserDest = path.join(doctorDir, "conflicts", `${e.id}-${path.basename(path.dirname(loser.file))}.md`);
      await fs.rename(loser.file, loserDest);
      if (winner === e) {
        const winnerDest = path.join(authoritative, e.state, path.basename(e.file));
        await fs.mkdir(path.dirname(winnerDest), { recursive: true });
        await fs.rename(e.file, winnerDest);
      }
    }
    // remove the stray tree's now-empty state dirs (content was moved, never deleted)
    await fs.rm(stray.path, { recursive: true, force: true });
  }
  return reportPath;
}
```

- [ ] **Step 4: Run to verify pass + full suite**

Run: `npm run build && npm run build:tests && node --test tests/doctor.test.mjs && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/scripts/lib/doctor.mts src/tests/doctor.test.mts
git commit -m "feat(doctor): --fix merges stray trees, newest-transition conflict resolution, pre-action report"
```

### Task 7: Contract doc, changelog, release v0.36.0

**Files:**
- Create: `docs/state-contract.md`
- Modify: `CHANGELOG.md`, `package.json` (version)

- [ ] **Step 1: Write `docs/state-contract.md`** — one page: schema v1 field tables for FEAT/slice/grade/decision/loop.json (copy the constraints from `state-schemas.mts` literally), the authoritative-root rule, the write-guard rule, doctor's five finding kinds, and the versioning policy (new constraint ⇒ bump `schemaVersion`, validators accept N and N−1 for one release).

- [ ] **Step 2: CHANGELOG entry + version bump**

`package.json` version → `0.36.0`. CHANGELOG top section `## v0.36.0 — state contract + doctor` listing Tasks 1–6 with file paths (follow the existing per-version format).

- [ ] **Step 3: Verify, commit, tag (push is user-triggered)**

```bash
npm test && npm run lint
git add -A && git commit -m "chore(release): v0.36.0 — state contract, dispatcher config, write-guard, doctor"
git tag -a v0.36.0 -m "v0.36.0"
# USER ACTION: git push origin main --follow-tags
```

---

## Part B — hero-crew repo. All paths relative to `C:\work\mega\hero-crew`. Requires loop v0.36.0 released (Task 7).

### Task 8: Bump the loop pin

> **OBSOLETE (2026-06-10).** This task assumed hero-crew's `marketplace.json`
> carried a `loop` plugin entry to pin. It does not — loop now self-publishes
> from its own marketplace, and hero-crew's `marketplace.json` only lists
> `crew`. There is no loop pin in hero-crew to bump. Skip this task; the loop
> version consumed is governed by the user's plugin install, not by hero-crew.

**Files:**
- Modify: `.claude-plugin/marketplace.json` → `plugins[name=loop].version` → `0.36.0`

- [ ] **Step 1: Edit, validate, commit**

```bash
node ./scripts/validate-manifests.ts
git add .claude-plugin/marketplace.json
git commit -m "chore(marketplace): bump loop to 0.36.0 — state contract + doctor"
```

- [ ] **Step 2: Refresh the local plugin cache** (USER ACTION if the marketplace install is user-managed: re-install/update the loop plugin so `~/.claude/plugins/cache/loop/loop/0.36.0/` exists). Verify: `node "$HOME/.claude/plugins/cache/loop/loop/0.36.0/scripts/loop.mjs" status --repo "$PWD"` returns without error.

### Task 9: Single-tree migration

> **Status (2026-06-10).** Backlog half DONE (commit `d0c49ca`): all FEATs live
> under `.claude/artifacts/loop/backlog`, `backlogRoot`/`backlogPath` overrides
> removed. The **slices / `docs/ai-loop` half was deferred** at first pass —
> `aiLoopRoot` + `slicesRoot` overrides remained and the `docs/ai-loop` tree
> (slices + `00-entry`/`01-loop-control`/`backlog` control docs) stayed in place.
> **Decision (user, 2026-06-10): collapse it too.** The whole `docs/ai-loop`
> tree migrates to the default `.claude/artifacts/loop/ai-loop`, both overrides
> are removed, and `CLAUDE.md` loop-start refs are repointed. `loop doctor` only
> repairs backlog trees, so the slices move is done by hand (`git mv`).

**Files:**
- Modify: `.claude/loop.json` (delete `loop.backlogRoot`, `loop.backlogPath`, `loop.slicesRoot`, `loop.aiLoopRoot` keys — defaults now apply; keep `phaseGateArtifactDir`, which intentionally points at crew validations)
- Delete (via doctor merge): `docs/backlog/` tree
- Modify: `CLAUDE.md` ("Backlog discipline" section)

- [ ] **Step 1: Edit `.claude/loop.json`** — remove the four path keys. Run `node "$HOME/.claude/plugins/cache/loop/loop/0.36.0/scripts/loop.mjs" doctor --repo "$PWD"` (no flags = report only). Expected findings: `stray-tree` for `docs/backlog` (+ collisions/contradictions for FEAT-121, FEAT-129 etc.), possibly `stray-tree` for `docs/ai-loop`.

- [ ] **Step 2: Run the repair**

```bash
node "$HOME/.claude/plugins/cache/loop/loop/0.36.0/scripts/loop.mjs" doctor --fix --repo "$PWD"
```

Expected: report artifact under `.claude/artifacts/loop/doctor/`; `docs/backlog/` gone; all FEATs (001–144) under `.claude/artifacts/loop/backlog/`; conflicts (if any) preserved under `.claude/artifacts/loop/doctor/conflicts/` — review each conflict file manually and confirm the surviving state matches git history before proceeding.

- [ ] **Step 3: Verify clean**

```bash
node "$HOME/.claude/plugins/cache/loop/loop/0.36.0/scripts/loop.mjs" doctor --check --repo "$PWD"
```

Expected: exit 0, zero findings.

- [ ] **Step 4: Update CLAUDE.md** — in "Backlog discipline", replace `docs/backlog/{pending,triaged,in-progress,done}/` with `.claude/artifacts/loop/backlog/{pending,triaged,in-progress,done}/`. Also update the "Read first" item 4 pointer (`docs/backlog/product-backlog.md`) if it moved; check with `ls docs/backlog 2>/dev/null` (should not exist).

- [ ] **Step 5: Regenerate the snapshot** — invoke the `/loop:snapshot-memory` skill (session action) so `.claude/artifacts/loop/loop-snapshot.md` reflects the merged tree. Sanity-check the counts: done ≥ 75, FEAT-139..144 present.

- [ ] **Step 6: Commit the migration as ONE commit**

```bash
git add -A
git commit -m "chore(state): migrate to single backlog tree under .claude/artifacts/loop (doctor --fix)

Per docs/superpowers/specs/2026-06-10-loop-crew-state-contract-design.md.
Doctor report: .claude/artifacts/loop/doctor/<stamp>-report.md
Closes the dual-tree divergence behind FEAT-144."
```

### Task 10: CI guard + close FEAT-144

**Files:**
- Create: `scripts/validate-loop-state.ts`
- Create: `tests/validate-loop-state.test.ts`
- Modify: `.github/workflows/test.yml` (add step after `validate-slices`)

CI runners have no plugin cache, so hero-crew gets a thin local check (single tree + unique ids) rather than invoking `loop doctor`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/validate-loop-state.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { checkLoopState } from "../scripts/validate-loop-state.ts";

test("clean single tree passes", async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), "vls-"));
  try {
    const dir = path.join(repo, ".claude/artifacts/loop/backlog/pending");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "FEAT-001.md"), "---\nid: FEAT-001\n---\n");
    assert.deepEqual(await checkLoopState(repo), []);
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

test("flags a second populated tree and duplicate ids", async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), "vls-"));
  try {
    for (const root of [".claude/artifacts/loop/backlog", "docs/backlog"]) {
      const dir = path.join(repo, root, "pending");
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, "FEAT-001.md"), "---\nid: FEAT-001\n---\n");
    }
    const errors = await checkLoopState(repo);
    assert.ok(errors.some((e) => e.includes("docs/backlog")), errors.join("; "));
    assert.ok(errors.some((e) => e.includes("FEAT-001")), errors.join("; "));
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test --experimental-strip-types tests/validate-loop-state.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```ts
// scripts/validate-loop-state.ts
// Hard CI gate: exactly one populated backlog tree, unique FEAT ids.
// Thin local sibling of `loop doctor --check` (CI has no plugin cache).
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pathExists } from "./lib/fs-utils.ts";

const STATES = ["pending", "triaged", "in-progress", "done"];
const AUTHORITATIVE = ".claude/artifacts/loop/backlog";
const LEGACY = ["docs/backlog"];

async function listFeats(root: string): Promise<string[]> {
  const ids: string[] = [];
  for (const state of STATES) {
    const dir = path.join(root, state);
    if (!(await pathExists(dir))) continue;
    for (const f of await fs.readdir(dir)) {
      if (/^FEAT-\d+\.md$/.test(f)) ids.push(f.replace(".md", ""));
    }
  }
  return ids;
}

export async function checkLoopState(repoPath: string): Promise<string[]> {
  const errors: string[] = [];
  for (const legacy of LEGACY) {
    const ids = await listFeats(path.join(repoPath, legacy));
    if (ids.length > 0) {
      errors.push(`${legacy}: populated backlog tree outside ${AUTHORITATIVE} (${ids.length} FEATs)`);
    }
  }
  const authIds = await listFeats(path.join(repoPath, AUTHORITATIVE));
  const seen = new Set<string>();
  for (const id of authIds) {
    if (seen.has(id)) errors.push(`${id}: duplicate id in ${AUTHORITATIVE}`);
    seen.add(id);
  }
  return errors;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const errors = await checkLoopState(process.cwd());
  if (errors.length > 0) {
    console.error("validate-loop-state FAILED:");
    for (const e of errors) console.error(`  - ${e}`);
    process.exitCode = 1;
  } else {
    console.log("Loop state OK: single tree, unique ids.");
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test --experimental-strip-types tests/validate-loop-state.test.ts && node ./scripts/validate-loop-state.ts`
Expected: PASS + "Loop state OK"

- [ ] **Step 5: Add the CI step** — in `.github/workflows/test.yml`, after the `validate-slices` step:

```yaml
      - name: Validate loop state (single tree, unique ids)
        run: node ./scripts/validate-loop-state.ts
```

- [ ] **Step 6: Close FEAT-144**

```bash
node "$HOME/.claude/plugins/cache/loop/loop/0.36.0/scripts/loop.mjs" backlog promote --repo "$PWD" --id FEAT-144
# then move through the normal slice ceremony, or — since the work shipped via this plan —
# set status: done in its frontmatter, move the file to done/, citing the spec + doctor report.
```

- [ ] **Step 7: Lint, format, full validation, commit**

```bash
npm run lint && npm run format:check && node --test --experimental-strip-types tests/validate-loop-state.test.ts
git add scripts/validate-loop-state.ts tests/validate-loop-state.test.ts .github/workflows/test.yml
git commit -m "feat(ci): validate-loop-state hard gate — single backlog tree, unique FEAT ids"
```

---

## Self-review notes

- Spec coverage: C1→Task 1, C2→Tasks 2–4, C3→Tasks 5–6, C4→Task 9, C5→Tasks 7–8; AC-1..7 all have an owning task; hero-crew CI guard (AC-6) → Task 10.
- Loop's `npm test` runs the FULL build + suite — keep targeted `node --test tests/<file>.mjs` during inner loops, full `npm test` before each commit of Tasks 2, 6, 7.
- Conflict files for FEAT-121/129 in Task 9 Step 2 require a human eyeball before the migration commit — the newest-transition heuristic is good but those two are known-diverged.
