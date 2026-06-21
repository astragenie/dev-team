/**
 * Tests for the ## Agent stats (rolling) cost-report section (FEAT-159 SLICE-B).
 * Covers renderCostReportAgentStats + the regex extension in decisionSet.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { writeArtifact } from "../scripts/lib/artifacts/write.ts";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { AgentStatsRow } from "../scripts/lib/agent-stats-aggregator.ts";
import { aggregateAgentStats } from "../scripts/lib/agent-stats-aggregator.ts";

function mkRow(agent: string, n: number): AgentStatsRow {
  return {
    agent,
    window: "last_n_slices_10",
    sample_count: n,
    pass_rate: 0.9,
    mean_wall_ms: 50000,
    mean_tokens: 45000,
    review_rework_rate: 0.1,
    validation_fail_rate: 0.05,
    median_dispatches_to_pass: 1
  };
}

test("AC-T1: empty agentStats omits the section entirely", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "cost-report-stats-"));
  const r = await writeArtifact(tmp, "cost-report-slice", {
    title: "no-stats",
    runTitle: "no-stats",
    cost: { totals: { input: 100 } },
    outcome: null,
    agentStats: []
  });
  assert.ok(r.ok, "write should succeed");
  const md = await fs.readFile((r.value as { path: string }).path, "utf-8");
  assert.ok(!md.includes("## Agent stats (rolling)"), "section must not appear when rows empty");
  await fs.rm(tmp, { recursive: true, force: true });
});

test("AC-T2: 7 agents → table shows top-5 by sample_count desc with header + separator", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "cost-report-stats-"));
  const rows: AgentStatsRow[] = [
    mkRow("crew:fullstack-dev", 12),
    mkRow("crew:inspector", 8),
    mkRow("crew:verifier", 7),
    mkRow("crew:backend-dev", 4),
    mkRow("crew:frontend-dev", 2),
    mkRow("crew:document-writer", 9),
    mkRow("crew:architect", 1)
  ];
  const r = await writeArtifact(tmp, "cost-report-slice", {
    title: "top5",
    runTitle: "top5",
    cost: { totals: { input: 100 } },
    outcome: null,
    agentStats: rows
  });
  assert.ok(r.ok);
  const md = await fs.readFile((r.value as { path: string }).path, "utf-8");
  assert.ok(md.includes("## Agent stats (rolling)"), "section header present");
  assert.ok(md.includes("Window: `last_n_slices_10`"), "window slug present");
  assert.ok(md.includes("| Agent | N |"), "table header present");
  assert.ok(md.includes("|---|---:|"), "alignment row present");

  // Top 5 by sample_count desc: 12, 9, 8, 7, 4 → fullstack-dev, document-writer, inspector, verifier, backend-dev
  assert.ok(md.includes("| crew:fullstack-dev | 12 |"), "rank 1");
  assert.ok(md.includes("| crew:document-writer | 9 |"), "rank 2");
  assert.ok(md.includes("| crew:inspector | 8 |"), "rank 3");
  assert.ok(md.includes("| crew:verifier | 7 |"), "rank 4");
  assert.ok(md.includes("| crew:backend-dev | 4 |"), "rank 5");

  // Below top-5 → must NOT appear
  assert.ok(!md.includes("| crew:frontend-dev |"), "rank 6 excluded");
  assert.ok(!md.includes("| crew:architect |"), "rank 7 excluded");

  await fs.rm(tmp, { recursive: true, force: true });
});

test("AC-T3: section ordering — agent-stats appears AFTER Per-dispatch breakdown", async () => {
  // Use both dispatchBreakdown + agentStats so both sections render.
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "cost-report-stats-"));
  const r = await writeArtifact(tmp, "cost-report-slice", {
    title: "ordering",
    runTitle: "ordering",
    cost: { totals: { input: 100 } },
    outcome: null,
    dispatchBreakdown: {
      dispatch: { rowCount: 1, totalWallMs: 1000, topSlow: [], topTokens: [] },
      gates: { rowCount: 0, totalMs: 0, timeoutCount: 0, byGate: {} }
    },
    agentStats: [mkRow("crew:builder", 5)]
  });
  assert.ok(r.ok);
  const md = await fs.readFile((r.value as { path: string }).path, "utf-8");
  const dispatchIdx = md.indexOf("## Per-dispatch breakdown");
  const statsIdx = md.indexOf("## Agent stats (rolling)");
  assert.ok(dispatchIdx > 0, "Per-dispatch breakdown section present");
  assert.ok(statsIdx > 0, "Agent stats section present");
  assert.ok(statsIdx > dispatchIdx, "agent-stats MUST follow Per-dispatch");
  await fs.rm(tmp, { recursive: true, force: true });
});

test("AC-T4: regex extension — `rejected` review decision counts toward rework", async () => {
  // Synthetic: 1 slice, 1 dispatch by `crew:builder`, review decision = REJECTED.
  // Without the regex extension this would yield review_rework_rate == 0.
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "cost-report-stats-"));
  const reviewsDir = path.join(tmp, "reviews");
  await fs.mkdir(reviewsDir, { recursive: true });
  await fs.writeFile(
    path.join(reviewsDir, "review-slice-z01.md"),
    `---\nkind: review-result\nslice: SLICE-Z01\nreviewer: crew:inspector\nverdict: REJECTED\n---\n# Review\nRejected.\n`
  );
  const dispatchSeed = path.join(tmp, "dispatch.jsonl");
  await fs.writeFile(
    dispatchSeed,
    JSON.stringify({
      runId: "r1",
      sliceId: "SLICE-Z01",
      agent: "crew:builder",
      model: "sonnet",
      startMs: 1,
      wallMs: 10000,
      toolCalls: {},
      bashDurationMs: 0,
      skillLoadCount: 0,
      tokenIn: 10000,
      tokenOut: 5000
    }) + "\n"
  );
  const rows = await aggregateAgentStats({
    repo: tmp,
    window: { kind: "last_n_slices", n: 5 },
    dispatchTimingPath: dispatchSeed,
    grades: [{ slice: "SLICE-Z01", graded_at: "2026-06-20", scores: { x: 0.85 } }],
    reviewsDir,
    validationsDir: path.join(tmp, "validations-empty")
  });
  const builder = rows.find((r) => r.agent === "crew:builder");
  assert.ok(builder, "builder row present");
  assert.equal(builder.review_rework_rate, 1, "rejected counts toward rework (1 of 1)");
  await fs.rm(tmp, { recursive: true, force: true });
});
