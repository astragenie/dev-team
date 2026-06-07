import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { getCachedArtifact, _cacheForTesting } from "../scripts/lib/artifact-cache.mjs";

async function writeTmp(content) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "artifact-cache-"));
  const filePath = path.join(dir, "artifact.md");
  await fs.writeFile(filePath, content, "utf8");
  return { dir, filePath };
}

test("getCachedArtifact: returns parsed frontmatter and body", async () => {
  const { dir, filePath } = await writeTmp(
    "---\nid: SLICE-1\ntitle: Test\n---\n# Heading\nBody text."
  );
  try {
    const result = await getCachedArtifact(filePath);
    assert.equal(result.fm.id, "SLICE-1");
    assert.equal(result.fm.title, "Test");
    assert.ok(result.body.includes("# Heading"));
    assert.ok(typeof result.mtimeMs === "number");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("getCachedArtifact: second call returns cached result without re-reading", async () => {
  const { dir, filePath } = await writeTmp("---\nid: SLICE-2\n---\n# Two");
  const cache = _cacheForTesting();
  cache.delete(filePath); // ensure no prior entry
  try {
    const first = await getCachedArtifact(filePath);
    const second = await getCachedArtifact(filePath);
    // Same object reference means cache was hit
    assert.strictEqual(first, second);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("getCachedArtifact: cache invalidated when file changes (mtime advances)", async () => {
  const { dir, filePath } = await writeTmp("---\nid: OLD\n---\nOld body");
  try {
    const first = await getCachedArtifact(filePath);
    assert.equal(first.fm.id, "OLD");

    // Write new content and force a new mtime by delaying slightly
    await new Promise((r) => setTimeout(r, 10));
    await fs.writeFile(filePath, "---\nid: NEW\n---\nNew body", "utf8");

    const second = await getCachedArtifact(filePath);
    assert.equal(second.fm.id, "NEW");
    assert.notStrictEqual(first, second);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("getCachedArtifact: throws for missing file", async () => {
  await assert.rejects(
    () => getCachedArtifact("/nonexistent/path/missing.md"),
    (err) => {
      assert.equal(/** @type {NodeJS.ErrnoException} */ (err).code, "ENOENT");
      return true;
    }
  );
});
