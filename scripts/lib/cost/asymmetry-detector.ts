/**
 * scripts/lib/cost/asymmetry-detector.ts
 *
 * SLICE-114 (FEAT-186 S5) — cross-pipeline cost asymmetry heuristic.
 *
 * `detectAsymmetry(entries)` scans per-pipeline totals derived from a set of
 * `CostEntry` records and returns a finding for each slice where:
 *
 *   1. The ratio between the highest-cost pipeline total and the lowest-cost
 *      pipeline total exceeds `RATIO_THRESHOLD` (10×), AND
 *   2. The absolute delta between those two totals exceeds `FLOOR_USD` ($0.10).
 *
 * The floor guard (rule 2) prevents noise on tiny denominators — e.g. a gepa
 * pipeline at $0.001 and an eval pipeline at $0.012 is technically 12× but the
 * $0.011 absolute delta is below the threshold and produces no warning.
 *
 * **Warning-only contract**: `detectAsymmetry` NEVER throws and NEVER calls
 * `process.exit`. It returns structured findings; the caller decides whether to
 * log them, append them to a report, or ignore them.
 *
 * AC-4: consumes `CostEntry` from `./cost-report-renderer.ts`, which extends
 * `JudgeCost` from `@astragenie/gepa-core ^0.5.0`. No duplicate cost-shape def.
 */

import type { CostEntry } from "./cost-report-renderer.ts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Ratio between highest and lowest per-pipeline total that triggers a finding. */
const RATIO_THRESHOLD = 10;

/**
 * Minimum absolute delta in USD between the two pipeline totals required to
 * emit a finding. Guards against 10×+ ratio noise on sub-cent denominators.
 */
const FLOOR_USD = 0.1;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** A single asymmetry finding for a pair of pipelines. */
export interface AsymmetryFinding {
  /** The pipeline with the higher per-slice total. */
  highPipeline: string;
  /** The pipeline with the lower per-slice total. */
  lowPipeline: string;
  /** Total USD attributed to the higher pipeline. */
  highUsd: number;
  /** Total USD attributed to the lower pipeline. */
  lowUsd: number;
  /**
   * Ratio `highUsd / lowUsd`. Always > RATIO_THRESHOLD when a finding is
   * emitted. Capped at `Infinity` to avoid a division-by-zero in callers;
   * check `Number.isFinite(ratio)` before displaying.
   */
  ratio: number;
  /** Absolute delta `highUsd - lowUsd`. Always > FLOOR_USD when emitted. */
  deltaUsd: number;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** Sum `usd` values for a given pipeline label. */
function sumByPipeline(entries: CostEntry[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    const prev = totals.get(entry.pipeline) ?? 0;
    totals.set(entry.pipeline, prev + entry.usd);
  }
  return totals;
}

/**
 * Evaluate one pair of pipeline totals for asymmetry.
 *
 * Returns an `AsymmetryFinding` if both threshold conditions are met;
 * returns `null` otherwise.
 */
function evaluatePair(
  pipelineA: string,
  totalA: number,
  pipelineB: string,
  totalB: number
): AsymmetryFinding | null {
  const [highPipeline, highUsd, lowPipeline, lowUsd] =
    totalA >= totalB
      ? [pipelineA, totalA, pipelineB, totalB]
      : [pipelineB, totalB, pipelineA, totalA];

  const deltaUsd = highUsd - lowUsd;
  if (deltaUsd <= FLOOR_USD) return null;

  const ratio = lowUsd === 0 ? Number.POSITIVE_INFINITY : highUsd / lowUsd;
  if (ratio <= RATIO_THRESHOLD) return null;

  return { highPipeline, lowPipeline, highUsd, lowUsd, ratio, deltaUsd };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect cross-pipeline cost asymmetry in a set of `CostEntry` records.
 *
 * Groups entries by `pipeline`, sums USD totals per pipeline, then evaluates
 * each unique pair of pipelines for the 10× ratio + $0.10 floor conditions.
 *
 * @param entries  Cost entries, typically one per `(pipeline, provider)` tuple.
 *                 Entries are grouped by `pipeline` before comparison.
 * @returns        Array of `AsymmetryFinding` objects. Empty array means no
 *                 asymmetry detected. Never throws; never calls `process.exit`.
 */
export function detectAsymmetry(entries: CostEntry[]): AsymmetryFinding[] {
  const totals = sumByPipeline(entries);
  const pipelines = [...totals.keys()];
  const findings: AsymmetryFinding[] = [];

  // Evaluate all unique pairs (n=2 in normal use; supports n>2 for completeness).
  for (let i = 0; i < pipelines.length; i++) {
    for (let j = i + 1; j < pipelines.length; j++) {
      const pipelineA = pipelines[i];
      const pipelineB = pipelines[j];
      if (pipelineA === undefined || pipelineB === undefined) continue;

      const totalA = totals.get(pipelineA) ?? 0;
      const totalB = totals.get(pipelineB) ?? 0;

      const finding = evaluatePair(pipelineA, totalA, pipelineB, totalB);
      if (finding !== null) findings.push(finding);
    }
  }

  return findings;
}
