/**
 * Loads and parses cost reports from .claude/artifacts/crew/cost/*.md.
 *
 * Reuses parsing helpers from scripts/lib/briefing/collect-cost-parser.ts
 * rather than duplicating regex logic.
 */
import fs from "node:fs/promises";
import path from "node:path";
import {
  parseFrontmatterBlock,
  parseModelMix,
  parseHeaderFields,
  parseTokenFields,
  parseDiagnosticFields,
  type ModelMixEntry
} from "../briefing/collect-cost-parser.ts";

export type { ModelMixEntry };

export class AggregateReportSkipped extends Error {
  readonly filePath: string;
  constructor(filePath: string) {
    super(`Aggregate cost report skipped (aggregate_all: true): ${filePath}`);
    this.name = "AggregateReportSkipped";
    this.filePath = filePath;
  }
}

export interface CostReport {
  sliceFilename: string;
  runId: string;
  featureId: string | null;
  runTitle: string;
  usd: number;
  durationMs: number;
  totalTokens: number;
  cacheHitPct: number;
  windowStart: string;
  windowEnd: string;
  createdAt: string;
  modelMix: ModelMixEntry[];
  toolUsage: Record<string, number>;
  subagentDispatches: number;
  cacheCreate1h: number;
  cacheRead: number;
  inputTokens: number;
  outputTokens: number;
  aggregateAll: boolean;
}

// ---------------------------------------------------------------------------
// runId extraction — leading timestamp from filename (e.g. 20260607T122544Z)
// ---------------------------------------------------------------------------

function extractRunId(filename: string): string {
  const m = path.basename(filename).match(/^(\d{8}T\d{6}Z)/);
  return m ? m[1]! : path.basename(filename, ".md");
}

// ---------------------------------------------------------------------------
// Tool usage parser (returns map of tool -> call count)
// ---------------------------------------------------------------------------

function parseToolUsageMap(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  const section = text.split(/^##\s+/m).find((s: string) => s.startsWith("Tool Usage"));
  if (!section) return out;
  for (const line of section.split(/\r?\n/)) {
    const m = line.match(/^-\s+(\S+):\s*([\d,]+)/);
    if (m) out[m[1]!] = Number(m[2]!.replace(/,/g, ""));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Cache-create-1h body parser
// ---------------------------------------------------------------------------

function parseCacheCreate1h(text: string): number {
  return Number(text.match(/^-\s+cache_create_1h:\s*([\d,]+)/m)?.[1]?.replace(/,/g, "") ?? 0);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load a single cost report. Throws AggregateReportSkipped for aggregate files.
 * Throws a plain Error for malformed files.
 */
export async function loadCostReport(absPath: string): Promise<CostReport> {
  const text = await fs.readFile(absPath, "utf8");
  const fm = parseFrontmatterBlock(text);
  const aggregateAll = String(fm["aggregate_all"] ?? "").toLowerCase() === "true";

  if (aggregateAll) {
    throw new AggregateReportSkipped(absPath);
  }

  const header = parseHeaderFields(text, fm);
  const tokens = parseTokenFields(text, fm);
  const diag = parseDiagnosticFields(text);
  const modelMix = parseModelMix(text);

  const runId = extractRunId(absPath);
  const runTitle = header.runTitle ?? runId;
  const featureId = fm["feature"] ?? null;

  if (!header.windowStart || !header.windowEnd) {
    throw new Error(`Missing window start/end in cost report: ${absPath}`);
  }

  return {
    sliceFilename: path.basename(absPath),
    runId,
    featureId: featureId ? canonicalFeatId(featureId) : null,
    runTitle,
    usd: header.usd ?? 0,
    durationMs: header.durationMs,
    totalTokens: tokens.totalTokens,
    cacheHitPct: tokens.cacheHitPct,
    windowStart: header.windowStart,
    windowEnd: header.windowEnd,
    createdAt: fm["created_at"] ?? header.windowEnd,
    modelMix,
    toolUsage: parseToolUsageMap(text),
    subagentDispatches: diag.subagentDispatches,
    cacheCreate1h: parseCacheCreate1h(text),
    cacheRead: tokens.cacheReadTokens,
    inputTokens: tokens.inputTokens,
    outputTokens: tokens.outputTokens,
    aggregateAll
  };
}

/**
 * Safe variant — returns null for aggregate files, re-throws other errors.
 */
export async function loadCostReportSafe(absPath: string): Promise<CostReport | null> {
  try {
    return await loadCostReport(absPath);
  } catch (err) {
    if (err instanceof AggregateReportSkipped) return null;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Feature / slice id derivation
// ---------------------------------------------------------------------------

function canonicalFeatId(raw: string): string {
  const m = raw.match(/FEAT-?(\d{3,})/i);
  return m ? `FEAT-${m[1]}` : raw;
}

export function derivedFeatureId(report: CostReport): string | null {
  if (report.featureId) return report.featureId;
  const m = report.runTitle.match(/FEAT-?(\d{3,})/i);
  return m ? `FEAT-${m[1]}` : null;
}

export function derivedSliceId(report: CostReport): string | null {
  const m = report.runTitle.match(/SLICE-?(\d{1,3})/i);
  return m ? `SLICE-${m[1]}` : null;
}
