import fs from "node:fs/promises";
import path from "node:path";
import { buildCostAdvisor } from "../cost-advisor.ts";
import {
  parseCostReportText,
  dedupeForRollup,
  aggregateRoleDispatches
} from "./collect-cost-parser.ts";
import type { CostReport } from "./collect-cost-parser.ts";
import { pathExists } from "../fs-utils.ts";

// ---------------------------------------------------------------------------
// Exported interfaces
// ---------------------------------------------------------------------------

export interface CostHealthResult {
  grade: string;
  topConcern: string | null;
  reportCount: number;
}

export interface ModelCompliance {
  sonnetPct: number;
  compliant: boolean;
  sliceCount: number;
}

interface ModelBurnEntry {
  model: string;
  slices: number;
  messages: number;
  usd: number;
}

interface RecentCostsResult {
  recent: CostReport[];
  totalReports: number;
  dedupedCount: number;
  sumUsdRecent?: number;
  avgUsdRecent?: number;
  modelBurn?: ModelBurnEntry[];
  roleDispatches: Record<string, number>;
  diagnostics?: CostReport[];
}

const SEVERITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

async function statFiles(files: string[]): Promise<Array<{ f: string; mtime: number }>> {
  const results = await Promise.all(
    files.map(async (f) => {
      try {
        const s = await fs.stat(f);
        return { f, mtime: s.mtimeMs };
      } catch {
        return null;
      }
    })
  );
  return results.filter((s): s is { f: string; mtime: number } => s !== null);
}

async function listCostReportFilesByMtime(
  dirs: string | string[],
  limit: number
): Promise<string[]> {
  const dirList = Array.isArray(dirs) ? dirs : [dirs];
  const perDirFiles = await Promise.all(
    dirList.map(async (dir): Promise<string[]> => {
      if (!(await pathExists(dir))) return [];
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return [];
      }
      return entries
        .filter((e) => e.isFile() && /-cost-report-.+\.md$/.test(e.name))
        .map((e) => path.join(dir, e.name));
    })
  );
  const files = perDirFiles.flat();
  if (files.length === 0) return [];
  const stats = await statFiles(files);
  return stats
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit)
    .map((entry) => entry.f);
}

function computeModelBurn(rollupSet: CostReport[]): ModelBurnEntry[] {
  const modelBurnMap = new Map<string, ModelBurnEntry>();
  for (const r of rollupSet) {
    if (!Array.isArray(r.modelMix)) continue;
    for (const m of r.modelMix) {
      if (!modelBurnMap.has(m.model)) {
        modelBurnMap.set(m.model, { model: m.model, slices: 0, messages: 0, usd: 0 });
      }
      const agg = modelBurnMap.get(m.model)!;
      agg.slices += 1;
      agg.messages += m.messages || 0;
      agg.usd += m.usd || 0;
    }
  }
  return Array.from(modelBurnMap.values())
    .map((m) => ({ ...m, usd: Number(m.usd.toFixed(4)) }))
    .sort((a, b) => b.usd - a.usd);
}

// ---------------------------------------------------------------------------
// Exported collectors (with FEAT-129 Promise.all verbatim)
// ---------------------------------------------------------------------------

export async function collectRecentCosts(repoPath: string, limit = 5): Promise<RecentCostsResult> {
  const dirs = [
    path.join(repoPath, ".claude", "artifacts", "crew", "cost"),
    path.join(repoPath, ".claude", "artifacts", "crew", "runs") // legacy fallback
  ];
  const sorted = await listCostReportFilesByMtime(dirs, limit);
  if (sorted.length === 0)
    return {
      recent: [] as CostReport[],
      totalReports: 0,
      dedupedCount: 0,
      roleDispatches: {} as Record<string, number>
    };

  const results = await Promise.allSettled(
    sorted.map(async (filePath) => {
      const text = await fs.readFile(filePath, "utf8");
      return parseCostReportText(filePath, text);
    })
  );
  const recent = results
    .filter((r): r is PromiseFulfilledResult<CostReport> => r.status === "fulfilled")
    .map((r) => r.value);

  // Deduplicate overlapping windows before computing rollup sums.
  // recent[] is kept whole for per-row table rendering.
  const rollupSet = dedupeForRollup(recent);
  const dedupedCount = rollupSet.length;

  let totalUsd = 0;
  for (const r of rollupSet) {
    if (r.usd != null) totalUsd += r.usd;
  }

  const avgUsd = dedupedCount ? Number((totalUsd / dedupedCount).toFixed(4)) : 0;
  const modelBurn = computeModelBurn(rollupSet);

  return {
    recent,
    totalReports: sorted.length,
    dedupedCount,
    sumUsdRecent: Number(totalUsd.toFixed(4)),
    avgUsdRecent: avgUsd,
    modelBurn,
    roleDispatches: aggregateRoleDispatches(rollupSet),
    diagnostics: recent.filter((r) => r.hasFlags)
  };
}

export async function collectCostHealth(repoPath: string): Promise<CostHealthResult | null> {
  let advisor;
  try {
    advisor = await buildCostAdvisor(repoPath, {
      limit: 5,
      nameFilter: (name: string) => /-cost-report-slice-/.test(name)
    });
    if (!advisor.target) {
      advisor = await buildCostAdvisor(repoPath, { limit: 5 });
    }
  } catch {
    return null;
  }
  if (!advisor.target) {
    return null;
  }

  const { grade, recommendations = [], reports = [] } = advisor;
  const sorted = [...(recommendations as Array<{ severity: string; message: string }>)].sort(
    (a, b) => (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3)
  );
  const topConcern = sorted.length > 0 ? (sorted[0]?.message ?? null) : null;

  return {
    grade: grade as string,
    topConcern,
    reportCount: (reports as unknown[]).length
  };
}

export async function collectCostAggregate(repoPath: string): Promise<CostHealthResult | null> {
  let advisor;
  try {
    advisor = await buildCostAdvisor(repoPath, {
      limit: 5,
      nameFilter: (name: string) => /-cost-report-aggregate-/.test(name)
    });
  } catch {
    return null;
  }
  if (!advisor.target) {
    return null;
  }

  const { grade, recommendations = [], reports = [] } = advisor;
  const sorted = [...(recommendations as Array<{ severity: string; message: string }>)].sort(
    (a, b) => (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3)
  );
  const topConcern = sorted.length > 0 ? (sorted[0]?.message ?? null) : null;

  return {
    grade: grade as string,
    topConcern,
    reportCount: (reports as unknown[]).length
  };
}

export function computeModelCompliance(
  reports: Array<{ modelMix?: Array<{ model: string; usdPct: number }> | null }>
): ModelCompliance | null {
  const valid = reports.filter((r) => Array.isArray(r.modelMix) && (r.modelMix?.length ?? 0) > 0);
  if (valid.length === 0) return null;
  const sonnetSlicePcts = valid.map((r) => {
    const entry = (r.modelMix as Array<{ model: string; usdPct: number }>).find((m) =>
      /sonnet/i.test(m.model)
    );
    return entry ? entry.usdPct : 0;
  });
  const sonnetPct = sonnetSlicePcts.reduce((a, b) => a + b, 0) / sonnetSlicePcts.length;
  return {
    sonnetPct: Math.round(sonnetPct * 10) / 10,
    compliant: sonnetPct >= 60,
    sliceCount: valid.length
  };
}

export async function collectModelCompliance(repoPath: string): Promise<ModelCompliance | null> {
  const costs = await collectRecentCosts(repoPath, 5);
  return computeModelCompliance(costs.recent);
}
