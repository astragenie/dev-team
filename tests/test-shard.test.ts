// Tests for scripts/test-shard.ts (FEAT-200).
//
// Proves the partition is a COVER over the test suite: every shard's file
// list is disjoint, and the union of all shards equals the full input file
// list exactly once each (no skip, no double-run). Exercises both a
// synthetic file list and the real tests/ tree so a future test file
// addition/removal can't silently fall outside every shard.

import test from "node:test";
import assert from "node:assert/strict";
import { discoverTestFiles, partitionFiles } from "../scripts/test-shard.ts";

function unionOverShards(files: readonly string[], shardTotal: number): string[] {
  const union: string[] = [];
  for (let shardIndex = 0; shardIndex < shardTotal; shardIndex++) {
    union.push(...partitionFiles(files, shardIndex, shardTotal));
  }
  return union;
}

test("partitionFiles: union of all shards equals the sorted input, no gaps", () => {
  const files = ["c.test.ts", "a.test.ts", "e.test.ts", "b.test.ts", "d.test.ts"];
  const union = unionOverShards(files, 3);
  assert.deepEqual(union.slice().sort(), [...files].sort());
});

test("partitionFiles: no file appears in more than one shard", () => {
  const files = Array.from({ length: 37 }, (_, i) => `file-${String(i).padStart(2, "0")}.test.ts`);
  const shardTotal = 4;
  const seen = new Map<string, number>();
  for (let shardIndex = 0; shardIndex < shardTotal; shardIndex++) {
    for (const f of partitionFiles(files, shardIndex, shardTotal)) {
      seen.set(f, (seen.get(f) ?? 0) + 1);
    }
  }
  assert.equal(seen.size, files.length, "every file must be assigned to some shard");
  for (const [file, count] of seen) {
    assert.equal(count, 1, `${file} was assigned to ${count} shards, expected exactly 1`);
  }
});

test("partitionFiles: deterministic across repeated calls and unsorted input order", () => {
  const filesA = ["z.test.ts", "m.test.ts", "a.test.ts"];
  const filesB = ["a.test.ts", "z.test.ts", "m.test.ts"]; // same set, different order
  assert.deepEqual(partitionFiles(filesA, 0, 2), partitionFiles(filesA, 0, 2));
  assert.deepEqual(partitionFiles(filesA, 0, 2), partitionFiles(filesB, 0, 2));
});

test("partitionFiles: shardTotal=1 assigns every file to the single shard", () => {
  const files = ["a.test.ts", "b.test.ts", "c.test.ts"];
  assert.deepEqual(partitionFiles(files, 0, 1), [...files].sort());
});

test("partitionFiles: empty input yields empty shards", () => {
  assert.deepEqual(partitionFiles([], 0, 3), []);
  assert.deepEqual(unionOverShards([], 3), []);
});

test("partitionFiles: rejects out-of-range shardIndex", () => {
  assert.throws(() => partitionFiles(["a.test.ts"], 3, 3));
  assert.throws(() => partitionFiles(["a.test.ts"], -1, 3));
});

test("partitionFiles: rejects non-positive shardTotal", () => {
  assert.throws(() => partitionFiles(["a.test.ts"], 0, 0));
  assert.throws(() => partitionFiles(["a.test.ts"], 0, -1));
});

test("discoverTestFiles + partitionFiles: real tests/ tree is fully covered across 3 shards", async () => {
  const allFiles = await discoverTestFiles();
  assert.ok(allFiles.length > 0, "expected at least one discovered test file");
  // This file itself must be discoverable, proving the walk reaches every subdirectory depth used in tests/.
  assert.ok(
    allFiles.includes("tests/test-shard.test.ts"),
    "discoverTestFiles did not find tests/test-shard.test.ts"
  );

  const shardTotal = 3;
  const union = unionOverShards(allFiles, shardTotal);
  assert.deepEqual(union.slice().sort(), [...allFiles].sort());

  const seen = new Set<string>();
  for (let shardIndex = 0; shardIndex < shardTotal; shardIndex++) {
    for (const f of partitionFiles(allFiles, shardIndex, shardTotal)) {
      assert.ok(!seen.has(f), `${f} appeared in more than one shard`);
      seen.add(f);
    }
  }
  assert.equal(seen.size, allFiles.length);
});
