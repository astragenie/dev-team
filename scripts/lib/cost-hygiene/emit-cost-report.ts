// Extracted from scripts/crew.mjs — maybeEmitCostReport.
// Auto-emits cost-report artifacts after write-final-synthesis.
// Non-fatal: returns null / { error } on failure so the synthesis result still surfaces.

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
  const sliceCost = await computeSessionCost(repoPath, {
    startedAt: run.startedAt,
    completedAt,
    aggregateAll: false
  });
  const sliceArtifact = await writeArtifact(repoPath, "cost-report-slice", {
    title,
    runTitle: title,
    cost: sliceCost,
    outcome,
    ...(feature != null ? { feature } : {}),
    ...(phase != null ? { phase } : {})
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
