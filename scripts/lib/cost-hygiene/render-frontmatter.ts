// Extracted from scripts/lib/artifacts.mjs — renderCostReportFrontmatter.
// Kept in cost-hygiene/ because it formats cost-report YAML frontmatter.

import type { ArtifactFields, CostBreakdown, CostOutcome } from "../artifacts/types.ts";

function nowIso(): string {
  return new Date().toISOString();
}

function resolveVariantLines(
  breakdown: CostBreakdown | undefined,
  isSlice: boolean
): {
  aggregateAllPredicate: boolean;
  aggregateAllLine: string;
  sourceCountPredicate: boolean;
  sourceCountLine: string;
} {
  return {
    aggregateAllPredicate: isSlice ? true : Boolean(breakdown?.aggregateAll),
    aggregateAllLine: isSlice ? "aggregate_all: false" : "aggregate_all: true",
    sourceCountPredicate: isSlice ? true : Boolean(breakdown?.sources?.length),
    sourceCountLine: isSlice
      ? "source_count: 1"
      : `source_count: ${breakdown?.sources?.length ?? 0}`
  };
}

type CondLine = [unknown, () => string];

function buildOptionalLines(
  fields: ArtifactFields,
  breakdown: CostBreakdown | undefined,
  outcome: CostOutcome | null,
  totalTokens: number,
  cacheHitPct: number | string,
  variant: ReturnType<typeof resolveVariantLines>
): CondLine[] {
  const durationMs = breakdown?.window?.durationMs ?? 0;
  const { aggregateAllPredicate, aggregateAllLine, sourceCountPredicate, sourceCountLine } =
    variant;
  return [
    [
      fields.phase != null && String(fields.phase).length > 0,
      () => `phase: ${JSON.stringify(String(fields.phase))}`
    ],
    [fields.feature, () => `feature: ${fields.feature}`],
    [outcome?.sliceId, () => `slice: ${outcome!.sliceId}`],
    [true, () => `run_title: ${JSON.stringify(fields.runTitle || "")}`],
    [breakdown?.usd != null, () => `usd: ${breakdown!.usd}`],
    [durationMs, () => `duration_ms: ${durationMs}`],
    [totalTokens, () => `total_tokens: ${totalTokens}`],
    [cacheHitPct !== "-", () => `cache_hit_pct: ${cacheHitPct}`],
    [outcome?.gradeAvg != null, () => `grade_avg: ${outcome!.gradeAvg}`],
    [outcome?.reviewDecision, () => `review_decision: ${outcome!.reviewDecision}`],
    [outcome?.validationDecision, () => `validation_decision: ${outcome!.validationDecision}`],
    [breakdown?.sourceProject, () => `source_project: ${breakdown!.sourceProject}`],
    [breakdown?.autoDetected, () => `auto_detected: true`],
    [aggregateAllPredicate, () => aggregateAllLine],
    [sourceCountPredicate, () => sourceCountLine]
  ];
}

export function renderCostReportFrontmatter(
  fields: ArtifactFields,
  breakdown: CostBreakdown | undefined,
  outcome: CostOutcome | null,
  totalTokens: number,
  cacheHitPct: number | string,
  variant: "slice" | "aggregate" | null = null
): string[] {
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
