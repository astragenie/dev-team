import { test, expect } from "bun:test";
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
  expect(target).toEqual(source);
});

test("addTotals: accumulates on a non-empty target", () => {
  const target = { input: 1, cache_create_5m: 0, cache_create_1h: 0, cache_read: 0, output: 1 };
  const source = { input: 9, cache_create_5m: 0, cache_create_1h: 0, cache_read: 0, output: 4 };
  addTotals(target, source);
  expect(target["input"]).toBe(10);
  expect(target["output"]).toBe(5);
});

test("addTotals: missing keys in source treated as 0", () => {
  const target = emptyTotals();
  addTotals(target, {});
  expect(target).toEqual(emptyTotals());
});

// ── percentile ─────────────────────────────────────────────────────────────

test("percentile: returns 0 for empty array", () => {
  expect(percentile([], 50)).toBe(0);
});

test("percentile: p50 on sorted odd-length array", () => {
  const arr = [10, 20, 30, 40, 50];
  expect(percentile(arr, 50)).toBe(30);
});

test("percentile: p90 on 10-element array", () => {
  const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  // floor(0.9 * 10) = 9 → index 9 → value 10
  expect(percentile(arr, 90)).toBe(10);
});

test("percentile: p0 returns first element", () => {
  expect(percentile([5, 10, 15], 0)).toBe(5);
});

test("percentile: p100 returns last element", () => {
  expect(percentile([5, 10, 15], 100)).toBe(15);
});

// ── isSyntheticModel ───────────────────────────────────────────────────────

test("isSyntheticModel: returns true for <synthetic>", () => {
  expect(isSyntheticModel("<synthetic>")).toBe(true);
});

test("isSyntheticModel: returns true for < (angle-bracket prefix)", () => {
  expect(isSyntheticModel("<whatever>")).toBe(true);
});

test("isSyntheticModel: returns true for synthetic prefix", () => {
  expect(isSyntheticModel("synthetic-model")).toBe(true);
});

test("isSyntheticModel: returns false for real model name", () => {
  expect(isSyntheticModel("claude-sonnet-4-5")).toBe(false);
});

test("isSyntheticModel: returns false for empty string", () => {
  expect(isSyntheticModel("")).toBe(false);
});

// ── approxSize ─────────────────────────────────────────────────────────────

test("approxSize: null returns 0", () => {
  expect(approxSize(null)).toBe(0);
});

test("approxSize: undefined returns 0", () => {
  expect(approxSize(undefined)).toBe(0);
});

test("approxSize: string returns its length", () => {
  expect(approxSize("hello")).toBe(5);
});

test("approxSize: object returns JSON.stringify length", () => {
  const obj = { a: 1 };
  expect(approxSize(obj)).toBe(JSON.stringify(obj).length);
});

test("approxSize: array returns JSON.stringify length", () => {
  const arr = [1, 2, 3];
  expect(approxSize(arr)).toBe(JSON.stringify(arr).length);
});

// ── inspectContent ─────────────────────────────────────────────────────────

test("inspectContent: plain string returns textLen, no tools", () => {
  const r = inspectContent("hello world");
  expect(r.textLen).toBe(11);
  expect(r.toolUses.length).toBe(0);
  expect(r.toolResults.length).toBe(0);
});

test("inspectContent: null/undefined returns empty result", () => {
  const r = inspectContent(null);
  expect(r.textLen).toBe(0);
  expect(r.toolUses.length).toBe(0);
});

test("inspectContent: extracts tool_use blocks", () => {
  const content = [{ type: "tool_use", id: "id1", name: "Read", input: { file_path: "/foo" } }];
  const r = inspectContent(content);
  expect(r.toolUses.length).toBe(1);
  expect(r.toolUses[0]?.name).toBe("Read");
  expect(r.toolUses[0]?.id).toBe("id1");
});

test("inspectContent: extracts tool_result blocks", () => {
  const content = [{ type: "tool_result", tool_use_id: "id1", content: "abc", is_error: false }];
  const r = inspectContent(content);
  expect(r.toolResults.length).toBe(1);
  expect(r.toolResults[0]?.id).toBe("id1");
  expect(r.toolResults[0]?.size).toBe(3);
  expect(r.toolResults[0]?.isError).toBe(false);
});

test("inspectContent: accumulates text block lengths", () => {
  const content = [
    { type: "text", text: "hello" },
    { type: "text", text: " world" }
  ];
  const r = inspectContent(content);
  expect(r.textLen).toBe(11);
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
  expect(t["input"]).toBe(100);
  expect(t["output"]).toBe(50);
  expect(t["cache_read"]).toBe(20);
  expect(t["cache_create_5m"]).toBe(10);
  expect(t["cache_create_1h"]).toBe(0);
});

test("tokensFromUsage: nested cache_creation object", () => {
  const usage = {
    input_tokens: 50,
    output_tokens: 25,
    cache_creation: { ephemeral_5m_input_tokens: 8, ephemeral_1h_input_tokens: 4 }
  };
  const t = tokensFromUsage(usage);
  expect(t["cache_create_5m"]).toBe(8);
  expect(t["cache_create_1h"]).toBe(4);
});

test("tokensFromUsage: empty/null returns zeros", () => {
  const t = tokensFromUsage({});
  expect(t).toEqual(emptyTotals());
});

// ── handleUserTurn ─────────────────────────────────────────────────────────

test("handleUserTurn: isMeta increments compactionCount", () => {
  const ctx = makeCtx();
  handleUserTurn({ isMeta: true, type: "user" }, ctx);
  expect(ctx.counters.compactionCount).toBe(1);
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
  expect(ctx.counters.userMsgCount).toBe(1);
  expect(ctx.counters.userMsgTotalLen).toBe(5);
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
  expect(ctx.toolResultSizes.length).toBe(1);
  expect(ctx.toolResultSizes[0]).toBe(3);
  expect(ctx.toolCachePrime["Read"]?.calls).toBe(1);
  expect(ctx.toolCachePrime["Read"]?.totalResultBytes).toBe(3);
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
  expect(ctx.toolFailureCounts["Bash"]).toBe(1);
});

// ── recordToolUse ──────────────────────────────────────────────────────────

test("recordToolUse: increments toolUseCounts and sets sawFirstTool", () => {
  const ctx = makeCtx();
  recordToolUse(ctx, { id: "i1", name: "Bash", input: {} });
  expect(ctx.toolUseCounts["Bash"]).toBe(1);
  expect(ctx.flags.sawFirstTool).toBe(true);
});

test("recordToolUse: Read tool tracks file_path in filesRead", () => {
  const ctx = makeCtx();
  recordToolUse(ctx, { id: "i2", name: "Read", input: { file_path: "/some/file.ts" } });
  expect(ctx.filesRead["/some/file.ts"]).toBe(1);
});

test("recordToolUse: Skill increments skillInvocations", () => {
  const ctx = makeCtx();
  recordToolUse(ctx, { id: "i3", name: "Skill", input: {} });
  expect(ctx.counters.skillInvocations).toBe(1);
});

test("recordToolUse: Agent increments subagentDispatches", () => {
  const ctx = makeCtx();
  recordToolUse(ctx, { id: "i4", name: "Agent", input: {} });
  expect(ctx.counters.subagentDispatches).toBe(1);
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
  expect(touched).toBe(true);
  expect(ctx.counters.messagesCounted).toBe(1);
  expect(ctx.totals["input"]).toBe(100);
  expect(ctx.totals["output"]).toBe(50);
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
  expect(ctx.counters.messagesCounted).toBe(0);
  expect(ctx.totals["input"]).toBe(0);
});

test("handleAssistantTurn: no usage returns false (not touched)", () => {
  const ctx = makeCtx();
  const obj = {
    type: "assistant",
    message: { model: "claude-sonnet-4-5", content: [] }
  };
  const touched = handleAssistantTurn(obj, "file.jsonl", new Map(), ctx);
  expect(touched).toBe(false);
});

test("handleAssistantTurn: increments turnsBeforeFirstTool when no tool use yet", () => {
  const ctx = makeCtx();
  const obj = {
    type: "assistant",
    message: { model: "claude-sonnet-4-5", content: [{ type: "text", text: "hi" }] }
  };
  handleAssistantTurn(obj, "f", new Map(), ctx);
  expect(ctx.counters.turnsBeforeFirstTool).toBe(1);
});
