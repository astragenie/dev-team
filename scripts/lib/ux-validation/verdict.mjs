// Compute pass/fail verdict from the 4-check evidence payload.
// Returns "failed", "passed_with_notes", or "passed". Failed dominates.

const SERIOUS = new Set(["serious", "critical"]);
const MINOR = new Set(["minor", "moderate"]);

function hasFailingAC(evidence) {
  return (evidence.ac_results || []).some((r) => r.status === "fail");
}

function hasSeriousA11y(evidence) {
  return (evidence.a11y?.violations || []).some((v) => SERIOUS.has(v.severity));
}

function hasMinorA11y(evidence) {
  return (evidence.a11y?.violations || []).some((v) => MINOR.has(v.severity));
}

function hasConsoleErrors(evidence) {
  return (evidence.console?.errors || []).length > 0;
}

function hasConsoleWarnings(evidence) {
  return (evidence.console?.warnings || []).length > 0;
}

function hasNetworkFailures(evidence) {
  return (evidence.network?.failures || []).length > 0;
}

function hasVisualDiffOverTolerance(evidence) {
  return (evidence.visual?.diffs || []).some((d) => d.pct > d.tolerance);
}

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
