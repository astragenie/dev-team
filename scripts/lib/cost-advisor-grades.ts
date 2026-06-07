// Performance letter grade helpers extracted from cost-advisor.mjs.
// Exported for use by cost-advisor.ts and any other callers.

export type GradeLetter = "A" | "B" | "C" | "D" | "F";

/**
 * Grade thresholds keyed by metric name. Each row is [maxValue, grade] where
 * maxValue is the INCLUSIVE upper bound that still earns that grade.
 * cacheHitPct uses INCLUSIVE lower bound (inverted — higher is better).
 */
export const GRADE_THRESHOLDS: Record<string, Array<[number, GradeLetter]>> = {
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

export const GRADE_ORDER: GradeLetter[] = ["A", "B", "C", "D", "F"];

export function worseGrade(a: GradeLetter, b: GradeLetter): GradeLetter {
  return GRADE_ORDER.indexOf(a) >= GRADE_ORDER.indexOf(b) ? a : b;
}

export interface GradeTarget {
  cacheHitPct: number;
  compactionCount: number;
  subagentDispatches: number;
  fileRereadCount: number;
  toolFailureRate?: number;
}

function gradeCacheHit(cacheHit: number): GradeLetter {
  for (const [min, g] of GRADE_THRESHOLDS["cacheHitPct"] ?? []) {
    if (cacheHit >= min) return g;
  }
  return "F";
}

function gradeCountMetrics(targetMap: Record<string, number>): GradeLetter {
  const countMetrics: Array<[string, Array<[number, GradeLetter]>]> = [
    ["compactionCount", GRADE_THRESHOLDS["compactionCount"] ?? []],
    ["subagentDispatches", GRADE_THRESHOLDS["subagentDispatches"] ?? []],
    ["fileRereadCount", GRADE_THRESHOLDS["fileRereadCount"] ?? []],
    ["toolFailureRate", GRADE_THRESHOLDS["toolFailureRate"] ?? []]
  ];
  let grade: GradeLetter = "A";
  for (const [key, thresholds] of countMetrics) {
    const val = targetMap[key] ?? 0;
    let metricGrade: GradeLetter = "F";
    for (const [max, g] of thresholds) {
      if (val <= max) {
        metricGrade = g;
        break;
      }
    }
    grade = worseGrade(grade, metricGrade);
  }
  return grade;
}

/**
 * Compute a composite performance letter grade (A-F) from cost-report metrics.
 * Logic: start at A, downgrade to the worst band any single metric falls into.
 */
export function computeGrade(target: GradeTarget): GradeLetter {
  const targetMap = target as unknown as Record<string, number>;
  let grade: GradeLetter = "A";
  grade = worseGrade(grade, gradeCacheHit(target.cacheHitPct ?? 0));
  grade = worseGrade(grade, gradeCountMetrics(targetMap));
  return grade;
}
