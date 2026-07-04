/**
 * tests/cost-judge-aggregator.test.ts
 *
 * FEAT-186 S3 — aggregator + renderer contract tests.
 *
 * Forward-compatible behavior:
 *   - Today's eval-run JSON shape (no per-test judgeCost) returns empty rows.
 *   - After FEAT-186 S2 dev-team wire-up persists judgeCost, the same
 *     aggregator picks up the new field and populates rows automatically.
 *   - Pre-186 slices (no runs, no trials) return EMPTY aggregate; renderer
 *     emits empty string.
 *
 * Backward-compatible behavior:
 *   - Malformed JSON files are skipped silently (never throw).
 *   - Missing evals/runs/ or gepa/trials/ directory returns empty.
 */

import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  aggregateJudgeCost,
  renderJudgeCostSection,
  type JudgeCostAggregate
} from "../scripts/lib/cost-judge-aggregator.ts";

function makeTmpRepo(): string {
  return mkdtempSync(path.join(tmpdir(), "feat186-s3-"));
}

async function writeRunFile(
  repoRoot: string,
  filename: string,
  body: Record<string, unknown>
): Promise<void> {
  const dir = path.join(repoRoot, "evals", "runs");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), JSON.stringify(body, null, 2), "utf8");
}

async function writeTrialsFile(
  repoRoot: string,
  filename: string,
  trials: Array<Record<string, unknown>>
): Promise<void> {
  const dir = path.join(repoRoot, ".claude", "artifacts", "crew", "gepa", "trials");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, filename),
    trials.map((t) => JSON.stringify(t)).join("\n"),
    "utf8"
  );
}

describe("FEAT-186 S3 — aggregateJudgeCost", () => {
  test("returns EMPTY aggregate when no evals/runs/ + no gepa/trials/ dirs", async () => {
    const repoRoot = makeTmpRepo();
    const agg = await aggregateJudgeCost({ repoRoot });
    expect(agg.rows.length).toBe(0);
    expect(agg.grandTotalUsd).toBe(0);
    expect(agg.sources.evalsRuns).toBe(0);
    expect(agg.sources.gepaTrials).toBe(0);
  });

  test("today's pre-S2 eval-run shape (no judgeCost) returns empty rows but counts files", async () => {
    const repoRoot = makeTmpRepo();
    await writeRunFile(repoRoot, "2026-06-29T19-07-56-053Z-reviewer.json", {
      promptId: "reviewer",
      judgeId: "groq:llama-3.3-70b-versatile",
      tests: [
        { name: "case1", pass: true, asserts: [] },
        { name: "case2", pass: true, asserts: [] }
      ]
    });
    const agg = await aggregateJudgeCost({ repoRoot });
    expect(agg.rows.length).toBe(0);
    expect(agg.sources.evalsRuns).toBe(1);
  });

  test("post-S2 eval-run shape (judgeCost per test) aggregates correctly", async () => {
    const repoRoot = makeTmpRepo();
    await writeRunFile(repoRoot, "2026-06-29T19-07-56-053Z-reviewer.json", {
      promptId: "reviewer",
      judgeId: "groq:llama-3.3-70b-versatile",
      tests: [
        {
          name: "case1",
          pass: true,
          asserts: [],
          judgeCost: { usd: 0.012, latency_ms: 487, tokens: { in: 1200, out: 380 } }
        },
        {
          name: "case2",
          pass: true,
          asserts: [],
          judgeCost: { usd: 0.018, latency_ms: 623, tokens: { in: 1500, out: 420 } }
        }
      ]
    });
    const agg = await aggregateJudgeCost({ repoRoot });
    expect(agg.rows.length).toBe(1);
    const row = agg.rows[0]!;
    expect(row.pipeline).toBe("evals");
    expect(row.provider).toBe("groq");
    expect(row.model).toBe("llama-3.3-70b-versatile");
    expect(row.calls).toBe(2);
    expect(row.usdTotal).toBeCloseTo(0.03, 5);
    expect(row.latencyP50Ms).toBe(555); // median of [487, 623]
    expect(row.tokensIn).toBe(2700);
    expect(row.tokensOut).toBe(800);
    expect(agg.grandTotalUsd).toBeCloseTo(0.03, 5);
  });

  test("gepa trials aggregated by judge_id", async () => {
    const repoRoot = makeTmpRepo();
    await writeTrialsFile(repoRoot, "reviewer.jsonl", [
      {
        trial_id: "t1",
        judge_id: "ollama:llama3.1:8b",
        created_at: "2026-06-29T12:00:00Z",
        score: { cost_usd: 0.0, latency_ms: 91 }
      },
      {
        trial_id: "t2",
        judge_id: "ollama:llama3.1:8b",
        created_at: "2026-06-29T12:01:00Z",
        score: { cost_usd: 0.0, latency_ms: 105 }
      }
    ]);
    const agg = await aggregateJudgeCost({ repoRoot });
    expect(agg.rows.length).toBe(1);
    expect(agg.rows[0]!.pipeline).toBe("gepa");
    expect(agg.rows[0]!.provider).toBe("ollama");
    expect(agg.rows[0]!.calls).toBe(2);
    expect(agg.rows[0]!.usdTotal).toBe(0);
    expect(agg.sources.gepaTrials).toBe(2);
  });

  test("dual-pipeline scenario emits separate rows per pipeline", async () => {
    const repoRoot = makeTmpRepo();
    await writeRunFile(repoRoot, "2026-06-29T10-00-00-000Z-fullstack-dev.json", {
      promptId: "fullstack-dev",
      judgeId: "gemini:gemini-2.5-flash",
      tests: [
        {
          name: "c1",
          pass: true,
          asserts: [],
          judgeCost: { usd: 0.005, latency_ms: 200 }
        }
      ]
    });
    await writeTrialsFile(repoRoot, "fullstack-dev.jsonl", [
      {
        trial_id: "t1",
        judge_id: "ollama:llama3.1:8b",
        created_at: "2026-06-29T10:00:00Z",
        score: { cost_usd: 0.0, latency_ms: 92 }
      }
    ]);
    const agg = await aggregateJudgeCost({ repoRoot });
    expect(agg.rows.length).toBe(2);
    const pipelines = agg.rows.map((r) => r.pipeline).sort();
    expect(pipelines).toEqual(["evals", "gepa"]);
  });

  test("slice window filters runs by filename timestamp", async () => {
    const repoRoot = makeTmpRepo();
    await writeRunFile(repoRoot, "2026-06-20T10-00-00-000Z-reviewer.json", {
      promptId: "reviewer",
      judgeId: "groq:llama-3.3-70b-versatile",
      tests: [{ name: "old", pass: true, asserts: [], judgeCost: { usd: 0.01, latency_ms: 100 } }]
    });
    await writeRunFile(repoRoot, "2026-06-29T10-00-00-000Z-reviewer.json", {
      promptId: "reviewer",
      judgeId: "groq:llama-3.3-70b-versatile",
      tests: [{ name: "new", pass: true, asserts: [], judgeCost: { usd: 0.02, latency_ms: 200 } }]
    });
    const agg = await aggregateJudgeCost({
      repoRoot,
      sliceWindowStart: new Date("2026-06-25T00:00:00Z")
    });
    expect(agg.rows.length).toBe(1);
    expect(agg.rows[0]!.calls).toBe(1);
    expect(agg.rows[0]!.usdTotal).toBeCloseTo(0.02, 5);
  });

  test("malformed JSON files are skipped silently (no throw)", async () => {
    const repoRoot = makeTmpRepo();
    const runsDir = path.join(repoRoot, "evals", "runs");
    await fs.mkdir(runsDir, { recursive: true });
    await fs.writeFile(path.join(runsDir, "broken.json"), "{ not valid json", "utf8");
    const agg = await aggregateJudgeCost({ repoRoot });
    expect(agg.rows.length).toBe(0);
    expect(agg.sources.evalsRuns).toBe(1);
  });
});

describe("FEAT-186 S3 — renderJudgeCostSection", () => {
  test("empty aggregate returns empty string (caller skips section)", () => {
    const empty: JudgeCostAggregate = {
      rows: [],
      grandTotalUsd: 0,
      sources: { evalsRuns: 0, gepaTrials: 0 }
    };
    expect(renderJudgeCostSection(empty)).toBe("");
  });

  test("populated aggregate renders Markdown table with TOTAL row", () => {
    const agg: JudgeCostAggregate = {
      rows: [
        {
          pipeline: "evals",
          provider: "groq",
          model: "llama-3.3-70b-versatile",
          calls: 2,
          usdTotal: 0.03,
          latencyP50Ms: 555,
          tokensIn: 2700,
          tokensOut: 800
        },
        {
          pipeline: "gepa",
          provider: "ollama",
          model: "llama3.1:8b",
          calls: 5,
          usdTotal: 0,
          latencyP50Ms: 95
        }
      ],
      grandTotalUsd: 0.03,
      sources: { evalsRuns: 1, gepaTrials: 5 }
    };
    const md = renderJudgeCostSection(agg);
    expect(md).toContain("## Judge cost");
    expect(md).toContain(
      "| evals | groq | llama-3.3-70b-versatile | 2 | 0.0300 | 555ms | 2700/800 | — |"
    );
    expect(md).toContain("| gepa | ollama | llama3.1:8b | 5 | 0.0000 | 95ms | — | — |");
    expect(md).toContain("**TOTAL**");
    expect(md).toContain("**0.0300**");
  });
});
