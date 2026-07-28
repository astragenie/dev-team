import { test, expect } from "bun:test";
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
    expect(result).toBe("hello world");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("readFileIfExists: returns null when file does not exist", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fs-utils-"));
  const filePath = path.join(dir, "nonexistent.txt");
  try {
    const result = await readFileIfExists(filePath);
    expect(result).toBe(null);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("readFileIfExists: re-throws non-ENOENT errors", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fs-utils-"));
  // Reading a directory as a file produces EISDIR, not ENOENT
  try {
    let caught: unknown;
    try {
      await readFileIfExists(dir);
    } catch (err) {
      caught = err;
    }
    expect(caught instanceof Error).toBeTruthy();
    expect((caught as NodeJS.ErrnoException).code).not.toBe("ENOENT");
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
    expect(await pathExists(f)).toBe(true);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("pathExists: returns false for missing file", async () => {
  expect(await pathExists("/nonexistent/path/that/cannot/exist-xyz123")).toBe(false);
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
    expect(result.foo).toBe(42);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("readJson: throws for missing file", async () => {
  await expect(readJson("/nonexistent/data.json")).rejects.toThrow();
});

test("readJson: throws for malformed JSON", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fs-utils-test-"));
  const f = path.join(dir, "bad.json");
  await fs.writeFile(f, "not valid json{{{");
  try {
    await expect(readJson(f)).rejects.toThrow();
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
