// TDD tests for Item 11 (v0.8.0 polish): per-role cost-report breakdown.
//
// AC-1: scanSessions captures subagentDispatchesByRole from Agent tool inputs
// AC-2: cost-report artifact renders the role breakdown section
// AC-3: briefing rollup aggregates role dispatches across recent slices

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { writeArtifact } from "../scripts/lib/artifacts.mjs";
import { collectRecentCosts } from "../scripts/lib/briefing/collect.mjs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeTempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), "hero-crew-role-test-"));
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

/** @param {string} dir */
async function readCostReport(dir) {
  const files = await listCostDir(dir);
  if (!files.length) return null;
  const costDir = path.join(dir, ".claude", "artifacts", "crew", "cost");
  return fs.readFile(path.join(costDir, files[0]), "utf8");
}

/** Build a minimal CostBreakdown with a role breakdown */
function makeCostWithRoles() {
  return {
    usd: 12.5,
    aggregateAll: false,
    sourceProject: "C--work-mega-hero-crew",
    autoDetected: false,
    sources: [],
    window: {
      start: "2026-01-01T00:00:00Z",
      end: "2026-01-01T02:00:00Z",
      durationMs: 7200000
    },
    sessionsScanned: 1,
    messagesCounted: 15,
    totals: {
      input: 2000,
      output: 400,
      cache_create_5m: 800,
      cache_create_1h: 0,
      cache_read: 16000
    },
    modelMix: [],
    toolUsage: [],
    toolResultSizes: null,
    fileReReadCount: 0,
    fileReReadTopPaths: [],
    conversation: {
      userMsgCount: 3,
      userMsgAvgLen: 80,
      turnsBeforeFirstTool: 1,
      compactionCount: 0,
      skillInvocations: 2,
      subagentDispatches: 5,
      subagentDispatchesByRole: {
        "crew:builder": 3,
        "crew:reviewer": 1,
        "crew:validator": 1
      }
    }
  };
}

/** Build a minimal CostBreakdown without role breakdown (backward compat) */
function makeCostWithoutRoles() {
  return {
    usd: 8.0,
    aggregateAll: false,
    sourceProject: "C--work-mega-hero-crew",
    autoDetected: false,
    sources: [],
    window: {
      start: "2026-01-02T00:00:00Z",
      end: "2026-01-02T01:00:00Z",
      durationMs: 3600000
    },
    sessionsScanned: 1,
    messagesCounted: 8,
    totals: {
      input: 1000,
      output: 200,
      cache_create_5m: 400,
      cache_create_1h: 0,
      cache_read: 8000
    },
    modelMix: [],
    toolUsage: [],
    toolResultSizes: null,
    fileReReadCount: 0,
    fileReReadTopPaths: [],
    conversation: {
      userMsgCount: 2,
      userMsgAvgLen: 60,
      turnsBeforeFirstTool: 1,
      compactionCount: 0,
      skillInvocations: 1,
      subagentDispatches: 2
    }
  };
}

// ---------------------------------------------------------------------------
// AC-2: cost-report artifact renders the role breakdown section
// ---------------------------------------------------------------------------

test("cost-report-slice: renders subagent_dispatches_by_role section when present", async () => {
  const tmpDir = await makeTempDir();
  try {
    await writeArtifact(tmpDir, "cost-report-slice", {
      title: "role-breakdown-test",
      runTitle: "role-breakdown-test",
      cost: makeCostWithRoles(),
      outcome: null
    });

    const content = await readCostReport(tmpDir);
    assert.ok(content, "Expected cost report to be written");
    assert.ok(
      content.includes("subagent_dispatches_by_role"),
      `Expected 'subagent_dispatches_by_role' section in body.\nContent:\n${content.slice(0, 800)}`
    );
    assert.ok(
      content.includes("crew:builder: 3"),
      `Expected 'crew:builder: 3' in role breakdown.\nContent:\n${content.slice(0, 1000)}`
    );
    assert.ok(
      content.includes("crew:reviewer: 1"),
      `Expected 'crew:reviewer: 1' in role breakdown.\nContent:\n${content.slice(0, 1000)}`
    );
  } finally {
    await cleanup(tmpDir);
  }
});

test("cost-report-slice: omits role breakdown section when subagentDispatchesByRole absent", async () => {
  const tmpDir = await makeTempDir();
  try {
    await writeArtifact(tmpDir, "cost-report-slice", {
      title: "no-role-breakdown-test",
      runTitle: "no-role-breakdown-test",
      cost: makeCostWithoutRoles(),
      outcome: null
    });

    const content = await readCostReport(tmpDir);
    assert.ok(content, "Expected cost report to be written");
    assert.ok(
      !content.includes("subagent_dispatches_by_role"),
      `Expected no role breakdown section when field absent.\nContent:\n${content.slice(0, 800)}`
    );
  } finally {
    await cleanup(tmpDir);
  }
});

test("cost-report-slice: renders entries sorted by count descending", async () => {
  const tmpDir = await makeTempDir();
  try {
    await writeArtifact(tmpDir, "cost-report-slice", {
      title: "role-sort-test",
      runTitle: "role-sort-test",
      cost: makeCostWithRoles(),
      outcome: null
    });

    const content = await readCostReport(tmpDir);
    assert.ok(content, "Expected cost report to be written");

    const builderIdx = content.indexOf("crew:builder: 3");
    const reviewerIdx = content.indexOf("crew:reviewer: 1");
    assert.ok(builderIdx > -1 && reviewerIdx > -1, "Expected both role entries");
    assert.ok(
      builderIdx < reviewerIdx,
      `Expected crew:builder (3) to appear before crew:reviewer (1) (sorted by count desc)`
    );
  } finally {
    await cleanup(tmpDir);
  }
});

// ---------------------------------------------------------------------------
// AC-3: briefing rollup aggregates role dispatches across recent slices
// ---------------------------------------------------------------------------

/**
 * Build a cost-report markdown with role breakdown for briefing tests.
 * @param {{
 *   usd?: number,
 *   windowStart?: string,
 *   windowEnd?: string,
 *   roleBreakdown?: Record<string, number>
 * }} opts
 */
function makeCostReportMd({
  usd = 10.0,
  windowStart = "2026-05-01T00:00:00Z",
  windowEnd = "2026-05-03T00:00:00Z",
  roleBreakdown = {}
} = {}) {
  const roleLines = Object.entries(roleBreakdown)
    .sort((a, b) => b[1] - a[1])
    .map(([role, count]) => `  - ${role}: ${count}`)
    .join("\n");

  const roleSection =
    Object.keys(roleBreakdown).length > 0
      ? `\n## Subagent Role Breakdown\n\n- subagent_dispatches_by_role:\n${roleLines}\n`
      : "";

  return `---
usd: ${usd.toFixed(4)}
cache_hit_pct: 99
total_tokens: 100000
duration_ms: 3600000
run_title: "Test Report"
aggregate_all: false
---
# Cost Report: Test Report

- Run Title: Test Report
- Total USD: $${usd.toFixed(4)}
- Total Tokens: 100000
- Cache Hit %: 99
- Window Start: ${windowStart}
- Window End: ${windowEnd}

## Conversation Shape

- user_msg_count: 2
- user_msg_avg_len: 80
- turns_before_first_tool: 0
- compaction_count: 0
- skill_invocations: 1
- subagent_dispatches: ${Object.values(roleBreakdown).reduce((a, b) => a + b, 0) || 1}
${roleSection}
## Tool Usage
- Bash: 20

## Tool Result Sizes
- p90: 1000

## Model Mix
- claude-sonnet-4-6 (priced as claude-sonnet): 10 msgs (100.0%), $${usd.toFixed(4)} (100.0%)

`;
}

async function makeTempCostDir() {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "hero-crew-role-rollup-test-"));
  const costDir = path.join(tmpDir, ".claude", "artifacts", "crew", "cost");
  await fs.mkdir(costDir, { recursive: true });
  return { tmpDir, costDir };
}

async function writeCostReport(costDir, ts, label, text) {
  const name = `${ts}-cost-report-slice-${label}.md`;
  const filePath = path.join(costDir, name);
  await fs.writeFile(filePath, text, "utf8");
  const mtimeMs = Date.parse(
    ts.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, "$1-$2-$3T$4:$5:$6Z")
  );
  if (!Number.isNaN(mtimeMs)) {
    await fs.utimes(filePath, mtimeMs / 1000, mtimeMs / 1000);
  }
  return filePath;
}

test("collectRecentCosts: aggregates roleDispatches across recent slices", async () => {
  const { tmpDir, costDir } = await makeTempCostDir();
  try {
    await writeCostReport(
      costDir,
      "20260501T000000Z",
      "s1",
      makeCostReportMd({
        usd: 10,
        windowStart: "2026-05-01T00:00:00Z",
        windowEnd: "2026-05-01T01:00:00Z",
        roleBreakdown: { "crew:builder": 3, "crew:reviewer": 1 }
      })
    );
    await writeCostReport(
      costDir,
      "20260502T000000Z",
      "s2",
      makeCostReportMd({
        usd: 20,
        windowStart: "2026-05-02T00:00:00Z",
        windowEnd: "2026-05-02T01:00:00Z",
        roleBreakdown: { "crew:builder": 2, "crew:validator": 2 }
      })
    );

    const result = await collectRecentCosts(tmpDir, 5);
    const roleDispatches = result.roleDispatches;

    assert.ok(roleDispatches, `Expected roleDispatches in rollup result`);
    assert.equal(
      roleDispatches["crew:builder"],
      5,
      `Expected crew:builder: 5 (3 + 2), got ${roleDispatches["crew:builder"]}`
    );
    assert.equal(
      roleDispatches["crew:reviewer"],
      1,
      `Expected crew:reviewer: 1, got ${roleDispatches["crew:reviewer"]}`
    );
    assert.equal(
      roleDispatches["crew:validator"],
      2,
      `Expected crew:validator: 2, got ${roleDispatches["crew:validator"]}`
    );
  } finally {
    await cleanup(tmpDir);
  }
});

test("collectRecentCosts: roleDispatches is empty object when no reports have role data", async () => {
  const { tmpDir, costDir } = await makeTempCostDir();
  try {
    await writeCostReport(
      costDir,
      "20260501T000000Z",
      "legacy",
      makeCostReportMd({
        usd: 5,
        windowStart: "2026-05-01T00:00:00Z",
        windowEnd: "2026-05-01T01:00:00Z"
      })
    );

    const result = await collectRecentCosts(tmpDir, 5);
    const roleDispatches = result.roleDispatches;

    assert.ok(roleDispatches !== undefined, `Expected roleDispatches field to exist`);
    assert.deepEqual(roleDispatches, {}, `Expected empty object when no role data present`);
  } finally {
    await cleanup(tmpDir);
  }
});
