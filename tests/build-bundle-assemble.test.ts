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

  assert.ok(
    result.path.endsWith("SLICE-99/builder-be-20260608T223000Z-build-bundle.md") ||
      result.path.endsWith("SLICE-99\\builder-be-20260608T223000Z-build-bundle.md")
  );
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
  // Section ordering is fixed:
  assert.ok(text.indexOf("## Handoff") < text.indexOf("## Diff"));
  assert.ok(text.indexOf("## Diff") < text.indexOf("## Files touched"));
  assert.ok(text.indexOf("## Files touched") < text.indexOf("## Files read"));
  // INLINE_HEADER never appears in raw bundle (it is only added by inliner).
  assert.ok(!text.includes(INLINE_HEADER));
});

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

  assert.deepEqual(result.filesReadSkipped, [{ path: "missing.md", reason: "deleted" }]);
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
    result.filesReadSkipped.some((s) => s.path === "../outside.txt" && s.reason === "outside-repo")
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
