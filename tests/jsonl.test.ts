import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { tailReadJsonl } from "../scripts/lib/jsonl.mjs";

async function writeTmpJsonl(lines: unknown[]) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "jsonl-test-"));
  const filePath = path.join(dir, "data.jsonl");
  await fs.writeFile(
    filePath,
    lines.map((l: unknown) => JSON.stringify(l)).join("\n") + "\n",
    "utf8"
  );
  return { dir, filePath };
}

test("tailReadJsonl: returns last N records from multi-line file", async () => {
  const records = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];
  const { dir, filePath } = await writeTmpJsonl(records);
  try {
    const result = await tailReadJsonl(filePath, 3);
    assert.deepEqual(result, [{ id: 3 }, { id: 4 }, { id: 5 }]);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("tailReadJsonl: discards partial leading line at tail boundary", async () => {
  const records = Array.from({ length: 50 }, (_, i) => ({ seq: i, pad: "x".repeat(100) }));
  const { dir, filePath } = await writeTmpJsonl(records);
  try {
    // Use a small maxBytes to force a mid-file start; truncated first line must be dropped
    const result = await tailReadJsonl(filePath, 5, { maxBytes: 800 });
    assert.ok(result.length > 0 && result.length <= 5, "should return 1-5 records");
    // All returned records must be fully parseable (no partial data)
    for (const r of result) {
      assert.ok(typeof r.seq === "number", "each record must have numeric seq");
    }
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("tailReadJsonl: file smaller than tail-window reads in full", async () => {
  const records = [{ a: 1 }, { b: 2 }];
  const { dir, filePath } = await writeTmpJsonl(records);
  try {
    // maxBytes much larger than file — should read all records
    const result = await tailReadJsonl(filePath, 100, { maxBytes: 1024 * 1024 });
    assert.deepEqual(result, records);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("tailReadJsonl: returns empty array for missing file", async () => {
  const result = await tailReadJsonl("/nonexistent/path/data.jsonl", 10);
  assert.deepEqual(result, []);
});

test("tailReadJsonl: returns empty array for empty file", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "jsonl-empty-"));
  const filePath = path.join(dir, "empty.jsonl");
  await fs.writeFile(filePath, "", "utf8");
  try {
    const result = await tailReadJsonl(filePath, 5);
    assert.deepEqual(result, []);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
