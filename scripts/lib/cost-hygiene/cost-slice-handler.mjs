// Extracted from scripts/crew.mjs — "cost-slice" command handler body.
// Kept in cost-hygiene/ because it emits per-slice and aggregate cost artifacts.

/**
 * @param {{
 *   repoPath: string,
 *   startedAt: string,
 *   completedAt: string | null,
 *   runTitle: string,
 *   outcome: Record<string, unknown>,
 *   feature: string | null,
 *   phase: string | null,
 *   notes: string | null,
 *   sourceProject: string | null | undefined,
 *   writeArtifact: (repoPath: string, kind: string, fields: Record<string, unknown>) => Promise<Record<string, unknown>>,
 *   computeSessionCost: (repoPath: string, opts: Record<string, unknown>) => Promise<Record<string, unknown>>
 * }} opts
 * @returns {Promise<Record<string, unknown> | null>}
 */
async function maybeEmitAggregateSlice(opts) {
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
  const sources = /** @type {unknown[] | undefined} */ (aggregateCost.sources);
  if (!sources || sources.length <= 1) return null;
  const artifact = /** @type {Record<string, unknown>} */ (
    await writeArtifact(repoPath, "cost-report-aggregate", {
      title: runTitle,
      runTitle,
      cost: aggregateCost,
      outcome,
      notes,
      feature,
      phase
    })
  );
  artifact.cost = aggregateCost;
  artifact.outcome = outcome;
  return artifact;
}

/**
 * @typedef {{ repoPath: string, flags: Record<string, unknown> }} CostSliceContext
 */

/**
 * @param {Record<string, unknown>} flags
 * @param {{ startedAt?: string, completedAt?: string | null, title?: string } | null} run
 */
function resolveCostSliceParams(flags, run) {
  return {
    startedAt: /** @type {string | undefined} */ (flags.startedAt) || run?.startedAt,
    completedAt: /** @type {string | null} */ (flags.completedAt) || run?.completedAt || null,
    runTitle:
      /** @type {string | undefined} */ (flags.runTitle) ||
      /** @type {string | undefined} */ (flags.title) ||
      run?.title ||
      "manual-cost-slice",
    notes: /** @type {string | null} */ (flags.summary) || null,
    feature: /** @type {string | null | undefined} */ (flags.feature),
    phase: /** @type {string | null | undefined} */ (flags.phase),
    sourceProject: /** @type {string | null | undefined} */ (flags.sourceProject)
  };
}

/**
 * Handler for the "cost-slice" CLI command.
 *
 * @param {CostSliceContext} ctx
 * @returns {Promise<Record<string, unknown>>}
 */
export async function costSliceHandler({ repoPath, flags }) {
  const { loadWorkflowState } = await import("../workflow-state.mjs");
  const { computeSessionCost } = await import("../session-cost.mjs");
  const { collectOutcomeLinkage } = await import("../outcome-linkage.mjs");
  const { writeArtifact } = await import("../artifacts.mjs");
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
  const outcome = await collectOutcomeLinkage(repoPath, runTitle);
  const sliceArtifact = /** @type {Record<string, unknown>} */ (
    await writeArtifact(repoPath, "cost-report-slice", {
      title: runTitle,
      runTitle,
      cost: sliceCost,
      outcome,
      notes,
      feature,
      phase
    })
  );
  sliceArtifact.cost = sliceCost;
  sliceArtifact.outcome = outcome;

  if (flags.aggregateAll !== true) {
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
