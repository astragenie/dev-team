type Evidence = {
  ac_results?: Array<{ id: string; status: string }>;
  a11y?: { violations?: Array<{ severity: string; rule?: string }>; passes_count?: number };
  console?: { errors?: string[]; warnings?: string[] };
  network?: { failures?: Array<{ url: string; status: number }> };
  visual?: { diffs?: Array<{ route?: string; pct: number; tolerance: number }> };
};

const SERIOUS = new Set(["serious", "critical"]);
const MINOR = new Set(["minor", "moderate"]);

function hasFailingAC(evidence: Evidence): boolean {
  return (evidence.ac_results ?? []).some((r) => r.status === "fail");
}

function hasSeriousA11y(evidence: Evidence): boolean {
  return (evidence.a11y?.violations ?? []).some((v) => SERIOUS.has(v.severity));
}

function hasMinorA11y(evidence: Evidence): boolean {
  return (evidence.a11y?.violations ?? []).some((v) => MINOR.has(v.severity));
}

function hasConsoleErrors(evidence: Evidence): boolean {
  return (evidence.console?.errors ?? []).length > 0;
}

function hasConsoleWarnings(evidence: Evidence): boolean {
  return (evidence.console?.warnings ?? []).length > 0;
}

function hasNetworkFailures(evidence: Evidence): boolean {
  return (evidence.network?.failures ?? []).length > 0;
}

function hasVisualDiffOverTolerance(evidence: Evidence): boolean {
  return (evidence.visual?.diffs ?? []).some((d) => d.pct > d.tolerance);
}

export function computeVerdict(evidence: Evidence): "failed" | "passed_with_notes" | "passed" {
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
