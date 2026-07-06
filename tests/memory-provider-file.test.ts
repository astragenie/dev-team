// tests/memory-provider-file.test.ts
// FEAT-188 S2 AC coverage: fileProvider — atomic O_APPEND JSONL, torn-line
// discard on read, legacy learnings.jsonl adapter, recency x severity
// ranking with token-budget truncation + supersede-chain resolution.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { fileProvider } from "../scripts/lib/memory/file-provider.ts";
import { captureFailureLearning } from "../scripts/lib/memory/capture-learning.ts";

async function makeTempRepo(prefix: string) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function cleanup(dir: string) {
  await fs.rm(dir, { recursive: true, force: true });
}

function learningsPath(repo: string) {
  return path.join(repo, ".claude", "artifacts", "loop", "learnings.jsonl");
}

test("fileProvider describes itself as file", () => {
  assert.deepEqual(fileProvider("/tmp/whatever").describe(), { provider: "file" });
});

test("fileProvider.capture appends a JSONL row that recall() can read back", async () => {
  const repo = await makeTempRepo("memory-file-capture-");
  try {
    const provider = fileProvider(repo);
    await provider.capture({
      kind: "failure",
      severity: "high",
      summary: "review rejected: missing null guard",
      tags: ["stack:typescript"],
      source: "review_fail"
    });
    const results = await provider.recall({ k: 5 });
    assert.equal(results.length, 1);
    assert.equal(results[0]!.summary, "review rejected: missing null guard");
    assert.equal(results[0]!.severity, "high");
    assert.ok(results[0]!.id, "capture assigns an id when the caller omits one");
  } finally {
    await cleanup(repo);
  }
});

test("fileProvider.capture writes into the SAME store S1a's captureFailureLearning uses (no forked writer)", async () => {
  const repo = await makeTempRepo("memory-file-shared-store-");
  try {
    await captureFailureLearning(repo, { summary: "s1a entry", source: "validation_fail" });
    const provider = fileProvider(repo);
    await provider.capture({
      kind: "lesson",
      severity: "medium",
      summary: "s2 entry",
      source: "test"
    });
    const raw = await fs.readFile(learningsPath(repo), "utf8");
    const lines = raw.split("\n").filter((l) => l.trim().length > 0);
    assert.equal(lines.length, 2, "both writers append to the same file");
  } finally {
    await cleanup(repo);
  }
});

test("fileProvider.recall discards a torn (corrupt) trailing line instead of throwing", async () => {
  const repo = await makeTempRepo("memory-file-torn-");
  try {
    const provider = fileProvider(repo);
    await provider.capture({ kind: "failure", severity: "high", summary: "good row", source: "t" });
    // Simulate a crash mid-write: append a truncated JSON fragment.
    await fs.appendFile(learningsPath(repo), '{"kind":"failure","ts":"2026-0', "utf8");

    const results = await provider.recall({ k: 5 });
    assert.equal(results.length, 1);
    assert.equal(results[0]!.summary, "good row");
  } finally {
    await cleanup(repo);
  }
});

test("fileProvider.recall includes legacy S1a-shape rows (kind/ts/agent/severity/tags/summary/source, no id) via the adapter", async () => {
  const repo = await makeTempRepo("memory-file-legacy-s1a-");
  try {
    await captureFailureLearning(repo, {
      agent: "reviewer",
      severity: "critical",
      summary: "legacy S1a row",
      source: "review_fail"
    });
    const provider = fileProvider(repo);
    const results = await provider.recall({ k: 5 });
    assert.equal(results.length, 1);
    assert.equal(results[0]!.summary, "legacy S1a row");
    assert.equal(results[0]!.kind, "failure");
  } finally {
    await cleanup(repo);
  }
});

test("fileProvider.recall includes pre-S1a legacy rows (id/timestamp/key/insight/confidence) via the adapter", async () => {
  const repo = await makeTempRepo("memory-file-legacy-pre-s1a-");
  try {
    const target = learningsPath(repo);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.appendFile(
      target,
      `${JSON.stringify({
        id: "old-1",
        timestamp: new Date().toISOString(),
        key: "grade-template-rot",
        insight: "grades kept the unfilled placeholder bullet",
        confidence: 0.8
      })}\n`,
      "utf8"
    );
    const provider = fileProvider(repo);
    const results = await provider.recall({ k: 5 });
    assert.equal(results.length, 1);
    assert.equal(results[0]!.summary, "grades kept the unfilled placeholder bullet");
    assert.deepEqual(results[0]!.tags, ["grade-template-rot"]);
  } finally {
    await cleanup(repo);
  }
});

test("fileProvider.recall ranks by recency x severity (higher severity + more recent wins)", async () => {
  const repo = await makeTempRepo("memory-file-ranking-");
  try {
    const provider = fileProvider(repo);
    const now = Date.now();
    const oldTs = new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString();
    const freshTs = new Date(now - 1 * 60 * 1000).toISOString();

    await provider.capture({
      id: "old-low",
      ts: oldTs,
      kind: "lesson",
      severity: "low",
      summary: "old and low severity",
      source: "t"
    });
    await provider.capture({
      id: "fresh-critical",
      ts: freshTs,
      kind: "failure",
      severity: "critical",
      summary: "fresh and critical",
      source: "t"
    });

    const results = await provider.recall({ k: 5 });
    assert.equal(results[0]!.id, "fresh-critical", "fresh+critical should outrank old+low");
  } finally {
    await cleanup(repo);
  }
});

test("fileProvider.recall truncates results to a token budget (recall.maxTokens)", async () => {
  const repo = await makeTempRepo("memory-file-truncate-");
  try {
    const provider = fileProvider(repo);
    for (let i = 0; i < 5; i += 1) {
      await provider.capture({
        id: `entry-${i}`,
        kind: "lesson",
        severity: "high",
        summary: "x".repeat(200),
        source: "t"
      });
    }
    // Each ~200-char summary costs ~50 estimated tokens; a 60-token budget
    // should allow through at most one entry.
    const results = await provider.recall({ k: 5, maxTokens: 60 });
    assert.ok(
      results.length <= 1,
      `expected <=1 entry under a tight token budget, got ${results.length}`
    );
  } finally {
    await cleanup(repo);
  }
});

test("fileProvider.recall resolves supersede chains — only the latest entry in a chain is returned", async () => {
  const repo = await makeTempRepo("memory-file-supersede-");
  try {
    const provider = fileProvider(repo);
    await provider.capture({
      id: "v1",
      kind: "decision",
      severity: "medium",
      summary: "original decision",
      source: "t"
    });
    await provider.supersede("v1", {
      id: "v2",
      kind: "decision",
      severity: "medium",
      summary: "revised decision",
      source: "t"
    });

    const results = await provider.recall({ k: 5 });
    const ids = results.map((r) => r.id);
    assert.ok(ids.includes("v2"), "the superseding entry should be present");
    assert.ok(!ids.includes("v1"), "the superseded entry should be excluded");
  } finally {
    await cleanup(repo);
  }
});

test("fileProvider.invalidate excludes an entry from future recall() calls", async () => {
  const repo = await makeTempRepo("memory-file-invalidate-");
  try {
    const provider = fileProvider(repo);
    await provider.capture({
      id: "bad-entry",
      kind: "lesson",
      severity: "high",
      summary: "turned out to be wrong",
      source: "t"
    });
    let results = await provider.recall({ k: 5 });
    assert.ok(results.some((r) => r.id === "bad-entry"));

    await provider.invalidate("bad-entry");
    results = await provider.recall({ k: 5 });
    assert.ok(!results.some((r) => r.id === "bad-entry"));
  } finally {
    await cleanup(repo);
  }
});
