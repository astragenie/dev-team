import { test } from "node:test";
import assert from "node:assert/strict";

import {
  addTotals,
  percentile,
  approxSize,
  isSyntheticModel,
  emptyTotals,
  inspectContent,
  tokensFromUsage,
  handleUserTurn,
  handleAssistantTurn,
  recordToolUse
} from "../scripts/lib/session-cost-scanner/compute.ts";

import type { ScanCtx } from "../scripts/lib/session-cost-scanner/compute.ts";

// ── helpers ────────────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<ScanCtx> = {}): ScanCtx {
  const perSource = new Map();
  return {
    totals: emptyTotals(),
    byModel: {},
    toolUseCounts: {},
    toolFailureCounts: {},
    toolResultSizes: [],
    filesRead: {},
    toolNameById: new Map(),
    counters: {
      messagesCounted: 0,
      sessionsScanned: 0,
      compactionCount: 0,
      userMsgCount: 0,
      userMsgTotalLen: 0,
      skillInvocations: 0,
      subagentDispatches: 0,
      turnsBeforeFirstTool: 0
    },
    flags: { sawFirstTool: false },
    ensureSource: (slug) => {
      if (!perSource.has(slug)) {
        perSource.set(slug, {
          messages: 0,
          tokens: emptyTotals(),
          modelTokens: {},
          touched: false
        });
      }
      return perSource.get(slug);
    },
    toolCachePrime: {},
    cachePrimeState: { pendingToolUses: [], pendingResultSizes: {} },
    ...overrides
  };
}

// ── addTotals ──────────────────────────────────────────────────────────────

test("addTotals: merges two records into target", () => {
  const target = emptyTotals();
  const source = { input: 10, cache_create_5m: 2, cache_create_1h: 3, cache_read: 4, output: 5 };
  addTotals(target, source);
  assert.deepEqual(target, source);
});

test("addTotals: accumulates on a non-empty target", () => {
  const target = { input: 1, cache_create_5m: 0, cache_create_1h: 0, cache_read: 0, output: 1 };
  const source = { input: 9, cache_create_5m: 0, cache_create_1h: 0, cache_read: 0, output: 4 };
  addTotals(target, source);
  assert.equal(target["input"], 10);
  assert.equal(target["output"], 5);
});

test("addTotals: missing keys in source treated as 0", () => {
  const target = emptyTotals();
  addTotals(target, {});
  assert.deepEqual(target, emptyTotals());
});

// ── percentile ─────────────────────────────────────────────────────────────

test("percentile: returns 0 for empty array", () => {
  assert.equal(percentile([], 50), 0);
});

test("percentile: p50 on sorted odd-length array", () => {
  const arr = [10, 20, 30, 40, 50];
  assert.equal(percentile(arr, 50), 30);
});

test("percentile: p90 on 10-element array", () => {
  const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  // floor(0.9 * 10) = 9 → index 9 → value 10
  assert.equal(percentile(arr, 90), 10);
});

test("percentile: p0 returns first element", () => {
  assert.equal(percentile([5, 10, 15], 0), 5);
});

test("percentile: p100 returns last element", () => {
  assert.equal(percentile([5, 10, 15], 100), 15);
});

// ── isSyntheticModel ───────────────────────────────────────────────────────

test("isSyntheticModel: returns true for <synthetic>", () => {
  assert.equal(isSyntheticModel("<synthetic>"), true);
});

test("isSyntheticModel: returns true for < (angle-bracket prefix)", () => {
  assert.equal(isSyntheticModel("<whatever>"), true);
});

test("isSyntheticModel: returns true for synthetic prefix", () => {
  assert.equal(isSyntheticModel("synthetic-model"), true);
});

test("isSyntheticModel: returns false for real model name", () => {
  assert.equal(isSyntheticModel("claude-sonnet-4-5"), false);
});

test("isSyntheticModel: returns false for empty string", () => {
  assert.equal(isSyntheticModel(""), false);
});

// ── approxSize ─────────────────────────────────────────────────────────────

test("approxSize: null returns 0", () => {
  assert.equal(approxSize(null), 0);
});

test("approxSize: undefined returns 0", () => {
  assert.equal(approxSize(undefined), 0);
});

test("approxSize: string returns its length", () => {
  assert.equal(approxSize("hello"), 5);
});

test("approxSize: object returns JSON.stringify length", () => {
  const obj = { a: 1 };
  assert.equal(approxSize(obj), JSON.stringify(obj).length);
});

test("approxSize: array returns JSON.stringify length", () => {
  const arr = [1, 2, 3];
  assert.equal(approxSize(arr), JSON.stringify(arr).length);
});

// ── inspectContent ─────────────────────────────────────────────────────────

test("inspectContent: plain string returns textLen, no tools", () => {
  const r = inspectContent("hello world");
  assert.equal(r.textLen, 11);
  assert.equal(r.toolUses.length, 0);
  assert.equal(r.toolResults.length, 0);
});

test("inspectContent: null/undefined returns empty result", () => {
  const r = inspectContent(null);
  assert.equal(r.textLen, 0);
  assert.equal(r.toolUses.length, 0);
});

test("inspectContent: extracts tool_use blocks", () => {
  const content = [{ type: "tool_use", id: "id1", name: "Read", input: { file_path: "/foo" } }];
  const r = inspectContent(content);
  assert.equal(r.toolUses.length, 1);
  assert.equal(r.toolUses[0]?.name, "Read");
  assert.equal(r.toolUses[0]?.id, "id1");
});

test("inspectContent: extracts tool_result blocks", () => {
  const content = [{ type: "tool_result", tool_use_id: "id1", content: "abc", is_error: false }];
  const r = inspectContent(content);
  assert.equal(r.toolResults.length, 1);
  assert.equal(r.toolResults[0]?.id, "id1");
  assert.equal(r.toolResults[0]?.size, 3);
  assert.equal(r.toolResults[0]?.isError, false);
});

test("inspectContent: accumulates text block lengths", () => {
  const content = [
    { type: "text", text: "hello" },
    { type: "text", text: " world" }
  ];
  const r = inspectContent(content);
  assert.equal(r.textLen, 11);
});

// ── tokensFromUsage ────────────────────────────────────────────────────────

test("tokensFromUsage: basic usage record", () => {
  const usage = {
    input_tokens: 100,
    output_tokens: 50,
    cache_read_input_tokens: 20,
    cache_creation_input_tokens: 10
  };
  const t = tokensFromUsage(usage);
  assert.equal(t["input"], 100);
  assert.equal(t["output"], 50);
  assert.equal(t["cache_read"], 20);
  assert.equal(t["cache_create_5m"], 10);
  assert.equal(t["cache_create_1h"], 0);
});

test("tokensFromUsage: nested cache_creation object", () => {
  const usage = {
    input_tokens: 50,
    output_tokens: 25,
    cache_creation: { ephemeral_5m_input_tokens: 8, ephemeral_1h_input_tokens: 4 }
  };
  const t = tokensFromUsage(usage);
  assert.equal(t["cache_create_5m"], 8);
  assert.equal(t["cache_create_1h"], 4);
});

test("tokensFromUsage: empty/null returns zeros", () => {
  const t = tokensFromUsage({});
  assert.deepEqual(t, emptyTotals());
});

// ── handleUserTurn ─────────────────────────────────────────────────────────

test("handleUserTurn: isMeta increments compactionCount", () => {
  const ctx = makeCtx();
  handleUserTurn({ isMeta: true, type: "user" }, ctx);
  assert.equal(ctx.counters.compactionCount, 1);
});

test("handleUserTurn: plain text increments userMsgCount and userMsgTotalLen", () => {
  const ctx = makeCtx();
  handleUserTurn(
    {
      type: "user",
      message: { content: [{ type: "text", text: "hello" }] }
    },
    ctx
  );
  assert.equal(ctx.counters.userMsgCount, 1);
  assert.equal(ctx.counters.userMsgTotalLen, 5);
});

test("handleUserTurn: tool_result tracks size and calls", () => {
  const ctx = makeCtx();
  // Pre-register a tool name so the result can be attributed
  ctx.toolNameById.set("tid1", "Read");
  handleUserTurn(
    {
      type: "user",
      message: {
        content: [{ type: "tool_result", tool_use_id: "tid1", content: "abc", is_error: false }]
      }
    },
    ctx
  );
  assert.equal(ctx.toolResultSizes.length, 1);
  assert.equal(ctx.toolResultSizes[0], 3);
  assert.equal(ctx.toolCachePrime["Read"]?.calls, 1);
  assert.equal(ctx.toolCachePrime["Read"]?.totalResultBytes, 3);
});

test("handleUserTurn: error tool_result increments toolFailureCounts", () => {
  const ctx = makeCtx();
  ctx.toolNameById.set("tid2", "Bash");
  handleUserTurn(
    {
      type: "user",
      message: {
        content: [{ type: "tool_result", tool_use_id: "tid2", content: "err", is_error: true }]
      }
    },
    ctx
  );
  assert.equal(ctx.toolFailureCounts["Bash"], 1);
});

// ── recordToolUse ──────────────────────────────────────────────────────────

test("recordToolUse: increments toolUseCounts and sets sawFirstTool", () => {
  const ctx = makeCtx();
  recordToolUse(ctx, { id: "i1", name: "Bash", input: {} });
  assert.equal(ctx.toolUseCounts["Bash"], 1);
  assert.equal(ctx.flags.sawFirstTool, true);
});

test("recordToolUse: Read tool tracks file_path in filesRead", () => {
  const ctx = makeCtx();
  recordToolUse(ctx, { id: "i2", name: "Read", input: { file_path: "/some/file.ts" } });
  assert.equal(ctx.filesRead["/some/file.ts"], 1);
});

test("recordToolUse: Skill increments skillInvocations", () => {
  const ctx = makeCtx();
  recordToolUse(ctx, { id: "i3", name: "Skill", input: {} });
  assert.equal(ctx.counters.skillInvocations, 1);
});

test("recordToolUse: Agent increments subagentDispatches", () => {
  const ctx = makeCtx();
  recordToolUse(ctx, { id: "i4", name: "Agent", input: {} });
  assert.equal(ctx.counters.subagentDispatches, 1);
});

// ── handleAssistantTurn ────────────────────────────────────────────────────

test("handleAssistantTurn: counts token usage via recordTokenUsage", () => {
  const ctx = makeCtx();
  const obj = {
    type: "assistant",
    timestamp: new Date().toISOString(),
    message: {
      model: "claude-sonnet-4-5",
      usage: { input_tokens: 100, output_tokens: 50 },
      content: []
    }
  };
  const touched = handleAssistantTurn(obj, "file.jsonl", new Map(), ctx);
  assert.equal(touched, true);
  assert.equal(ctx.counters.messagesCounted, 1);
  assert.equal(ctx.totals["input"], 100);
  assert.equal(ctx.totals["output"], 50);
});

test("handleAssistantTurn: synthetic model skips token counting", () => {
  const ctx = makeCtx();
  const obj = {
    type: "assistant",
    timestamp: new Date().toISOString(),
    message: {
      model: "<synthetic>",
      usage: { input_tokens: 999, output_tokens: 99 },
      content: []
    }
  };
  handleAssistantTurn(obj, "file.jsonl", new Map(), ctx);
  assert.equal(ctx.counters.messagesCounted, 0);
  assert.equal(ctx.totals["input"], 0);
});

test("handleAssistantTurn: no usage returns false (not touched)", () => {
  const ctx = makeCtx();
  const obj = {
    type: "assistant",
    message: { model: "claude-sonnet-4-5", content: [] }
  };
  const touched = handleAssistantTurn(obj, "file.jsonl", new Map(), ctx);
  assert.equal(touched, false);
});

test("handleAssistantTurn: increments turnsBeforeFirstTool when no tool use yet", () => {
  const ctx = makeCtx();
  const obj = {
    type: "assistant",
    message: { model: "claude-sonnet-4-5", content: [{ type: "text", text: "hi" }] }
  };
  handleAssistantTurn(obj, "f", new Map(), ctx);
  assert.equal(ctx.counters.turnsBeforeFirstTool, 1);
});
