/**
 * cost-judge-aggregator.ts — FEAT-186 S3
 *
 * Aggregates judge-cost rows for a slice from both pipelines:
 *   - evals pipeline: evals/runs/*.json (per-test judgeCost)
 *   - gepa pipeline: .claude/artifacts/crew/gepa/trials/<agent>.jsonl (Trial.score)
 *
 * Returns per-(pipeline, provider) totals + grand totals for the unified
 * cost-report `## Judge cost` section.
 *
 * Forward-compatible: today the eval-run JSON shape does NOT yet carry
 * `judgeCost` per test (gepa-core 0.4.0 publish + FEAT-186 S2 dev-team
 * wire lands that). When judgeCost is absent, this aggregator returns an
 * empty row set rather than failing. After S2 wire-up, eval runs will
 * persist judgeCost and aggregator output populates automatically — no
 * renderer change required.
 *
 * Backward-compatible: pre-186 slices (no eval runs, no gepa trials in
 * the slice window) return an empty aggregate; the renderer emits no
 * `## Judge cost` section in that case.
 */

import fs from "node:fs/promises";
import path from "node:path";

// Mirror of gepa-core's JudgeCost shape (FEAT-186 S1). Kept structurally
// equivalent until dev-team pins @astragenie/gepa-core@^0.4.0 — at which
// point this local interface is dropped in favor of:
//   import type { JudgeCost } from "@astragenie/gepa-core";
export interface JudgeCost {
  usd: number;
  latency_ms: number;
  tokens?: { in: number; out: number };
  cache?: { hit: boolean; tokens_saved?: number };
}

export interface JudgeCostRow {
  /** "evals" | "gepa" — which pipeline emitted the judge call */
  pipeline: "evals" | "gepa";
  /** "groq" | "gemini" | "ollama" | "azure-openai" | "claude-p" etc. */
  provider: string;
  /** Model identifier as reported by the judge (e.g. "llama-3.3-70b-versatile") */
  model: string;
  /** Number of judge calls aggregated into this row */
  calls: number;
  /** Sum of usd across the calls */
  usdTotal: number;
  /** Median latency_ms across the calls */
  latencyP50Ms: number;
  /** Sum of input tokens (undefined if no call provided tokens) */
  tokensIn?: number;
  /** Sum of output tokens (undefined if no call provided tokens) */
  tokensOut?: number;
  /** Fraction of calls that reported `cache.hit = true` (undefined if no call provided cache) */
  cacheHitRate?: number;
}

export interface JudgeCostAggregate {
  rows: JudgeCostRow[];
  grandTotalUsd: number;
  /** Source data flags — useful for debugging "why is my report empty?" */
  sources: {
    evalsRuns: number;
    gepaTrials: number;
  };
}

/**
 * Aggregate judge-cost rows for a slice window.
 *
 * `opts.sliceWindowStart` / `opts.sliceWindowEnd` bound which run files +
 * trial rows count. Window is inclusive of start, exclusive of end (half-open).
 * Both may be omitted to aggregate across all available data — useful for
 * brief-me grand-totals (FEAT-186 S4).
 */
export async function aggregateJudgeCost(opts: {
  repoRoot: string;
  sliceWindowStart?: Date;
  sliceWindowEnd?: Date;
}): Promise<JudgeCostAggregate> {
  const { repoRoot, sliceWindowStart, sliceWindowEnd } = opts;

  const [evalsRows, gepaRows] = await Promise.all([
    aggregateEvalsRuns(repoRoot, sliceWindowStart, sliceWindowEnd),
    aggregateGepaTrials(repoRoot, sliceWindowStart, sliceWindowEnd),
  ]);

  const rows = [...evalsRows.rows, ...gepaRows.rows];
  const grandTotalUsd = round4(rows.reduce((sum, r) => sum + r.usdTotal, 0));
  return {
    rows,
    grandTotalUsd,
    sources: {
      evalsRuns: evalsRows.fileCount,
      gepaTrials: gepaRows.rowCount,
    },
  };
}

/**
 * Scan evals/runs/*.json for files in the slice window. Returns aggregated
 * rows. Today's run-JSON shape does NOT yet carry judgeCost per test;
 * this function returns empty rows in that case. After FEAT-186 S2
 * dev-team wire-up lands (evals/cli.ts persists judgeCost per test), rows
 * populate automatically.
 */
async function aggregateEvalsRuns(
  repoRoot: string,
  windowStart?: Date,
  windowEnd?: Date,
): Promise<{ rows: JudgeCostRow[]; fileCount: number }> {
  const runsDir = path.join(repoRoot, "evals", "runs");
  let entries: string[];
  try {
    entries = await fs.readdir(runsDir);
  } catch {
    return { rows: [], fileCount: 0 };
  }

  const jsonFiles = entries.filter((f) => f.endsWith(".json"));
  const inWindow = jsonFiles.filter((f) => fileInWindow(f, windowStart, windowEnd));

  const buckets: BucketMap = new Map();
  for (const file of inWindow) {
    const fullPath = path.join(runsDir, file);
    try {
      const raw = await fs.readFile(fullPath, "utf8");
      const json = JSON.parse(raw) as unknown;
      collectEvalsRunCosts(json, buckets);
    } catch {
      // Skip malformed files silently — observability over correctness.
    }
  }
  return { rows: bucketsToRows(buckets, "evals"), fileCount: inWindow.length };
}

/**
 * Collect costs from one eval-run JSON. Forward-compatible: handles three
 * shapes: (a) pre-186 (no cost at all), (b) S2-wired (per-test judgeCost),
 * (c) summary.judgeCost aggregate. Today (a) is the only shape seen.
 */
function collectEvalsRunCosts(runJson: unknown, buckets: BucketMap): void {
  if (!runJson || typeof runJson !== "object") return;
  const run = runJson as Record<string, unknown>;
  const judgeId = typeof run["judgeId"] === "string" ? run["judgeId"] : undefined;
  const { provider, model } = parseJudgeId(judgeId);

  const tests = Array.isArray(run["tests"]) ? (run["tests"] as unknown[]) : [];
  for (const t of tests) addTestCostToBucket(t, buckets, provider, model);
}

function addTestCostToBucket(
  test: unknown,
  buckets: BucketMap,
  provider: string,
  model: string,
): void {
  if (!test || typeof test !== "object") return;
  const cost = (test as Record<string, unknown>)["judgeCost"];
  if (!cost || typeof cost !== "object") return;
  addCostShapeToBucket(cost as Record<string, unknown>, buckets, provider, model);
}

function addCostShapeToBucket(
  cost: Record<string, unknown>,
  buckets: BucketMap,
  provider: string,
  model: string,
): void {
  const usd = typeof cost["usd"] === "number" ? cost["usd"] : undefined;
  const lat = typeof cost["latency_ms"] === "number" ? cost["latency_ms"] : undefined;
  if (usd === undefined || lat === undefined) return;

  const key = `${provider}|${model}`;
  const bucket = buckets.get(key) ?? emptyBucket();
  bucket.usds.push(usd);
  bucket.latencies.push(lat);

  const tokens = cost["tokens"] as Record<string, unknown> | undefined;
  if (tokens && typeof tokens["in"] === "number" && typeof tokens["out"] === "number") {
    bucket.tokensIn.push(tokens["in"]);
    bucket.tokensOut.push(tokens["out"]);
  }
  const cache = cost["cache"] as Record<string, unknown> | undefined;
  if (cache && typeof cache["hit"] === "boolean") {
    bucket.cacheHits.push(cache["hit"] ? 1 : 0);
  }
  buckets.set(key, bucket);
}

type Bucket = {
  usds: number[];
  latencies: number[];
  tokensIn: number[];
  tokensOut: number[];
  cacheHits: number[];
};
type BucketMap = Map<string, Bucket>;

function emptyBucket(): Bucket {
  return { usds: [], latencies: [], tokensIn: [], tokensOut: [], cacheHits: [] };
}

function bucketsToRows(buckets: BucketMap, pipeline: "evals" | "gepa"): JudgeCostRow[] {
  const rows: JudgeCostRow[] = [];
  for (const [key, agg] of buckets) {
    if (agg.usds.length === 0) continue;
    const sep = key.indexOf("|");
    const provider = key.slice(0, sep);
    const model = key.slice(sep + 1);
    const row: JudgeCostRow = {
      pipeline,
      provider,
      model,
      calls: agg.usds.length,
      usdTotal: round4(agg.usds.reduce((s, v) => s + v, 0)),
      latencyP50Ms: median(agg.latencies),
    };
    if (agg.tokensIn.length > 0) {
      row.tokensIn = agg.tokensIn.reduce((s, v) => s + v, 0);
      row.tokensOut = agg.tokensOut.reduce((s, v) => s + v, 0);
    }
    if (agg.cacheHits.length > 0) {
      row.cacheHitRate = round4(agg.cacheHits.reduce((s, v) => s + v, 0) / agg.cacheHits.length);
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Scan .claude/artifacts/crew/gepa/trials/*.jsonl for trials in the slice
 * window. Each line is a Trial whose `score.cost_usd` + `score.latency_ms`
 * carry per-trial cost. Forward-compatible: when Trial.score widens to
 * include JudgeCost (S2 follow-up), this aggregator picks it up.
 */
async function aggregateGepaTrials(
  repoRoot: string,
  windowStart?: Date,
  windowEnd?: Date,
): Promise<{ rows: JudgeCostRow[]; rowCount: number }> {
  const trialsDir = path.join(repoRoot, ".claude", "artifacts", "crew", "gepa", "trials");
  let entries: string[];
  try {
    entries = await fs.readdir(trialsDir);
  } catch {
    return { rows: [], rowCount: 0 };
  }

  const jsonlFiles = entries.filter((f) => f.endsWith(".jsonl"));
  if (jsonlFiles.length === 0) return { rows: [], rowCount: 0 };

  const buckets: BucketMap = new Map();
  let rowCount = 0;

  for (const file of jsonlFiles) {
    rowCount += await processGepaTrialFile(
      path.join(trialsDir, file),
      buckets,
      windowStart,
      windowEnd,
    );
  }
  return { rows: bucketsToRows(buckets, "gepa"), rowCount };
}

async function processGepaTrialFile(
  fullPath: string,
  buckets: BucketMap,
  windowStart?: Date,
  windowEnd?: Date,
): Promise<number> {
  let raw: string;
  try {
    raw = await fs.readFile(fullPath, "utf8");
  } catch {
    return 0;
  }
  let countedRows = 0;
  for (const line of raw.split(/\r?\n/)) {
    if (line.length === 0) continue;
    try {
      const trial = JSON.parse(line) as Record<string, unknown>;
      if (!trialInWindow(trial, windowStart, windowEnd)) continue;
      countedRows++;
      collectGepaTrialCost(trial, buckets);
    } catch {
      // Skip malformed JSONL lines.
    }
  }
  return countedRows;
}

function collectGepaTrialCost(trial: Record<string, unknown>, buckets: BucketMap): void {
  const score = trial["score"] as Record<string, unknown> | undefined;
  if (!score) return;
  const judgeId = typeof trial["judge_id"] === "string" ? trial["judge_id"] : undefined;
  const { provider, model } = parseJudgeId(judgeId);
  // gepa trial Trial.score has flat fields (cost_usd, latency_ms) matching LLMJudge result.
  addCostShapeToBucket(
    { usd: score["cost_usd"], latency_ms: score["latency_ms"] },
    buckets,
    provider,
    model,
  );
}

// ---------- helpers ----------

function parseJudgeId(judgeId: string | undefined): { provider: string; model: string } {
  if (!judgeId) return { provider: "unknown", model: "unknown" };
  const colon = judgeId.indexOf(":");
  if (colon < 0) return { provider: judgeId, model: "unknown" };
  return { provider: judgeId.slice(0, colon), model: judgeId.slice(colon + 1) };
}

function fileInWindow(filename: string, start?: Date, end?: Date): boolean {
  if (!start && !end) return true;
  // evals/runs filename pattern: 2026-06-29T19-07-56-053Z-<agent>.json
  const match = filename.match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/);
  if (!match) return true; // unknown shape — include rather than drop
  const iso = `${match[1]}T${match[2]}:${match[3]}:${match[4]}.${match[5]}Z`;
  const ts = new Date(iso);
  if (start && ts < start) return false;
  if (end && ts >= end) return false;
  return true;
}

function trialInWindow(trial: Record<string, unknown>, start?: Date, end?: Date): boolean {
  if (!start && !end) return true;
  const created = trial["created_at"];
  if (typeof created !== "string") return true;
  const ts = new Date(created);
  if (Number.isNaN(ts.getTime())) return true;
  if (start && ts < start) return false;
  if (end && ts >= end) return false;
  return true;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/**
 * Render the aggregate as the `## Judge cost` Markdown section for
 * `.claude/artifacts/crew/cost/<slice>.md`. Empty aggregate returns the
 * empty string — caller decides whether to skip the section entirely or
 * emit a placeholder. Today this returns "" for legacy slices.
 */
export function renderJudgeCostSection(agg: JudgeCostAggregate): string {
  if (agg.rows.length === 0) return "";

  const lines: string[] = [];
  lines.push("## Judge cost");
  lines.push("");
  lines.push("| Pipeline | Provider | Model | Calls | $USD | Latency p50 | Tokens in/out | Cache hit % |");
  lines.push("| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |");
  for (const row of agg.rows) {
    const tokens =
      row.tokensIn !== undefined && row.tokensOut !== undefined
        ? `${row.tokensIn}/${row.tokensOut}`
        : "—";
    const cache = row.cacheHitRate !== undefined ? `${Math.round(row.cacheHitRate * 100)}%` : "—";
    lines.push(
      `| ${row.pipeline} | ${row.provider} | ${row.model} | ${row.calls} | ${row.usdTotal.toFixed(4)} | ${row.latencyP50Ms}ms | ${tokens} | ${cache} |`,
    );
  }
  lines.push(`| **TOTAL** | | | | **${agg.grandTotalUsd.toFixed(4)}** | | | |`);
  lines.push("");
  return lines.join("\n");
}
