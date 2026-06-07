import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { readFileIfExists } from "../scripts/lib/fs-utils.mjs";

test("readFileIfExists: returns content when file exists", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fs-utils-"));
  const filePath = path.join(dir, "test.txt");
  await fs.writeFile(filePath, "hello world", "utf8");
  try {
    const result = await readFileIfExists(filePath);
    assert.equal(result, "hello world");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("readFileIfExists: returns null when file does not exist", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fs-utils-"));
  const filePath = path.join(dir, "nonexistent.txt");
  try {
    const result = await readFileIfExists(filePath);
    assert.equal(result, null);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("readFileIfExists: re-throws non-ENOENT errors", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fs-utils-"));
  // Reading a directory as a file produces EISDIR, not ENOENT
  try {
    await assert.rejects(
      () => readFileIfExists(dir),
      (err) => {
        assert.ok(err instanceof Error);
        assert.notEqual(/** @type {NodeJS.ErrnoException} */ (err).code, "ENOENT");
        return true;
      }
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
