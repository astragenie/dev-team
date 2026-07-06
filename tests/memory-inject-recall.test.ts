// tests/memory-inject-recall.test.ts
// FEAT-188 S3a AC coverage: the ONE recall injection helper — scoped
// agent/tag recall, token budget, bridge-format block, and the
// highest-risk regression property (byte-identical output when memory is
// disabled or on any failure).
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRecallBlock,
  injectRecall,
  formatRecallBlock,
  loadMemoryConfig
} from "../scripts/lib/memory/inject-recall.ts";
import { fileProvider } from "../scripts/lib/memory/file-provider.ts";

async function makeTempRepo(prefix: string) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function cleanup(dir: string) {
  await fs.rm(dir, { recursive: true, force: true });
}

async function writeLoopConfig(repo: string, memory: unknown) {
  const target = path.join(repo, ".claude", "loop.json");
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify({ memory }), "utf8");
}

test("formatRecallBlock returns empty string for zero entries (no header, no whitespace)", () => {
  assert.equal(formatRecallBlock([]), "");
});

test("loadMemoryConfig returns undefined when .claude/loop.json is missing", async () => {
  const repo = await makeTempRepo("inject-recall-no-config-");
  try {
    const config = await loadMemoryConfig(repo);
    assert.equal(config, undefined);
  } finally {
    await cleanup(repo);
  }
});

test("loadMemoryConfig returns undefined on malformed JSON (never throws)", async () => {
  const repo = await makeTempRepo("inject-recall-bad-json-");
  try {
    const target = path.join(repo, ".claude", "loop.json");
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, "{ not json", "utf8");
    const config = await loadMemoryConfig(repo);
    assert.equal(config, undefined);
  } finally {
    await cleanup(repo);
  }
});

test("injectRecall is byte-identical to input when no memory config exists (provider:none default)", async () => {
  const repo = await makeTempRepo("inject-recall-none-");
  try {
    const dispatchText = "Build the thing. Do the work.";
    const result = await injectRecall(dispatchText, { repoPath: repo });
    assert.equal(result, dispatchText);
  } finally {
    await cleanup(repo);
  }
});

test("injectRecall is byte-identical to input when recall.enabled:false (even with provider:file)", async () => {
  const repo = await makeTempRepo("inject-recall-disabled-");
  try {
    // Seed an entry so we can prove it's the recall.enabled switch (not lack
    // of data) suppressing the block.
    await fileProvider(repo).capture({
      kind: "failure",
      severity: "high",
      summary: "should never be recalled",
      source: "test"
    });
    await writeLoopConfig(repo, { provider: "file", recall: { enabled: false } });

    const dispatchText = "Fix the bug.";
    const result = await injectRecall(dispatchText, { repoPath: repo });
    assert.equal(result, dispatchText);
  } finally {
    await cleanup(repo);
  }
});

test("injectRecall appends the bridge-format block when provider:file and entries match", async () => {
  const repo = await makeTempRepo("inject-recall-enabled-");
  try {
    await fileProvider(repo).capture({
      kind: "failure",
      severity: "high",
      summary: "review rejected: missing null guard",
      tags: ["stack:typescript"],
      source: "review_fail"
    });
    await writeLoopConfig(repo, { provider: "file" });

    const dispatchText = "Implement the feature.";
    const result = await injectRecall(dispatchText, { repoPath: repo, tags: ["stack:typescript"] });

    assert.ok(result.startsWith(dispatchText), "original dispatch text is preserved verbatim");
    assert.ok(
      result.includes("## Prior context (from astramem)"),
      "reuses the bridge's existing header, not a rival format"
    );
    assert.ok(result.includes("review rejected: missing null guard"));
  } finally {
    await cleanup(repo);
  }
});

test("buildRecallBlock scopes by agent — entries for a different agent are excluded", async () => {
  const repo = await makeTempRepo("inject-recall-agent-scope-");
  try {
    await fileProvider(repo).capture({
      kind: "lesson",
      severity: "medium",
      agent: "crew:backend-dev",
      summary: "backend-only lesson",
      source: "test"
    });
    await writeLoopConfig(repo, { provider: "file" });

    const block = await buildRecallBlock({ repoPath: repo, agent: "crew:frontend-dev" });
    assert.equal(block, "", "entry scoped to a different agent must not leak into this recall");
  } finally {
    await cleanup(repo);
  }
});

test("buildRecallBlock respects recall.maxTokens (token-budget truncation)", async () => {
  const repo = await makeTempRepo("inject-recall-budget-");
  try {
    const provider = fileProvider(repo);
    for (let i = 0; i < 5; i += 1) {
      await provider.capture({
        kind: "lesson",
        severity: "high",
        summary: "x".repeat(200),
        source: "t"
      });
    }
    await writeLoopConfig(repo, { provider: "file", recall: { maxTokens: 60 } });

    const block = await buildRecallBlock({ repoPath: repo });
    const lineCount = block.length === 0 ? 0 : block.split("\n").length - 1; // minus header line
    assert.ok(
      lineCount <= 1,
      `expected <=1 recalled line under a tight token budget, got ${lineCount}`
    );
  } finally {
    await cleanup(repo);
  }
});

test("injectRecall degrades to the input text unchanged when the provider throws (best-effort guard)", async () => {
  const repo = await makeTempRepo("inject-recall-guard-");
  try {
    // An unknown provider value is a hard Zod error inside parseMemoryConfig;
    // buildRecallBlock/injectRecall must swallow it, not propagate.
    await writeLoopConfig(repo, { provider: "not-a-real-provider" });

    const dispatchText = "Ship it.";
    const result = await injectRecall(dispatchText, { repoPath: repo });
    assert.equal(result, dispatchText);
  } finally {
    await cleanup(repo);
  }
});
