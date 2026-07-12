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
import { writeArtifact } from "../scripts/lib/artifacts/write.ts";
import type { CostBreakdown } from "../scripts/lib/artifacts/types.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeTempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), "hero-crew-emission-test-"));
}

async function cleanup(dir: string) {
  await fs.rm(dir, { recursive: true, force: true });
}

/** @param {string} dir */
async function listCostDir(dir: string) {
  const costDir = path.join(dir, ".claude", "artifacts", "crew", "cost");
  try {
    const entries = await fs.readdir(costDir);
    return entries.filter((e) => e.endsWith(".md"));
  } catch {
    return [];
  }
}

// Minimal CostBreakdown for single-source scenario (aggregateAll false)
function makeSingleSourceCost(): CostBreakdown {
  return {
    usd: 5.0,
    aggregateAll: false,
    sourceProject: "C--work-mega-hero-crew",
    autoDetected: false,
    sources: [],
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
function makeMultiSourceCost(): CostBreakdown {
  return {
    ...makeSingleSourceCost(),
    usd: 50.0,
    aggregateAll: true,
    sourceProject: "aggregate",
    sources: [
      { slug: "C--work-mega-hero-crew", messages: 100, usd: 20.0 },
      { slug: "C--work-mega-other-repo", messages: 80, usd: 30.0 }
    ]
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
      files[0]!.includes("-cost-report-slice-"),
      `Expected filename to include '-cost-report-slice-', got: ${files[0]!}`
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
      path.join(tmpDir, ".claude", "artifacts", "crew", "cost", files[0]!),
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
      path.join(tmpDir, ".claude", "artifacts", "crew", "cost", files[0]!),
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
      files[0]!.includes("-cost-report-aggregate-"),
      `Expected filename to include '-cost-report-aggregate-', got: ${files[0]!}`
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
      path.join(tmpDir, ".claude", "artifacts", "crew", "cost", files[0]!),
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
      path.join(tmpDir, ".claude", "artifacts", "crew", "cost", files[0]!),
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
      files[0]!.includes("-cost-report-"),
      `Expected '-cost-report-' in filename, got: ${files[0]!}`
    );
  } finally {
    await cleanup(tmpDir);
  }
});

// ---------------------------------------------------------------------------
// #178 regression: cost-report kinds are immutable emit events. `updatePath`
// (idempotent same-path overwrite) must be IGNORED for the three cost-report
// kinds, otherwise a slice-close with a stale/wide currentRun window could
// clobber an unrelated historical cost-report file into a lossy stub. The
// fix removes the overwrite capability structurally rather than trusting an
// emit-window predicate.
// ---------------------------------------------------------------------------

for (const kind of ["cost-report", "cost-report-slice", "cost-report-aggregate"] as const) {
  test(`${kind}: updatePath cannot clobber an existing historical cost file (#178)`, async () => {
    const tmpDir = await makeTempDir();
    try {
      const costDir = path.join(tmpDir, ".claude", "artifacts", "crew", "cost");
      await fs.mkdir(costDir, { recursive: true });
      const historicalPath = path.join(costDir, "20260101T000000Z-cost-report-slice-historical.md");
      const SENTINEL = "# Historical report — must NOT be overwritten\nusd: 999.99\n";
      await fs.writeFile(historicalPath, SENTINEL);

      const result = await writeArtifact(tmpDir, kind, {
        title: "fresh-emit",
        runTitle: "fresh-emit",
        cost: makeMultiSourceCost(),
        outcome: null,
        updatePath: historicalPath
      });
      assert.ok(result.ok, "writeArtifact should still succeed");

      // Historical file is byte-preserved — not clobbered.
      const after = await fs.readFile(historicalPath, "utf8");
      assert.equal(after, SENTINEL, "historical cost-report file must be preserved intact");

      // The emit still landed — as a NEW timestamped file, not at updatePath.
      assert.notEqual(
        result.value.path,
        historicalPath,
        "cost-report emit must mint a fresh path, never reuse updatePath"
      );
      const files = await listCostDir(tmpDir);
      assert.equal(files.length, 2, `Expected historical + fresh file, got: ${files.join(", ")}`);
    } finally {
      await cleanup(tmpDir);
    }
  });
}

// ---------------------------------------------------------------------------
// #178 end-to-end regression: exercise the actual slice-close ceremony entry
// point (maybeEmitCostReport, invoked by write-final-synthesis / `slice
// complete`) rather than calling writeArtifact directly with an explicit
// updatePath. The tests above prove writeArtifact ignores updatePath for
// cost-report kinds; these prove the real production call chain never
// derives an updatePath (or any other historical-file target) from a
// stale/wide currentRun window in the first place — the exact incident
// shape from the FEAT-188 S5 close, where currentRun was never rotated via
// `/loop:slice start` and the emit window spanned ~8 days / 107 sessions.
// ---------------------------------------------------------------------------

async function writeWorkflowState(
  tmpDir: string,
  currentRun: Record<string, unknown>
): Promise<void> {
  const stateDir = path.join(tmpDir, ".claude", "state", "crew");
  await fs.mkdir(stateDir, { recursive: true });
  await fs.writeFile(
    path.join(stateDir, "workflow-state.json"),
    JSON.stringify(
      { version: "1.0", updatedAt: new Date().toISOString(), currentRun, recentRuns: [] },
      null,
      2
    )
  );
}

async function withIsolatedProjectsRoot<T>(tmpDir: string, fn: () => Promise<T>): Promise<T> {
  const original = process.env["CREW_PROJECTS_ROOT"];
  try {
    // Point session scanning at an empty, isolated directory so a wide
    // emit-window scan is deterministic and never touches real
    // ~/.claude/projects session data from the host running the test.
    const emptyProjectsRoot = path.join(tmpDir, "isolated-projects-root");
    await fs.mkdir(emptyProjectsRoot, { recursive: true });
    process.env["CREW_PROJECTS_ROOT"] = emptyProjectsRoot;
    return await fn();
  } finally {
    if (original === undefined) delete process.env["CREW_PROJECTS_ROOT"];
    else process.env["CREW_PROJECTS_ROOT"] = original;
  }
}

test("maybeEmitCostReport: stale/wide currentRun does not touch historical cost-report files (#178)", async () => {
  const tmpDir = await makeTempDir();
  try {
    await withIsolatedProjectsRoot(tmpDir, async () => {
      const costDir = path.join(tmpDir, ".claude", "artifacts", "crew", "cost");
      await fs.mkdir(costDir, { recursive: true });
      // Two historical reports from unrelated slices/features — mirrors the
      // ~12-file blast radius from the incident (feat105, feat130, ...).
      const historicalPaths = [
        path.join(costDir, "20260607T101040Z-cost-report-slice-feat105-slice23.md"),
        path.join(costDir, "20260609T143942Z-cost-report-slice-feat130-slice58.md")
      ];
      const sentinels = historicalPaths.map(
        (_p, i) => `# Historical report ${i} — must NOT be rewritten\nusd: ${i}.5\n`
      );
      for (const [i, p] of historicalPaths.entries()) {
        await fs.writeFile(p, sentinels[i]!);
      }

      // Stale currentRun: started 8 days ago, never rotated this session —
      // the exact shape flagged in the FEAT-188 S5 synthesis cost-attribution
      // caveat that preceded the incident.
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
      await writeWorkflowState(tmpDir, {
        title: "stale-currentrun-emit",
        goal: "regression repro",
        mode: "single-session",
        status: "in-progress",
        startedAt: eightDaysAgo,
        updatedAt: eightDaysAgo,
        next: "",
        gates: {},
        artifacts: {}
      });

      const { maybeEmitCostReport } = await import(
        "../scripts/lib/cost-hygiene/emit-cost-report.ts"
      );
      const result = await maybeEmitCostReport(tmpDir, { runTitle: "stale-currentrun-emit" });

      assert.ok(result, "emitter should return a result for a stale-but-present currentRun");
      assert.ok(
        !("error" in (result as Record<string, unknown>)),
        `emitter errored: ${JSON.stringify(result)}`
      );

      // Both historical files are byte-preserved — the stale/wide window
      // never rewrote them, and never rewrote them into lossy stubs.
      for (const [i, p] of historicalPaths.entries()) {
        const after = await fs.readFile(p, "utf8");
        assert.equal(after, sentinels[i]!, `historical file ${p} must be preserved intact`);
      }

      // The emit landed as a fresh file alongside the historical set, not by
      // touching it.
      const filesAfter = await listCostDir(tmpDir);
      assert.ok(
        filesAfter.length > historicalPaths.length,
        `expected at least one fresh file alongside the ${historicalPaths.length} historical files, got: ${filesAfter.join(", ")}`
      );
    });
  } finally {
    await cleanup(tmpDir);
  }
});

test("maybeEmitCostReport: normal (fresh) currentRun emission preserves historical files and mints exactly one report", async () => {
  const tmpDir = await makeTempDir();
  try {
    await withIsolatedProjectsRoot(tmpDir, async () => {
      const costDir = path.join(tmpDir, ".claude", "artifacts", "crew", "cost");
      await fs.mkdir(costDir, { recursive: true });
      const historicalPath = path.join(costDir, "20260101T000000Z-cost-report-slice-unrelated.md");
      const sentinel = "# Historical report — must NOT be rewritten\nusd: 42.0\n";
      await fs.writeFile(historicalPath, sentinel);

      // Freshly rotated currentRun, as `/loop:slice start` produces.
      const now = new Date().toISOString();
      await writeWorkflowState(tmpDir, {
        title: "fresh-currentrun-emit",
        goal: "normal slice close",
        mode: "single-session",
        status: "in-progress",
        startedAt: now,
        updatedAt: now,
        next: "",
        gates: {},
        artifacts: {}
      });

      const { maybeEmitCostReport } = await import(
        "../scripts/lib/cost-hygiene/emit-cost-report.ts"
      );
      const result = await maybeEmitCostReport(tmpDir, { runTitle: "fresh-currentrun-emit" });

      assert.ok(result, "emitter should return a result for a fresh currentRun");
      assert.ok(
        !("error" in (result as Record<string, unknown>)),
        `emitter errored: ${JSON.stringify(result)}`
      );

      const after = await fs.readFile(historicalPath, "utf8");
      assert.equal(after, sentinel, "unrelated historical file must be untouched");

      const filesAfter = await listCostDir(tmpDir);
      assert.equal(
        filesAfter.length,
        2,
        `expected historical + exactly one fresh report, got: ${filesAfter.join(", ")}`
      );
    });
  } finally {
    await cleanup(tmpDir);
  }
});
