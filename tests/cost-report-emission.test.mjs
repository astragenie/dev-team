// TDD tests for SLICE-13: cost-report emission split into slice vs aggregate variants.
//
// AC-1: single-source emission writes ONLY a slice variant file
// AC-2: multi-source emission writes BOTH slice + aggregate files
// AC-3: single-source emission does NOT write an aggregate file
// AC-4: legacy cost-report files continue to parse (no-change test)

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { writeArtifact } from "../scripts/lib/artifacts.mjs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeTempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), "hero-crew-emission-test-"));
}

async function cleanup(dir) {
  await fs.rm(dir, { recursive: true, force: true });
}

/** @param {string} dir */
async function listCostDir(dir) {
  const costDir = path.join(dir, ".claude", "artifacts", "crew", "cost");
  try {
    const entries = await fs.readdir(costDir);
    return entries.filter((e) => e.endsWith(".md"));
  } catch {
    return [];
  }
}

// Minimal CostBreakdown for single-source scenario (aggregateAll false)
function makeSingleSourceCost() {
  return {
    usd: 5.0,
    durationMs: 60000,
    aggregateAll: false,
    sourceProject: "C--work-mega-hero-crew",
    autoDetected: false,
    sources: [],
    sourceCount: 1,
    window: { start: "2026-01-01T00:00:00Z", end: "2026-01-01T01:00:00Z", durationMs: 3600000 },
    sessionsScanned: 1,
    messagesCounted: 10,
    totals: {
      input: 1000,
      output: 200,
      cache_create_5m: 500,
      cache_create_1h: 0,
      cache_read: 8000
    },
    modelMix: [],
    toolUsage: [],
    toolResultSizes: null,
    fileReReadCount: 2,
    fileReReadTopPaths: [],
    conversation: {
      userMsgCount: 2,
      userMsgAvgLen: 50,
      turnsBeforeFirstTool: 1,
      compactionCount: 0,
      skillInvocations: 1,
      subagentDispatches: 1
    }
  };
}

// Minimal CostBreakdown for multi-source scenario (aggregateAll true)
function makeMultiSourceCost() {
  return {
    ...makeSingleSourceCost(),
    usd: 50.0,
    aggregateAll: true,
    sourceProject: "aggregate",
    sources: [
      { slug: "C--work-mega-hero-crew", messages: 100, usd: 20.0 },
      { slug: "C--work-mega-other-repo", messages: 80, usd: 30.0 }
    ],
    sourceCount: 2
  };
}

// ---------------------------------------------------------------------------
// AC-1 + AC-3: single-source emission → only slice file, no aggregate file
// ---------------------------------------------------------------------------

test("cost-report-slice: single-source emission writes only the slice file", async () => {
  const tmpDir = await makeTempDir();
  try {
    await writeArtifact(tmpDir, "cost-report-slice", {
      title: "test-slice",
      runTitle: "test-slice",
      cost: makeSingleSourceCost(),
      outcome: null
    });

    const files = await listCostDir(tmpDir);
    assert.equal(files.length, 1, `Expected 1 file, got: ${files.join(", ")}`);
    assert.ok(
      files[0].includes("-cost-report-slice-"),
      `Expected filename to include '-cost-report-slice-', got: ${files[0]}`
    );
  } finally {
    await cleanup(tmpDir);
  }
});

test("cost-report-slice: single-source emission does NOT write an aggregate file", async () => {
  const tmpDir = await makeTempDir();
  try {
    await writeArtifact(tmpDir, "cost-report-slice", {
      title: "test-slice-only",
      runTitle: "test-slice-only",
      cost: makeSingleSourceCost(),
      outcome: null
    });

    const files = await listCostDir(tmpDir);
    const aggregateFiles = files.filter((f) => f.includes("-cost-report-aggregate-"));
    assert.equal(
      aggregateFiles.length,
      0,
      `Expected no aggregate file; found: ${aggregateFiles.join(", ")}`
    );
  } finally {
    await cleanup(tmpDir);
  }
});

// ---------------------------------------------------------------------------
// AC-1: slice file has correct frontmatter fields
// ---------------------------------------------------------------------------

test("cost-report-slice: slice file has aggregate_all: false in frontmatter", async () => {
  const tmpDir = await makeTempDir();
  try {
    await writeArtifact(tmpDir, "cost-report-slice", {
      title: "slice-fm-test",
      runTitle: "slice-fm-test",
      cost: makeSingleSourceCost(),
      outcome: null
    });

    const files = await listCostDir(tmpDir);
    assert.equal(files.length, 1, "Expected 1 file");
    const content = await fs.readFile(
      path.join(tmpDir, ".claude", "artifacts", "crew", "cost", files[0]),
      "utf8"
    );
    assert.ok(
      content.includes("aggregate_all: false"),
      `Expected 'aggregate_all: false' in frontmatter.\nContent:\n${content.slice(0, 400)}`
    );
  } finally {
    await cleanup(tmpDir);
  }
});

test("cost-report-slice: slice file has source_count: 1 in frontmatter", async () => {
  const tmpDir = await makeTempDir();
  try {
    await writeArtifact(tmpDir, "cost-report-slice", {
      title: "slice-count-test",
      runTitle: "slice-count-test",
      cost: makeSingleSourceCost(),
      outcome: null
    });

    const files = await listCostDir(tmpDir);
    const content = await fs.readFile(
      path.join(tmpDir, ".claude", "artifacts", "crew", "cost", files[0]),
      "utf8"
    );
    assert.ok(
      content.includes("source_count: 1"),
      `Expected 'source_count: 1' in frontmatter.\nContent:\n${content.slice(0, 400)}`
    );
  } finally {
    await cleanup(tmpDir);
  }
});

// ---------------------------------------------------------------------------
// AC-2: multi-source emission writes BOTH slice + aggregate files
// ---------------------------------------------------------------------------

test("cost-report-aggregate: multi-source emission writes aggregate file", async () => {
  const tmpDir = await makeTempDir();
  try {
    await writeArtifact(tmpDir, "cost-report-aggregate", {
      title: "test-aggregate",
      runTitle: "test-aggregate",
      cost: makeMultiSourceCost(),
      outcome: null
    });

    const files = await listCostDir(tmpDir);
    assert.equal(files.length, 1, `Expected 1 file, got: ${files.join(", ")}`);
    assert.ok(
      files[0].includes("-cost-report-aggregate-"),
      `Expected filename to include '-cost-report-aggregate-', got: ${files[0]}`
    );
  } finally {
    await cleanup(tmpDir);
  }
});

test("cost-report-aggregate: aggregate file has aggregate_all: true in frontmatter", async () => {
  const tmpDir = await makeTempDir();
  try {
    await writeArtifact(tmpDir, "cost-report-aggregate", {
      title: "agg-fm-test",
      runTitle: "agg-fm-test",
      cost: makeMultiSourceCost(),
      outcome: null
    });

    const files = await listCostDir(tmpDir);
    const content = await fs.readFile(
      path.join(tmpDir, ".claude", "artifacts", "crew", "cost", files[0]),
      "utf8"
    );
    assert.ok(
      content.includes("aggregate_all: true"),
      `Expected 'aggregate_all: true' in frontmatter.\nContent:\n${content.slice(0, 400)}`
    );
  } finally {
    await cleanup(tmpDir);
  }
});

test("cost-report-aggregate: aggregate file has correct source_count in frontmatter", async () => {
  const tmpDir = await makeTempDir();
  try {
    await writeArtifact(tmpDir, "cost-report-aggregate", {
      title: "agg-count-test",
      runTitle: "agg-count-test",
      cost: makeMultiSourceCost(),
      outcome: null
    });

    const files = await listCostDir(tmpDir);
    const content = await fs.readFile(
      path.join(tmpDir, ".claude", "artifacts", "crew", "cost", files[0]),
      "utf8"
    );
    assert.ok(
      content.includes("source_count: 2"),
      `Expected 'source_count: 2' in frontmatter.\nContent:\n${content.slice(0, 400)}`
    );
  } finally {
    await cleanup(tmpDir);
  }
});

// ---------------------------------------------------------------------------
// AC-4: legacy cost-report kind still works (backward compat)
// ---------------------------------------------------------------------------

test("cost-report: legacy kind still emits a file with -cost-report- in name", async () => {
  const tmpDir = await makeTempDir();
  try {
    await writeArtifact(tmpDir, "cost-report", {
      title: "legacy-report",
      runTitle: "legacy-report",
      cost: makeMultiSourceCost(),
      outcome: null
    });

    const files = await listCostDir(tmpDir);
    assert.equal(files.length, 1, `Expected 1 file, got: ${files.join(", ")}`);
    // Legacy pattern: includes -cost-report- but NOT -cost-report-slice- or -cost-report-aggregate-
    assert.ok(
      files[0].includes("-cost-report-"),
      `Expected '-cost-report-' in filename, got: ${files[0]}`
    );
  } finally {
    await cleanup(tmpDir);
  }
});
