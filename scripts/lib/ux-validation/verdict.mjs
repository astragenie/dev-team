// Compute pass/fail verdict from the 4-check evidence payload.
// Returns "failed", "passed_with_notes", or "passed". Failed dominates.

/**
 * @typedef {Object} Evidence
 * @property {Array<{id: string, status: string}>} [ac_results]
 * @property {{violations?: Array<{severity: string, rule?: string}>, passes_count?: number}} [a11y]
 * @property {{errors?: string[], warnings?: string[]}} [console]
 * @property {{failures?: Array<{url: string, status: number}>}} [network]
 * @property {{diffs?: Array<{route?: string, pct: number, tolerance: number}>}} [visual]
 */

const SERIOUS = new Set(["serious", "critical"]);
const MINOR = new Set(["minor", "moderate"]);

/** @param {Evidence} evidence */
function hasFailingAC(evidence) {
  return (evidence.ac_results || []).some((r) => r.status === "fail");
}

/** @param {Evidence} evidence */
function hasSeriousA11y(evidence) {
  return (evidence.a11y?.violations || []).some((v) => SERIOUS.has(v.severity));
}

/** @param {Evidence} evidence */
function hasMinorA11y(evidence) {
  return (evidence.a11y?.violations || []).some((v) => MINOR.has(v.severity));
}

/** @param {Evidence} evidence */
function hasConsoleErrors(evidence) {
  return (evidence.console?.errors || []).length > 0;
}

/** @param {Evidence} evidence */
function hasConsoleWarnings(evidence) {
  return (evidence.console?.warnings || []).length > 0;
}

/** @param {Evidence} evidence */
function hasNetworkFailures(evidence) {
  return (evidence.network?.failures || []).length > 0;
}

/** @param {Evidence} evidence */
function hasVisualDiffOverTolerance(evidence) {
  return (evidence.visual?.diffs || []).some((d) => d.pct > d.tolerance);
}

/**
 * @param {Evidence} evidence
 * @returns {"failed" | "passed_with_notes" | "passed"}
 */
export function computeVerdict(evidence) {
  if (
    hasFailingAC(evidence) ||
    hasSeriousA11y(evidence) ||
    hasConsoleErrors(evidence) ||
    hasVisualDiffOverTolerance(evidence)
  ) {
    return "failed";
  }
  if (hasMinorA11y(evidence) || hasConsoleWarnings(evidence) || hasNetworkFailures(evidence)) {
    return "passed_with_notes";
  }
  return "passed";
}
