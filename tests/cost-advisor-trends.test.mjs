// TDD tests for SLICE-06: regression trend detectors in cost-advisor.
//
// Written BEFORE the implementation. All tests should fail initially until
// detectTrends is exported from cost-advisor.mjs.

import test from "node:test";
import assert from "node:assert/strict";
import { detectTrends } from "../scripts/lib/cost-advisor.mjs";

// ---------------------------------------------------------------------------
// Helpers — synthetic summarized reports (newest first, same shape as
// summarizeReport() output used internally by buildCostAdvisor).
// ---------------------------------------------------------------------------

function makeReport(overrides = {}) {
  return {
    sliceId: null,
    runTitle: null,
    usd: 10,
    durationMs: 0,
    totalTokens: 0,
    cacheHitPct: 95,
    gradeAvg: null,
    reviewDecision: null,
    validationDecision: null,
    opusUsdPct: 0,
    totalToolCalls: 10,
    totalToolFailures: 0,
    toolFailureRate: 0,
    readCount: 5,
    bashCount: 3,
    grepCount: 1,
    writeCount: 2,
    editCount: 1,
    explorationRatio: 3,
    msgCount: 0,
    userMsgCount: 0,
    userMsgAvgLen: 0,
    turnsBeforeFirstTool: 0,
    compactionCount: 0,
    skillInvocations: 0,
    subagentDispatches: 0,
    fileRereadCount: 0,
    toolResultP90: 0,
    sourceProject: null,
    autoDetected: false,
    aggregateAll: false,
    sourceCount: 0,
    sources: [],
    cachePriming: [],
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// compaction-drift: fires when each of last 3 reports has strictly increasing
// compactionCount (newest first means r[0] > r[1] > r[2])
// ---------------------------------------------------------------------------

test("detectTrends: compaction-drift fires when compactionCount increases across last 3 reports", () => {
  const reports = [
    makeReport({ compactionCount: 5 }), // newest — highest
    makeReport({ compactionCount: 3 }),
    makeReport({ compactionCount: 1 }) // oldest — lowest
  ];
  const trends = detectTrends(reports);
  const ids = trends.map((t) => t.id);
  assert.ok(ids.includes("compaction-drift"), `Expected compaction-drift, got: ${ids.join(", ")}`);
});

test("detectTrends: compaction-drift does NOT fire when compactionCount is stable", () => {
  const reports = [
    makeReport({ compactionCount: 2 }),
    makeReport({ compactionCount: 2 }),
    makeReport({ compactionCount: 2 })
  ];
  const trends = detectTrends(reports);
  const ids = trends.map((t) => t.id);
  assert.ok(!ids.includes("compaction-drift"), "Should not fire on stable compaction counts");
});

test("detectTrends: compaction-drift does NOT fire when compactionCount decreases", () => {
  const reports = [
    makeReport({ compactionCount: 1 }), // newest — lowest
    makeReport({ compactionCount: 3 }),
    makeReport({ compactionCount: 5 }) // oldest — highest
  ];
  const trends = detectTrends(reports);
  const ids = trends.map((t) => t.id);
  assert.ok(!ids.includes("compaction-drift"), "Should not fire on decreasing compaction counts");
});

// ---------------------------------------------------------------------------
// subagent-creep: fires when each of last 3 reports has strictly increasing
// subagentDispatches (newest first means r[0] > r[1] > r[2])
// ---------------------------------------------------------------------------

test("detectTrends: subagent-creep fires when subagentDispatches increases across last 3 reports", () => {
  const reports = [
    makeReport({ subagentDispatches: 6 }), // newest
    makeReport({ subagentDispatches: 4 }),
    makeReport({ subagentDispatches: 2 }) // oldest
  ];
  const trends = detectTrends(reports);
  const ids = trends.map((t) => t.id);
  assert.ok(ids.includes("subagent-creep"), `Expected subagent-creep, got: ${ids.join(", ")}`);
});

test("detectTrends: subagent-creep does NOT fire when subagentDispatches is stable", () => {
  const reports = [
    makeReport({ subagentDispatches: 3 }),
    makeReport({ subagentDispatches: 3 }),
    makeReport({ subagentDispatches: 3 })
  ];
  const trends = detectTrends(reports);
  const ids = trends.map((t) => t.id);
  assert.ok(!ids.includes("subagent-creep"), "Should not fire on stable subagent dispatch counts");
});

// ---------------------------------------------------------------------------
// cost-regression: fires when current (newest) usd > median of last 3 by >20%
// ---------------------------------------------------------------------------

test("detectTrends: cost-regression fires when current usd is >20% above median of last 3", () => {
  // Median of [10, 10, 10] = 10. 10 * 1.21 = 12.1
  const reports = [
    makeReport({ usd: 15 }), // newest — 50% above median
    makeReport({ usd: 10 }),
    makeReport({ usd: 10 })
  ];
  const trends = detectTrends(reports);
  const ids = trends.map((t) => t.id);
  assert.ok(ids.includes("cost-regression"), `Expected cost-regression, got: ${ids.join(", ")}`);
});

test("detectTrends: cost-regression does NOT fire when current usd is within 20% of median", () => {
  // Median of [10, 10, 10] = 10. Current 11.9 is 19% above — should not fire.
  const reports = [
    makeReport({ usd: 11.9 }), // newest — 19% above median
    makeReport({ usd: 10 }),
    makeReport({ usd: 10 })
  ];
  const trends = detectTrends(reports);
  const ids = trends.map((t) => t.id);
  assert.ok(!ids.includes("cost-regression"), "Should not fire when increase is <=20%");
});

test("detectTrends: cost-regression does NOT fire when current usd is cheaper than median", () => {
  const reports = [
    makeReport({ usd: 8 }), // newest — cheaper than historical
    makeReport({ usd: 15 }),
    makeReport({ usd: 12 })
  ];
  const trends = detectTrends(reports);
  const ids = trends.map((t) => t.id);
  assert.ok(!ids.includes("cost-regression"), "Should not fire when cost decreases");
});

// ---------------------------------------------------------------------------
// No trends: stable, healthy metrics → empty array
// ---------------------------------------------------------------------------

test("detectTrends: returns empty array when all metrics are stable and cost is flat", () => {
  const reports = [
    makeReport({ compactionCount: 1, subagentDispatches: 2, usd: 10 }),
    makeReport({ compactionCount: 1, subagentDispatches: 2, usd: 10 }),
    makeReport({ compactionCount: 1, subagentDispatches: 2, usd: 10 })
  ];
  const trends = detectTrends(reports);
  assert.equal(trends.length, 0, `Expected no trends, got: ${trends.map((t) => t.id).join(", ")}`);
});

// ---------------------------------------------------------------------------
// Insufficient history: <3 reports → returns empty (cannot detect trends)
// ---------------------------------------------------------------------------

test("detectTrends: returns empty array when fewer than 3 reports provided", () => {
  assert.deepEqual(detectTrends([]), []);
  assert.deepEqual(detectTrends([makeReport()]), []);
  assert.deepEqual(detectTrends([makeReport(), makeReport()]), []);
});

// ---------------------------------------------------------------------------
// Shape check: trend findings have expected fields
// ---------------------------------------------------------------------------

test("detectTrends: each finding has id, severity, message, suggestion fields", () => {
  const reports = [
    makeReport({ compactionCount: 5 }),
    makeReport({ compactionCount: 3 }),
    makeReport({ compactionCount: 1 })
  ];
  const trends = detectTrends(reports);
  assert.ok(trends.length > 0, "Expected at least one trend finding");
  for (const t of trends) {
    assert.ok(typeof t.id === "string" && t.id.length > 0, "id must be non-empty string");
    assert.ok(
      ["low", "medium", "high"].includes(t.severity),
      `severity must be low/medium/high, got ${t.severity}`
    );
    assert.ok(
      typeof t.message === "string" && t.message.length > 0,
      "message must be non-empty string"
    );
    assert.ok(
      typeof t.suggestion === "string" && t.suggestion.length > 0,
      "suggestion must be non-empty string"
    );
  }
});

// ---------------------------------------------------------------------------
// Severity checks
// ---------------------------------------------------------------------------

test("detectTrends: compaction-drift has severity medium", () => {
  const reports = [
    makeReport({ compactionCount: 5 }),
    makeReport({ compactionCount: 3 }),
    makeReport({ compactionCount: 1 })
  ];
  const trends = detectTrends(reports);
  const drift = trends.find((t) => t.id === "compaction-drift");
  assert.ok(drift, "Expected compaction-drift finding");
  assert.equal(drift.severity, "medium");
});

test("detectTrends: subagent-creep has severity medium", () => {
  const reports = [
    makeReport({ subagentDispatches: 6 }),
    makeReport({ subagentDispatches: 4 }),
    makeReport({ subagentDispatches: 2 })
  ];
  const trends = detectTrends(reports);
  const creep = trends.find((t) => t.id === "subagent-creep");
  assert.ok(creep, "Expected subagent-creep finding");
  assert.equal(creep.severity, "medium");
});

test("detectTrends: cost-regression has severity high", () => {
  const reports = [makeReport({ usd: 25 }), makeReport({ usd: 10 }), makeReport({ usd: 10 })];
  const trends = detectTrends(reports);
  const reg = trends.find((t) => t.id === "cost-regression");
  assert.ok(reg, "Expected cost-regression finding");
  assert.equal(reg.severity, "high");
});
