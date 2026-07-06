// tests/capture-learning.test.ts
// FEAT-188 S1a AC-2/AC-3/AC-4/AC-6: capture repair — the legacy-JSONL sink
// used by review/validation-FAIL, inline-return-warn, and subagent_incomplete
// capture. Not the S2 MemoryProvider (doesn't exist yet) — this writes
// straight to .claude/artifacts/loop/learnings.jsonl in a shape S2's Zod
// schema can adopt without a migration (kind/severity/tags/summary/source).
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { captureFailureLearning } from "../scripts/lib/memory/capture-learning.ts";

async function makeTempRepo(prefix: string) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function cleanup(dir: string) {
  await fs.rm(dir, { recursive: true, force: true });
}

async function readLearningsLines(repoPath: string): Promise<Record<string, unknown>[]> {
  const raw = await fs.readFile(
    path.join(repoPath, ".claude", "artifacts", "loop", "learnings.jsonl"),
    "utf8"
  );
  return raw
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l));
}

test("captureFailureLearning appends a failure-kind entry with the forward-compatible shape", async () => {
  const repo = await makeTempRepo("capture-learning-basic-");
  try {
    await captureFailureLearning(repo, {
      agent: "reviewer",
      severity: "high",
      summary: "review rejected: missing null guard",
      tags: ["review-result", "SLICE-01"],
      source: "review_fail"
    });
    const lines = await readLearningsLines(repo);
    assert.equal(lines.length, 1);
    const entry = lines[0]!;
    assert.equal(entry.kind, "failure");
    assert.equal(entry.agent, "reviewer");
    assert.equal(entry.severity, "high");
    assert.equal(entry.summary, "review rejected: missing null guard");
    assert.deepEqual(entry.tags, ["review-result", "SLICE-01"]);
    assert.equal(entry.source, "review_fail");
    assert.equal(typeof entry.ts, "string");
    assert.ok(!Number.isNaN(Date.parse(entry.ts as string)));
  } finally {
    await cleanup(repo);
  }
});

test("captureFailureLearning creates the parent directory when missing", async () => {
  const repo = await makeTempRepo("capture-learning-mkdir-");
  try {
    await captureFailureLearning(repo, {
      summary: "validation failed: build broke",
      source: "validation_fail"
    });
    const lines = await readLearningsLines(repo);
    assert.equal(lines.length, 1);
    assert.equal(lines[0]!.agent, null);
    assert.equal(lines[0]!.severity, "medium", "default severity is medium when unspecified");
    assert.deepEqual(lines[0]!.tags, [], "default tags is empty array when unspecified");
  } finally {
    await cleanup(repo);
  }
});

test("captureFailureLearning appends (does not overwrite) across multiple calls", async () => {
  const repo = await makeTempRepo("capture-learning-append-");
  try {
    await captureFailureLearning(repo, { summary: "first", source: "review_fail" });
    await captureFailureLearning(repo, { summary: "second", source: "validation_fail" });
    const lines = await readLearningsLines(repo);
    assert.equal(lines.length, 2);
    assert.equal(lines[0]!.summary, "first");
    assert.equal(lines[1]!.summary, "second");
  } finally {
    await cleanup(repo);
  }
});

test("captureFailureLearning truncates an over-long summary to 280 chars", async () => {
  const repo = await makeTempRepo("capture-learning-truncate-");
  try {
    const longSummary = "x".repeat(500);
    await captureFailureLearning(repo, { summary: longSummary, source: "review_fail" });
    const lines = await readLearningsLines(repo);
    assert.equal((lines[0]!.summary as string).length, 280);
  } finally {
    await cleanup(repo);
  }
});

test("captureFailureLearning degrades safely (never throws) when the target path is unwritable", async () => {
  // Point repoPath at a location where .claude/artifacts/loop is itself a
  // file (not a directory) — mkdir + append must both fail, and the
  // function must swallow the error rather than propagate (AC-6).
  const repo = await makeTempRepo("capture-learning-unwritable-");
  try {
    const blockerPath = path.join(repo, ".claude", "artifacts", "loop");
    await fs.mkdir(path.dirname(blockerPath), { recursive: true });
    await fs.writeFile(blockerPath, "not a directory", "utf8");
    await assert.doesNotReject(
      captureFailureLearning(repo, { summary: "should not throw", source: "review_fail" })
    );
  } finally {
    await cleanup(repo);
  }
});
