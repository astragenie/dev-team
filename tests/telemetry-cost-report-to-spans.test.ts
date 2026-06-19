/**
 * Tests for scripts/lib/telemetry/cost-report-to-spans.ts
 * AC-4: Span builder produces the correct trace tree.
 */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { loadCostReport } from "../scripts/lib/telemetry/cost-report-loader.ts";
import { costReportToSpans } from "../scripts/lib/telemetry/cost-report-to-spans.ts";
import type { CostReport } from "../scripts/lib/telemetry/cost-report-loader.ts";

const REAL_FIXTURE = path.resolve(
  ".claude/artifacts/crew/cost/20260607T122544Z-cost-report-slice-feat113-slice37.md"
);

// ---------------------------------------------------------------------------
// Case 1: Real fixture produces correct 3-span tree
// ---------------------------------------------------------------------------

test("costReportToSpans: real FEAT113/SLICE37 report produces 3 spans with correct hierarchy", async () => {
  const report = await loadCostReport(REAL_FIXTURE);
  const spans = costReportToSpans(report);

  assert.equal(spans.length, 3, "Must produce exactly 3 spans: root + phase + agent");

  const root = spans.find((s) => s.name === "slice.run");
  const phase = spans.find((s) => s.name === "phase.build");
  const agent = spans.find((s) => s.name === "agent.dispatch");

  assert.ok(root, "Must have a slice.run span");
  assert.ok(phase, "Must have a phase.build span");
  assert.ok(agent, "Must have an agent.dispatch span");

  // All share same traceId
  assert.equal(root.traceId, phase.traceId, "root and phase must share traceId");
  assert.equal(phase.traceId, agent.traceId, "phase and agent must share traceId");

  // Parent-child links
  assert.equal(root.parentSpanId, undefined, "root must have no parentSpanId");
  assert.equal(phase.parentSpanId, root.spanId, "phase.parentSpanId must === root.spanId");
  assert.equal(agent.parentSpanId, phase.spanId, "agent.parentSpanId must === phase.spanId");

  // Root attrs
  assert.equal(root.attributes["feat_id"], "FEAT-113", "feat_id must be FEAT-113");
  assert.equal(root.attributes["slice_id"], "SLICE-37", "slice_id must be SLICE-37");
  assert.equal(root.attributes["run_id"], "20260607T122544Z", "run_id must match");

  // Agent model attr
  assert.equal(agent.attributes["model"], "claude-sonnet-4-6", "model must be claude-sonnet-4-6");
});

// ---------------------------------------------------------------------------
// Case 2: Two-model report produces 4 spans (1 root + 1 phase + 2 agent)
// ---------------------------------------------------------------------------

test("costReportToSpans: two-model report produces 4 spans", () => {
  const twoModelReport: CostReport = {
    sliceFilename: "20260101T000000Z-cost-report-two-models.md",
    runId: "20260101T000000Z",
    featureId: "FEAT-999",
    runTitle: "FEAT999 SLICE99",
    usd: 3.0,
    durationMs: 600000,
    totalTokens: 1000000,
    cacheHitPct: 98,
    windowStart: "2026-01-01T00:00:00.000Z",
    windowEnd: "2026-01-01T00:10:00.000Z",
    createdAt: "2026-01-01T00:10:00.000Z",
    modelMix: [
      { model: "claude-sonnet-4-6", messages: 10, msgPct: 60, usd: 1.5, usdPct: 50 },
      { model: "claude-opus-4-7", messages: 7, msgPct: 40, usd: 1.5, usdPct: 50 }
    ],
    toolUsage: { Bash: 5, Read: 3 },
    subagentDispatches: 2,
    cacheCreate1h: 5000,
    cacheRead: 900000,
    inputTokens: 50000,
    outputTokens: 50000,
    aggregateAll: false
  };

  const spans = costReportToSpans(twoModelReport);
  assert.equal(spans.length, 4, "Must produce 4 spans for 2 models");

  const agentSpans = spans.filter((s) => s.name === "agent.dispatch");
  assert.equal(agentSpans.length, 2, "Must have 2 agent spans");

  const models = agentSpans.map((s) => s.attributes["model"]).sort();
  assert.deepEqual(models, ["claude-opus-4-7", "claude-sonnet-4-6"]);
});

// ---------------------------------------------------------------------------
// Case 3: Determinism — same input -> byte-identical spans
// ---------------------------------------------------------------------------

test("costReportToSpans: re-running produces identical spans (determinism)", async () => {
  const report = await loadCostReport(REAL_FIXTURE);
  const spans1 = costReportToSpans(report);
  const spans2 = costReportToSpans(report);

  assert.equal(spans1.length, spans2.length, "span count must match");
  for (let i = 0; i < spans1.length; i++) {
    const s1 = spans1[i]!;
    const s2 = spans2[i]!;
    assert.equal(s1.traceId, s2.traceId, `traceId must match for span ${i}`);
    assert.equal(s1.spanId, s2.spanId, `spanId must match for span ${i}`);
    assert.equal(s1.parentSpanId, s2.parentSpanId, `parentSpanId must match for span ${i}`);
    assert.equal(
      JSON.stringify(s1),
      JSON.stringify(s2),
      `span ${i} must be byte-identical across re-runs`
    );
  }
});
