// Extracted from scripts/crew.mjs — maybeEmitCostReport.
// Auto-emits cost-report artifacts after write-final-synthesis.
// Non-fatal: returns null / { error } on failure so the synthesis result still surfaces.
import path from "node:path";
import {
  aggregateDispatchTiming,
  aggregateBashGates,
  getLatestRunId
} from "../dispatch-timing-reader.ts";
import type { DispatchBreakdown } from "../artifacts/types.ts";
import type { AgentStatsRow } from "../agent-stats-aggregator.ts";

async function collectAgentStatsForRun(repoPath: string): Promise<AgentStatsRow[] | undefined> {
  if (process.env["CREW_COST_REPORT_AGENT_STATS"] === "0") return undefined;
  try {
    const { aggregateAgentStats } = await import("../agent-stats-aggregator.ts");
    const n = Number.parseInt(process.env["CREW_AGENT_STATS_WINDOW"] ?? "10", 10);
    const rows = await aggregateAgentStats({
      repo: repoPath,
      window: { kind: "last_n_slices", n: Number.isFinite(n) && n > 0 ? n : 10 }
    });
    return rows.length > 0 ? rows : undefined;
  } catch {
    // Non-fatal — telemetry layer should never break cost-report emission.
    return undefined;
  }
}

async function collectDispatchBreakdownForRun(
  repoPath: string,
  runId: string | undefined
): Promise<DispatchBreakdown | undefined> {
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
    if (dispatch.rowCount === 0 && gates.rowCount === 0) return undefined;
    return { dispatch, gates };
  } catch {
    return undefined;
  }
}

interface MaybeEmitAggregateCostOpts {
  repoPath: string;
  title: string;
  startedAt: string;
  completedAt: string;
  outcome: Record<string, unknown>;
  feature: string | null;
  phase: string | null;
  writeArtifact: (
    repoPath: string,
    kind: string,
    fields: Record<string, unknown>
  ) => Promise<unknown>;
  computeSessionCost: (
    repoPath: string,
    opts: Record<string, unknown>
  ) => Promise<Record<string, unknown>>;
}

async function maybeEmitAggregateCost(opts: MaybeEmitAggregateCostOpts): Promise<unknown> {
  const {
    repoPath,
    title,
    startedAt,
    completedAt,
    outcome,
    feature,
    phase,
    writeArtifact,
    computeSessionCost
  } = opts;
  const aggregateCost = await computeSessionCost(repoPath, {
    startedAt,
    completedAt,
    aggregateAll: true
  });
  const sources = aggregateCost["sources"] as unknown[] | undefined;
  if (!sources || sources.length <= 1) return null;
  return writeArtifact(repoPath, "cost-report-aggregate", {
    title,
    runTitle: title,
    cost: aggregateCost,
    outcome,
    feature,
    phase
  });
}

async function emitCostReportInner(
  repoPath: string,
  runTitle: string | null,
  feature: string | null,
  phase: string | null,
  emitCostAdviseFn: (
    repoPath: string,
    opts: { title: string | null; feature: string | null; phase: string | null }
  ) => Promise<unknown>
): Promise<Record<string, unknown>> {
  const { loadWorkflowState } = await import("../workflow-state.ts");
  const { computeSessionCost: computeCost } = await import("../session-cost.ts");
  const { collectOutcomeLinkage } = await import("../outcome-linkage.ts");
  const { writeArtifact: writeArt } = await import("../artifacts/write.ts");
  const computeSessionCost = computeCost as (
    repoPath: string,
    opts: Record<string, unknown>
  ) => Promise<Record<string, unknown>>;
  const writeArtifact = async (
    rp: string,
    kind: string,
    fields: Record<string, unknown>
  ): Promise<Record<string, unknown>> => {
    const r = await writeArt(rp, kind, fields as import("../artifacts/write.ts").ArtifactFields);
    if (!r.ok) throw r.error;
    return r.value as unknown as Record<string, unknown>;
  };
  const state = await loadWorkflowState(repoPath);
  const run = state?.currentRun || null;
  if (!run?.startedAt) return null as unknown as Record<string, unknown>;
  const completedAt = run.completedAt || new Date().toISOString();
  const title = runTitle || run.title || "cost-report";
  const outcome = (await collectOutcomeLinkage(repoPath, title)) as unknown as Record<
    string,
    unknown
  >;
  const [sliceCost, dispatchBreakdown, agentStats] = await Promise.all([
    computeSessionCost(repoPath, {
      startedAt: run.startedAt,
      completedAt,
      aggregateAll: false
    }),
    collectDispatchBreakdownForRun(
      repoPath,
      (run as unknown as Record<string, unknown>)["runId"] as string | undefined
    ),
    collectAgentStatsForRun(repoPath)
  ]);
  const sliceArtifact = await writeArtifact(repoPath, "cost-report-slice", {
    title,
    runTitle: title,
    cost: sliceCost,
    outcome,
    ...(feature != null ? { feature } : {}),
    ...(phase != null ? { phase } : {}),
    ...(dispatchBreakdown != null ? { dispatchBreakdown } : {}),
    ...(agentStats != null ? { agentStats } : {})
  });
  const aggregateArtifact = await maybeEmitAggregateCost({
    repoPath,
    title,
    startedAt: run.startedAt,
    completedAt,
    outcome,
    feature,
    phase,
    writeArtifact,
    computeSessionCost
  });
  const adviseArtifact = await emitCostAdviseFn(repoPath, { title: runTitle, feature, phase });
  return { report: sliceArtifact, aggregate: aggregateArtifact, advise: adviseArtifact };
}

/**
 * Auto-emit a cost-report artifact when a run window is available.
 * Designed to be called immediately after write-final-synthesis.
 */
export async function maybeEmitCostReport(
  repoPath: string,
  options: { runTitle?: string | null; feature?: string | null; phase?: string | null } = {},
  emitCostAdviseFn: (
    repoPath: string,
    opts: { title: string | null; feature: string | null; phase: string | null }
  ) => Promise<unknown> = async () => null
): Promise<Record<string, unknown> | null> {
  const { runTitle, feature, phase } = options;
  try {
    return await emitCostReportInner(
      repoPath,
      runTitle || null,
      feature || null,
      phase || null,
      emitCostAdviseFn
    );
  } catch (err) {
    return { error: (err as Error).message };
  }
}
