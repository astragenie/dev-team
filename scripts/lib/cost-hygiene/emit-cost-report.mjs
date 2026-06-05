// Extracted from scripts/crew.mjs — maybeEmitCostReport.
// Auto-emits cost-report artifacts after write-final-synthesis.
// Non-fatal: returns null / { error } on failure so the synthesis result still surfaces.

/**
 * @param {{
 *   repoPath: string,
 *   title: string,
 *   startedAt: string,
 *   completedAt: string,
 *   outcome: Record<string, unknown>,
 *   feature: string | null,
 *   phase: string | null,
 *   writeArtifact: (repoPath: string, kind: string, fields: Record<string, unknown>) => Promise<unknown>,
 *   computeSessionCost: (repoPath: string, opts: Record<string, unknown>) => Promise<Record<string, unknown>>
 * }} opts
 * @returns {Promise<unknown>}
 */
async function maybeEmitAggregateCost(opts) {
  const { repoPath, title, startedAt, completedAt, outcome, feature, phase, writeArtifact, computeSessionCost } = opts;
  const aggregateCost = await computeSessionCost(repoPath, {
    startedAt,
    completedAt,
    aggregateAll: true
  });
  const sources = /** @type {unknown[] | undefined} */ (aggregateCost.sources);
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

/**
 * @param {string} repoPath
 * @param {string | null} runTitle
 * @param {string | null} feature
 * @param {string | null} phase
 * @param {(repoPath: string, opts: { title: string | null, feature: string | null, phase: string | null }) => Promise<unknown>} emitCostAdviseFn
 * @returns {Promise<Record<string, unknown>>}
 */
async function emitCostReportInner(repoPath, runTitle, feature, phase, emitCostAdviseFn) {
  const { loadWorkflowState } = await import("../workflow-state.mjs");
  const { computeSessionCost } = await import("../session-cost.mjs");
  const { collectOutcomeLinkage } = await import("../outcome-linkage.mjs");
  const { writeArtifact } = await import("../artifacts.mjs");
  const state = await loadWorkflowState(repoPath);
  const run = state?.currentRun || null;
  if (!run?.startedAt) return null;
  const completedAt = run.completedAt || new Date().toISOString();
  const title = runTitle || run.title || "cost-report";
  const outcome = await collectOutcomeLinkage(repoPath, title);
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
    feature,
    phase
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
 *
 * @param {string} repoPath
 * @param {{ runTitle?: string | null, feature?: string | null, phase?: string | null }} [options]
 * @param {(repoPath: string, opts: { title: string | null, feature: string | null, phase: string | null }) => Promise<unknown>} [emitCostAdviseFn]
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function maybeEmitCostReport(repoPath, options = {}, emitCostAdviseFn = async () => null) {
  const { runTitle, feature, phase } =
    /** @type {{ runTitle?: string | null, feature?: string | null, phase?: string | null }} */ (
      options
    );
  try {
    return await emitCostReportInner(
      repoPath,
      runTitle || null,
      feature || null,
      phase || null,
      emitCostAdviseFn
    );
  } catch (err) {
    return { error: /** @type {Error} */ (err).message };
  }
}
