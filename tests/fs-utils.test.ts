import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { readFileIfExists } from "../scripts/lib/fs-utils.mjs";
import { pathExists, readJson } from "../scripts/lib/fs-utils.ts";

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
        assert.notEqual((err as NodeJS.ErrnoException).code, "ENOENT");
        return true;
      }
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// pathExists
// ---------------------------------------------------------------------------

test("pathExists: returns true for existing file", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fs-utils-test-"));
  const f = path.join(dir, "file.txt");
  await fs.writeFile(f, "hello");
  try {
    assert.equal(await pathExists(f), true);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("pathExists: returns false for missing file", async () => {
  assert.equal(await pathExists("/nonexistent/path/that/cannot/exist-xyz123"), false);
});

// ---------------------------------------------------------------------------
// readJson
// ---------------------------------------------------------------------------

test("readJson: parses valid JSON", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fs-utils-test-"));
  const f = path.join(dir, "data.json");
  await fs.writeFile(f, JSON.stringify({ foo: 42 }));
  try {
    const result = await readJson<{ foo: number }>(f);
    assert.equal(result.foo, 42);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("readJson: throws for missing file", async () => {
  await assert.rejects(() => readJson("/nonexistent/data.json"));
});

test("readJson: throws for malformed JSON", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fs-utils-test-"));
  const f = path.join(dir, "bad.json");
  await fs.writeFile(f, "not valid json{{{");
  try {
    await assert.rejects(() => readJson(f));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
