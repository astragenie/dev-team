/**
 * brief-me/cost-aggregator.ts — FEAT-186 S4
 *
 * Exposes judge-cost totals from both eval and gepa pipelines for consumption
 * by the brief-me rendering layer. Wraps `aggregateJudgeCost` from the
 * SLICE-112 cost-judge-aggregator module with:
 *
 *   1. A unified `CostEntry` type alias — AC-1 contract. No parallel
 *      type definition is maintained here; the shape is imported directly
 *      from `../cost-judge-aggregator.ts`.
 *
 *   2. Cent-precision total arithmetic — AC-2.
 *      Rule: each per-row `usdTotal` is rounded to 4 decimal places using
 *      symmetric half-up rounding via `round4` (NOT IEEE 754 banker's / round-
 *      half-to-even) before summing. The final display total is rounded to 2
 *      decimal places. This matches the FEAT-159 SLICE-85 convention and
 *      prevents cascading floating-point drift on large corpora.
 *
 *   3. No per-pipeline column doubling — AC-3.
 *      Output is keyed on `(pipeline, provider)` pairs exactly as produced by
 *      the underlying aggregator — no duplicate eval/gepa shadow columns.
 *
 *   4. Backward-compat — AC-4.
 *      Pre-186 cost reports (no evals/runs, no gepa/trials) produce an
 *      EMPTY aggregate (`rows: [], total: 0`). Callers may check
 *      `agg.rows.length === 0` to skip rendering the judge-cost section.
 */

import {
  aggregateJudgeCost,
  type JudgeCostRow,
  type JudgeCostAggregate
} from "../cost-judge-aggregator.ts";

// ---------------------------------------------------------------------------
// Public type alias — AC-1: single authoritative definition, no duplication.
// ---------------------------------------------------------------------------

/**
 * `CostEntry` is the per-(pipeline, provider, model) cost row produced by
 * SLICE-112. This alias names it to match the brief-me consumption vocabulary
 * without copying the struct definition.
 */
export type CostEntry = JudgeCostRow;

/**
 * Re-export `JudgeCostAggregate` so brief-me callers can import the full
 * aggregate shape from this module without reaching into the lower-level
 * cost-judge-aggregator directly.
 */
export type { JudgeCostAggregate };

// ---------------------------------------------------------------------------
// Cent-precision arithmetic helpers — AC-2
// ---------------------------------------------------------------------------

/**
 * Round a USD value to 4 decimal places using symmetric (half-up) rounding.
 *
 * Convention (FEAT-186 S4 / FEAT-159 SLICE-85 alignment):
 *   - Per-row `usdTotal` values are rounded to 4 dp before summation.
 *   - Display totals are rounded to 2 dp.
 *   - This two-pass approach prevents cascading floating-point drift while
 *     keeping per-row precision consistent across eval-only, gepa-only, and
 *     dual-pipeline corpora.
 */
function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// BriefMeCostAggregate
// ---------------------------------------------------------------------------

export interface BriefMeCostAggregate {
  /** Per-(pipeline, provider, model) cost rows — no column doubling. */
  rows: CostEntry[];
  /**
   * Sum of per-row `usdTotal` rounded per the cent-precision rule:
   *   round2(sum(round4(row.usdTotal)))
   * Display this as `$X.XX`.
   */
  totalUsd: number;
  /** Source counts — useful for "why is my report empty?" diagnostics. */
  sources: {
    evalsRuns: number;
    gepaTrials: number;
  };
  /** True when no judge-cost data was found (pre-186 slice or empty window). */
  isEmpty: boolean;
}

// ---------------------------------------------------------------------------
// Main export — aggregateBriefMeCosts
// ---------------------------------------------------------------------------

/**
 * Aggregate judge-cost rows from both pipelines and apply the brief-me
 * cent-precision summation rule.
 *
 * @param repoRoot  Absolute path to the repo root.
 * @param windowStart  Optional inclusive lower bound for the slice window.
 * @param windowEnd    Optional exclusive upper bound for the slice window.
 *                     When both are omitted, all available data is scanned
 *                     (grand-total mode for the brief-me cost section).
 */
export async function aggregateBriefMeCosts(opts: {
  repoRoot: string;
  windowStart?: Date;
  windowEnd?: Date;
}): Promise<BriefMeCostAggregate> {
  const raw: JudgeCostAggregate = await aggregateJudgeCost(opts);

  // Cent-precision rule (AC-2): sum round4 of each row, then round2 for display.
  const totalUsd = round2(raw.rows.reduce((acc, row) => acc + round4(row.usdTotal), 0));

  return {
    rows: raw.rows,
    totalUsd,
    sources: raw.sources,
    isEmpty: raw.rows.length === 0
  };
}

// ---------------------------------------------------------------------------
// Rendering helper
// ---------------------------------------------------------------------------

/**
 * Render the `## Judge cost` Markdown section for brief-me output.
 * Returns an empty string when `agg.isEmpty` is true — callers should
 * skip the section heading in that case.
 *
 * Column layout: Pipeline | Provider | Model | Calls | $USD | Latency p50 | Tokens in/out | Cache hit %
 * No eval/gepa shadow columns — AC-3.
 */
export function renderBriefMeJudgeCostSection(agg: BriefMeCostAggregate): string {
  if (agg.isEmpty) return "";

  const lines: string[] = [];
  lines.push("## Judge cost (brief-me)");
  lines.push("");
  lines.push(
    "| Pipeline | Provider | Model | Calls | $USD | Latency p50 | Tokens in/out | Cache hit % |"
  );
  lines.push("| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |");

  for (const row of agg.rows) {
    const tokens =
      row.tokensIn !== undefined && row.tokensOut !== undefined
        ? `${row.tokensIn}/${row.tokensOut}`
        : "—";
    const cache = row.cacheHitRate !== undefined ? `${Math.round(row.cacheHitRate * 100)}%` : "—";
    lines.push(
      `| ${row.pipeline} | ${row.provider} | ${row.model} | ${row.calls} | ${round4(row.usdTotal).toFixed(4)} | ${row.latencyP50Ms}ms | ${tokens} | ${cache} |`
    );
  }

  lines.push(`| **TOTAL** | | | | **$${agg.totalUsd.toFixed(2)}** | | | |`);
  lines.push("");
  return lines.join("\n");
}
