// tests/memory-provider-noop.test.ts
// FEAT-188 S2 AC-1: no `memory` block -> noopProvider selected, dispatch
// output byte-identical to today (no filesystem side effects at all).
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { noopProvider } from "../scripts/lib/memory/noop-provider.ts";
import { resolveProvider } from "../scripts/lib/memory/resolve-provider.ts";

async function makeTempRepo(prefix: string) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function cleanup(dir: string) {
  await fs.rm(dir, { recursive: true, force: true });
}

test("noopProvider describes itself as noop", () => {
  assert.deepEqual(noopProvider().describe(), { provider: "noop" });
});

test("noopProvider.capture resolves without throwing and without writing anything", async () => {
  const provider = noopProvider();
  await assert.doesNotReject(
    provider.capture({
      kind: "failure",
      severity: "high",
      summary: "should not be persisted",
      source: "test"
    })
  );
});

test("noopProvider.recall always returns an empty array", async () => {
  const provider = noopProvider();
  assert.deepEqual(await provider.recall({}), []);
  assert.deepEqual(await provider.recall({ agent: "reviewer", k: 5 }), []);
});

test("noopProvider.supersede and .invalidate resolve without throwing", async () => {
  const provider = noopProvider();
  await assert.doesNotReject(
    provider.supersede("some-id", {
      kind: "lesson",
      severity: "low",
      summary: "replacement",
      source: "test"
    })
  );
  await assert.doesNotReject(provider.invalidate("some-id"));
});

test("golden: resolveProvider(undefined, repo) selects noop and never touches disk", async () => {
  const repo = await makeTempRepo("memory-noop-golden-");
  try {
    const provider = resolveProvider(undefined, repo);
    assert.deepEqual(provider.describe(), { provider: "noop" });

    await provider.capture({
      kind: "failure",
      severity: "critical",
      summary: "should not appear anywhere on disk",
      source: "test"
    });

    const learningsPath = path.join(repo, ".claude", "artifacts", "loop", "learnings.jsonl");
    await assert.rejects(fs.access(learningsPath), "no learnings.jsonl should be created by noop");
  } finally {
    await cleanup(repo);
  }
});

test("golden: an empty memory block ({}) also resolves to disabled/noop behavior", async () => {
  const repo = await makeTempRepo("memory-noop-empty-block-");
  try {
    const provider = resolveProvider({}, repo);
    assert.deepEqual(provider.describe(), { provider: "noop" });
  } finally {
    await cleanup(repo);
  }
});
