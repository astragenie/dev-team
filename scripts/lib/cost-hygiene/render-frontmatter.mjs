// Extracted from scripts/lib/artifacts.mjs — renderCostReportFrontmatter.
// Kept in cost-hygiene/ because it formats cost-report YAML frontmatter.

function nowIso() {
  return new Date().toISOString();
}

/**
 * @param {import("../artifacts.mjs").CostBreakdown | undefined} breakdown
 * @param {boolean} isSlice
 * @returns {{ aggregateAllPredicate: boolean, aggregateAllLine: string, sourceCountPredicate: boolean, sourceCountLine: string }}
 */
function resolveVariantLines(breakdown, isSlice) {
  return {
    aggregateAllPredicate: isSlice ? true : Boolean(breakdown?.aggregateAll),
    aggregateAllLine: isSlice ? "aggregate_all: false" : "aggregate_all: true",
    sourceCountPredicate: isSlice ? true : Boolean(breakdown?.sources?.length),
    sourceCountLine: isSlice
      ? "source_count: 1"
      : `source_count: ${breakdown?.sources?.length ?? 0}`
  };
}

/**
 * @param {import("../artifacts.mjs").ArtifactFields} fields
 * @param {import("../artifacts.mjs").CostBreakdown | undefined} breakdown
 * @param {import("../artifacts.mjs").CostOutcome | null} outcome
 * @param {number} totalTokens
 * @param {number | string} cacheHitPct
 * @param {ReturnType<typeof resolveVariantLines>} variant
 */
function buildOptionalLines(fields, breakdown, outcome, totalTokens, cacheHitPct, variant) {
  const durationMs = breakdown?.window?.durationMs || 0;
  const { aggregateAllPredicate, aggregateAllLine, sourceCountPredicate, sourceCountLine } =
    variant;
  return /** @type {Array<[unknown, function(): string]>} */ ([
    [
      fields.phase != null && String(fields.phase).length > 0,
      () => `phase: ${JSON.stringify(String(fields.phase))}`
    ],
    [fields.feature, () => `feature: ${fields.feature}`],
    [outcome?.sliceId, () => `slice: ${outcome.sliceId}`],
    [true, () => `run_title: ${JSON.stringify(fields.runTitle || "")}`],
    [breakdown?.usd != null, () => `usd: ${breakdown.usd}`],
    [durationMs, () => `duration_ms: ${durationMs}`],
    [totalTokens, () => `total_tokens: ${totalTokens}`],
    [cacheHitPct !== "-", () => `cache_hit_pct: ${cacheHitPct}`],
    [outcome?.gradeAvg != null, () => `grade_avg: ${outcome.gradeAvg}`],
    [outcome?.reviewDecision, () => `review_decision: ${outcome.reviewDecision}`],
    [outcome?.validationDecision, () => `validation_decision: ${outcome.validationDecision}`],
    [breakdown?.sourceProject, () => `source_project: ${breakdown.sourceProject}`],
    [breakdown?.autoDetected, () => `auto_detected: true`],
    [aggregateAllPredicate, () => aggregateAllLine],
    [sourceCountPredicate, () => sourceCountLine]
  ]);
}

/**
 * @param {import("../artifacts.mjs").ArtifactFields} fields
 * @param {import("../artifacts.mjs").CostBreakdown | undefined} breakdown
 * @param {import("../artifacts.mjs").CostOutcome | null} outcome
 * @param {number} totalTokens
 * @param {number | string} cacheHitPct
 * @param {"slice" | "aggregate" | null} [variant] - when "slice", forces aggregate_all:false +
 *   source_count:1; when "aggregate", uses breakdown values (same as legacy); null = legacy.
 */
export function renderCostReportFrontmatter(
  fields,
  breakdown,
  outcome,
  totalTokens,
  cacheHitPct,
  variant = null
) {
  const variantLines = resolveVariantLines(breakdown, variant === "slice");
  const optional = buildOptionalLines(
    fields,
    breakdown,
    outcome,
    totalTokens,
    cacheHitPct,
    variantLines
  );
  return [
    "---",
    "kind: cost-report",
    ...optional.filter(([cond]) => cond).map(([, build]) => build()),
    `created_at: ${nowIso()}`,
    "---"
  ];
}
