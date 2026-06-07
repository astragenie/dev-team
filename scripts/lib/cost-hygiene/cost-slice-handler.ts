// Extracted from scripts/crew.mjs — "cost-slice" command handler body.
// Kept in cost-hygiene/ because it emits per-slice and aggregate cost artifacts.

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
 * Handler for the "cost-slice" CLI command.
 */
export async function costSliceHandler({
  repoPath,
  flags
}: CostSliceContext): Promise<Record<string, unknown>> {
  const { loadWorkflowState } = await import("../workflow-state.ts");
  const { computeSessionCost: computeCost } = await import("../session-cost.mjs");
  const { collectOutcomeLinkage } = await import("../outcome-linkage.mjs");
  const { writeArtifact: writeArt } = await import("../artifacts.mjs");
  // Cast to permissive signatures to avoid cross-.mjs JSDoc type mismatches.
  const computeSessionCost = computeCost as (
    repoPath: string,
    opts: Record<string, unknown>
  ) => Promise<Record<string, unknown>>;
  const writeArtifact = writeArt as (
    repoPath: string,
    kind: string,
    fields: Record<string, unknown>
  ) => Promise<Record<string, unknown>>;
  const state = await loadWorkflowState(repoPath);
  const run = state?.currentRun || null;
  const { startedAt, completedAt, runTitle, notes, feature, phase, sourceProject } =
    resolveCostSliceParams(flags, run);
  if (!startedAt) {
    throw new Error("cost-slice requires --started-at or an active/last run with startedAt");
  }
  const sliceCost = await computeSessionCost(repoPath, {
    startedAt,
    completedAt,
    sourceProject,
    aggregateAll: false
  });
  const outcome = (await collectOutcomeLinkage(repoPath, runTitle)) as Record<string, unknown>;
  const sliceArtifact = await writeArtifact(repoPath, "cost-report-slice", {
    title: runTitle,
    runTitle,
    cost: sliceCost,
    outcome,
    notes,
    feature,
    phase
  });
  sliceArtifact["cost"] = sliceCost;
  sliceArtifact["outcome"] = outcome;

  if (flags["aggregateAll"] !== true) {
    return sliceArtifact;
  }

  const aggregateArtifact = await maybeEmitAggregateSlice({
    repoPath,
    startedAt,
    completedAt,
    runTitle,
    outcome,
    feature: feature || null,
    phase: phase || null,
    notes: notes || null,
    sourceProject,
    writeArtifact,
    computeSessionCost
  });

  return aggregateArtifact ? { slice: sliceArtifact, aggregate: aggregateArtifact } : sliceArtifact;
}
