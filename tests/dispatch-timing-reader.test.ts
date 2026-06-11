// tests/dispatch-timing-reader.test.ts — FEAT-151 TDD (red phase).
// Tests for aggregateDispatchTiming, aggregateBashGates, renderDispatchBreakdownSection.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  aggregateDispatchTiming,
  aggregateBashGates,
  renderDispatchBreakdownSection
} from "../scripts/lib/dispatch-timing-reader.ts";

// ── aggregateDispatchTiming ───────────────────────────────────────────────

test("aggregates top-3 slowest + top-3 token-heaviest per runId", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "agg-"));
  try {
    const log = path.join(tmp, "dispatch-timing.jsonl");
    const rows = [
      {
        runId: "r1",
        agent: "crew:builder",
        wallMs: 5000,
        tokenIn: 10000,
        tokenOut: 2000,
        toolCalls: { Read: 3 },
        bashDurationMs: 0,
        skillLoadCount: 0
      },
      {
        runId: "r1",
        agent: "crew:reviewer",
        wallMs: 8000,
        tokenIn: 8000,
        tokenOut: 1500,
        toolCalls: {},
        bashDurationMs: 1000,
        skillLoadCount: 1
      },
      {
        runId: "r2",
        agent: "crew:lead",
        wallMs: 12000,
        tokenIn: 20000,
        tokenOut: 5000,
        toolCalls: {},
        bashDurationMs: 0,
        skillLoadCount: 0
      }
    ];
    await fs.writeFile(log, rows.map((r) => JSON.stringify(r)).join("\n"), "utf-8");
    const agg = await aggregateDispatchTiming(log, "r1");
    assert.equal(agg.totalWallMs, 13000);
    assert.equal(agg.rowCount, 2);
    assert.equal(agg.topSlow[0]?.agent, "crew:reviewer");
    assert.equal(agg.topTokens[0]?.agent, "crew:builder");
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("returns empty aggregate when log missing", async () => {
  const agg = await aggregateDispatchTiming("/nonexistent/path.jsonl", "r1");
  assert.equal(agg.rowCount, 0);
  assert.equal(agg.totalWallMs, 0);
  assert.deepEqual(agg.topSlow, []);
  assert.deepEqual(agg.topTokens, []);
});

test("returns empty aggregate when runId not present", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "agg-"));
  try {
    const log = path.join(tmp, "dt.jsonl");
    await fs.writeFile(
      log,
      JSON.stringify({
        runId: "other",
        agent: "x",
        wallMs: 1,
        tokenIn: 1,
        tokenOut: 1,
        toolCalls: {},
        bashDurationMs: 0,
        skillLoadCount: 0
      }) + "\n",
      "utf-8"
    );
    const agg = await aggregateDispatchTiming(log, "missing");
    assert.equal(agg.rowCount, 0);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("topTokens sorts by tokenIn + tokenOut descending", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "agg-tt-"));
  try {
    const log = path.join(tmp, "dt.jsonl");
    const rows = [
      {
        runId: "r1",
        agent: "a",
        wallMs: 1000,
        tokenIn: 100,
        tokenOut: 50,
        toolCalls: {},
        bashDurationMs: 0,
        skillLoadCount: 0
      },
      {
        runId: "r1",
        agent: "b",
        wallMs: 2000,
        tokenIn: 500,
        tokenOut: 200,
        toolCalls: {},
        bashDurationMs: 0,
        skillLoadCount: 0
      },
      {
        runId: "r1",
        agent: "c",
        wallMs: 500,
        tokenIn: 300,
        tokenOut: 300,
        toolCalls: {},
        bashDurationMs: 0,
        skillLoadCount: 0
      }
    ];
    await fs.writeFile(log, rows.map((r) => JSON.stringify(r)).join("\n"), "utf-8");
    const agg = await aggregateDispatchTiming(log, "r1");
    // b: 700 total, c: 600 total, a: 150 total
    assert.equal(agg.topTokens[0]?.agent, "b");
    assert.equal(agg.topTokens[1]?.agent, "c");
    assert.equal(agg.topTokens[2]?.agent, "a");
    assert.equal(agg.topTokens[0]?.totalTokens, 700);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

// ── aggregateBashGates ────────────────────────────────────────────────────

test("aggregateBashGates sums durations per gate", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "agg-bg-"));
  try {
    const log = path.join(tmp, "bash-gates.jsonl");
    const rows = [
      { gate: "lint", durationMs: 2000, exitCode: 0 },
      { gate: "typecheck", durationMs: 8000, exitCode: 0 },
      { gate: "lint", durationMs: 1500, exitCode: 0 }
    ];
    await fs.writeFile(log, rows.map((r) => JSON.stringify(r)).join("\n"), "utf-8");
    const agg = await aggregateBashGates(log);
    assert.equal(agg.totalMs, 11500);
    assert.equal(agg.byGate["lint"], 3500);
    assert.equal(agg.byGate["typecheck"], 8000);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("aggregateBashGates returns empty aggregate when log missing", async () => {
  const agg = await aggregateBashGates("/nonexistent/bash-gates.jsonl");
  assert.equal(agg.rowCount, 0);
  assert.equal(agg.totalMs, 0);
  assert.equal(agg.timeoutCount, 0);
  assert.deepEqual(agg.byGate, {});
});

test("aggregateBashGates counts timeout exits (exitCode 124)", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "agg-bg-to-"));
  try {
    const log = path.join(tmp, "bash-gates.jsonl");
    const rows = [
      { gate: "test", durationMs: 30000, exitCode: 124 },
      { gate: "lint", durationMs: 5000, exitCode: 0 }
    ];
    await fs.writeFile(log, rows.map((r) => JSON.stringify(r)).join("\n"), "utf-8");
    const agg = await aggregateBashGates(log);
    assert.equal(agg.timeoutCount, 1);
    assert.equal(agg.rowCount, 2);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

// ── renderDispatchBreakdownSection ────────────────────────────────────────

test("renderDispatchBreakdownSection returns empty string when both aggregates empty", () => {
  const section = renderDispatchBreakdownSection(
    { rowCount: 0, totalWallMs: 0, topSlow: [], topTokens: [] },
    { rowCount: 0, totalMs: 0, timeoutCount: 0, byGate: {} }
  );
  assert.equal(section, "");
});

test("renderDispatchBreakdownSection includes section header and slow agent row", () => {
  const dispatchAgg = {
    rowCount: 2,
    totalWallMs: 13000,
    topSlow: [
      {
        agent: "crew:reviewer",
        model: "claude-sonnet-4-5",
        wallMs: 8000,
        tokenIn: 8000,
        tokenOut: 1500,
        toolCalls: { Read: 2, Edit: 1, Bash: 0 } as Record<string, number>,
        bashDurationMs: 1000,
        skillLoadCount: 1,
        runId: "r1",
        sliceId: "SLICE-67"
      }
    ],
    topTokens: [
      {
        agent: "crew:builder",
        model: "claude-sonnet-4-5",
        wallMs: 5000,
        tokenIn: 10000,
        tokenOut: 2000,
        toolCalls: { Read: 3 } as Record<string, number>,
        bashDurationMs: 0,
        skillLoadCount: 0,
        runId: "r1",
        sliceId: "SLICE-67",
        totalTokens: 12000
      }
    ]
  };
  const bashAgg = {
    rowCount: 1,
    totalMs: 8000,
    timeoutCount: 0,
    byGate: { typecheck: 8000 }
  };
  const section = renderDispatchBreakdownSection(dispatchAgg, bashAgg);
  assert.match(section, /## Per-dispatch breakdown/);
  assert.match(section, /crew:reviewer/);
  assert.match(section, /crew:builder/);
  assert.match(section, /typecheck/);
  assert.match(section, /13000ms/);
});

test("renderDispatchBreakdownSection renders (no data) when topSlow empty but rowCount > 0 somehow", () => {
  const dispatchAgg = {
    rowCount: 0,
    totalWallMs: 0,
    topSlow: [],
    topTokens: []
  };
  const bashAgg = {
    rowCount: 3,
    totalMs: 15000,
    timeoutCount: 0,
    byGate: { lint: 5000, typecheck: 10000 }
  };
  // bash data present but dispatch empty → still renders bash section
  const section = renderDispatchBreakdownSection(dispatchAgg, bashAgg);
  assert.match(section, /## Per-dispatch breakdown/);
  assert.match(section, /no data/);
  assert.match(section, /lint/);
});

test("renderDispatchBreakdownSection handles missing toolCalls fields gracefully", () => {
  const dispatchAgg = {
    rowCount: 1,
    totalWallMs: 5000,
    topSlow: [
      {
        agent: "crew:builder",
        wallMs: 5000,
        tokenIn: 100,
        tokenOut: 50,
        toolCalls: {} as Record<string, number>,
        bashDurationMs: 0,
        skillLoadCount: 0,
        runId: "r1"
      }
    ],
    topTokens: []
  };
  const bashAgg = { rowCount: 0, totalMs: 0, timeoutCount: 0, byGate: {} };
  const section = renderDispatchBreakdownSection(dispatchAgg, bashAgg);
  // Should not throw; missing Read/Edit/Bash render as 0
  assert.match(section, /0/);
});
