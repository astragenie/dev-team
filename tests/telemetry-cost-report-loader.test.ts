/**
 * Tests for scripts/lib/telemetry/cost-report-loader.ts
 * AC-3: Cost-report loader reads real FEAT113/SLICE37 fixture correctly.
 */
import test from "node:test";
import assert from "node:assert/strict";
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

  assert.equal(report.runId, "20260607T122544Z", "runId must match leading timestamp");
  assert.equal(derivedFeatureId(report), "FEAT-113", "derivedFeatureId must be FEAT-113");
  assert.equal(derivedSliceId(report), "SLICE-37", "derivedSliceId must be SLICE-37");
  assert.equal(report.usd, 1.9962, "usd must be 1.9962");
  assert.equal(report.totalTokens, 4947801, "totalTokens must be 4947801");
  assert.equal(report.modelMix.length, 1, "modelMix must have 1 entry");
  assert.equal(report.modelMix[0]?.model, "claude-sonnet-4-6", "model must be claude-sonnet-4-6");
  assert.equal(report.subagentDispatches, 5, "subagentDispatches must be 5");
  assert.equal(report.aggregateAll, false, "aggregateAll must be false");
});

// ---------------------------------------------------------------------------
// Case 2: Aggregate file is skipped with AggregateReportSkipped
// ---------------------------------------------------------------------------

test("loadCostReport: aggregate file throws AggregateReportSkipped", async () => {
  await assert.rejects(
    () => loadCostReport(AGGREGATE_FIXTURE),
    (err: unknown) => {
      assert.ok(err instanceof AggregateReportSkipped, "expected AggregateReportSkipped");
      return true;
    }
  );
});

test("loadCostReportSafe: aggregate file returns null", async () => {
  const result = await loadCostReportSafe(AGGREGATE_FIXTURE);
  assert.equal(result, null, "loadCostReportSafe must return null for aggregate file");
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

    await assert.rejects(
      () => loadCostReport(malformedPath),
      (err: unknown) => {
        assert.ok(err instanceof Error, "expected Error");
        return true;
      }
    );
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});
