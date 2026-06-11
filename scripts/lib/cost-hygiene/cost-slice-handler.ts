// Extracted from scripts/crew.mjs — "cost-slice" command handler body.
// Kept in cost-hygiene/ because it emits per-slice and aggregate cost artifacts.
import path from "node:path";
import {
  aggregateDispatchTiming,
  aggregateBashGates,
  getLatestRunId
} from "../dispatch-timing-reader.ts";
import type { DispatchBreakdown } from "../artifacts/types.ts";

interface MaybeEmitAggregateSliceOpts {
  repoPath: string;
  startedAt: string;
  completedAt: string | null;
  runTitle: string;
  outcome: Record<string, unknown>;
  feature: string | null;
  phase: string | null;
  notes: string | null;
  sourceProject: string | null | undefined;
  writeArtifact: (
    repoPath: string,
    kind: string,
    fields: Record<string, unknown>
  ) => Promise<Record<string, unknown>>;
  computeSessionCost: (
    repoPath: string,
    opts: Record<string, unknown>
  ) => Promise<Record<string, unknown>>;
}

async function maybeEmitAggregateSlice(
  opts: MaybeEmitAggregateSliceOpts
): Promise<Record<string, unknown> | null> {
  const {
    repoPath,
    startedAt,
    completedAt,
    runTitle,
    outcome,
    feature,
    phase,
    notes,
    sourceProject,
    writeArtifact,
    computeSessionCost
  } = opts;
  const aggregateCost = await computeSessionCost(repoPath, {
    startedAt,
    completedAt,
    sourceProject,
    aggregateAll: true
  });
  const sources = aggregateCost["sources"] as unknown[] | undefined;
  if (!sources || sources.length <= 1) return null;
  const artifact = await writeArtifact(repoPath, "cost-report-aggregate", {
    title: runTitle,
    runTitle,
    cost: aggregateCost,
    outcome,
    notes,
    feature,
    phase
  });
  artifact["cost"] = aggregateCost as unknown;
  artifact["outcome"] = outcome as unknown;
  return artifact;
}

export interface CostSliceContext {
  repoPath: string;
  flags: Record<string, unknown>;
}

interface CostSliceParams {
  startedAt: string | undefined;
  completedAt: string | null;
  runTitle: string;
  notes: string | null;
  feature: string | null | undefined;
  phase: string | null | undefined;
  sourceProject: string | null | undefined;
}

function resolveCostSliceParams(
  flags: Record<string, unknown>,
  run: { startedAt?: string; completedAt?: string | null; title?: string } | null
): CostSliceParams {
  return {
    startedAt: (flags["startedAt"] as string | undefined) || run?.startedAt,
    completedAt: (flags["completedAt"] as string | null) || run?.completedAt || null,
    runTitle:
      (flags["runTitle"] as string | undefined) ||
      (flags["title"] as string | undefined) ||
      run?.title ||
      "manual-cost-slice",
    notes: (flags["summary"] as string | null) || null,
    feature: flags["feature"] as string | null | undefined,
    phase: flags["phase"] as string | null | undefined,
    sourceProject: flags["sourceProject"] as string | null | undefined
  };
}

/**
 * Collect dispatch + bash-gate telemetry for the cost-report breakdown section (FEAT-151).
 * Non-fatal: returns undefined on any error so the rest of the report still renders.
 * Gated by CREW_COST_REPORT_DISPATCH_DETAIL env (set to "0" to suppress).
 */
async function collectDispatchBreakdown(
  repoPath: string,
  runId: string | undefined
): Promise<DispatchBreakdown | undefined> {
  if (process.env["CREW_COST_REPORT_DISPATCH_DETAIL"] === "0") return undefined;
  try {
    const pluginRoot = process.env["CLAUDE_PLUGIN_ROOT"] ?? repoPath;
    const dispatchLog =
      process.env["CREW_DISPATCH_TIMING_LOG"] ??
      path.join(pluginRoot, ".claude", "logs", "dispatch-timing.jsonl");
    const bashLog =
      process.env["CREW_BASH_GATE_LOG"] ??
      path.join(pluginRoot, ".claude", "logs", "bash-gates.jsonl");
    // Fall back to scanning the log for the most recent runId when not provided
    const resolvedRunId = runId ?? (await getLatestRunId(dispatchLog));
    const [dispatch, gates] = await Promise.all([
      resolvedRunId
        ? aggregateDispatchTiming(dispatchLog, resolvedRunId)
        : Promise.resolve({ rowCount: 0, totalWallMs: 0, topSlow: [], topTokens: [] }),
      aggregateBashGates(bashLog)
    ]);
    // Suppress if both sources are empty (nothing interesting to show)
    if (dispatch.rowCount === 0 && gates.rowCount === 0) return undefined;
    return { dispatch, gates };
  } catch {
    return undefined;
  }
}

/**
 * Handler for the "cost-slice" CLI command.
 */
export async function costSliceHandler({
  repoPath,
  flags
}: CostSliceContext): Promise<Record<string, unknown>> {
  const { loadWorkflowState } = await import("../workflow-state.ts");
  const { computeSessionCost: computeCost } = await import("../session-cost.ts");
  const { collectOutcomeLinkage } = await import("../outcome-linkage.ts");
  const { writeArtifact: writeArt } = await import("../artifacts/write.ts");
  // Cast to permissive signatures to avoid cross-.mjs JSDoc type mismatches.
  const computeSessionCost = computeCost as (
    repoPath: string,
    opts: Record<string, unknown>
  ) => Promise<Record<string, unknown>>;
  const state = await loadWorkflowState(repoPath);
  const run = state?.currentRun || null;
  const { startedAt, completedAt, runTitle, notes, feature, phase, sourceProject } =
    resolveCostSliceParams(flags, run);
  if (!startedAt) {
    throw new Error("cost-slice requires --started-at or an active/last run with startedAt");
  }
  const [sliceCost, dispatchBreakdown] = await Promise.all([
    computeSessionCost(repoPath, {
      startedAt,
      completedAt,
      sourceProject,
      aggregateAll: false
    }),
    collectDispatchBreakdown(
      repoPath,
      (run as Record<string, unknown> | null)?.["runId"] as string | undefined
    )
  ]);
  const outcome = (await collectOutcomeLinkage(repoPath, runTitle)) as unknown as Record<
    string,
    unknown
  >;
  const writeResult = await writeArt(repoPath, "cost-report-slice", {
    title: runTitle,
    runTitle,
    cost: sliceCost,
    outcome,
    ...(notes != null ? { notes } : {}),
    ...(feature != null ? { feature } : {}),
    ...(phase != null ? { phase } : {}),
    ...(dispatchBreakdown != null ? { dispatchBreakdown } : {})
  });
  if (!writeResult.ok) throw writeResult.error;
  const sliceArtifact: Record<string, unknown> = { ...writeResult.value };
  sliceArtifact["cost"] = sliceCost;
  sliceArtifact["outcome"] = outcome;

  if (flags["aggregateAll"] !== true) {
    return sliceArtifact;
  }

  const writeArtifact = async (
    rp: string,
    kind: string,
    fields: Record<string, unknown>
  ): Promise<Record<string, unknown>> => {
    const r = await writeArt(rp, kind, fields as import("../artifacts/write.ts").ArtifactFields);
    if (!r.ok) throw r.error;
    return r.value as unknown as Record<string, unknown>;
  };

  const aggregateArtifact = await maybeEmitAggregateSlice({
    repoPath,
    startedAt,
    completedAt,
    runTitle,
    outcome,
    feature: feature ?? null,
    phase: phase ?? null,
    notes: notes ?? null,
    sourceProject,
    writeArtifact,
    computeSessionCost
  });

  return aggregateArtifact ? { slice: sliceArtifact, aggregate: aggregateArtifact } : sliceArtifact;
}
