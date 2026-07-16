import { test, expect } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { getCachedDirFiles, _cacheForTesting } from "../scripts/lib/dir-cache.ts";

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
    expect(first, "cache hit must return same array reference").toBe(second);
    expect(first.length).toBe(2);
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
    expect(first.length).toBe(1);

    // Wait to ensure mtime advances on the directory
    await new Promise((r) => setTimeout(r, 20));
    await fs.writeFile(path.join(dir, "b.jsonl"), "");

    const second = await getCachedDirFiles(dir, (n) => n.endsWith(".jsonl"));
    expect(second.length >= 2, "cache should refresh after new file added").toBeTruthy();
    expect(first, "must be a new array after mtime change").not.toBe(second);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("getCachedDirFiles: returns empty array for missing directory", async () => {
  const result = await getCachedDirFiles("/nonexistent/path/dir", () => true);
  expect(result).toEqual([]);
});

test("getCachedDirFiles: files returned in descending order", async () => {
  const dir = await makeTmpDir();
  await fs.writeFile(path.join(dir, "a.txt"), "");
  await fs.writeFile(path.join(dir, "c.txt"), "");
  await fs.writeFile(path.join(dir, "b.txt"), "");
  try {
    const files = await getCachedDirFiles(dir);
    const names = files.map((f) => path.basename(f));
    expect(names).toEqual(["c.txt", "b.txt", "a.txt"]);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
