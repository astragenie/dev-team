// Performance letter grade helpers extracted from cost-advisor.mjs.
// Exported for use by cost-advisor.mjs and any other callers.

/**
 * Grade thresholds keyed by metric name. Each row is [maxValue, grade] where
 * maxValue is the INCLUSIVE upper bound that still earns that grade.
 * cacheHitPct uses INCLUSIVE lower bound (inverted — higher is better).
 *
 * @type {Record<string, Array<[number, string]>>}
 */
export const GRADE_THRESHOLDS = {
  // [minPct, grade] — highest threshold first
  cacheHitPct: [
    [98, "A"],
    [95, "B"],
    [90, "C"],
    [80, "D"]
  ],
  // [maxCount, grade] — lowest threshold first
  compactionCount: [
    [1, "A"],
    [3, "B"],
    [6, "C"],
    [15, "D"]
  ],
  subagentDispatches: [
    [2, "A"],
    [4, "B"],
    [6, "C"],
    [10, "D"]
  ],
  fileRereadCount: [
    [3, "A"],
    [8, "B"],
    [15, "C"],
    [30, "D"]
  ],
  // toolFailureRate is a fraction 0-1; thresholds are fractions
  toolFailureRate: [
    [0.03, "A"],
    [0.05, "B"],
    [0.08, "C"],
    [0.15, "D"]
  ]
};

export const GRADE_ORDER = ["A", "B", "C", "D", "F"];

/**
 * @param {string} a
 * @param {string} b
 * @returns {string}
 */
export function worseGrade(a, b) {
  return GRADE_ORDER.indexOf(a) >= GRADE_ORDER.indexOf(b) ? a : b;
}

/**
 * Compute a composite performance letter grade (A-F) from cost-report metrics.
 * Logic: start at A, downgrade to the worst band any single metric falls into.
 *
 * @param {{ cacheHitPct: number, compactionCount: number, subagentDispatches: number,
 *           fileRereadCount: number, toolFailureRate?: number }} target
 * @returns {"A"|"B"|"C"|"D"|"F"}
 */
export function computeGrade(target) {
  let grade = "A";

  /** @type {Record<string, number>} */
  const targetMap = /** @type {Record<string, number>} */ (/** @type {unknown} */ (target));

  // cacheHitPct: higher is better
  const cacheHit = target.cacheHitPct ?? 0;
  let cacheGrade = "F";
  for (const [min, g] of GRADE_THRESHOLDS.cacheHitPct) {
    if (cacheHit >= /** @type {number} */ (min)) {
      cacheGrade = /** @type {string} */ (g);
      break;
    }
  }
  grade = worseGrade(grade, cacheGrade);

  // Count-based metrics: lower is better
  /** @type {Array<[string, Array<[number, string]>]>} */
  const countMetrics = [
    ["compactionCount", GRADE_THRESHOLDS.compactionCount],
    ["subagentDispatches", GRADE_THRESHOLDS.subagentDispatches],
    ["fileRereadCount", GRADE_THRESHOLDS.fileRereadCount],
    ["toolFailureRate", GRADE_THRESHOLDS.toolFailureRate]
  ];

  for (const [key, thresholds] of countMetrics) {
    const val = targetMap[key] ?? 0;
    let metricGrade = "F";
    for (const [max, g] of thresholds) {
      if (val <= /** @type {number} */ (max)) {
        metricGrade = /** @type {string} */ (g);
        break;
      }
    }
    grade = worseGrade(grade, metricGrade);
  }

  return /** @type {"A"|"B"|"C"|"D"|"F"} */ (grade);
}
