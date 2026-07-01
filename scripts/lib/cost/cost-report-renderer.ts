/**
 * scripts/lib/cost/cost-report-renderer.ts
 *
 * SLICE-112 (FEAT-186 S3) — unified per-slice cost-report renderer.
 *
 * `renderCostReport(entries)` produces a markdown table with one row per
 * (pipeline, provider) tuple and a totals row at the bottom.
 *
 * Backward-compat contract:
 *   - `tokens` and `cache` are OPTIONAL on CostEntry (mirroring JudgeCost
 *     from gepa-core 0.4.0+). Pre-186 callers that lack these fields produce
 *     valid single-row tables — no crash, no `undefined` cells.
 *   - Totals row sums `usd` and `latency_ms`; `tokens` and `cache` columns
 *     show `-` in the totals row if ANY row is missing them (AC-1).
 *   - An empty entries array renders a table with no data rows and a totals
 *     row of all zeros / `-`.
 *
 * AC-6: imports `JudgeCost` type from `@astragenie/gepa-core` (^0.5.0).
 */

import type { JudgeCost } from "@astragenie/gepa-core";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * One cost entry contributed by a single (pipeline, provider) tuple.
 *
 * Extends `JudgeCost` with the two routing dimensions (`pipeline`,
 * `provider`) so the renderer can group and label rows without separate
 * lookup tables.
 *
 * Pre-186 callers that only have session-level cost data pass a single entry
 * with `pipeline: "eval"` (or similar) and omit `tokens` / `cache`.
 */
export interface CostEntry extends JudgeCost {
  /** Logical pipeline that incurred this cost (e.g. "eval", "gepa"). */
  pipeline: string;
  /**
   * LLM provider identifier (e.g. "anthropic", "groq", "ollama").
   * Matches the `provider` field surfaced by `LLMJudge.describe()`.
   */
  provider: string;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** Format a USD number as a fixed-4 string without the dollar sign. */
function fmtUsd(usd: number): string {
  return usd.toFixed(4);
}

/** Format latency to integer ms. */
function fmtLatency(ms: number): string {
  return Math.round(ms).toString();
}

/** Format optional token counts as "in/out" or "-". */
function fmtTokens(tokens: JudgeCost["tokens"]): string {
  if (tokens === undefined) return "-";
  return `${tokens.in}/${tokens.out}`;
}

/** Format optional cache outcome as "hit" | "miss" (with tokens_saved when present). */
function fmtCache(cache: JudgeCost["cache"]): string {
  if (cache === undefined) return "-";
  if (!cache.hit) return "miss";
  const saved = cache.tokens_saved !== undefined ? ` (${cache.tokens_saved} saved)` : "";
  return `hit${saved}`;
}

/** Build one body row for the markdown table. */
function buildDataRow(entry: CostEntry): string {
  const cols = [
    entry.pipeline,
    entry.provider,
    fmtUsd(entry.usd),
    fmtLatency(entry.latency_ms),
    fmtTokens(entry.tokens),
    fmtCache(entry.cache)
  ];
  return `| ${cols.join(" | ")} |`;
}

/** Build the totals row. Sums usd + latency_ms; shows `-` for tokens/cache if any row lacks them. */
function buildTotalsRow(entries: CostEntry[]): string {
  const totalUsd = entries.reduce((acc, e) => acc + e.usd, 0);
  const totalLatency = entries.reduce((acc, e) => acc + e.latency_ms, 0);

  const anyMissingTokens = entries.some((e) => e.tokens === undefined);
  const anyMissingCache = entries.some((e) => e.cache === undefined);

  const tokensTotalStr = anyMissingTokens ? "-" : buildTokensTotal(entries);
  const cacheTotalStr = anyMissingCache ? "-" : buildCacheTotal(entries);

  const cols = [
    "**totals**",
    "",
    `**${fmtUsd(totalUsd)}**`,
    `**${fmtLatency(totalLatency)}**`,
    tokensTotalStr,
    cacheTotalStr
  ];
  return `| ${cols.join(" | ")} |`;
}

/**
 * Sum token counts across all entries when all are present.
 * Called only when `anyMissingTokens` is false.
 */
function buildTokensTotal(entries: CostEntry[]): string {
  let totalIn = 0;
  let totalOut = 0;
  for (const e of entries) {
    // Safe: called only when none are undefined.
    totalIn += e.tokens!.in;
    totalOut += e.tokens!.out;
  }
  return `${totalIn}/${totalOut}`;
}

/**
 * Summarise cache outcomes when all entries have cache data.
 * Shows "N hit / M miss" aggregate.
 * Called only when `anyMissingCache` is false.
 */
function buildCacheTotal(entries: CostEntry[]): string {
  let hits = 0;
  let misses = 0;
  for (const e of entries) {
    // Safe: called only when none are undefined.
    if (e.cache!.hit) {
      hits++;
    } else {
      misses++;
    }
  }
  return `${hits} hit / ${misses} miss`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Header row of the unified cost table. */
const TABLE_HEADER = "| pipeline | provider | usd | latency_ms | tokens (in/out) | cache |";

/** Separator row. */
const TABLE_SEP = "| --- | --- | --- | --- | --- | --- |";

/**
 * Render a unified cost-report markdown table from an array of `CostEntry`
 * records.
 *
 * - Each `CostEntry` maps to exactly one data row `(pipeline, provider)`.
 * - The totals row is always emitted, even for empty or single-entry arrays.
 * - `tokens` and `cache` columns show `-` if any entry omits them.
 *
 * @param entries  Cost entries, typically one per pipeline/provider pair.
 * @returns        Multi-line markdown string containing the table.
 */
export function renderCostReport(entries: CostEntry[]): string {
  const dataRows = entries.map(buildDataRow);
  const totalsRow = buildTotalsRow(entries);

  return [TABLE_HEADER, TABLE_SEP, ...dataRows, totalsRow].join("\n");
}
