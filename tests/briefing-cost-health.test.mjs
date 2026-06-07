// TDD tests for SLICE-07: cost health summary in brief-me output.
//
// Written BEFORE the implementation. All tests should fail initially until
// collectCostHealth is exported and wired into buildBriefingReport.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { collectCostHealth, collectCostAggregate } from "../scripts/lib/briefing/collect.ts";

// ---------------------------------------------------------------------------
// Helpers — build a minimal temp repo with seeded cost reports
// ---------------------------------------------------------------------------

async function makeTempRepo(reportTexts = []) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "hero-crew-test-"));
  const costDir = path.join(tmpDir, ".claude", "artifacts", "crew", "cost");
  await fs.mkdir(costDir, { recursive: true });

  for (let i = 0; i < reportTexts.length; i++) {
    // Use timestamp-prefixed names so lexicographic sort == chronological.
    const ts = String(20260501 + i).padStart(8, "0");
    const name = `${ts}T000000Z-slice-cost-report-SLICE-0${i + 1}.md`;
    await fs.writeFile(path.join(costDir, name), reportTexts[i], "utf8");
  }

  return tmpDir;
}

async function cleanup(dir) {
  await fs.rm(dir, { recursive: true, force: true });
}

// A minimal cost-report markdown that the parsers in collect.mjs can read.
// The critical metrics for computeGrade are:
//   cacheHitPct, compactionCount, subagentDispatches, fileRereadCount, toolFailureRate
function makeCostReportText({
  cacheHitPct = 98,
  compactionCount = 0,
  subagentDispatches = 1,
  fileRereadCount = 2,
  toolFailures = 0,
  toolCalls = 20,
  usd = 5.0
} = {}) {
  // cost-advisor.mjs reads metrics from YAML frontmatter (parseFrontmatter).
  // Body fallback patterns cover fields not surfaced via frontmatter.
  return `---
usd: ${usd.toFixed(4)}
cache_hit_pct: ${cacheHitPct}
total_tokens: 100000
duration_ms: 3600000
run_title: "Test Slice"
---
# Test cost report

- Run Title: Test Slice
- Total USD: $${usd.toFixed(4)}
- Total Tokens: 100000
- Cache Hit %: ${cacheHitPct}
- Window Start: 2026-05-01T00:00:00Z
- Window End: 2026-05-01T01:00:00Z

## Diagnostics
- compaction_count: ${compactionCount}
- subagent_dispatches: ${subagentDispatches}
- redundant_read_count: ${fileRereadCount}
- turns_before_first_tool: 0
- user_msg_avg_len: 100
- skill_invocations: 1
- Sessions Scanned: 1
- Assistant Messages Counted: 10

## Tool Usage
- Bash: ${toolCalls}${toolFailures > 0 ? ` (${toolFailures} failed)` : ""}
- Read: 5
- Edit: 3

## Tool Result Sizes
- p90: 1000

## Model Mix
- claude-sonnet-4-5 (priced as claude-sonnet): 10 msgs (100.0%), $${usd.toFixed(4)} (100.0%)

`;
}

// ---------------------------------------------------------------------------
// Test: brief-me with cost reports → costHealth field present
// ---------------------------------------------------------------------------

test("collectCostHealth: returns costHealth with grade and topConcern when cost reports exist", async () => {
  const reportText = makeCostReportText({
    cacheHitPct: 96, // B-band
    compactionCount: 0,
    subagentDispatches: 1,
    fileRereadCount: 2,
    toolCalls: 20,
    toolFailures: 0,
    usd: 5.0
  });
  const tmpDir = await makeTempRepo([reportText]);
  try {
    const result = await collectCostHealth(tmpDir);
    assert.ok(result !== null, "Expected costHealth to be non-null when reports exist");
    assert.ok(typeof result.grade === "string", "grade must be a string");
    assert.ok(result.reportCount >= 1, "reportCount must be >= 1");
    // topConcern can be null (no rules fired) or a string
    assert.ok(
      result.topConcern === null || typeof result.topConcern === "string",
      "topConcern must be string or null"
    );
  } finally {
    await cleanup(tmpDir);
  }
});

// ---------------------------------------------------------------------------
// Test: brief-me without cost reports → null (field omitted by caller)
// ---------------------------------------------------------------------------

test("collectCostHealth: returns null when no cost reports exist", async () => {
  const tmpDir = await makeTempRepo([]); // no reports
  try {
    const result = await collectCostHealth(tmpDir);
    assert.equal(result, null, "Expected null when no cost reports present");
  } finally {
    await cleanup(tmpDir);
  }
});

// ---------------------------------------------------------------------------
// Test: costHealth.grade is a valid A-F letter
// ---------------------------------------------------------------------------

test("collectCostHealth: grade is a valid A-F letter", async () => {
  const validGrades = new Set(["A", "B", "C", "D", "F"]);
  const reportText = makeCostReportText({ cacheHitPct: 99 });
  const tmpDir = await makeTempRepo([reportText]);
  try {
    const result = await collectCostHealth(tmpDir);
    assert.ok(result !== null, "Expected non-null result");
    assert.ok(validGrades.has(result.grade), `grade '${result.grade}' must be one of A,B,C,D,F`);
  } finally {
    await cleanup(tmpDir);
  }
});

// ---------------------------------------------------------------------------
// Test: topConcern is string or null
// ---------------------------------------------------------------------------

test("collectCostHealth: topConcern is string or null", async () => {
  // Create a report that will likely fire a rule (low cache hit)
  const reportText = makeCostReportText({ cacheHitPct: 70 });
  const tmpDir = await makeTempRepo([reportText]);
  try {
    const result = await collectCostHealth(tmpDir);
    assert.ok(result !== null, "Expected non-null result");
    assert.ok(
      result.topConcern === null || typeof result.topConcern === "string",
      `topConcern must be string or null, got ${typeof result.topConcern}`
    );
  } finally {
    await cleanup(tmpDir);
  }
});

// ---------------------------------------------------------------------------
// Test: grade A when all metrics are excellent
// ---------------------------------------------------------------------------

test("collectCostHealth: grade is A when all metrics are excellent", async () => {
  const reportText = makeCostReportText({
    cacheHitPct: 99,
    compactionCount: 0,
    subagentDispatches: 1,
    fileRereadCount: 1,
    toolCalls: 20,
    toolFailures: 0
  });
  const tmpDir = await makeTempRepo([reportText]);
  try {
    const result = await collectCostHealth(tmpDir);
    assert.ok(result !== null, "Expected non-null result");
    assert.equal(result.grade, "A", `Expected A grade for excellent metrics, got ${result.grade}`);
  } finally {
    await cleanup(tmpDir);
  }
});

// ---------------------------------------------------------------------------
// Test: grade downgrades when cache hit is low
// ---------------------------------------------------------------------------

test("collectCostHealth: grade downgrades when cache hit is below A threshold", async () => {
  const reportText = makeCostReportText({ cacheHitPct: 85 }); // D-band cache
  const tmpDir = await makeTempRepo([reportText]);
  try {
    const result = await collectCostHealth(tmpDir);
    assert.ok(result !== null, "Expected non-null result");
    const gradeOrder = ["A", "B", "C", "D", "F"];
    const gradeIdx = gradeOrder.indexOf(result.grade);
    assert.ok(
      gradeIdx >= gradeOrder.indexOf("D"),
      `Expected grade D or worse for cache hit 85%, got ${result.grade}`
    );
  } finally {
    await cleanup(tmpDir);
  }
});

// ---------------------------------------------------------------------------
// Test: topConcern is a string when rules fire (low cache hit triggers rule)
// ---------------------------------------------------------------------------

test("collectCostHealth: topConcern is a non-empty string when a rule fires", async () => {
  // cacheHitPct=70 triggers the cache-busted rule (< 95%)
  const reportText = makeCostReportText({ cacheHitPct: 70 });
  const tmpDir = await makeTempRepo([reportText]);
  try {
    const result = await collectCostHealth(tmpDir);
    assert.ok(result !== null, "Expected non-null result");
    assert.ok(
      typeof result.topConcern === "string" && result.topConcern.length > 0,
      `Expected non-empty topConcern string when cache-busted rule fires, got: ${JSON.stringify(result.topConcern)}`
    );
  } finally {
    await cleanup(tmpDir);
  }
});

// ---------------------------------------------------------------------------
// Test: reportCount matches number of reports seeded
// ---------------------------------------------------------------------------

test("collectCostHealth: reportCount reflects number of cost reports found", async () => {
  const reports = [
    makeCostReportText({ usd: 5.0 }),
    makeCostReportText({ usd: 6.0 }),
    makeCostReportText({ usd: 4.0 })
  ];
  const tmpDir = await makeTempRepo(reports);
  try {
    const result = await collectCostHealth(tmpDir);
    assert.ok(result !== null, "Expected non-null result");
    assert.equal(result.reportCount, 3, `Expected reportCount 3, got ${result.reportCount}`);
  } finally {
    await cleanup(tmpDir);
  }
});

// ---------------------------------------------------------------------------
// Test: buildBriefingReport includes costHealth when reports exist
// ---------------------------------------------------------------------------

test("buildBriefingReport: summary.costHealth is present when cost reports exist", async () => {
  const { buildBriefingReport } = await import("../scripts/lib/briefing.ts");
  const reportText = makeCostReportText({ cacheHitPct: 96 });
  const tmpDir = await makeTempRepo([reportText]);
  // Need a minimal git repo for buildBriefingReport to not fail
  try {
    const result = await buildBriefingReport(tmpDir);
    assert.ok("costHealth" in result, "Expected costHealth field in buildBriefingReport output");
    // When reports exist, costHealth should be non-null
    if (result.costHealth !== null) {
      assert.ok(typeof result.costHealth.grade === "string");
    }
  } finally {
    await cleanup(tmpDir);
  }
});

// ---------------------------------------------------------------------------
// Test: buildBriefingReport omits costHealth (null) when no reports exist
// ---------------------------------------------------------------------------

test("buildBriefingReport: costHealth is null when no cost reports exist", async () => {
  const { buildBriefingReport } = await import("../scripts/lib/briefing.ts");
  const tmpDir = await makeTempRepo([]); // no reports
  try {
    const result = await buildBriefingReport(tmpDir);
    assert.ok(
      "costHealth" in result,
      "Expected costHealth key to be present in result (even if null)"
    );
    assert.equal(result.costHealth, null, "Expected costHealth to be null when no reports exist");
  } finally {
    await cleanup(tmpDir);
  }
});

// ---------------------------------------------------------------------------
// SLICE-13: per-slice-only world — costHealth from slice file, costAggregate null
// AC-5, AC-6, AC-7
// ---------------------------------------------------------------------------

function makeSliceVariantText({
  cacheHitPct = 98,
  fileRereadCount = 9,
  aggregateAll = false,
  sourceCount = 1
} = {}) {
  return `---
kind: cost-report
usd: 5.0000
cache_hit_pct: ${cacheHitPct}
total_tokens: 100000
duration_ms: 3600000
run_title: "Slice Test"
aggregate_all: ${aggregateAll}
source_count: ${sourceCount}
---
# Cost Report: Slice Test

- Run Title: Slice Test
- Total USD: $5.0000
- Cache Hit %: ${cacheHitPct}
- Aggregate All: ${aggregateAll ? "yes" : "no"}

## Diagnostics
- compaction_count: 0
- subagent_dispatches: 1
- redundant_read_count: ${fileRereadCount}
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
- claude-sonnet-4-6 (priced as claude-sonnet): 10 msgs (100.0%), $5.0000 (100.0%)

`;
}

function makeAggregateVariantText({ fileRereadCount = 114, sourceCount = 4 } = {}) {
  return `---
kind: cost-report
usd: 280.0000
cache_hit_pct: 98.0
total_tokens: 272568956
duration_ms: 7023189
run_title: "Aggregate Test"
aggregate_all: true
source_count: ${sourceCount}
---
# Cost Report: Aggregate Test

- Run Title: Aggregate Test
- Total USD: $280.0000
- Cache Hit %: 98.0
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega-hero-crew: 473 msgs, $31.6608
- C--work-mega-other: 502 msgs, $104.9518
- C--work-mega-third: 719 msgs, $118.5371
- C--work-mega-fourth: 504 msgs, $27.3144

## Diagnostics
- compaction_count: 0
- subagent_dispatches: 1
- redundant_read_count: ${fileRereadCount}
- turns_before_first_tool: 0
- user_msg_avg_len: 100
- skill_invocations: 1
- Sessions Scanned: 7
- Assistant Messages Counted: 2198

## Tool Usage
- Bash: 20

## Tool Result Sizes
- p90: 1000

## Model Mix
- claude-sonnet-4-6 (priced as claude-sonnet): 100 msgs (100.0%), $280.0000 (100.0%)

`;
}

async function makeTempRepoWithVariants({
  sliceFiles = [],
  aggregateFiles = [],
  legacyFiles = []
} = {}) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "hero-crew-slice13-test-"));
  const costDir = path.join(tmpDir, ".claude", "artifacts", "crew", "cost");
  await fs.mkdir(costDir, { recursive: true });

  // Write slice-variant files (pattern: <ts>-cost-report-slice-<title>.md)
  for (let i = 0; i < sliceFiles.length; i++) {
    const ts = `2026050${i + 1}T000000Z`;
    const name = `${ts}-cost-report-slice-test-${i + 1}.md`;
    await fs.writeFile(path.join(costDir, name), sliceFiles[i], "utf8");
  }

  // Write aggregate-variant files (pattern: <ts>-cost-report-aggregate-<title>.md)
  for (let i = 0; i < aggregateFiles.length; i++) {
    const ts = `2026050${i + 1}T000000Z`;
    const name = `${ts}-cost-report-aggregate-test-${i + 1}.md`;
    await fs.writeFile(path.join(costDir, name), aggregateFiles[i], "utf8");
  }

  // Write legacy files (pattern: <ts>-cost-report-<title>.md — no infix)
  for (let i = 0; i < legacyFiles.length; i++) {
    const ts = `2026040${i + 1}T000000Z`; // older timestamps than slice/aggregate
    const name = `${ts}-cost-report-legacy-${i + 1}.md`;
    await fs.writeFile(path.join(costDir, name), legacyFiles[i], "utf8");
  }

  return tmpDir;
}

// AC-5: per-slice-only → costHealth from slice file
test("collectCostHealth: per-slice-only world uses slice file for costHealth", async () => {
  const sliceText = makeSliceVariantText({ cacheHitPct: 99, fileRereadCount: 9 });
  const tmpDir = await makeTempRepoWithVariants({ sliceFiles: [sliceText] });
  try {
    const result = await collectCostHealth(tmpDir);
    assert.ok(result !== null, "Expected non-null costHealth when slice file exists");
    assert.ok(typeof result.grade === "string", "grade must be a string");
    assert.ok(result.reportCount >= 1, "reportCount must be >= 1");
  } finally {
    await cleanup(tmpDir);
  }
});

// AC-6: per-slice-only → costAggregate null
test("collectCostAggregate: returns null when no aggregate-variant file exists", async () => {
  const sliceText = makeSliceVariantText({ cacheHitPct: 99 });
  const tmpDir = await makeTempRepoWithVariants({ sliceFiles: [sliceText] });
  try {
    const result = await collectCostAggregate(tmpDir);
    assert.equal(result, null, "Expected null costAggregate when no aggregate file exists");
  } finally {
    await cleanup(tmpDir);
  }
});

// AC-6: both-variants world → costAggregate populated
test("collectCostAggregate: returns aggregate data when aggregate-variant file exists", async () => {
  const sliceText = makeSliceVariantText({ cacheHitPct: 99, fileRereadCount: 9 });
  const aggText = makeAggregateVariantText({ fileRereadCount: 114, sourceCount: 4 });
  const tmpDir = await makeTempRepoWithVariants({
    sliceFiles: [sliceText],
    aggregateFiles: [aggText]
  });
  try {
    const result = await collectCostAggregate(tmpDir);
    assert.ok(result !== null, "Expected non-null costAggregate when aggregate file exists");
    assert.ok(typeof result.grade === "string", "grade must be a string");
  } finally {
    await cleanup(tmpDir);
  }
});

// AC-7: costHealth grade uses per-slice reread count (9), not aggregate (114)
test("collectCostHealth: grade uses slice reread count (9), not aggregate reread count (114)", async () => {
  // 9 rereads → within B-band (≤8 for A, ≤15 for B — wait, per GRADE_THRESHOLDS:
  // [3, "A"], [8, "B"], [15, "C"], [30, "D"]. So 9 → C; 114 → F.
  const sliceText = makeSliceVariantText({ cacheHitPct: 99, fileRereadCount: 9 });
  const aggText = makeAggregateVariantText({ fileRereadCount: 114 });
  const tmpDir = await makeTempRepoWithVariants({
    sliceFiles: [sliceText],
    aggregateFiles: [aggText]
  });
  try {
    const sliceHealth = await collectCostHealth(tmpDir);
    assert.ok(sliceHealth !== null, "Expected non-null costHealth");
    // If grade is derived from slice (9 rereads) → C at worst for that metric
    // If grade is derived from aggregate (114 rereads) → F
    // Grade must NOT be F when using the per-slice file.
    // (cacheHitPct=99 → A; 9 rereads → C-band worst case for that metric alone)
    assert.notEqual(
      sliceHealth.grade,
      "F",
      `costHealth.grade should not be F when slice has only 9 rereads (expected C or better), got ${sliceHealth.grade}`
    );
  } finally {
    await cleanup(tmpDir);
  }
});

// AC-8: legacy-only world → backward compat read path, costAggregate null
test("collectCostHealth: falls back to legacy file when no slice-variant exists", async () => {
  const legacyText = makeSliceVariantText({ cacheHitPct: 95, fileRereadCount: 3 });
  const tmpDir = await makeTempRepoWithVariants({ legacyFiles: [legacyText] });
  try {
    const result = await collectCostHealth(tmpDir);
    assert.ok(result !== null, "Expected non-null costHealth from legacy fallback");
    assert.ok(typeof result.grade === "string", "grade must be a string");
  } finally {
    await cleanup(tmpDir);
  }
});

test("collectCostAggregate: returns null in legacy-only world (no aggregate-variant files)", async () => {
  const legacyText = makeAggregateVariantText({ fileRereadCount: 114 }); // legacy file even with aggregate data
  const tmpDir = await makeTempRepoWithVariants({ legacyFiles: [legacyText] });
  try {
    const result = await collectCostAggregate(tmpDir);
    assert.equal(
      result,
      null,
      "Expected null costAggregate when only legacy (non-infixed) files exist"
    );
  } finally {
    await cleanup(tmpDir);
  }
});

// AC-5: buildBriefingReport exposes costAggregate field
test("buildBriefingReport: exposes costAggregate field at top level", async () => {
  const { buildBriefingReport } = await import("../scripts/lib/briefing.ts");
  const sliceText = makeSliceVariantText({ cacheHitPct: 96 });
  const tmpDir = await makeTempRepoWithVariants({ sliceFiles: [sliceText] });
  try {
    const result = await buildBriefingReport(tmpDir);
    assert.ok(
      "costAggregate" in result,
      "Expected costAggregate key in buildBriefingReport output"
    );
    // With no aggregate file, costAggregate should be null
    assert.equal(result.costAggregate, null, "Expected costAggregate null when no aggregate file");
  } finally {
    await cleanup(tmpDir);
  }
});
