import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { getCachedDirFiles, _cacheForTesting } from "../scripts/lib/dir-cache.mjs";

async function makeTmpDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dir-cache-"));
  return dir;
}

test("getCachedDirFiles: second call with unchanged dir returns same array reference", async () => {
  const dir = await makeTmpDir();
  await fs.writeFile(path.join(dir, "b.jsonl"), "");
  await fs.writeFile(path.join(dir, "a.jsonl"), "");
  const cache = _cacheForTesting();
  cache.delete(dir); // clear any prior entry
  try {
    const first = await getCachedDirFiles(dir, (n) => n.endsWith(".jsonl"));
    const second = await getCachedDirFiles(dir, (n) => n.endsWith(".jsonl"));
    assert.strictEqual(first, second, "cache hit must return same array reference");
    assert.equal(first.length, 2);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("getCachedDirFiles: cache invalidated when mtime advances", async () => {
  const dir = await makeTmpDir();
  await fs.writeFile(path.join(dir, "a.jsonl"), "");
  const cache = _cacheForTesting();
  cache.delete(dir);
  try {
    const first = await getCachedDirFiles(dir, (n) => n.endsWith(".jsonl"));
    assert.equal(first.length, 1);

    // Wait to ensure mtime advances on the directory
    await new Promise((r) => setTimeout(r, 20));
    await fs.writeFile(path.join(dir, "b.jsonl"), "");

    const second = await getCachedDirFiles(dir, (n) => n.endsWith(".jsonl"));
    assert.ok(second.length >= 2, "cache should refresh after new file added");
    assert.notStrictEqual(first, second, "must be a new array after mtime change");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("getCachedDirFiles: returns empty array for missing directory", async () => {
  const result = await getCachedDirFiles("/nonexistent/path/dir", () => true);
  assert.deepEqual(result, []);
});

test("getCachedDirFiles: files returned in descending order", async () => {
  const dir = await makeTmpDir();
  await fs.writeFile(path.join(dir, "a.txt"), "");
  await fs.writeFile(path.join(dir, "c.txt"), "");
  await fs.writeFile(path.join(dir, "b.txt"), "");
  try {
    const files = await getCachedDirFiles(dir);
    const names = files.map((f) => path.basename(f));
    assert.deepEqual(names, ["c.txt", "b.txt", "a.txt"]);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
