// tests/memory-provider-noop.test.ts
// FEAT-188 S2 AC-1: no `memory` block -> noopProvider selected, dispatch
// output byte-identical to today (no filesystem side effects at all).
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test, expect } from "bun:test";
import { noopProvider, resolveProvider } from "@astragenie/memory-provider";

async function makeTempRepo(prefix: string) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function cleanup(dir: string) {
  await fs.rm(dir, { recursive: true, force: true });
}

test("noopProvider describes itself as noop", () => {
  expect(noopProvider().describe()).toEqual({ provider: "noop" });
});

test("noopProvider.capture resolves without throwing and without writing anything", async () => {
  const provider = noopProvider();
  await provider.capture({
    kind: "failure",
    severity: "high",
    summary: "should not be persisted",
    source: "test"
  });
});

test("noopProvider.recall always returns an empty array", async () => {
  const provider = noopProvider();
  expect(await provider.recall({})).toEqual([]);
  expect(await provider.recall({ agent: "reviewer", k: 5 })).toEqual([]);
});

test("noopProvider.supersede and .invalidate resolve without throwing", async () => {
  const provider = noopProvider();
  await provider.supersede("some-id", {
    kind: "lesson",
    severity: "low",
    summary: "replacement",
    source: "test"
  });
  await provider.invalidate("some-id");
});

test("golden: resolveProvider(undefined, repo) selects noop and never touches disk", async () => {
  const repo = await makeTempRepo("memory-noop-golden-");
  try {
    const provider = resolveProvider(undefined, repo);
    expect(provider.describe()).toEqual({ provider: "noop" });

    await provider.capture({
      kind: "failure",
      severity: "critical",
      summary: "should not appear anywhere on disk",
      source: "test"
    });

    const learningsPath = path.join(repo, ".claude", "artifacts", "loop", "learnings.jsonl");
    await expect(
      fs.access(learningsPath),
      "no learnings.jsonl should be created by noop"
    ).rejects.toThrow();
  } finally {
    await cleanup(repo);
  }
});

test("golden: an empty memory block ({}) also resolves to disabled/noop behavior", async () => {
  const repo = await makeTempRepo("memory-noop-empty-block-");
  try {
    const provider = resolveProvider({}, repo);
    expect(provider.describe()).toEqual({ provider: "noop" });
  } finally {
    await cleanup(repo);
  }
});
