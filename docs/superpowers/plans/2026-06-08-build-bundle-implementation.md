# Build Bundle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a builder-side "build bundle" artifact that each `crew:builder*` variant writes on completion; have `/crew:review` and `/crew:validate` inline the latest bundle into reviewer/validator dispatch prompts so they arrive with the builder's working set pre-loaded.

**Architecture:** Two pure TS modules (`assemble`, `inline`) plus one new `crew.ts write-build-bundle` subcommand. Three builder prompts gain a final "write bundle" step; two command files gain a "read latest bundle and inline" step before the Agent dispatch. New `validate-bundles.ts` joins the existing hard CI validator family.

**Tech Stack:** Node 22.6+ (strip-types runtime, `node --test`), TypeScript, ESM. No new external deps.

**Spec:** `docs/superpowers/specs/2026-06-08-build-bundle-design.md`

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `docs/standards/build-bundle-schema.md` | Schema source-of-truth; migration log for `schema_version` |
| `scripts/lib/build-bundle/assemble.ts` | Pure TS — `assembleBuildBundle(inputs) → BundleOutput`; reads cost-hygiene state, computes diff_stat, writes atomic file |
| `scripts/lib/build-bundle/inline.ts` | Pure TS — `inlineLatestBundle(opts) → string`; selects latest bundle, validates frontmatter, returns inline-ready string |
| `scripts/lib/build-bundle/types.ts` | Shared `BundleInputs`, `BundleOutput`, `BundleFrontmatter`, `SkipReason` types |
| `scripts/validate-bundles.ts` | CI validator; walks `bundles/**/*.md`, asserts schema |
| `tests/build-bundle-assemble.test.ts` | Unit tests for `assemble.ts` |
| `tests/build-bundle-inline.test.ts` | Unit tests for `inline.ts` |
| `tests/build-bundle-cli.test.ts` | Integration test for `crew.ts write-build-bundle` subcommand |

### Modified files

| Path | Change |
|---|---|
| `scripts/crew.ts` | Add `write-build-bundle` subcommand handler + help line + flag spec entries |
| `agents/builder.md` | Append "write bundle" step to `## Report contract` section |
| `agents/builder-be.md` | Same |
| `agents/builder-fe.md` | Same |
| `commands/review.md` | Insert "read latest bundle and inline into dispatch prompt" step between step 6 and step 7 |
| `commands/validate.md` | Same insertion |
| `docs/routing-table.md` | New row tying builders → bundle-write CLI; reviewer/validator → bundle inliner |
| `scripts/e2e-smoke.ts` | Three new assertions after builder + reviewer phases |
| `.github/workflows/test.yml` | New step running `validate-bundles.ts` between `validate-slices` and `validate-contracts` |
| `package.json` | New `validate:bundles` script entry |
| `scripts/lib/briefing/collect.ts` | Add bundle summary line to brief-me output |
| `CHANGELOG.md` | Release note under next minor `0.X.0` |

---

## Task 1 — Build bundle schema document

**Files:**
- Create: `docs/standards/build-bundle-schema.md`

This task pins down the schema first so all subsequent code references the same authoritative description. No code yet; pure documentation.

- [ ] **Step 1: Write the schema document**

Write the file with these exact sections (paste verbatim):

````markdown
# Build Bundle Schema

Build bundles are artifacts written by `crew:builder` / `crew:builder-be` / `crew:builder-fe` on completion and inlined by `/crew:review` / `/crew:validate` into reviewer/validator dispatch prompts. They preload the builder's working set so downstream agents skip re-Read round-trips and arrive with builder context.

## Path

```
.claude/artifacts/crew/bundles/{sliceId}/{builderName}-{runId}-build-bundle.md
```

- `sliceId` — current `currentRun.slice` from `.claude/state/crew/workflow-state.json`. Bundles written without a resolvable slice land under `bundles/orphan/`.
- `builderName` — one of `builder`, `builder-be`, `builder-fe`.
- `runId` — ISO compact UTC: `YYYYMMDDTHHMMSSZ`.

## Frontmatter

```yaml
---
slice: SLICE-NN          # or "unknown" for orphan bundles
builder: builder-be
run_id: 20260608T223000Z
feat: FEAT-NNN           # optional
files_touched: [path/a.ts, path/b.ts]
files_read: [path/c.ts, path/d.md]
files_read_skipped:
  - { path: path/e.ts, reason: outside-repo }
diff_stat: { files: 2, additions: 47, deletions: 5 }
truncated: false
truncation_reason: null  # or "size-cap"
schema_version: 1
---
```

Required: `slice`, `builder`, `run_id`, `files_touched`, `files_read`, `diff_stat`, `truncated`, `schema_version`.
Optional: `feat`, `files_read_skipped`, `truncation_reason`.

`files_read_skipped[].reason` ∈ `{outside-repo, deleted, binary}`.

## Sections (fixed order)

1. `## Handoff` — verbatim handoff body from `crew.ts write-handoff`.
2. `## Diff` — output of `git diff` for changed files.
3. `## Files touched` — full contents of each file in `files_touched`, alphabetical, each fenced with a path header `### path/a.ts`.
4. `## Files read` — full contents of each file in `files_read`, alphabetical, same fencing pattern.

Determinism rule: identical `BundleInputs` produce byte-identical bundles. No timestamps in section bodies. Alphabetical ordering within each file-list section.

## Size cap

Soft cap: 200 KB. When exceeded, drop entries in this order:
1. `Files read` section (LRU by `last_read_at` from cost-hygiene state).
2. `Files touched` section (alphabetical, last-named first).

Set `truncated: true` and `truncation_reason: size-cap` when truncation occurs.

## Binary files in `files_touched`

Replace contents with `<binary file, N bytes, sha=…>` placeholder. SHA is `sha256` hex (first 16 chars).

## Outside-repo paths

`files_read` paths resolving outside the repo root are dropped from the bundle and recorded in `files_read_skipped` with `reason: outside-repo`. Protects against accidental ingest of files Read outside the project (e.g., `~/.aws/credentials`).

## Mtime tiebreak

When two bundles in the same `bundles/{slice}/` dir share an mtime within 1 second, the inliner picks the alphabetically-last filename.

## schema_version migration log

| Version | Date | Change |
|---|---|---|
| 1 | 2026-06-08 | Initial schema |
````

- [ ] **Step 2: Commit**

```bash
git add docs/standards/build-bundle-schema.md
git commit -m "docs(build-bundle): add schema source-of-truth document"
```

---

## Task 2 — Shared types module

**Files:**
- Create: `scripts/lib/build-bundle/types.ts`

Centralize types so `assemble`, `inline`, validator, and CLI all reference the same definitions.

- [ ] **Step 1: Write `scripts/lib/build-bundle/types.ts`**

```ts
// Shared types for build-bundle module.
// Schema reference: docs/standards/build-bundle-schema.md

export type BuilderName = "builder" | "builder-be" | "builder-fe";

export type SkipReason = "outside-repo" | "deleted" | "binary";

export interface FileReadSkipped {
  path: string;
  reason: SkipReason;
}

export interface DiffStat {
  files: number;
  additions: number;
  deletions: number;
}

export interface BundleFrontmatter {
  slice: string;
  builder: BuilderName;
  run_id: string;
  feat?: string;
  files_touched: string[];
  files_read: string[];
  files_read_skipped?: FileReadSkipped[];
  diff_stat: DiffStat;
  truncated: boolean;
  truncation_reason: "size-cap" | null;
  schema_version: number;
}

export interface BundleInputs {
  repoPath: string;
  sliceId: string;
  builderName: BuilderName;
  runId: string;
  feat?: string;
  handoffBody: string;
  filesTouched: string[];
  filesRead: string[];
  // When provided, used to derive LRU ordering + skip status. When omitted,
  // assembler falls back to repo working-tree mtimes for ordering.
  ledger?: ReadLedgerEntry[];
  sizeCapBytes?: number; // defaults to 200 * 1024
}

export interface ReadLedgerEntry {
  path: string;
  last_read_at: string; // ISO timestamp
}

export interface BundleOutput {
  path: string;
  bytes: number;
  truncated: boolean;
  filesReadSkipped: FileReadSkipped[];
}

export const SCHEMA_VERSION = 1 as const;
export const DEFAULT_SIZE_CAP_BYTES = 200 * 1024;
export const SECTION_HEADERS = {
  handoff: "## Handoff",
  diff: "## Diff",
  filesTouched: "## Files touched",
  filesRead: "## Files read"
} as const;

export const INLINE_HEADER =
  "## Builder context (preloaded — do not re-Read these files)";
export const INLINE_TRUNCATION_WARNING =
  "> NOTE: builder bundle was size-capped, reviewer should manually re-read suspect files";
```

- [ ] **Step 2: Run lint + typecheck**

```bash
npm run lint && npm run typecheck
```

Expected: both PASS.

- [ ] **Step 3: Commit**

```bash
git add scripts/lib/build-bundle/types.ts
git commit -m "feat(build-bundle): add shared types module"
```

---

## Task 3 — Failing tests for `assembleBuildBundle` (happy path)

**Files:**
- Create: `tests/build-bundle-assemble.test.ts`

TDD: write the failing happy-path test first so the implementation has a concrete target.

- [ ] **Step 1: Write the failing test file**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

import { assembleBuildBundle } from "../scripts/lib/build-bundle/assemble.ts";
import { SCHEMA_VERSION, INLINE_HEADER } from "../scripts/lib/build-bundle/types.ts";

async function makeRepo(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bundle-test-"));
  execSync("git init -q", { cwd: root });
  execSync('git config user.email "t@example.com"', { cwd: root });
  execSync('git config user.name "Test"', { cwd: root });
  await fs.writeFile(path.join(root, ".gitignore"), "node_modules\n", "utf8");
  execSync("git add -A && git commit -q -m initial", { cwd: root });
  return root;
}

test("assembleBuildBundle: happy path writes bundle with frontmatter and four sections", async () => {
  const repo = await makeRepo();
  await fs.writeFile(path.join(repo, "a.ts"), "export const a = 1;\n", "utf8");
  await fs.writeFile(path.join(repo, "b.ts"), "export const b = 2;\n", "utf8");
  await fs.writeFile(path.join(repo, "c.md"), "doc-c\n", "utf8");

  const result = await assembleBuildBundle({
    repoPath: repo,
    sliceId: "SLICE-99",
    builderName: "builder-be",
    runId: "20260608T223000Z",
    feat: "FEAT-999",
    handoffBody: "## Handoff body\n\nsummary line\n",
    filesTouched: ["a.ts", "b.ts"],
    filesRead: ["c.md"]
  });

  assert.ok(result.path.endsWith("SLICE-99/builder-be-20260608T223000Z-build-bundle.md"));
  assert.equal(result.truncated, false);
  assert.deepEqual(result.filesReadSkipped, []);

  const text = await fs.readFile(result.path, "utf8");
  assert.match(text, /^---\nslice: SLICE-99\n/);
  assert.match(text, /builder: builder-be/);
  assert.match(text, /run_id: 20260608T223000Z/);
  assert.match(text, /feat: FEAT-999/);
  assert.match(text, new RegExp(`schema_version: ${SCHEMA_VERSION}`));
  assert.ok(text.includes("## Handoff"));
  assert.ok(text.includes("## Diff"));
  assert.ok(text.includes("## Files touched"));
  assert.ok(text.includes("## Files read"));
  // Ensure section ordering is fixed:
  assert.ok(text.indexOf("## Handoff") < text.indexOf("## Diff"));
  assert.ok(text.indexOf("## Diff") < text.indexOf("## Files touched"));
  assert.ok(text.indexOf("## Files touched") < text.indexOf("## Files read"));
  // INLINE_HEADER never appears in raw bundle (it is only added by inliner).
  assert.ok(!text.includes(INLINE_HEADER));
});
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
node --test --experimental-strip-types tests/build-bundle-assemble.test.ts
```

Expected: FAIL with `Cannot find module '.../scripts/lib/build-bundle/assemble.ts'`.

---

## Task 4 — Implement `assembleBuildBundle` (minimal happy path)

**Files:**
- Create: `scripts/lib/build-bundle/assemble.ts`

- [ ] **Step 1: Write the minimal implementation**

```ts
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";

import {
  type BundleInputs,
  type BundleOutput,
  type BundleFrontmatter,
  type FileReadSkipped,
  type DiffStat,
  DEFAULT_SIZE_CAP_BYTES,
  SCHEMA_VERSION,
  SECTION_HEADERS
} from "./types.ts";

const ORPHAN_SLICE = "unknown";
const BUNDLES_REL = path.join(".claude", "artifacts", "crew", "bundles");

function bundleDir(repo: string, sliceId: string): string {
  const slice = sliceId === ORPHAN_SLICE ? "orphan" : sliceId;
  return path.join(repo, BUNDLES_REL, slice);
}

function bundleFile(repo: string, inputs: BundleInputs): string {
  return path.join(
    bundleDir(repo, inputs.sliceId),
    `${inputs.builderName}-${inputs.runId}-build-bundle.md`
  );
}

function isInsideRepo(repo: string, candidate: string): boolean {
  const rel = path.relative(repo, path.resolve(repo, candidate));
  return !rel.startsWith("..") && !path.isAbsolute(rel);
}

function computeDiffStat(repo: string): DiffStat {
  try {
    const out = execFileSync("git", ["diff", "--numstat"], {
      cwd: repo,
      encoding: "utf8"
    });
    let files = 0;
    let additions = 0;
    let deletions = 0;
    for (const line of out.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const [a, d] = line.split(/\s+/, 2);
      const aNum = Number(a);
      const dNum = Number(d);
      if (Number.isFinite(aNum)) additions += aNum;
      if (Number.isFinite(dNum)) deletions += dNum;
      files += 1;
    }
    return { files, additions, deletions };
  } catch {
    return { files: 0, additions: 0, deletions: 0 };
  }
}

function gitDiff(repo: string): string {
  try {
    return execFileSync("git", ["diff"], { cwd: repo, encoding: "utf8" });
  } catch {
    return "";
  }
}

interface SectionBuild {
  body: string;
  skipped: FileReadSkipped[];
}

const BINARY_DETECT_BYTES = 8192;

async function readFileMaybeBinary(
  abs: string
): Promise<{ content: string; isBinary: boolean; size: number; sha?: string }> {
  const stat = await fs.stat(abs);
  const handle = await fs.open(abs, "r");
  try {
    const buf = Buffer.alloc(Math.min(BINARY_DETECT_BYTES, stat.size));
    await handle.read(buf, 0, buf.length, 0);
    if (buf.includes(0)) {
      const all = await fs.readFile(abs);
      const sha = crypto.createHash("sha256").update(all).digest("hex").slice(0, 16);
      return { content: "", isBinary: true, size: stat.size, sha };
    }
  } finally {
    await handle.close();
  }
  const content = await fs.readFile(abs, "utf8");
  return { content, isBinary: false, size: stat.size };
}

async function buildFileListSection(
  repo: string,
  files: string[],
  treatOutsideRepoAsSkip: boolean
): Promise<SectionBuild> {
  const skipped: FileReadSkipped[] = [];
  const sorted = [...files].sort();
  const parts: string[] = [];
  for (const rel of sorted) {
    if (treatOutsideRepoAsSkip && !isInsideRepo(repo, rel)) {
      skipped.push({ path: rel, reason: "outside-repo" });
      continue;
    }
    const abs = path.resolve(repo, rel);
    try {
      const { content, isBinary, size, sha } = await readFileMaybeBinary(abs);
      if (isBinary) {
        parts.push(`### ${rel}\n\n\`\`\`\n<binary file, ${size} bytes, sha=${sha}>\n\`\`\`\n`);
      } else {
        parts.push(`### ${rel}\n\n\`\`\`\n${content}\n\`\`\`\n`);
      }
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        skipped.push({ path: rel, reason: "deleted" });
        continue;
      }
      throw err;
    }
  }
  return { body: parts.join("\n"), skipped };
}

function yamlList(items: string[]): string {
  if (items.length === 0) return "[]";
  return `[${items.map((s) => JSON.stringify(s)).join(", ")}]`;
}

function renderFrontmatter(fm: BundleFrontmatter): string {
  const lines = [
    "---",
    `slice: ${fm.slice}`,
    `builder: ${fm.builder}`,
    `run_id: ${fm.run_id}`
  ];
  if (fm.feat) lines.push(`feat: ${fm.feat}`);
  lines.push(`files_touched: ${yamlList(fm.files_touched)}`);
  lines.push(`files_read: ${yamlList(fm.files_read)}`);
  if (fm.files_read_skipped && fm.files_read_skipped.length > 0) {
    lines.push("files_read_skipped:");
    for (const s of fm.files_read_skipped) {
      lines.push(`  - { path: ${JSON.stringify(s.path)}, reason: ${s.reason} }`);
    }
  }
  lines.push(
    `diff_stat: { files: ${fm.diff_stat.files}, additions: ${fm.diff_stat.additions}, deletions: ${fm.diff_stat.deletions} }`
  );
  lines.push(`truncated: ${fm.truncated}`);
  lines.push(`truncation_reason: ${fm.truncation_reason ?? "null"}`);
  lines.push(`schema_version: ${fm.schema_version}`);
  lines.push("---");
  return lines.join("\n");
}

async function atomicWrite(file: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp.${process.pid}`;
  await fs.writeFile(tmp, content, "utf8");
  await fs.rename(tmp, file);
}

export async function assembleBuildBundle(
  inputs: BundleInputs
): Promise<BundleOutput> {
  const cap = inputs.sizeCapBytes ?? DEFAULT_SIZE_CAP_BYTES;

  const touched = await buildFileListSection(
    inputs.repoPath,
    inputs.filesTouched,
    false
  );
  const read = await buildFileListSection(
    inputs.repoPath,
    inputs.filesRead,
    true
  );

  const diffStat = computeDiffStat(inputs.repoPath);
  const diffBody = gitDiff(inputs.repoPath);

  // Files that survived in each list (not skipped).
  const survivingTouched = inputs.filesTouched.filter(
    (p) => !touched.skipped.some((s) => s.path === p)
  );
  const survivingRead = inputs.filesRead
    .filter((p) => !read.skipped.some((s) => s.path === p))
    .sort();

  const allSkipped = [...touched.skipped, ...read.skipped];

  // Initial frontmatter (truncation may flip later).
  let truncated = false;
  let frontmatter: BundleFrontmatter = {
    slice: inputs.sliceId,
    builder: inputs.builderName,
    run_id: inputs.runId,
    feat: inputs.feat,
    files_touched: [...survivingTouched].sort(),
    files_read: survivingRead,
    files_read_skipped: allSkipped.length > 0 ? allSkipped : undefined,
    diff_stat: diffStat,
    truncated,
    truncation_reason: null,
    schema_version: SCHEMA_VERSION
  };

  const composeBody = (
    handoff: string,
    diff: string,
    touchedBody: string,
    readBody: string
  ): string =>
    [
      renderFrontmatter(frontmatter),
      "",
      SECTION_HEADERS.handoff,
      "",
      handoff,
      SECTION_HEADERS.diff,
      "",
      "```diff",
      diff,
      "```",
      "",
      SECTION_HEADERS.filesTouched,
      "",
      touchedBody,
      SECTION_HEADERS.filesRead,
      "",
      readBody
    ].join("\n");

  let body = composeBody(inputs.handoffBody, diffBody, touched.body, read.body);

  // Apply size cap: drop files_read first (LRU by ledger if available), then
  // files_touched (alphabetical, last-named first).
  if (Buffer.byteLength(body, "utf8") > cap) {
    truncated = true;
    const lru = inputs.ledger
      ? [...inputs.ledger]
          .sort((a, b) => a.last_read_at.localeCompare(b.last_read_at))
          .map((e) => e.path)
      : [...frontmatter.files_read];
    const keepRead = new Set(frontmatter.files_read);
    while (
      Buffer.byteLength(body, "utf8") > cap &&
      keepRead.size > 0 &&
      lru.length > 0
    ) {
      const drop = lru.shift();
      if (drop) keepRead.delete(drop);
      const filtered = await buildFileListSection(
        inputs.repoPath,
        [...keepRead],
        true
      );
      frontmatter = {
        ...frontmatter,
        files_read: [...keepRead].sort(),
        truncated: true,
        truncation_reason: "size-cap"
      };
      body = composeBody(inputs.handoffBody, diffBody, touched.body, filtered.body);
    }
    if (Buffer.byteLength(body, "utf8") > cap) {
      // Still over cap: trim files_touched alphabetically last-first.
      const keepTouched = [...frontmatter.files_touched].sort();
      while (
        Buffer.byteLength(body, "utf8") > cap &&
        keepTouched.length > 0
      ) {
        keepTouched.pop();
        const filtered = await buildFileListSection(
          inputs.repoPath,
          keepTouched,
          false
        );
        frontmatter = {
          ...frontmatter,
          files_touched: keepTouched,
          truncated: true,
          truncation_reason: "size-cap"
        };
        body = composeBody(inputs.handoffBody, diffBody, filtered.body, "");
      }
    }
  }

  const file = bundleFile(inputs.repoPath, inputs);
  await atomicWrite(file, body);
  return {
    path: file,
    bytes: Buffer.byteLength(body, "utf8"),
    truncated,
    filesReadSkipped: allSkipped
  };
}
```

- [ ] **Step 2: Run the happy-path test and verify it passes**

```bash
node --test --experimental-strip-types tests/build-bundle-assemble.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run lint + typecheck + format:check**

```bash
npm run lint && npm run typecheck && npm run format:check
```

Expected: all PASS. If `format:check` fails, run `npm run format` then re-run.

- [ ] **Step 4: Commit**

```bash
git add scripts/lib/build-bundle/assemble.ts tests/build-bundle-assemble.test.ts
git commit -m "feat(build-bundle): assembler with happy-path TDD"
```

---

## Task 5 — Assembler edge-case tests

**Files:**
- Modify: `tests/build-bundle-assemble.test.ts`

Add the remaining edge cases from the spec. Each is one failing assertion against the existing implementation (most should already pass given Task 4's code; any that don't drive small fixes).

- [ ] **Step 1: Append edge-case tests**

Append to `tests/build-bundle-assemble.test.ts` (after the existing happy-path test):

```ts
test("assembleBuildBundle: deleted file in files_read is recorded in files_read_skipped", async () => {
  const repo = await makeRepo();
  await fs.writeFile(path.join(repo, "a.ts"), "export const a = 1;\n", "utf8");
  // Note: "missing.md" is referenced in filesRead but never created.

  const result = await assembleBuildBundle({
    repoPath: repo,
    sliceId: "SLICE-99",
    builderName: "builder",
    runId: "20260608T223100Z",
    handoffBody: "h",
    filesTouched: ["a.ts"],
    filesRead: ["missing.md"]
  });

  assert.deepEqual(result.filesReadSkipped, [
    { path: "missing.md", reason: "deleted" }
  ]);
  const text = await fs.readFile(result.path, "utf8");
  assert.match(text, /files_read_skipped:/);
});

test("assembleBuildBundle: outside-repo path in files_read is dropped", async () => {
  const repo = await makeRepo();
  await fs.writeFile(path.join(repo, "a.ts"), "x\n", "utf8");

  const result = await assembleBuildBundle({
    repoPath: repo,
    sliceId: "SLICE-99",
    builderName: "builder",
    runId: "20260608T223200Z",
    handoffBody: "h",
    filesTouched: ["a.ts"],
    filesRead: ["../outside.txt"]
  });

  assert.ok(
    result.filesReadSkipped.some(
      (s) => s.path === "../outside.txt" && s.reason === "outside-repo"
    )
  );
});

test("assembleBuildBundle: binary file in files_touched is replaced with placeholder", async () => {
  const repo = await makeRepo();
  const binPath = path.join(repo, "blob.bin");
  await fs.writeFile(binPath, Buffer.from([0, 1, 2, 3, 0, 4, 5]));

  const result = await assembleBuildBundle({
    repoPath: repo,
    sliceId: "SLICE-99",
    builderName: "builder",
    runId: "20260608T223300Z",
    handoffBody: "h",
    filesTouched: ["blob.bin"],
    filesRead: []
  });

  const text = await fs.readFile(result.path, "utf8");
  assert.match(text, /<binary file, 7 bytes, sha=[0-9a-f]{16}>/);
});

test("assembleBuildBundle: soft cap drops files_read LRU first", async () => {
  const repo = await makeRepo();
  const padding = "x".repeat(50_000);
  await fs.writeFile(path.join(repo, "small.ts"), "tiny\n", "utf8");
  await fs.writeFile(path.join(repo, "old.md"), padding, "utf8");
  await fs.writeFile(path.join(repo, "new.md"), padding, "utf8");

  const result = await assembleBuildBundle({
    repoPath: repo,
    sliceId: "SLICE-99",
    builderName: "builder",
    runId: "20260608T223400Z",
    handoffBody: "h",
    filesTouched: ["small.ts"],
    filesRead: ["old.md", "new.md"],
    ledger: [
      { path: "old.md", last_read_at: "2026-06-08T22:00:00Z" },
      { path: "new.md", last_read_at: "2026-06-08T22:30:00Z" }
    ],
    sizeCapBytes: 60_000
  });

  assert.equal(result.truncated, true);
  const text = await fs.readFile(result.path, "utf8");
  // old.md (older) dropped first; new.md should still be present.
  assert.ok(!text.includes("old.md\n\n```\n" + padding));
});

test("assembleBuildBundle: orphan bundle path when slice is 'unknown'", async () => {
  const repo = await makeRepo();
  await fs.writeFile(path.join(repo, "a.ts"), "x\n", "utf8");

  const result = await assembleBuildBundle({
    repoPath: repo,
    sliceId: "unknown",
    builderName: "builder",
    runId: "20260608T223500Z",
    handoffBody: "h",
    filesTouched: ["a.ts"],
    filesRead: []
  });

  assert.ok(result.path.includes(`${path.sep}orphan${path.sep}`));
});

test("assembleBuildBundle: deterministic output across two identical runs", async () => {
  const repo = await makeRepo();
  await fs.writeFile(path.join(repo, "a.ts"), "export const a = 1;\n", "utf8");

  const inputs = {
    repoPath: repo,
    sliceId: "SLICE-99",
    builderName: "builder" as const,
    runId: "20260608T223600Z",
    handoffBody: "deterministic\n",
    filesTouched: ["a.ts"],
    filesRead: []
  };
  const r1 = await assembleBuildBundle(inputs);
  const first = await fs.readFile(r1.path, "utf8");
  const r2 = await assembleBuildBundle(inputs);
  const second = await fs.readFile(r2.path, "utf8");
  assert.equal(first, second);
});
```

- [ ] **Step 2: Run the test file**

```bash
node --test --experimental-strip-types tests/build-bundle-assemble.test.ts
```

Expected: all six new tests PASS along with the original happy-path test (7 total).

If any FAIL, fix the assembler in `scripts/lib/build-bundle/assemble.ts` minimally to make that one test pass, then re-run.

- [ ] **Step 3: Lint + typecheck + format**

```bash
npm run lint && npm run typecheck && npm run format:check
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/build-bundle-assemble.test.ts scripts/lib/build-bundle/assemble.ts
git commit -m "test(build-bundle): assembler edge-case coverage"
```

---

## Task 6 — Failing test for `inlineLatestBundle`

**Files:**
- Create: `tests/build-bundle-inline.test.ts`

- [ ] **Step 1: Write the failing test file**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import {
  inlineLatestBundle
} from "../scripts/lib/build-bundle/inline.ts";
import {
  INLINE_HEADER,
  INLINE_TRUNCATION_WARNING
} from "../scripts/lib/build-bundle/types.ts";

const MINIMAL_BUNDLE = `---
slice: SLICE-99
builder: builder-be
run_id: 20260608T223000Z
files_touched: ["a.ts"]
files_read: []
diff_stat: { files: 1, additions: 1, deletions: 0 }
truncated: false
truncation_reason: null
schema_version: 1
---

## Handoff

body

## Diff

\`\`\`diff
diff --git a/a.ts b/a.ts
\`\`\`

## Files touched

### a.ts
content
`;

async function makeBundleRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "inline-test-"));
}

async function writeBundle(
  root: string,
  slice: string,
  filename: string,
  body: string
): Promise<string> {
  const dir = path.join(root, slice);
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, filename);
  await fs.writeFile(file, body, "utf8");
  return file;
}

test("inlineLatestBundle: returns header + body when bundle present", async () => {
  const root = await makeBundleRoot();
  await writeBundle(root, "SLICE-99", "builder-20260608T223000Z-build-bundle.md", MINIMAL_BUNDLE);

  const result = await inlineLatestBundle({
    sliceId: "SLICE-99",
    bundlesRoot: root
  });
  assert.ok(result.startsWith(INLINE_HEADER));
  assert.ok(result.includes("body"));
});

test("inlineLatestBundle: empty string when no bundle present", async () => {
  const root = await makeBundleRoot();
  await fs.mkdir(path.join(root, "SLICE-99"), { recursive: true });
  const result = await inlineLatestBundle({
    sliceId: "SLICE-99",
    bundlesRoot: root
  });
  assert.equal(result, "");
});

test("inlineLatestBundle: empty when frontmatter unparseable", async () => {
  const root = await makeBundleRoot();
  await writeBundle(root, "SLICE-99", "builder-20260608T223000Z-build-bundle.md",
    "no-frontmatter-just-text\n");
  const result = await inlineLatestBundle({
    sliceId: "SLICE-99",
    bundlesRoot: root
  });
  assert.equal(result, "");
});

test("inlineLatestBundle: empty when schema_version too high", async () => {
  const root = await makeBundleRoot();
  const body = MINIMAL_BUNDLE.replace("schema_version: 1", "schema_version: 999");
  await writeBundle(root, "SLICE-99", "builder-20260608T223000Z-build-bundle.md", body);
  const result = await inlineLatestBundle({
    sliceId: "SLICE-99",
    bundlesRoot: root,
    supportedSchemaVersion: 1
  });
  assert.equal(result, "");
});

test("inlineLatestBundle: alphabetically-last filename wins on identical mtime tiebreak", async () => {
  const root = await makeBundleRoot();
  const aPath = await writeBundle(root, "SLICE-99", "builder-a-build-bundle.md",
    MINIMAL_BUNDLE.replace("body", "first"));
  const bPath = await writeBundle(root, "SLICE-99", "builder-b-build-bundle.md",
    MINIMAL_BUNDLE.replace("body", "second"));
  // Force identical mtime within the 1-second window.
  const now = new Date();
  await fs.utimes(aPath, now, now);
  await fs.utimes(bPath, now, now);

  const result = await inlineLatestBundle({
    sliceId: "SLICE-99",
    bundlesRoot: root
  });
  assert.ok(result.includes("second"));
  assert.ok(!result.includes("first"));
});

test("inlineLatestBundle: truncation warning appended when bundle is size-capped", async () => {
  const root = await makeBundleRoot();
  const body = MINIMAL_BUNDLE
    .replace("truncated: false", "truncated: true")
    .replace("truncation_reason: null", "truncation_reason: size-cap");
  await writeBundle(root, "SLICE-99", "builder-20260608T223000Z-build-bundle.md", body);
  const result = await inlineLatestBundle({
    sliceId: "SLICE-99",
    bundlesRoot: root
  });
  assert.ok(result.includes(INLINE_TRUNCATION_WARNING));
});
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
node --test --experimental-strip-types tests/build-bundle-inline.test.ts
```

Expected: FAIL with `Cannot find module '.../scripts/lib/build-bundle/inline.ts'`.

---

## Task 7 — Implement `inlineLatestBundle`

**Files:**
- Create: `scripts/lib/build-bundle/inline.ts`

- [ ] **Step 1: Write the implementation**

```ts
import fs from "node:fs/promises";
import path from "node:path";

import {
  INLINE_HEADER,
  INLINE_TRUNCATION_WARNING,
  SCHEMA_VERSION
} from "./types.ts";

export interface InlineOptions {
  sliceId: string;
  bundlesRoot?: string;
  supportedSchemaVersion?: number;
  warn?: (msg: string) => void;
}

const DEFAULT_BUNDLES_ROOT = path.join(
  ".claude",
  "artifacts",
  "crew",
  "bundles"
);

interface ParsedFrontmatter {
  schema_version: number;
  truncated: boolean;
}

function parseFrontmatter(text: string): ParsedFrontmatter | null {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const body = match[1] ?? "";
  let schemaVersion: number | null = null;
  let truncated = false;
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    const sv = line.match(/^schema_version:\s*(\d+)\s*$/);
    if (sv && sv[1]) {
      schemaVersion = Number(sv[1]);
      continue;
    }
    const tr = line.match(/^truncated:\s*(true|false)\s*$/);
    if (tr) {
      truncated = tr[1] === "true";
    }
  }
  if (schemaVersion === null || !Number.isFinite(schemaVersion)) return null;
  return { schema_version: schemaVersion, truncated };
}

async function pickLatest(
  dir: string
): Promise<string | null> {
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
  const bundles = entries.filter((n) => n.endsWith("-build-bundle.md"));
  if (bundles.length === 0) return null;
  const stats = await Promise.all(
    bundles.map(async (name) => ({
      name,
      mtime: (await fs.stat(path.join(dir, name))).mtimeMs
    }))
  );
  stats.sort((a, b) => {
    if (Math.abs(a.mtime - b.mtime) < 1000) {
      return a.name < b.name ? 1 : -1; // alphabetically-last wins
    }
    return b.mtime - a.mtime;
  });
  const winner = stats[0];
  return winner ? path.join(dir, winner.name) : null;
}

export async function inlineLatestBundle(opts: InlineOptions): Promise<string> {
  const supported = opts.supportedSchemaVersion ?? SCHEMA_VERSION;
  const warn = opts.warn ?? ((msg) => process.stderr.write(`[build-bundle] ${msg}\n`));
  const root = opts.bundlesRoot ?? DEFAULT_BUNDLES_ROOT;
  const dir = path.join(root, opts.sliceId);

  const file = await pickLatest(dir);
  if (!file) {
    warn(`no bundle for slice ${opts.sliceId}`);
    return "";
  }

  const body = await fs.readFile(file, "utf8");
  const fm = parseFrontmatter(body);
  if (!fm) {
    warn(`malformed bundle frontmatter at ${file}`);
    return "";
  }
  if (fm.schema_version > supported) {
    warn(
      `bundle schema_version ${fm.schema_version} > supported ${supported} at ${file}`
    );
    return "";
  }

  const lines = [INLINE_HEADER, "", body];
  if (fm.truncated) {
    lines.push("", INLINE_TRUNCATION_WARNING);
  }
  return lines.join("\n");
}
```

- [ ] **Step 2: Run inline tests**

```bash
node --test --experimental-strip-types tests/build-bundle-inline.test.ts
```

Expected: all 6 tests PASS.

- [ ] **Step 3: Lint + typecheck + format**

```bash
npm run lint && npm run typecheck && npm run format:check
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add scripts/lib/build-bundle/inline.ts tests/build-bundle-inline.test.ts
git commit -m "feat(build-bundle): inline helper with frontmatter validation"
```

---

## Task 8 — Wire `write-build-bundle` subcommand into `crew.ts`

**Files:**
- Modify: `scripts/crew.ts`
- Create: `tests/build-bundle-cli.test.ts`

The builder agent invokes the bundle writer via `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" write-build-bundle ...`. This mirrors the existing `write-handoff` / `write-review-result` pattern.

- [ ] **Step 1: Write the failing CLI integration test**

Create `tests/build-bundle-cli.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

async function makeRepo(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bundle-cli-"));
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["config", "user.email", "t@example.com"], { cwd: root });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: root });
  await fs.writeFile(path.join(root, ".gitignore"), "node_modules\n", "utf8");
  execFileSync("git", ["add", "-A"], { cwd: root });
  execFileSync("git", ["commit", "-q", "-m", "init"], { cwd: root });
  return root;
}

test("crew.ts write-build-bundle: writes bundle artifact, prints path", async () => {
  const repo = await makeRepo();
  await fs.writeFile(path.join(repo, "a.ts"), "export const a = 1;\n", "utf8");

  const handoffPath = path.join(repo, "handoff.md");
  await fs.writeFile(handoffPath, "## Handoff body\n\nshort\n", "utf8");

  const crewScript = path.resolve(import.meta.dirname, "..", "scripts", "crew.ts");
  const out = execFileSync(
    "node",
    [
      "--experimental-strip-types",
      crewScript,
      "write-build-bundle",
      "--repo", repo,
      "--slice", "SLICE-77",
      "--builder", "builder-be",
      "--run", "20260608T230000Z",
      "--feat", "FEAT-777",
      "--handoff", handoffPath,
      "--files", "a.ts",
      "--files-read", ""
    ],
    { encoding: "utf8" }
  );

  const printedPath = out.trim().split(/\r?\n/).pop() ?? "";
  assert.ok(printedPath.endsWith("build-bundle.md"), `got: ${printedPath}`);
  const stat = await fs.stat(printedPath);
  assert.ok(stat.size > 0);
});
```

- [ ] **Step 2: Run test, confirm FAIL**

```bash
node --test --experimental-strip-types tests/build-bundle-cli.test.ts
```

Expected: FAIL with `Unknown command: write-build-bundle` (or similar — the CLI rejects unknown subcommands).

- [ ] **Step 3: Add CLI flags to `FLAG_SPEC`**

Open `scripts/crew.ts`. Locate the value-consuming flags block (around line 23 onwards, alphabetized). Insert the new flag entries in alphabetical order:

```ts
  "--builder": { key: "builder" },
  "--files-read": { key: "filesRead" },
  "--handoff": { key: "handoff" },
  "--run": { key: "run" },
  "--slice": { key: "slice" },
```

If `--repo`, `--feat`, `--files` are already present (they are), skip those.

- [ ] **Step 4: Add subcommand to `COMMANDS`**

Open `scripts/crew.ts`. Locate the `COMMANDS` constant (around line 376). Add the new handler in alphabetical order with the other `write-*` handlers:

```ts
  "write-build-bundle": async ({ repoPath, flags }: CommandContext) => {
    const { assembleBuildBundle } = await import("./lib/build-bundle/assemble.ts");
    const fs = await import("node:fs/promises");

    const slice = flags.slice ?? "unknown";
    const builder = flags.builder;
    const run = flags.run;
    const handoffPath = flags.handoff;

    if (!builder || !run || !handoffPath) {
      process.stderr.write(
        "[crew] write-build-bundle refused: --builder, --run, and --handoff are required.\n"
      );
      process.exit(2);
    }
    const validBuilders = new Set(["builder", "builder-be", "builder-fe"]);
    if (!validBuilders.has(builder)) {
      process.stderr.write(
        `[crew] write-build-bundle refused: --builder must be one of ${[...validBuilders].join(", ")}.\n`
      );
      process.exit(2);
    }

    const handoffBody = await fs.readFile(handoffPath, "utf8");
    const filesTouched = (flags.files ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const filesRead = (flags.filesRead ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const result = await assembleBuildBundle({
      repoPath,
      sliceId: slice,
      builderName: builder as "builder" | "builder-be" | "builder-fe",
      runId: run,
      feat: flags.feat ?? undefined,
      handoffBody,
      filesTouched,
      filesRead
    });
    return result.path;
  },
```

- [ ] **Step 5: Add help entry**

Open `scripts/crew.ts`. Locate the `subcommands` object (around line 216). Add in alphabetical order:

```ts
    "write-build-bundle":
      "  node scripts/crew.ts write-build-bundle --repo <path> --slice <SLICE-NN> --builder <builder|builder-be|builder-fe> --run <YYYYMMDDTHHMMSSZ> --handoff <path> [--feat <FEAT-NNN>] [--files <a,b>] [--files-read <c,d>]",
```

- [ ] **Step 6: Run test, confirm PASS**

```bash
node --test --experimental-strip-types tests/build-bundle-cli.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run full test suite + lint + typecheck**

```bash
npm run lint && npm run typecheck && node --test --experimental-strip-types
```

Expected: PASS across the suite.

- [ ] **Step 8: Commit**

```bash
git add scripts/crew.ts tests/build-bundle-cli.test.ts
git commit -m "feat(build-bundle): add write-build-bundle subcommand to crew.ts"
```

---

## Task 9 — Schema validator `validate-bundles.ts`

**Files:**
- Create: `scripts/validate-bundles.ts`

The validator walks `.claude/artifacts/crew/bundles/**/*-build-bundle.md`, parses frontmatter, and fails on any malformed bundle. Joins the existing hard validator family.

- [ ] **Step 1: Write the validator**

```ts
#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SCHEMA_VERSION } from "./lib/build-bundle/types.ts";

const BUNDLES_REL = path.join(".claude", "artifacts", "crew", "bundles");
const REQUIRED_FIELDS = [
  "slice",
  "builder",
  "run_id",
  "files_touched",
  "files_read",
  "diff_stat",
  "truncated",
  "schema_version"
] as const;

function repoRoot(): string {
  if (process.env.CREW_VALIDATE_BUNDLES_REPO) {
    return path.resolve(process.env.CREW_VALIDATE_BUNDLES_REPO);
  }
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

async function walk(dir: string): Promise<string[]> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const out: string[] = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await walk(full)));
    } else if (e.isFile() && e.name.endsWith("-build-bundle.md")) {
      out.push(full);
    }
  }
  return out;
}

interface Finding {
  file: string;
  reason: string;
}

function validateOne(filePath: string, text: string): Finding | null {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    return { file: filePath, reason: "missing frontmatter delimiters" };
  }
  const body = match[1] ?? "";
  const have = new Set<string>();
  let schemaVersion: number | null = null;
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    const m = line.match(/^([a-z_]+):/);
    if (m && m[1]) have.add(m[1]);
    const sv = line.match(/^schema_version:\s*(\d+)\s*$/);
    if (sv && sv[1]) schemaVersion = Number(sv[1]);
  }
  for (const f of REQUIRED_FIELDS) {
    if (!have.has(f)) {
      return { file: filePath, reason: `missing required field: ${f}` };
    }
  }
  if (schemaVersion === null) {
    return { file: filePath, reason: "schema_version unparseable" };
  }
  if (schemaVersion > SCHEMA_VERSION) {
    return {
      file: filePath,
      reason: `schema_version ${schemaVersion} > supported ${SCHEMA_VERSION}`
    };
  }
  return null;
}

async function main(): Promise<void> {
  const root = repoRoot();
  const bundles = await walk(path.join(root, BUNDLES_REL));
  const findings: Finding[] = [];
  for (const file of bundles) {
    const text = await fs.readFile(file, "utf8");
    const finding = validateOne(file, text);
    if (finding) findings.push(finding);
  }
  if (findings.length === 0) {
    process.stdout.write(`validate-bundles: ${bundles.length} bundle(s) OK\n`);
    return;
  }
  for (const f of findings) {
    process.stderr.write(`${f.file}: ${f.reason}\n`);
  }
  process.stderr.write(`validate-bundles: ${findings.length} failure(s)\n`);
  process.exit(1);
}

main().catch((err) => {
  process.stderr.write(`validate-bundles: ${String(err)}\n`);
  process.exit(1);
});
```

- [ ] **Step 2: Test validator against the test fixtures we already wrote**

The validator should pass on any bundle generated by the assembler. Smoke-test it:

```bash
node --experimental-strip-types scripts/validate-bundles.ts
```

Expected: exit 0 (`validate-bundles: 0 bundle(s) OK` if no bundles exist, OR `N bundle(s) OK` if any did from earlier test runs in `.claude/artifacts/crew/bundles/`).

- [ ] **Step 3: Add `validate:bundles` script to package.json**

Open `package.json`. In the `scripts` section, insert in alphabetical order with the other `validate:*` entries:

```json
    "validate:bundles": "node --experimental-strip-types ./scripts/validate-bundles.ts",
```

- [ ] **Step 4: Add CI step**

Open `.github/workflows/test.yml`. Insert a new step right after the `validate-slices.ts` step and before the `Validate contracts` step:

```yaml
      - run: node ./scripts/validate-bundles.ts
```

- [ ] **Step 5: Lint + typecheck**

```bash
npm run lint && npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/validate-bundles.ts package.json .github/workflows/test.yml
git commit -m "feat(build-bundle): add validate-bundles.ts as hard CI gate"
```

---

## Task 10 — Update three builder prompts

**Files:**
- Modify: `agents/builder.md`
- Modify: `agents/builder-be.md`
- Modify: `agents/builder-fe.md`

Each builder gains one new step after writing the handoff: invoke `crew.ts write-build-bundle`. Same insertion text in each file.

- [ ] **Step 1: Insert bundle-write step in `agents/builder.md`**

Locate the `## Report contract` section (around line 109 of the current file). After the existing `write-handoff` code block and its surrounding paragraph (which currently ends with `Do NOT inline the full report body — that re-inflates lead context and triggers compactions.`), append the following subsection BEFORE the `## Self-verify gate` section:

```markdown
### Build bundle (post-handoff)

After `write-handoff` returns a path, write a build bundle so the
reviewer / validator can inline your working set instead of re-Reading
files you already touched. Path schema: `.claude/artifacts/crew/bundles/{sliceId}/{builderName}-{runId}-build-bundle.md`.

Run via Bash:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" write-build-bundle \
  --repo "$PWD" \
  --slice "$(node -e 'process.stdout.write(require(`'"$PWD"'/.claude/state/crew/workflow-state.json`).currentRun?.slice || `unknown`)')" \
  --builder builder \
  --run "$(date -u +%Y%m%dT%H%M%SZ)" \
  --feat "<FEAT-NNN or omit>" \
  --handoff "<handoff artifact path from previous step>" \
  --files "<comma-separated files you modified>" \
  --files-read "<comma-separated files you Read but did not modify>"
```

If this command exits non-zero, log the error under a `## Bundle write failure` section in your return message but still return success — bundle write is non-blocking. The reviewer/validator falls back to today's handoff-only dispatch when no bundle exists for the slice.

Include the returned bundle path in your return message under a single line: `Bundle: <path>`.
```

- [ ] **Step 2: Replace `--builder builder` placeholder per file**

In `agents/builder-be.md`, perform the same insertion but use `--builder builder-be` in the example.

In `agents/builder-fe.md`, perform the same insertion but use `--builder builder-fe` in the example.

- [ ] **Step 3: Run agent validator**

```bash
node --experimental-strip-types ./scripts/validate-agents.ts
```

Expected: PASS. (The validator enforces ≤300 lines per `docs/governance.md`. The added subsection is ~25 lines per file; verify each prompt still under cap.)

- [ ] **Step 4: Verify lengths**

```bash
wc -l agents/builder.md agents/builder-be.md agents/builder-fe.md
```

Each should be well under 300 lines.

- [ ] **Step 5: Commit**

```bash
git add agents/builder.md agents/builder-be.md agents/builder-fe.md
git commit -m "feat(build-bundle): instruct builders to write bundle after handoff"
```

---

## Task 11 — Update `/crew:review` and `/crew:validate` to inline the bundle

**Files:**
- Modify: `commands/review.md`
- Modify: `commands/validate.md`

Both commands need a new step between "identify standards" and "dispatch reviewer/validator subagent" that resolves the slice id, finds the latest bundle, reads it, and inlines it into the dispatch prompt.

- [ ] **Step 1: Insert bundle-inline step in `commands/review.md`**

Open `commands/review.md`. After step 6 (`identify the standards…`) and before step 7 (`dispatch the **crew:reviewer**`), insert a new step:

```markdown
6a. preload builder context (build bundle): resolve the current slice id from `.claude/state/crew/workflow-state.json` (`currentRun.slice`) and call:
   - `node -e 'import("./scripts/lib/build-bundle/inline.ts").then(m => m.inlineLatestBundle({ sliceId: process.argv[1] })).then(s => process.stdout.write(s))' "<SLICE-NN>"`
   If the returned string is non-empty, include it verbatim in the reviewer dispatch prompt **before** the role-specific task body. If empty, dispatch the reviewer without preload (today's behavior) — bundle inline is non-blocking. The header inside the bundle (`## Builder context (preloaded — do not re-Read these files)`) is your signal to the reviewer that those files do not need to be re-Read.
```

Renumber the existing steps 7-10 to 8-11 only if needed; otherwise leave them — `6a` is a substep distinct from `7`.

- [ ] **Step 2: Insert the same step in `commands/validate.md`**

Open `commands/validate.md`. Locate the analogous "dispatch validator" step (the structure mirrors review.md). Insert the same `6a`-style step before the validator dispatch instruction.

- [ ] **Step 3: Run command/manifest validators**

```bash
node --experimental-strip-types ./scripts/validate-manifests.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add commands/review.md commands/validate.md
git commit -m "feat(build-bundle): inline build bundle into reviewer/validator dispatch"
```

---

## Task 12 — Add routing-table row

**Files:**
- Modify: `docs/routing-table.md`

The routing table is the lead's source of truth for which skill/agent handles which task.

- [ ] **Step 1: Add the routing row**

Open `docs/routing-table.md`. Locate the section that lists builder-related rows. Add (or append, depending on existing layout):

```markdown
| Builder completion (post-handoff) | `crew:builder`, `crew:builder-be`, `crew:builder-fe` | Write build bundle via `scripts/crew.ts write-build-bundle`; non-blocking |
| Review / validate dispatch | `commands/review.md`, `commands/validate.md` | Inline latest bundle for current slice via `scripts/lib/build-bundle/inline.ts` |
```

If a different column shape is in use, match the surrounding rows exactly. Read 3-5 rows above and below to follow the convention.

- [ ] **Step 2: Run routing-table validator**

```bash
CREW_VALIDATE_ROUTING_TABLE=1 node --experimental-strip-types ./scripts/validate-routing-table.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add docs/routing-table.md
git commit -m "docs(routing): add build-bundle routing rows for builders and review/validate"
```

---

## Task 13 — Extend `e2e-smoke.ts`

**Files:**
- Modify: `scripts/e2e-smoke.ts`

After the smoke runs `/crew:build` against the sample repo, assert the bundle file exists and that the reviewer dispatch picked it up.

- [ ] **Step 1: Read the existing smoke**

```bash
head -50 scripts/e2e-smoke.ts
```

Identify where the builder phase asserts complete (`run brief` written, `handoff` written). The new assertions go immediately after the builder phase.

- [ ] **Step 2: Append assertions**

Find the section that asserts a handoff was written. Add immediately after it:

```ts
// FEAT-XXX (build-bundle): assert builder wrote a bundle.
const bundlesDir = path.join(sampleRepo, ".claude", "artifacts", "crew", "bundles");
const bundlesExist = await fs.stat(bundlesDir).then(() => true).catch(() => false);
assert.ok(bundlesExist, "expected bundles dir to exist after builder phase");
const bundles = await listBundlesRecursive(bundlesDir);
assert.ok(bundles.length > 0, "expected at least one build bundle written by builder");
const firstBundle = await fs.readFile(bundles[0]!, "utf8");
assert.match(firstBundle, /^---\nslice:/, "bundle missing frontmatter");
assert.match(firstBundle, /## Handoff/, "bundle missing handoff section");
```

If `listBundlesRecursive` does not yet exist in the smoke, add this helper near the top of the smoke file:

```ts
async function listBundlesRecursive(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await listBundlesRecursive(full)));
    else if (e.isFile() && e.name.endsWith("-build-bundle.md")) out.push(full);
  }
  return out;
}
```

- [ ] **Step 3: Run the smoke**

```bash
node --experimental-strip-types scripts/e2e-smoke.ts
```

Expected: PASS (assumes the sample-repo flow exercises a real builder dispatch that writes a bundle — if the smoke uses a stubbed flow that doesn't actually invoke `write-build-bundle`, gate this assertion behind a `if (bundlesExist)` check + log "smoke did not exercise bundle write" and continue. Document the gate in the smoke's comment block).

- [ ] **Step 4: Commit**

```bash
git add scripts/e2e-smoke.ts
git commit -m "test(e2e-smoke): assert build-bundle write + frontmatter shape"
```

---

## Task 14 — Update `brief-me` to surface bundle stats

**Files:**
- Modify: `scripts/lib/briefing/collect.ts`

Add a summary line: `bundles: N written this slice, M malformed, K size-capped`.

- [ ] **Step 1: Locate the collect output shape**

```bash
grep -n "summary\|sections\|cost" scripts/lib/briefing/collect.ts | head -20
```

Identify where the brief assembles its summary lines.

- [ ] **Step 2: Add bundle stats collection**

Append a helper to `scripts/lib/briefing/collect.ts`:

```ts
async function collectBundleStats(
  repoPath: string,
  sliceId: string | undefined
): Promise<{ written: number; malformed: number; truncated: number }> {
  if (!sliceId) return { written: 0, malformed: 0, truncated: 0 };
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const dir = path.join(
    repoPath,
    ".claude",
    "artifacts",
    "crew",
    "bundles",
    sliceId
  );
  let entries: string[];
  try {
    entries = (await fs.readdir(dir)).filter((n) =>
      n.endsWith("-build-bundle.md")
    );
  } catch {
    return { written: 0, malformed: 0, truncated: 0 };
  }
  let malformed = 0;
  let truncated = 0;
  for (const name of entries) {
    try {
      const text = await fs.readFile(path.join(dir, name), "utf8");
      if (!/^---\n[\s\S]*?\nschema_version: \d+\n[\s\S]*?\n---/.test(text)) {
        malformed += 1;
      }
      if (/^truncated: true$/m.test(text)) {
        truncated += 1;
      }
    } catch {
      malformed += 1;
    }
  }
  return { written: entries.length, malformed, truncated };
}
```

- [ ] **Step 3: Add summary line to the brief output**

In the function that assembles the summary lines, after the cost-report line and before the closing, add:

```ts
const bundleStats = await collectBundleStats(repoPath, currentSliceId);
lines.push(
  `bundles: ${bundleStats.written} written this slice, ${bundleStats.malformed} malformed, ${bundleStats.truncated} size-capped`
);
```

`currentSliceId` should already be resolved earlier in the brief; if not, resolve it from the loaded workflow state inline.

- [ ] **Step 4: Run brief-me locally and confirm the line appears**

```bash
node --experimental-strip-types scripts/crew.ts wake-up --repo "$PWD"
```

Expected: output includes `bundles: N written this slice, M malformed, K size-capped` line. May be `0 written` in repos that haven't produced a bundle yet — that's fine.

- [ ] **Step 5: Run brief-me tests if they exist**

```bash
node --test --experimental-strip-types tests/briefing*.test.ts 2>&1 | tail -20
```

If no briefing tests exist, skip. Otherwise expect PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/briefing/collect.ts
git commit -m "feat(brief-me): surface build-bundle write/malformed/truncated stats"
```

---

## Task 15 — Add `review_rebound_count` to grade template

**Files:**
- Modify: existing grade template — likely under `commands/loop/` or `scripts/lib/loop/` (search for it)

The slice-grade template is the loop-plugin artifact that quantifies a slice's outcome. We add a measurement field so the quality-win hypothesis can be tracked over a rolling window.

- [ ] **Step 1: Find the grade template**

```bash
grep -rn "review_rebound\|architecture_quality\|test_confidence" --include="*.md" --include="*.ts" -l
```

Locate the file that defines the grade frontmatter schema.

- [ ] **Step 2: Add the field**

In the template's frontmatter section, add (alphabetical or grouped with other score-style fields):

```yaml
review_rebound_count: 0   # number of /crew:fix → /crew:review cycles before review passed
```

If the grade template is generated by a TS module rather than a static `.md`, add the field to the TS shape (interface + default value 0) and any test that verifies the template structure.

- [ ] **Step 3: Run loop-related validators / tests if present**

```bash
node --test --experimental-strip-types tests/loop*.test.ts 2>&1 | tail -20
```

Skip if no such tests exist. Otherwise expect PASS.

- [ ] **Step 4: Commit**

```bash
git add <grade-template-file>
git commit -m "feat(grade): add review_rebound_count field for build-bundle quality measurement"
```

---

## Task 16 — CHANGELOG entry

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add an entry under the unreleased / next-minor section**

Open `CHANGELOG.md`. Under the top-most "Unreleased" section (or create one matching the file's pattern), add:

```markdown
### Added
- Build bundles: every builder variant (`builder`, `builder-be`, `builder-fe`) writes a `.claude/artifacts/crew/bundles/{slice}/{builder}-{runId}-build-bundle.md` artifact on completion containing handoff body, diff, touched-file contents, and read-file contents. `/crew:review` and `/crew:validate` inline the latest bundle into reviewer/validator dispatch prompts under a `## Builder context (preloaded — do not re-Read these files)` header, preloading the builder's working set so downstream agents skip re-Reads. Schema documented at `docs/standards/build-bundle-schema.md`. Hard CI gate: `scripts/validate-bundles.ts`. `brief-me` surfaces per-slice write/malformed/size-cap counts. Tracks first stealable from the agent-crew competitor matrix (`.claude/artifacts/crew/research/20260608T220200Z-competitor-matrix-agent-crews.md`).
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): note build-bundle addition"
```

---

## Task 17 — Final integration sweep

**Files:** none (verification only)

- [ ] **Step 1: Run the full CI gate chain**

```bash
node --experimental-strip-types ./scripts/validate-manifests.ts && \
node --experimental-strip-types ./scripts/validate-skills.ts && \
node --experimental-strip-types ./scripts/validate-agents.ts && \
node --experimental-strip-types ./scripts/validate-slices.ts && \
node --experimental-strip-types ./scripts/validate-bundles.ts && \
CREW_VALIDATE_ROUTING_TABLE=1 node --experimental-strip-types ./scripts/validate-routing-table.ts && \
npm run lint && \
npm run format:check && \
npm run typecheck && \
node --test --experimental-strip-types && \
node --experimental-strip-types ./scripts/e2e-smoke.ts
```

Expected: every command exits 0.

- [ ] **Step 2: Final commit only if anything still needs to land**

If the above all pass without changes, no commit needed — slice is complete.

If any required tweaks were uncovered (e.g. format pass), commit them:

```bash
git add -A
git commit -m "chore(build-bundle): final integration sweep fixes"
```

- [ ] **Step 3: Suggest follow-up**

Surface a single line to the user: "Build-bundle implementation complete. First measurement window starts on the next slice; review `review_rebound_count` after 10 slices to validate quality-win hypothesis."

---

## Self-review (run by author after writing this plan)

**Spec coverage check:**
- Spec §"Goal" → measurement field added in Task 15 + manual QA gate referenced in Task 17 follow-up.
- Spec §"Success criteria" 1 (builders write bundle) → Tasks 8 + 10.
- Spec §"Success criteria" 2 (reviewer/validator inline) → Task 11.
- Spec §"Success criteria" 3 (non-blocking) → Task 10 step 1 (failure mode documented in builder prompt); Task 11 (empty-string fallback in inline).
- Spec §"Success criteria" 4 (validate-bundles is hard CI gate) → Task 9.
- Spec §"Success criteria" 5 (review_rebound_count) → Task 15.
- Spec §"Subsystem.Components" all covered: writer (Tasks 4 + 8 + 10), reader/inliner (Tasks 7 + 11), schema doc (Task 1), routing (Task 12), validator (Task 9).
- Spec §"Interfaces" → matched exactly in Task 2 (types) and Task 4 (assembler) + Task 7 (inliner).
- Spec §"Bundle file path" → matched in `bundleFile` in Task 4 + `pickLatest` in Task 7.
- Spec §"Bundle schema" frontmatter + sections → Task 1 schema doc + Task 4 `renderFrontmatter` + `composeBody`.
- Spec §"Data flow" all 8 steps → Tasks 10 (builder side) + 11 (consumer side) + 8 (CLI bridge).
- Spec §"Error handling" all 11 rows → Tasks 4 + 5 (assembler errors) + Task 7 (inliner errors) + Task 10 (builder fallback prompt language).
- Spec §"Security" outside-repo rejection → Task 4 (`isInsideRepo`) + Task 5 test.
- Spec §"Artifact policy" committed under `.claude/artifacts/crew/bundles/` → matches existing repo-wide policy; no `.gitignore` change needed.
- Spec §"Testing.Unit assemble" all 8 cases → Tasks 3 + 5.
- Spec §"Testing.Unit inline" all 6 cases → Task 6.
- Spec §"Testing.Integration e2e-smoke" 3 assertions → Task 13.
- Spec §"Testing.Schema validation" hard CI gate → Task 9.
- Spec §"Testing.Telemetry hook" review_rebound_count field → Task 15.

**Placeholder scan:** No "TBD", "TODO", or "implement later". The `FEAT-XXX` comment in Task 13 is intentionally a placeholder for whichever FEAT this work gets filed under — it can stay as a literal `FEAT-XXX` until the FEAT id is assigned, since it appears only as a code comment.

**Type consistency:** `BundleInputs`, `BundleOutput`, `BundleFrontmatter`, `BuilderName`, `SkipReason`, `DiffStat`, `ReadLedgerEntry` defined once in Task 2; referenced consistently in Tasks 4, 7, 9, and 8.

**Scope check:** Single subsystem. Independent of the other four steals in the research matrix. Produces working, testable software on its own after Task 17.
