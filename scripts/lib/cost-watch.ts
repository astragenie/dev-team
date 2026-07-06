// cost-watch.ts — FEAT-194 S4: operator burn-watch. Read-only over existing
// cost telemetry — no new event pipeline. Reads:
//   - .claude/logs/dispatch-timing.jsonl (FEAT-149): per-dispatch agent +
//     model + tokenIn/tokenOut, via readRecentDispatchRows.
//   - .claude/artifacts/crew/cost/*-cost-report-*.md (cost-hygiene): per-slice
//     usd + total_tokens + cache_hit_pct, via the existing brief-me reader
//     (collectRecentCosts / parseCostReportText).
//   - .claude/loop.json loop.cost.ceilingUsd: advisory rolling-USD threshold.
//
// Known data gaps (see renderCostWatchReport's "Data-gap notes" section):
//   1. Per-dispatch `model` is the agent's frontmatter-pinned model at
//      Agent-dispatch time (hooks/lib/dispatch-timing-pre-tap.ts:lookupAgentModel),
//      which FEAT-194 S3 documents as advisory, not a runtime guarantee — it
//      is NOT necessarily the model the router actually resolved.
//   2. Per-dispatch cache-hit % is not captured anywhere. Cache-hit is only
//      available at slice/session granularity via cost-report-slice artifacts.
import fs from "node:fs/promises";
import path from "node:path";
import { readRecentDispatchRows, type DispatchRow } from "./dispatch-timing-reader.ts";
import { collectRecentCosts } from "./briefing/cost.ts";
import type { CostReport } from "./briefing/collect-cost-parser.ts";

/** Per-dispatch token cap default, per docs/research/2026-07-06-token-burn-patch-plan.md (P2-1). */
export const DEFAULT_PER_DISPATCH_TOKEN_CAP = 150_000;

export interface DispatchBurnRow {
  runId: string;
  sliceId: string | undefined;
  agent: string;
  model: string;
  tokenIn: number;
  tokenOut: number;
  totalTokens: number;
  wallMs: number;
  flagged: boolean;
}

export interface DispatchBurnSummary {
  rows: DispatchBurnRow[];
  rollingTotalTokens: number;
  perDispatchTokenCap: number;
  flaggedCount: number;
}

/** Pure — no I/O. Summarizes a window of dispatch-timing rows for the burn-watch. */
export function summarizeDispatchBurn(
  rows: DispatchRow[],
  perDispatchTokenCap: number = DEFAULT_PER_DISPATCH_TOKEN_CAP
): DispatchBurnSummary {
  let rollingTotalTokens = 0;
  let flaggedCount = 0;
  const out: DispatchBurnRow[] = rows.map((r) => {
    const totalTokens = (r.tokenIn ?? 0) + (r.tokenOut ?? 0);
    rollingTotalTokens += totalTokens;
    const flagged = totalTokens > perDispatchTokenCap;
    if (flagged) flaggedCount += 1;
    return {
      runId: r.runId,
      sliceId: r.sliceId,
      agent: r.agent,
      model: r.model ?? "unknown",
      tokenIn: r.tokenIn ?? 0,
      tokenOut: r.tokenOut ?? 0,
      totalTokens,
      wallMs: r.wallMs ?? 0,
      flagged
    };
  });
  return { rows: out, rollingTotalTokens, perDispatchTokenCap, flaggedCount };
}

export interface SliceBurnSummary {
  reports: CostReport[];
  /** `.path` of each report whose own usd exceeds ceilingUsd — used for the per-row flag. */
  flaggedPaths: Set<string>;
  rollingUsd: number;
  ceilingUsd: number | null;
  ceilingExceeded: boolean;
}

/**
 * Pure — no I/O. `rollingUsd` is supplied by the caller (the deduped rollup
 * from collectRecentCosts) rather than re-summed here, so this never
 * double-counts overlapping slice/aggregate cost-report windows. `rollingUsd`
 * is informational context only — `ceilingUsd` (loop.cost.ceilingUsd) is a
 * PER-SLICE budget, so the flag fires per-report (any single report whose own
 * usd exceeds the ceiling), not against the multi-slice rolling sum — summing
 * an N-slice window against a 1-slice ceiling would trip on nearly every
 * non-trivial window and make the flag useless noise. Flagged by `.path`
 * (not runTitle) since a slice + aggregate report can share the same title.
 */
export function summarizeSliceBurn(
  reports: CostReport[],
  rollingUsd: number,
  ceilingUsd: number | null
): SliceBurnSummary {
  const flaggedPaths = new Set<string>();
  if (ceilingUsd != null) {
    for (const r of reports) {
      if ((r.usd ?? 0) > ceilingUsd) flaggedPaths.add(r.path);
    }
  }
  return {
    reports,
    flaggedPaths,
    rollingUsd: Number(rollingUsd.toFixed(4)),
    ceilingUsd,
    ceilingExceeded: flaggedPaths.size > 0
  };
}

/** Reads loop.cost.ceilingUsd from .claude/loop.json. Returns null on any miss/error. */
export async function readLoopCostCeiling(repoPath: string): Promise<number | null> {
  try {
    const raw = await fs.readFile(path.join(repoPath, ".claude", "loop.json"), "utf8");
    const parsed = JSON.parse(raw) as { loop?: { cost?: { ceilingUsd?: unknown } } };
    const v = parsed.loop?.cost?.ceilingUsd;
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

export interface CostWatchData {
  dispatch: DispatchBurnSummary;
  slice: SliceBurnSummary;
}

export interface CostWatchOptions {
  /** Number of most-recent dispatches / cost-reports to include. Default 10. */
  limit?: number;
  perDispatchTokenCap?: number;
  /** Override the dispatch-timing.jsonl path (tests / non-default log location). */
  dispatchTimingLogPath?: string;
}

/**
 * Orchestrates the read: dispatch-timing.jsonl (per-dispatch) + cost-report
 * artifacts (per-slice) + loop.json ceiling, then summarizes both windows.
 * Pure-additive read — writes nothing.
 */
export async function buildCostWatch(
  repoPath: string,
  options: CostWatchOptions = {}
): Promise<CostWatchData> {
  const limit = options.limit ?? 10;
  const perDispatchTokenCap = options.perDispatchTokenCap ?? DEFAULT_PER_DISPATCH_TOKEN_CAP;
  const dispatchLogPath =
    options.dispatchTimingLogPath ??
    process.env["CREW_DISPATCH_TIMING_LOG"] ??
    path.join(
      process.env["CLAUDE_PLUGIN_ROOT"] ?? repoPath,
      ".claude",
      "logs",
      "dispatch-timing.jsonl"
    );

  const [dispatchRows, costResult, ceilingUsd] = await Promise.all([
    readRecentDispatchRows(dispatchLogPath, limit),
    collectRecentCosts(repoPath, limit),
    readLoopCostCeiling(repoPath)
  ]);

  return {
    dispatch: summarizeDispatchBurn(dispatchRows, perDispatchTokenCap),
    slice: summarizeSliceBurn(costResult.recent, costResult.sumUsdRecent ?? 0, ceilingUsd)
  };
}

function renderDispatchSection(dispatch: DispatchBurnSummary): string[] {
  const lines: string[] = [
    `## Recent dispatches (${dispatch.rows.length}, token cap ${dispatch.perDispatchTokenCap.toLocaleString()})`,
    ""
  ];
  if (dispatch.rows.length === 0) {
    lines.push(
      "_(no dispatch-timing data — the PreToolUse Agent hook may be disabled, or no Agent-tool dispatches recorded yet)_",
      ""
    );
    return lines;
  }
  lines.push(
    "| Agent | Model | Tokens (in/out) | Total | wallMs | Flag |",
    "|-------|-------|-----------------|-------|--------|------|"
  );
  for (const r of dispatch.rows) {
    lines.push(
      `| ${r.agent} | ${r.model} | ${r.tokenIn.toLocaleString()}/${r.tokenOut.toLocaleString()} | ${r.totalTokens.toLocaleString()} | ${r.wallMs} | ${r.flagged ? "⚠ OVER CAP" : ""} |`
    );
  }
  lines.push("", `Rolling total (this window): ${dispatch.rollingTotalTokens.toLocaleString()} tokens`);
  if (dispatch.flaggedCount > 0) {
    lines.push(
      `⚠ ${dispatch.flaggedCount} dispatch(es) crossed the ${dispatch.perDispatchTokenCap.toLocaleString()}-token cap. Advisory only.`
    );
  }
  lines.push("");
  return lines;
}

function renderSliceSection(slice: SliceBurnSummary): string[] {
  const lines: string[] = [`## Recent slices (${slice.reports.length})`, ""];
  if (slice.reports.length === 0) {
    lines.push("_(no cost-report-slice artifacts found under .claude/artifacts/crew/cost/)_", "");
    return lines;
  }
  lines.push(
    "| Slice / Run | USD | Total tokens | Cache hit % | Flag |",
    "|-------------|-----|---------------|-------------|------|"
  );
  for (const r of slice.reports) {
    const flagged = slice.flaggedPaths.has(r.path);
    lines.push(
      `| ${r.runTitle ?? "-"} | $${(r.usd ?? 0).toFixed(4)} | ${r.totalTokens.toLocaleString()} | ${r.cacheHitPct}% | ${flagged ? "⚠ OVER CEILING" : ""} |`
    );
  }
  lines.push("", `Rolling USD (deduped window, informational): $${slice.rollingUsd.toFixed(4)}`);
  if (slice.ceilingUsd == null) {
    lines.push("_(no loop.cost.ceilingUsd configured in .claude/loop.json — no ceiling flag available)_");
  } else if (slice.ceilingExceeded) {
    lines.push(
      `⚠ ${slice.flaggedPaths.size} report(s) exceeded loop.cost.ceilingUsd ($${slice.ceilingUsd}) on their own. Advisory only — not a hard stop.`
    );
  } else {
    lines.push(`OK — no single report in this window exceeded loop.cost.ceilingUsd ($${slice.ceilingUsd}).`);
  }
  lines.push("");
  return lines;
}

/** Pure — renders the compact operator burn-watch report as Markdown-ish text. */
export function renderCostWatchReport(data: CostWatchData): string {
  const lines: string[] = ["Crew cost-watch — burn summary", ""];
  lines.push(...renderDispatchSection(data.dispatch));
  lines.push(...renderSliceSection(data.slice));
  lines.push(
    "## Data-gap notes",
    "",
    "- Per-dispatch `model` reflects the agent's frontmatter-pinned model at dispatch time (advisory per FEAT-194 S3), not a runtime-verified resolved model.",
    "- Per-dispatch cache-hit % is not captured anywhere; cache-hit is only available at slice/session granularity (cost-report-slice artifacts).",
    ""
  );
  return lines.join("\n");
}
