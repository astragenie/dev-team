import { test, expect } from "bun:test";
/**
 * Tests for scripts/lib/telemetry/cost-report-to-spans.ts
 * AC-4: Span builder produces the correct trace tree.
 */
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

  expect(spans.length, "Must produce exactly 3 spans: root + phase + agent").toBe(3);

  const root = spans.find((s) => s.name === "slice.run");
  const phase = spans.find((s) => s.name === "phase.build");
  const agent = spans.find((s) => s.name === "agent.dispatch");

  expect(root, "Must have a slice.run span").toBeTruthy();
  expect(phase, "Must have a phase.build span").toBeTruthy();
  expect(agent, "Must have an agent.dispatch span").toBeTruthy();

  // All share same traceId
  expect(root!.traceId, "root and phase must share traceId").toBe(phase!.traceId);
  expect(phase!.traceId, "phase and agent must share traceId").toBe(agent!.traceId);

  // Parent-child links
  expect(root!.parentSpanId, "root must have no parentSpanId").toBe(undefined);
  expect(phase!.parentSpanId, "phase.parentSpanId must === root.spanId").toBe(root!.spanId);
  expect(agent!.parentSpanId, "agent.parentSpanId must === phase.spanId").toBe(phase!.spanId);

  // Root attrs
  expect(root!.attributes["feat_id"], "feat_id must be FEAT-113").toBe("FEAT-113");
  expect(root!.attributes["slice_id"], "slice_id must be SLICE-37").toBe("SLICE-37");
  expect(root!.attributes["run_id"], "run_id must match").toBe("20260607T122544Z");

  // Agent model attr
  expect(agent!.attributes["model"], "model must be claude-sonnet-4-6").toBe("claude-sonnet-4-6");
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
    cacheCreate5m: 0,
    cacheRead: 900000,
    inputTokens: 50000,
    outputTokens: 50000,
    aggregateAll: false
  };

  const spans = costReportToSpans(twoModelReport);
  expect(spans.length, "Must produce 4 spans for 2 models").toBe(4);

  const agentSpans = spans.filter((s) => s.name === "agent.dispatch");
  expect(agentSpans.length, "Must have 2 agent spans").toBe(2);

  const models = agentSpans.map((s) => s.attributes["model"]).sort();
  expect(models).toEqual(["claude-opus-4-7", "claude-sonnet-4-6"]);
});

// ---------------------------------------------------------------------------
// Case 3: Determinism — same input -> byte-identical spans
// ---------------------------------------------------------------------------

test("costReportToSpans: re-running produces identical spans (determinism)", async () => {
  const report = await loadCostReport(REAL_FIXTURE);
  const spans1 = costReportToSpans(report);
  const spans2 = costReportToSpans(report);

  expect(spans1.length, "span count must match").toBe(spans2.length);
  for (let i = 0; i < spans1.length; i++) {
    const s1 = spans1[i]!;
    const s2 = spans2[i]!;
    expect(s1.traceId, `traceId must match for span ${i}`).toBe(s2.traceId);
    expect(s1.spanId, `spanId must match for span ${i}`).toBe(s2.spanId);
    expect(s1.parentSpanId, `parentSpanId must match for span ${i}`).toBe(s2.parentSpanId);
    expect(JSON.stringify(s1), `span ${i} must be byte-identical across re-runs`).toBe(
      JSON.stringify(s2)
    );
  }
});

// ---------------------------------------------------------------------------
// Case 4: cache_create_5m is summed into usage.cache_creation_tokens
// ---------------------------------------------------------------------------

test("costReportToSpans: cache_create_5m + cacheCreate1h are both summed into cache_creation_tokens", () => {
  const report: CostReport = {
    sliceFilename: "20260202T000000Z-cost-report-cache5m.md",
    runId: "20260202T000000Z",
    featureId: "FEAT-165",
    runTitle: "FEAT-165 SLICE-77 cache_create_5m test",
    usd: 1.0,
    durationMs: 300000,
    totalTokens: 100000,
    cacheHitPct: 90,
    windowStart: "2026-02-02T00:00:00.000Z",
    windowEnd: "2026-02-02T00:05:00.000Z",
    createdAt: "2026-02-02T00:05:00.000Z",
    modelMix: [{ model: "claude-sonnet-4-6", messages: 5, msgPct: 100, usd: 1.0, usdPct: 100 }],
    toolUsage: {},
    subagentDispatches: 0,
    cacheCreate1h: 2000,
    cacheCreate5m: 1000,
    cacheRead: 50000,
    inputTokens: 25000,
    outputTokens: 25000,
    aggregateAll: false
  };

  const spans = costReportToSpans(report);
  const agentSpan = spans.find((s) => s.name === "agent.dispatch");
  expect(agentSpan, "Must have an agent.dispatch span").toBeTruthy();
  expect(
    agentSpan!.attributes["usage.cache_creation_tokens"],
    "cache_creation_tokens must equal cacheCreate1h (2000) + cacheCreate5m (1000) = 3000"
  ).toBe(3000);
});
