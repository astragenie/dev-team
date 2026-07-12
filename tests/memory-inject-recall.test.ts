// tests/memory-inject-recall.test.ts
// FEAT-188 S3a AC coverage: the ONE recall injection helper — scoped
// agent/tag recall, token budget, bridge-format block, and the
// highest-risk regression property (byte-identical output when memory is
// disabled or on any failure).
//
// Project scoping (astragenie/dev-team#159, FEAT-423): the block below
// covers the direct wire-provider bypass in buildRecallBlock — project
// forwarded (explicit opt and config fallback) when astramem is paired, and
// graceful fallback to the standard agent/tag path when it is not. Uses the
// `_setWireProvider`/`_resetResolveCache` test seam from
// @astragenie/astramem-client (same seam memory-provider-astramem.test.ts
// uses) rather than a real socket.
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
import { fileProvider } from "@astragenie/memory-provider";
import {
  _resetResolveCache,
  _setWireProvider,
  type RecallRequest
} from "@astragenie/astramem-client";

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

test("buildRecallBlock forwards the configured project to the wire provider when astramem is paired (#159)", async () => {
  const repo = await makeTempRepo("inject-recall-project-config-");
  try {
    await writeLoopConfig(repo, { provider: "astramem", project: "dev-team" });

    let capturedReq: RecallRequest | undefined;
    _resetResolveCache();
    _setWireProvider({
      async recall(req) {
        capturedReq = req;
        return { hits: [{ id: "hit-1", type: "lesson", text: "scoped memory hit", score: 0.9 }] };
      },
      async remember() {
        return undefined;
      },
      async health() {
        return { ok: true };
      }
    });

    try {
      const block = await buildRecallBlock({ repoPath: repo, agent: "crew:fullstack-dev" });
      assert.ok(capturedReq, "wire provider recall() must have been called directly");
      assert.equal(
        capturedReq?.project,
        "dev-team",
        "project falls back from config.memory.project"
      );
      assert.equal(
        capturedReq?.agent,
        "crew:fullstack-dev",
        "agent scope still reaches the wire call"
      );
      assert.match(block, /## Prior context \(from astramem\)/);
      assert.match(block, /scoped memory hit/);
    } finally {
      _setWireProvider(null);
      _resetResolveCache();
    }
  } finally {
    await cleanup(repo);
  }
});

test("buildRecallBlock prefers an explicit project override over the configured default (#159)", async () => {
  const repo = await makeTempRepo("inject-recall-project-override-");
  try {
    await writeLoopConfig(repo, { provider: "astramem", project: "dev-team" });

    let capturedReq: RecallRequest | undefined;
    _resetResolveCache();
    _setWireProvider({
      async recall(req) {
        capturedReq = req;
        return { hits: [] };
      },
      async remember() {
        return undefined;
      },
      async health() {
        return { ok: true };
      }
    });

    try {
      await buildRecallBlock({ repoPath: repo, project: "runner-plugin" });
      assert.equal(capturedReq?.project, "runner-plugin");
    } finally {
      _setWireProvider(null);
      _resetResolveCache();
    }
  } finally {
    await cleanup(repo);
  }
});

test("buildRecallBlock falls back to the standard agent/tag path when astramem is unpaired despite a configured project (#159)", async () => {
  const repo = await makeTempRepo("inject-recall-project-fallback-");
  try {
    // astramemProvider's unpaired recall() delegates straight to
    // fileProvider — seed the same on-disk store the fallback reads.
    await fileProvider(repo).capture({
      kind: "lesson",
      severity: "medium",
      summary: "fallback lesson visible without project scoping",
      source: "test"
    });
    await writeLoopConfig(repo, { provider: "astramem", project: "dev-team" });

    _resetResolveCache();
    _setWireProvider(null); // simulate "astramem plugin not paired"

    try {
      const block = await buildRecallBlock({ repoPath: repo });
      assert.match(
        block,
        /fallback lesson visible without project scoping/,
        "project scoping being unavailable must not suppress the standard recall path"
      );
    } finally {
      _resetResolveCache();
    }
  } finally {
    await cleanup(repo);
  }
});

test("buildRecallBlock does not forward a project filter when none is configured or passed (#159)", async () => {
  const repo = await makeTempRepo("inject-recall-project-unset-");
  try {
    await writeLoopConfig(repo, { provider: "astramem" });

    let capturedReq: RecallRequest | undefined;
    _resetResolveCache();
    _setWireProvider({
      async recall(req) {
        capturedReq = req;
        return { hits: [] };
      },
      async remember() {
        return undefined;
      },
      async health() {
        return { ok: true };
      }
    });

    try {
      // No opts.project and no config project -> the project-scoped bypass
      // is skipped entirely; the generic astramemProvider path (paired,
      // dualWrite:false) still reaches the wire for agent/tag scoping, but
      // must never leak an implicit project filter onto that request.
      await buildRecallBlock({ repoPath: repo });
      assert.ok(capturedReq, "generic recall path still reaches the wire when paired");
      assert.equal(
        capturedReq?.project,
        undefined,
        "no project scope should be present on the wire request when unconfigured"
      );
    } finally {
      _setWireProvider(null);
      _resetResolveCache();
    }
  } finally {
    await cleanup(repo);
  }
});
