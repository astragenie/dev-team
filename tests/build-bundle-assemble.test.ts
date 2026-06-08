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
