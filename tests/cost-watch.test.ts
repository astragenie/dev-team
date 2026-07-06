// tests/cost-watch.test.ts — FEAT-194 S4: operator burn-watch CLI.
// Covers the pure summarize/render functions plus an end-to-end
// buildCostWatch() read over fixture dispatch-timing.jsonl + cost-report
// artifacts + loop.json.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { DispatchRow } from "../scripts/lib/dispatch-timing-reader.ts";
import type { CostReport } from "../scripts/lib/briefing/collect-cost-parser.ts";
import {
  DEFAULT_PER_DISPATCH_TOKEN_CAP,
  summarizeDispatchBurn,
  summarizeSliceBurn,
  readLoopCostCeiling,
  buildCostWatch,
  renderCostWatchReport
} from "../scripts/lib/cost-watch.ts";

function row(overrides: Partial<DispatchRow>): DispatchRow {
  return {
    runId: "r1",
    agent: "crew:fullstack-dev",
    model: "sonnet",
    wallMs: 1000,
    tokenIn: 1000,
    tokenOut: 200,
    toolCalls: {},
    bashDurationMs: 0,
    skillLoadCount: 0,
    ...overrides
  };
}

// ── summarizeDispatchBurn ───────────────────────────────────────────────────

test("summarizeDispatchBurn sums tokens and flags none under the default cap", () => {
  const rows = [row({ tokenIn: 1000, tokenOut: 200 }), row({ tokenIn: 2000, tokenOut: 300 })];
  const summary = summarizeDispatchBurn(rows);
  assert.equal(summary.rollingTotalTokens, 3500);
  assert.equal(summary.flaggedCount, 0);
  assert.equal(summary.perDispatchTokenCap, DEFAULT_PER_DISPATCH_TOKEN_CAP);
  assert.equal(summary.rows[0]?.totalTokens, 1200);
});

test("summarizeDispatchBurn flags a dispatch crossing the per-dispatch token cap", () => {
  const rows = [
    row({ agent: "crew:aiplugin-dev", tokenIn: 140_000, tokenOut: 20_000 }), // 160k > 150k default
    row({ agent: "crew:reviewer", tokenIn: 5000, tokenOut: 1000 })
  ];
  const summary = summarizeDispatchBurn(rows);
  assert.equal(summary.flaggedCount, 1);
  assert.equal(summary.rows[0]?.flagged, true);
  assert.equal(summary.rows[1]?.flagged, false);
});

test("summarizeDispatchBurn respects a custom token cap", () => {
  const rows = [row({ tokenIn: 500, tokenOut: 200 })];
  const summary = summarizeDispatchBurn(rows, 500);
  assert.equal(summary.rows[0]?.flagged, true);
  assert.equal(summary.perDispatchTokenCap, 500);
});

test("summarizeDispatchBurn defaults missing model to 'unknown'", () => {
  // Omit `model` entirely (not `model: undefined` — exactOptionalPropertyTypes
  // disallows explicit undefined for an optional string field).
  const rows: DispatchRow[] = [
    {
      runId: "r1",
      agent: "crew:fullstack-dev",
      wallMs: 1000,
      tokenIn: 1000,
      tokenOut: 200,
      toolCalls: {},
      bashDurationMs: 0,
      skillLoadCount: 0
    }
  ];
  const summary = summarizeDispatchBurn(rows);
  assert.equal(summary.rows[0]?.model, "unknown");
});

test("summarizeDispatchBurn handles an empty row set", () => {
  const summary = summarizeDispatchBurn([]);
  assert.equal(summary.rollingTotalTokens, 0);
  assert.equal(summary.flaggedCount, 0);
  assert.deepEqual(summary.rows, []);
});

// ── summarizeSliceBurn ──────────────────────────────────────────────────────

function costReport(overrides: Partial<CostReport>): CostReport {
  return {
    path: "/x.md",
    runTitle: "SLICE1",
    usd: 10,
    windowStart: null,
    windowEnd: null,
    durationMs: 0,
    durationMin: 0,
    messages: 0,
    totalTokens: 1_000_000,
    totalMillions: 1,
    cacheHitPct: 98.5,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    inputMillions: 0,
    outputMillions: 0,
    cacheReadMillions: 0,
    cacheWriteMillions: 0,
    ioMillionsStr: "0 / 0",
    cacheRWMillionsStr: "0 / 0",
    dominantModel: null,
    dominantModelStr: "-",
    modelMix: [],
    compactionCount: 0,
    subagentDispatches: 0,
    skillInvocations: 0,
    turnsBeforeFirstTool: 0,
    userMsgAvgLen: 0,
    sourceProject: null,
    autoDetected: false,
    aggregateAll: false,
    sourceCount: 0,
    fileReReadCount: 0,
    sessionsScanned: 1,
    toolCalls: 0,
    toolFailures: 0,
    toolFailureRate: 0,
    toolResultP90: 0,
    gradeAvg: null,
    reviewDecision: null,
    validationDecision: null,
    roleDispatches: {},
    flags: [],
    flagsStr: "",
    hasFlags: false,
    ...overrides
  } as CostReport;
}

test("summarizeSliceBurn flags a single report whose own usd exceeds the ceiling", () => {
  const reports = [costReport({ path: "/a.md", usd: 80 })];
  const summary = summarizeSliceBurn(reports, 80, 75);
  assert.equal(summary.ceilingExceeded, true);
  assert.equal(summary.flaggedPaths.has("/a.md"), true);
  assert.equal(summary.rollingUsd, 80);
  assert.equal(summary.ceilingUsd, 75);
});

test("summarizeSliceBurn does not flag when every report is within the ceiling", () => {
  const reports = [costReport({ path: "/a.md", usd: 20 })];
  const summary = summarizeSliceBurn(reports, 20, 75);
  assert.equal(summary.ceilingExceeded, false);
  assert.equal(summary.flaggedPaths.size, 0);
});

test("summarizeSliceBurn treats a null ceiling as no flag possible", () => {
  const reports = [costReport({ usd: 999 })];
  const summary = summarizeSliceBurn(reports, 999, null);
  assert.equal(summary.ceilingExceeded, false);
  assert.equal(summary.ceilingUsd, null);
});

test("summarizeSliceBurn does NOT flag on a rolling-sum-only breach — the ceiling is per-report", () => {
  // Two small reports whose SUM (140) exceeds ceiling (75), but neither
  // individually does. This is the exact false-positive the per-report
  // redesign guards against (see summarizeSliceBurn's doc comment).
  const reports = [costReport({ path: "/a.md", usd: 70 }), costReport({ path: "/b.md", usd: 70 })];
  const summary = summarizeSliceBurn(reports, 140, 75);
  assert.equal(summary.rollingUsd, 140);
  assert.equal(summary.ceilingExceeded, false);
  assert.equal(summary.flaggedPaths.size, 0);
});

// ── readLoopCostCeiling ──────────────────────────────────────────────────────

test("readLoopCostCeiling reads loop.cost.ceilingUsd from .claude/loop.json", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "cost-watch-ceiling-"));
  try {
    await fs.mkdir(path.join(tmp, ".claude"), { recursive: true });
    await fs.writeFile(
      path.join(tmp, ".claude", "loop.json"),
      JSON.stringify({ loop: { cost: { ceilingUsd: 42 } } })
    );
    const ceiling = await readLoopCostCeiling(tmp);
    assert.equal(ceiling, 42);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("readLoopCostCeiling returns null when loop.json is missing", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "cost-watch-ceiling-missing-"));
  try {
    const ceiling = await readLoopCostCeiling(tmp);
    assert.equal(ceiling, null);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("readLoopCostCeiling returns null when ceilingUsd is absent", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "cost-watch-ceiling-absent-"));
  try {
    await fs.mkdir(path.join(tmp, ".claude"), { recursive: true });
    await fs.writeFile(path.join(tmp, ".claude", "loop.json"), JSON.stringify({ loop: {} }));
    const ceiling = await readLoopCostCeiling(tmp);
    assert.equal(ceiling, null);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

// ── renderCostWatchReport ────────────────────────────────────────────────────

test("renderCostWatchReport renders dispatch + slice tables and a cap warning", () => {
  const report = renderCostWatchReport({
    dispatch: summarizeDispatchBurn([
      row({ agent: "crew:aiplugin-dev", model: "opus", tokenIn: 140_000, tokenOut: 20_000 })
    ]),
    slice: summarizeSliceBurn(
      [costReport({ path: "/s99.md", runTitle: "SLICE99", usd: 80 })],
      80,
      75
    )
  });
  assert.match(report, /crew:aiplugin-dev/);
  assert.match(report, /opus/);
  assert.match(report, /OVER CAP/);
  assert.match(report, /SLICE99/);
  assert.match(report, /OVER CEILING/);
  assert.match(report, /exceeded loop\.cost\.ceilingUsd/);
  assert.match(report, /Data-gap notes/);
});

test("renderCostWatchReport degrades gracefully with no data", () => {
  const report = renderCostWatchReport({
    dispatch: summarizeDispatchBurn([]),
    slice: summarizeSliceBurn([], 0, null)
  });
  assert.match(report, /no dispatch-timing data/);
  assert.match(report, /no cost-report-slice artifacts/);
});

// ── buildCostWatch (end-to-end read) ────────────────────────────────────────

test("buildCostWatch reads dispatch-timing.jsonl + cost reports + loop.json ceiling", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "cost-watch-e2e-"));
  try {
    await fs.mkdir(path.join(tmp, ".claude", "logs"), { recursive: true });
    await fs.mkdir(path.join(tmp, ".claude", "artifacts", "crew", "cost"), { recursive: true });

    await fs.writeFile(
      path.join(tmp, ".claude", "loop.json"),
      JSON.stringify({ loop: { cost: { ceilingUsd: 1 } } })
    );

    const dispatchRows = [
      row({ agent: "crew:fullstack-dev", model: "sonnet", tokenIn: 3000, tokenOut: 500 })
    ];
    await fs.writeFile(
      path.join(tmp, ".claude", "logs", "dispatch-timing.jsonl"),
      dispatchRows.map((r) => JSON.stringify(r)).join("\n") + "\n"
    );

    const costReportMd = [
      "---",
      "kind: cost-report",
      'run_title: "SLICE1"',
      "usd: 2.5",
      "total_tokens: 500000",
      "cache_hit_pct: 98.2",
      "---",
      "",
      "# Cost Report: SLICE1"
    ].join("\n");
    await fs.writeFile(
      path.join(
        tmp,
        ".claude",
        "artifacts",
        "crew",
        "cost",
        "20260101T000000Z-cost-report-slice-slice1.md"
      ),
      costReportMd
    );

    const data = await buildCostWatch(tmp, {
      limit: 10,
      dispatchTimingLogPath: path.join(tmp, ".claude", "logs", "dispatch-timing.jsonl")
    });

    assert.equal(data.dispatch.rows.length, 1);
    assert.equal(data.dispatch.rows[0]?.agent, "crew:fullstack-dev");
    assert.equal(data.slice.reports.length, 1);
    assert.equal(data.slice.reports[0]?.runTitle, "SLICE1");
    assert.equal(data.slice.ceilingUsd, 1);
    assert.equal(data.slice.ceilingExceeded, true); // 2.5 > 1

    const rendered = renderCostWatchReport(data);
    assert.match(rendered, /crew:fullstack-dev/);
    assert.match(rendered, /SLICE1/);
    assert.match(rendered, /exceeded loop\.cost\.ceilingUsd/);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
