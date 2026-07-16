import { test, expect } from "bun:test";
/**
 * Tests for scripts/lib/telemetry/cost-report-loader.ts
 * AC-3: Cost-report loader reads real FEAT113/SLICE37 fixture correctly.
 */
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  loadCostReport,
  loadCostReportSafe,
  derivedFeatureId,
  derivedSliceId,
  AggregateReportSkipped
} from "../scripts/lib/telemetry/cost-report-loader.ts";

// Real fixture path (relative to worktree root)
const REAL_FIXTURE = path.resolve(
  ".claude/artifacts/crew/cost/20260607T122544Z-cost-report-slice-feat113-slice37.md"
);

const AGGREGATE_FIXTURE = path.resolve(
  ".claude/artifacts/crew/cost/20260602T133012Z-cost-report-aggregate-feat034-slice13.md"
);

// ---------------------------------------------------------------------------
// Case 1: Load real FEAT113/SLICE37 fixture and assert field values
// ---------------------------------------------------------------------------

test("loadCostReport: real FEAT113/SLICE37 fixture loads with correct fields", async () => {
  const report = await loadCostReport(REAL_FIXTURE);

  expect(report.runId, "runId must match leading timestamp").toBe("20260607T122544Z");
  expect(derivedFeatureId(report), "derivedFeatureId must be FEAT-113").toBe("FEAT-113");
  expect(derivedSliceId(report), "derivedSliceId must be SLICE-37").toBe("SLICE-37");
  expect(report.usd, "usd must be 1.9962").toBe(1.9962);
  expect(report.totalTokens, "totalTokens must be 4947801").toBe(4947801);
  expect(report.modelMix.length, "modelMix must have 1 entry").toBe(1);
  expect(report.modelMix[0]?.model, "model must be claude-sonnet-4-6").toBe("claude-sonnet-4-6");
  expect(report.subagentDispatches, "subagentDispatches must be 5").toBe(5);
  expect(report.aggregateAll, "aggregateAll must be false").toBe(false);
});

// ---------------------------------------------------------------------------
// Case 2: Aggregate file is skipped with AggregateReportSkipped
// ---------------------------------------------------------------------------

test("loadCostReport: aggregate file throws AggregateReportSkipped", async () => {
  await expect(loadCostReport(AGGREGATE_FIXTURE)).rejects.toBeInstanceOf(AggregateReportSkipped);
});

test("loadCostReportSafe: aggregate file returns null", async () => {
  const result = await loadCostReportSafe(AGGREGATE_FIXTURE);
  expect(result, "loadCostReportSafe must return null for aggregate file").toBe(null);
});

// ---------------------------------------------------------------------------
// Case 3: Malformed cost report returns typed parse error
// ---------------------------------------------------------------------------

test("loadCostReport: malformed file (missing Tokens totals) throws Error, not unhandled rejection", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "telemetry-loader-test-"));
  const malformedPath = path.join(tmpDir, "20260101T000000Z-cost-report-malformed.md");
  try {
    // Write a cost report with no Tokens section and missing window fields.
    await fs.writeFile(
      malformedPath,
      `---
run_title: "Malformed"
usd: 0.5
---
# Cost Report: Malformed

(No Tokens totals section, no Window Start/End)
`,
      "utf8"
    );

    await expect(loadCostReport(malformedPath)).rejects.toBeInstanceOf(Error);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});
