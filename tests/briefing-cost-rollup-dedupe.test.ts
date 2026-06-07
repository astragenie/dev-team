// TDD tests for FEAT-036: dedupe overlapping cost reports in collectRecentCosts rollup.
//
// Written BEFORE the implementation. Tests verify that sumUsdRecent, avgUsdRecent,
// modelBurn, and dedupedCount are computed over a deduped set of cost reports,
// while recent[] still exposes all raw reports for per-row table rendering.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { collectRecentCosts } from "../scripts/lib/briefing/collect.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeTempCostDir() {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "hero-crew-dedupe-test-"));
  const costDir = path.join(tmpDir, ".claude", "artifacts", "crew", "cost");
  await fs.mkdir(costDir, { recursive: true });
  return { tmpDir, costDir };
}

async function cleanup(dir: string) {
  await fs.rm(dir, { recursive: true, force: true });
}

/**
 * Build a minimal cost-report markdown.
 *
 * @param {{
 *   usd?: number,
 *   windowStart?: string,
 *   windowEnd?: string,
 *   aggregateAll?: boolean,
 *   sourceProject?: string,
 *   model?: string
 * }} opts
 */
function makeCostReport({
  usd = 10.0,
  windowStart = "2026-05-01T00:00:00Z",
  windowEnd = "2026-05-03T00:00:00Z",
  aggregateAll = false,
  sourceProject = null as string | null,
  model = "claude-sonnet-4-6"
}: {
  usd?: number;
  windowStart?: string;
  windowEnd?: string;
  aggregateAll?: boolean;
  sourceProject?: string | null;
  model?: string;
} = {}) {
  const aggLine = aggregateAll ? "aggregate_all: true" : "aggregate_all: false";
  const srcLine = sourceProject ? `source_project: ${sourceProject}` : "";
  return `---
usd: ${usd.toFixed(4)}
cache_hit_pct: 99
total_tokens: 100000
duration_ms: 3600000
run_title: "Test Report"
${aggLine}
${srcLine}
---
# Cost Report: Test Report

- Run Title: Test Report
- Total USD: $${usd.toFixed(4)}
- Total Tokens: 100000
- Cache Hit %: 99
- Window Start: ${windowStart}
- Window End: ${windowEnd}

## Diagnostics
- compaction_count: 0
- subagent_dispatches: 1
- redundant_read_count: 2
- turns_before_first_tool: 0
- user_msg_avg_len: 100
- skill_invocations: 1
- Sessions Scanned: 1
- Assistant Messages Counted: 10

## Tool Usage
- Bash: 20

## Tool Result Sizes
- p90: 1000

## Model Mix
- ${model} (priced as claude-sonnet): 10 msgs (100.0%), $${usd.toFixed(4)} (100.0%)

`;
}

/**
 * Write a cost report file with an explicit filename timestamp so the
 * listCostReportFilesByMtime sort is deterministic.
 *
 * @param {string} costDir
 * @param {string} ts     e.g. "20260501T000000Z"
 * @param {string} label  e.g. "agg1"
 * @param {string} text
 */
async function writeCostReport(costDir: string, ts: string, label: string, text: string) {
  const name = `${ts}-cost-report-${label}.md`;
  const filePath = path.join(costDir, name);
  await fs.writeFile(filePath, text, "utf8");
  // Touch with an explicit mtime so newest-first sort is deterministic even
  // when fs timestamps have coarse resolution.
  const mtimeMs = Date.parse(
    ts.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, "$1-$2-$3T$4:$5:$6Z")
  );
  if (!Number.isNaN(mtimeMs)) {
    await fs.utimes(filePath, mtimeMs / 1000, mtimeMs / 1000);
  }
  return filePath;
}

// ---------------------------------------------------------------------------
// AC-1: all-aggregate same window → sum equals latest aggregate's usd alone
// ---------------------------------------------------------------------------

test("collectRecentCosts dedupe: all-aggregate same window → sumUsdRecent = latest aggregate only", async () => {
  const { tmpDir, costDir } = await makeTempCostDir();
  try {
    // Three aggregate snapshots of the exact same window — oldest to newest.
    // usd values: 1000, 2000, 3995.81. Only the newest should contribute.
    await writeCostReport(
      costDir,
      "20260501T000000Z",
      "agg-old1",
      makeCostReport({
        usd: 1000,
        aggregateAll: true,
        sourceProject: "aggregate",
        windowStart: "2026-05-01T00:00:00Z",
        windowEnd: "2026-05-06T00:00:00Z"
      })
    );
    await writeCostReport(
      costDir,
      "20260502T000000Z",
      "agg-old2",
      makeCostReport({
        usd: 2000,
        aggregateAll: true,
        sourceProject: "aggregate",
        windowStart: "2026-05-01T00:00:00Z",
        windowEnd: "2026-05-06T00:00:00Z"
      })
    );
    await writeCostReport(
      costDir,
      "20260503T000000Z",
      "agg-latest",
      makeCostReport({
        usd: 3995.81,
        aggregateAll: true,
        sourceProject: "aggregate",
        windowStart: "2026-05-01T00:00:00Z",
        windowEnd: "2026-05-06T00:00:00Z"
      })
    );

    const result = await collectRecentCosts(tmpDir, 5);

    assert.equal(result.recent.length, 3, "recent[] must contain all 3 raw reports");
    assert.equal(result.totalReports, 3, "totalReports must be 3");
    assert.equal(result.dedupedCount, 1, "dedupedCount must be 1 (latest aggregate only)");
    assert.ok(
      Math.abs(result.sumUsdRecent! - 3995.81) < 0.01,
      `sumUsdRecent must be ~3995.81, got ${result.sumUsdRecent}`
    );
    assert.ok(
      Math.abs(result.avgUsdRecent! - 3995.81) < 0.01,
      `avgUsdRecent must divide by dedupedCount (1), got ${result.avgUsdRecent}`
    );
  } finally {
    await cleanup(tmpDir);
  }
});

// ---------------------------------------------------------------------------
// AC-2: aggregate + nested slice same window → sum equals aggregate alone
// ---------------------------------------------------------------------------

test("collectRecentCosts dedupe: aggregate + nested slice same window → sumUsdRecent = aggregate usd only", async () => {
  const { tmpDir, costDir } = await makeTempCostDir();
  try {
    // Aggregate snapshot for window 05-01 → 05-06
    await writeCostReport(
      costDir,
      "20260503T060000Z",
      "agg",
      makeCostReport({
        usd: 3995.81,
        aggregateAll: true,
        sourceProject: "aggregate",
        windowStart: "2026-05-01T00:00:00Z",
        windowEnd: "2026-05-06T00:00:00Z"
      })
    );
    // Slice report for hero-crew, same window (fully contained)
    await writeCostReport(
      costDir,
      "20260503T050000Z",
      "slice-hero-crew",
      makeCostReport({
        usd: 400,
        aggregateAll: false,
        sourceProject: "C--work-mega-hero-crew",
        windowStart: "2026-05-01T00:00:00Z",
        windowEnd: "2026-05-06T00:00:00Z"
      })
    );

    const result = await collectRecentCosts(tmpDir, 5);

    assert.equal(result.recent.length, 2, "recent[] must contain both raw reports");
    assert.equal(result.dedupedCount, 1, "dedupedCount must be 1 (aggregate wins)");
    assert.ok(
      Math.abs(result.sumUsdRecent! - 3995.81) < 0.01,
      `sumUsdRecent must be aggregate usd ~3995.81, got ${result.sumUsdRecent}`
    );
  } finally {
    await cleanup(tmpDir);
  }
});

// ---------------------------------------------------------------------------
// AC-3: disjoint historical windows → sum equals plain sum (no false dedupe)
// ---------------------------------------------------------------------------

test("collectRecentCosts dedupe: disjoint historical windows → sumUsdRecent = plain sum", async () => {
  const { tmpDir, costDir } = await makeTempCostDir();
  try {
    // Two slices with completely different, non-overlapping windows
    await writeCostReport(
      costDir,
      "20260501T000000Z",
      "slice-w1",
      makeCostReport({
        usd: 100,
        aggregateAll: false,
        sourceProject: "C--work-mega-hero-crew",
        windowStart: "2026-05-01T00:00:00Z",
        windowEnd: "2026-05-02T00:00:00Z"
      })
    );
    await writeCostReport(
      costDir,
      "20260503T000000Z",
      "slice-w2",
      makeCostReport({
        usd: 200,
        aggregateAll: false,
        sourceProject: "C--work-mega-hero-crew",
        windowStart: "2026-05-03T00:00:00Z",
        windowEnd: "2026-05-04T00:00:00Z"
      })
    );

    const result = await collectRecentCosts(tmpDir, 5);

    assert.equal(result.recent.length, 2, "recent[] must contain both raw reports");
    assert.equal(result.dedupedCount, 2, "dedupedCount must be 2 (both disjoint windows)");
    assert.ok(
      Math.abs(result.sumUsdRecent! - 300) < 0.01,
      `sumUsdRecent must be plain sum 300, got ${result.sumUsdRecent}`
    );
  } finally {
    await cleanup(tmpDir);
  }
});

// ---------------------------------------------------------------------------
// AC-4: mix of overlapping aggregate + contained slice + one disjoint historical
// ---------------------------------------------------------------------------

test("collectRecentCosts dedupe: mixed scenario → sum = latest aggregate + disjoint report", async () => {
  const { tmpDir, costDir } = await makeTempCostDir();
  try {
    // Older aggregate snapshot (same window as newest agg → will be discarded)
    await writeCostReport(
      costDir,
      "20260501T000000Z",
      "agg-old",
      makeCostReport({
        usd: 1000,
        aggregateAll: true,
        sourceProject: "aggregate",
        windowStart: "2026-05-01T00:00:00Z",
        windowEnd: "2026-05-06T00:00:00Z"
      })
    );
    // Latest aggregate snapshot for same window
    await writeCostReport(
      costDir,
      "20260503T000000Z",
      "agg-latest",
      makeCostReport({
        usd: 3995.81,
        aggregateAll: true,
        sourceProject: "aggregate",
        windowStart: "2026-05-01T00:00:00Z",
        windowEnd: "2026-05-06T00:00:00Z"
      })
    );
    // Slice fully contained inside the aggregate window → excluded from rollup
    await writeCostReport(
      costDir,
      "20260502T000000Z",
      "slice-contained",
      makeCostReport({
        usd: 400,
        aggregateAll: false,
        sourceProject: "C--work-mega-hero-crew",
        windowStart: "2026-05-02T00:00:00Z",
        windowEnd: "2026-05-03T00:00:00Z"
      })
    );
    // Disjoint historical slice (window before the aggregate window)
    await writeCostReport(
      costDir,
      "20260425T000000Z",
      "slice-historical",
      makeCostReport({
        usd: 50,
        aggregateAll: false,
        sourceProject: "C--work-mega-hero-crew",
        windowStart: "2026-04-24T00:00:00Z",
        windowEnd: "2026-04-25T00:00:00Z"
      })
    );

    const result = await collectRecentCosts(tmpDir, 5);

    assert.equal(result.recent.length, 4, "recent[] must contain all 4 raw reports");
    assert.equal(
      result.dedupedCount,
      2,
      "dedupedCount must be 2 (latest agg + disjoint historical)"
    );
    const expected = 3995.81 + 50;
    assert.ok(
      Math.abs(result.sumUsdRecent! - expected) < 0.01,
      `sumUsdRecent must be ${expected}, got ${result.sumUsdRecent}`
    );
  } finally {
    await cleanup(tmpDir);
  }
});

// ---------------------------------------------------------------------------
// AC-5: modelBurn rollup respects dedupe (no double-counted model entries)
// ---------------------------------------------------------------------------

test("collectRecentCosts dedupe: modelBurn only counts deduped reports", async () => {
  const { tmpDir, costDir } = await makeTempCostDir();
  try {
    const opusModel = "claude-opus-4-7";
    const window = { windowStart: "2026-05-01T00:00:00Z", windowEnd: "2026-05-06T00:00:00Z" };

    // Two aggregate snapshots of same window (only latest should contribute to modelBurn)
    await writeCostReport(
      costDir,
      "20260501T000000Z",
      "agg-old",
      makeCostReport({
        usd: 500,
        aggregateAll: true,
        sourceProject: "aggregate",
        model: opusModel,
        ...window
      })
    );
    await writeCostReport(
      costDir,
      "20260503T000000Z",
      "agg-latest",
      makeCostReport({
        usd: 1000,
        aggregateAll: true,
        sourceProject: "aggregate",
        model: opusModel,
        ...window
      })
    );

    const result = await collectRecentCosts(tmpDir, 5);

    // modelBurn.slices for opus should be 1 (one deduped report), not 2
    const opusBurn = result.modelBurn?.find((m) => m.model === opusModel);
    assert.ok(opusBurn != null, `Expected modelBurn entry for ${opusModel}`);
    assert.equal(
      opusBurn.slices,
      1,
      `modelBurn.slices for ${opusModel} must be 1 (deduped), got ${opusBurn.slices}`
    );
  } finally {
    await cleanup(tmpDir);
  }
});

// ---------------------------------------------------------------------------
// AC-6: dedupedCount field is present on the return value
// ---------------------------------------------------------------------------

test("collectRecentCosts: dedupedCount field is present on result", async () => {
  const { tmpDir, costDir } = await makeTempCostDir();
  try {
    await writeCostReport(costDir, "20260501T000000Z", "r1", makeCostReport({ usd: 10 }));

    const result = await collectRecentCosts(tmpDir, 5);

    assert.ok(
      "dedupedCount" in result,
      "dedupedCount field must be present on collectRecentCosts result"
    );
    assert.ok(typeof result.dedupedCount === "number", "dedupedCount must be a number");
  } finally {
    await cleanup(tmpDir);
  }
});

// ---------------------------------------------------------------------------
// AC-6b: dedupedCount = 0 when no reports exist
// ---------------------------------------------------------------------------

test("collectRecentCosts: dedupedCount = 0 when no reports exist", async () => {
  const { tmpDir } = await makeTempCostDir();
  try {
    const result = await collectRecentCosts(tmpDir, 5);
    assert.equal(result.dedupedCount, 0, "dedupedCount must be 0 when no reports");
  } finally {
    await cleanup(tmpDir);
  }
});

// ---------------------------------------------------------------------------
// AC-7: recent[] still contains all raw reports (not stripped)
// ---------------------------------------------------------------------------

test("collectRecentCosts dedupe: recent[] contains all raw reports for table render", async () => {
  const { tmpDir, costDir } = await makeTempCostDir();
  try {
    const sharedWindow = { windowStart: "2026-05-01T00:00:00Z", windowEnd: "2026-05-06T00:00:00Z" };

    await writeCostReport(
      costDir,
      "20260501T000000Z",
      "agg-old",
      makeCostReport({ usd: 1000, aggregateAll: true, sourceProject: "aggregate", ...sharedWindow })
    );
    await writeCostReport(
      costDir,
      "20260502T000000Z",
      "agg-new",
      makeCostReport({ usd: 3995, aggregateAll: true, sourceProject: "aggregate", ...sharedWindow })
    );
    await writeCostReport(
      costDir,
      "20260503T000000Z",
      "slice",
      makeCostReport({
        usd: 400,
        aggregateAll: false,
        sourceProject: "C--work-mega-hero-crew",
        ...sharedWindow
      })
    );

    const result = await collectRecentCosts(tmpDir, 5);

    // recent[] must contain all 3 even though dedupedCount = 1
    assert.equal(result.recent.length, 3, "recent[] must contain all 3 raw reports");
    assert.equal(result.dedupedCount, 1, "dedupedCount must be 1 after dedupe");
  } finally {
    await cleanup(tmpDir);
  }
});
