// TDD tests for SLICE-05: performance letter grades (A-F) in cost-advisor.
//
// Written BEFORE the implementation. All tests should fail initially until
// computeGrade is exported and grade is wired into buildCostAdvisor.

import test from "node:test";
import assert from "node:assert/strict";
import { computeGrade } from "../scripts/lib/cost-advisor.mjs";

// Grade thresholds (from SLICE-05 spec):
//   A: cache hit >=98%, compactions <=1, subagents <=2, re-reads <=3,  tool failure rate <=3%
//   B: cache hit >=95%, compactions <=3, subagents <=4, re-reads <=8,  tool failure rate <=5%
//   C: cache hit >=90%, compactions <=6, subagents <=6, re-reads <=15, tool failure rate <=8%
//   D: cache hit >=80%, compactions <=15, subagents <=10, re-reads <=30, tool failure rate <=15%
//   F: anything worse than D
//
// Logic: start at A, downgrade to the worst band any single metric falls into.

// ---------------------------------------------------------------------------
// Test A grade: all metrics excellent
// ---------------------------------------------------------------------------
test("computeGrade returns A when all metrics are excellent", () => {
  const target = {
    cacheHitPct: 99,
    compactionCount: 0,
    subagentDispatches: 1,
    fileRereadCount: 2,
    toolFailureRate: 0.01 // 1%
  };
  assert.equal(computeGrade(target), "A");
});

test("computeGrade returns A at exact A-band boundaries", () => {
  const target = {
    cacheHitPct: 98,
    compactionCount: 1,
    subagentDispatches: 2,
    fileRereadCount: 3,
    toolFailureRate: 0.03 // 3%
  };
  assert.equal(computeGrade(target), "A");
});

// ---------------------------------------------------------------------------
// Test B grade: metrics in B band
// ---------------------------------------------------------------------------
test("computeGrade returns B when cache hit is in B band (95-97%)", () => {
  const target = {
    cacheHitPct: 96,
    compactionCount: 0,
    subagentDispatches: 1,
    fileRereadCount: 2,
    toolFailureRate: 0.01
  };
  assert.equal(computeGrade(target), "B");
});

test("computeGrade returns B at exact B-band boundaries", () => {
  const target = {
    cacheHitPct: 95,
    compactionCount: 3,
    subagentDispatches: 4,
    fileRereadCount: 8,
    toolFailureRate: 0.05 // 5%
  };
  assert.equal(computeGrade(target), "B");
});

// ---------------------------------------------------------------------------
// Test C grade: mixed (good cache, bad compactions)
// ---------------------------------------------------------------------------
test("computeGrade returns C when good cache but compactions in C band", () => {
  const target = {
    cacheHitPct: 99, // A-level cache
    compactionCount: 5, // C band (4-6)
    subagentDispatches: 1, // A
    fileRereadCount: 2, // A
    toolFailureRate: 0.01 // A
  };
  assert.equal(computeGrade(target), "C");
});

test("computeGrade returns C at exact C-band boundaries", () => {
  const target = {
    cacheHitPct: 90,
    compactionCount: 6,
    subagentDispatches: 6,
    fileRereadCount: 15,
    toolFailureRate: 0.08 // 8%
  };
  assert.equal(computeGrade(target), "C");
});

// ---------------------------------------------------------------------------
// Test D grade
// ---------------------------------------------------------------------------
test("computeGrade returns D when cache hit is in D band", () => {
  const target = {
    cacheHitPct: 85,
    compactionCount: 0,
    subagentDispatches: 1,
    fileRereadCount: 2,
    toolFailureRate: 0.01
  };
  assert.equal(computeGrade(target), "D");
});

test("computeGrade returns D at exact D-band boundaries", () => {
  const target = {
    cacheHitPct: 80,
    compactionCount: 15,
    subagentDispatches: 10,
    fileRereadCount: 30,
    toolFailureRate: 0.15 // 15%
  };
  assert.equal(computeGrade(target), "D");
});

// ---------------------------------------------------------------------------
// Test F grade: all metrics terrible
// ---------------------------------------------------------------------------
test("computeGrade returns F when all metrics are terrible", () => {
  const target = {
    cacheHitPct: 50, // way below D threshold of 80%
    compactionCount: 20, // above D max of 15
    subagentDispatches: 15, // above D max of 10
    fileRereadCount: 50, // above D max of 30
    toolFailureRate: 0.3 // 30%, above D max of 15%
  };
  assert.equal(computeGrade(target), "F");
});

test("computeGrade returns F when cache hit is just below D threshold", () => {
  const target = {
    cacheHitPct: 79, // just below D (80%)
    compactionCount: 0,
    subagentDispatches: 1,
    fileRereadCount: 2,
    toolFailureRate: 0.01
  };
  assert.equal(computeGrade(target), "F");
});

// ---------------------------------------------------------------------------
// Test "worst band wins": one bad metric downgrades the whole grade
// ---------------------------------------------------------------------------
test("worst band wins: single F metric downgrades A-level everything else to F", () => {
  const target = {
    cacheHitPct: 99, // A
    compactionCount: 0, // A
    subagentDispatches: 0, // A
    fileRereadCount: 0, // A
    toolFailureRate: 0.5 // F (50%)
  };
  assert.equal(computeGrade(target), "F");
});

test("worst band wins: single D metric downgrades otherwise-A grade to D", () => {
  const target = {
    cacheHitPct: 99, // A
    compactionCount: 0, // A
    subagentDispatches: 9, // D band (7-10)
    fileRereadCount: 1, // A
    toolFailureRate: 0.01 // A
  };
  assert.equal(computeGrade(target), "D");
});

test("worst band wins: B cache + C subagents = C overall", () => {
  const target = {
    cacheHitPct: 96, // B band
    compactionCount: 1, // A
    subagentDispatches: 5, // C band (5-6)
    fileRereadCount: 2, // A
    toolFailureRate: 0.02 // A
  };
  assert.equal(computeGrade(target), "C");
});

// ---------------------------------------------------------------------------
// Edge cases: zero / missing values default gracefully
// ---------------------------------------------------------------------------
test("computeGrade handles zero cacheHitPct (no data) as F", () => {
  const target = {
    cacheHitPct: 0,
    compactionCount: 0,
    subagentDispatches: 0,
    fileRereadCount: 0,
    toolFailureRate: 0
  };
  // cacheHitPct=0 is below the D threshold of 80%, so should grade F
  assert.equal(computeGrade(target), "F");
});

test("computeGrade handles missing optional fields without throwing", () => {
  // toolFailureRate might be missing — should default to 0
  const target = {
    cacheHitPct: 98,
    compactionCount: 0,
    subagentDispatches: 0,
    fileRereadCount: 0
    // toolFailureRate absent
  };
  assert.doesNotThrow(() => computeGrade(target));
});
