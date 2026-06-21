// Run lifecycle and gate helpers — extracted from workflow-state.ts.

// ---------------------------------------------------------------------------
// Discriminated-union types (AC-7)
// ---------------------------------------------------------------------------

export type GateStatus =
  | "pending"
  | "passed"
  | "failed"
  | "skipped"
  | "required"
  | "expected"
  | "blocked"
  | "escalated"
  | "recommended"
  | "stale";

export interface GateEntry {
  status: GateStatus;
  updatedAt: string;
  note?: string;
  blockedBy?: string;
}

export interface DeploymentGates {
  dev: GateEntry | null;
  prod: GateEntry | null;
}

export interface RunGates {
  review: GateEntry | null;
  validation: GateEntry | null;
  deployment: DeploymentGates;
  blocked: GateEntry | null;
  escalation: GateEntry | null;
}

export interface RunArtifacts {
  runBrief: string | null;
  handoffs: string[];
  reviewResult: string | null;
  validationPlan: string | null;
  validationResult: string | null;
  deploymentChecks: { dev: string | null; prod: string | null };
  finalSynthesis: string | null;
}

export interface WorkflowRun {
  title: string;
  goal: string;
  mode: string;
  status: string;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  next: string;
  gates: RunGates;
  artifacts: RunArtifacts;
}

export interface WorkflowState {
  version: string;
  updatedAt: string;
  currentRun: WorkflowRun | null;
  recentRuns: WorkflowRun[];
}

export interface RunFields {
  title?: string | undefined;
  goal?: string | undefined;
  mode?: string | undefined;
  status?: string | undefined;
  next?: string | undefined;
  path?: string | undefined;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MAX_RECENT_RUNS = 5;

function nowIso(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Private default-shape helpers (AC-4: reduce duplication)
// ---------------------------------------------------------------------------

function makeDefaultGates(): RunGates {
  return {
    review: null,
    validation: null,
    deployment: { dev: null, prod: null },
    blocked: null,
    escalation: null
  };
}

function makeDefaultArtifacts(): RunArtifacts {
  return {
    runBrief: null,
    handoffs: [],
    reviewResult: null,
    validationPlan: null,
    validationResult: null,
    deploymentChecks: { dev: null, prod: null },
    finalSynthesis: null
  };
}

// ---------------------------------------------------------------------------
// Run lifecycle helpers
// ---------------------------------------------------------------------------

export function archiveRun(state: WorkflowState, run: WorkflowRun | null): void {
  if (!run) {
    return;
  }

  const archived: WorkflowRun = {
    title: run.title,
    goal: run.goal || "",
    mode: run.mode || "",
    status: run.status || "completed",
    startedAt: run.startedAt || run.updatedAt || nowIso(),
    updatedAt: run.updatedAt || nowIso(),
    completedAt: run.completedAt || run.updatedAt || nowIso(),
    next: run.next || "",
    gates: run.gates || makeDefaultGates(),
    artifacts: run.artifacts || makeDefaultArtifacts()
  };

  state.recentRuns = [archived, ...(state.recentRuns || [])].slice(0, MAX_RECENT_RUNS);
}

export function createRun(fields: RunFields = {}): WorkflowRun {
  return {
    title: fields.title || "Workflow Run",
    goal: fields.goal || "",
    mode: fields.mode || "",
    status: fields.status || "active",
    startedAt: nowIso(),
    updatedAt: nowIso(),
    next: fields.next || "",
    gates: makeDefaultGates(),
    artifacts: {
      runBrief: fields.path ?? null,
      handoffs: [],
      reviewResult: null,
      validationPlan: null,
      validationResult: null,
      deploymentChecks: { dev: null, prod: null },
      finalSynthesis: null
    }
  };
}

// ---------------------------------------------------------------------------
// Gate query helpers
// ---------------------------------------------------------------------------

export function hasAnyWorkflowGate(run: WorkflowRun | null | undefined): boolean {
  return Boolean(
    run?.gates?.review ||
      run?.gates?.validation ||
      run?.gates?.deployment?.dev ||
      run?.gates?.deployment?.prod
  );
}

// Pending-gate predicates. Each maps a gate-status field on the run to its
// pending sentinel value.
export const PENDING_GATE_CHECKS: Array<(run: WorkflowRun | null | undefined) => boolean> = [
  (run) => run?.gates?.review?.status === "required",
  (run) => run?.gates?.validation?.status === "expected",
  (run) => run?.gates?.deployment?.dev?.status === "expected",
  (run) => run?.gates?.deployment?.prod?.status === "expected",
  (run) => run?.gates?.blocked?.status === "blocked",
  (run) => run?.gates?.escalation?.status === "escalated"
];

export function hasPendingGates(run: WorkflowRun | null | undefined): boolean {
  return PENDING_GATE_CHECKS.some((check) => check(run));
}

export function hasReviewOrValidationArtifact(artifacts: RunArtifacts | null | undefined): boolean {
  return Boolean(
    artifacts?.handoffs?.length ||
      artifacts?.reviewResult ||
      artifacts?.validationPlan ||
      artifacts?.validationResult ||
      artifacts?.deploymentChecks?.dev ||
      artifacts?.deploymentChecks?.prod
  );
}

export function hasSubstantialArtifact(artifacts: RunArtifacts | null | undefined): boolean {
  return Boolean(
    artifacts?.handoffs?.length ||
      artifacts?.validationPlan ||
      artifacts?.validationResult ||
      artifacts?.deploymentChecks?.dev ||
      artifacts?.deploymentChecks?.prod
  );
}

export function hasSubstantialGate(gates: RunGates | null | undefined): boolean {
  return Boolean(gates?.validation || gates?.deployment?.dev || gates?.deployment?.prod);
}

export function hasSubstantialMode(mode: string): boolean {
  return mode === "assisted single-session" || mode === "team run";
}

export function hasMeaningfulProgress(run: WorkflowRun | null | undefined): boolean {
  if (!run) return false;
  return Boolean(
    hasAnyWorkflowGate(run) || hasReviewOrValidationArtifact(run.artifacts) || run.next
  );
}

export function isSubstantialRunHint(run: WorkflowRun | null | undefined): boolean {
  if (!run) return false;
  return Boolean(
    hasSubstantialMode(run.mode) ||
      hasSubstantialArtifact(run.artifacts) ||
      hasSubstantialGate(run.gates)
  );
}

export const RESOLVED_GATE_STATUSES = new Set<string>(["passed", "failed", "skipped"]);

export function isGateResolved(status: string | undefined): boolean {
  return Boolean(status) && RESOLVED_GATE_STATUSES.has(status as string);
}

export const GATE_STATUS_GETTERS: Array<(gates: RunGates) => string | undefined> = [
  (gates) => gates.review?.status,
  (gates) => gates.validation?.status,
  (gates) => gates.deployment?.dev?.status,
  (gates) => gates.deployment?.prod?.status
];

export const PHASE_ARTIFACT_GETTERS: Array<(artifacts: RunArtifacts) => string | null | undefined> =
  [
    (artifacts) => artifacts.reviewResult,
    (artifacts) => artifacts.validationResult,
    (artifacts) => artifacts.deploymentChecks?.dev,
    (artifacts) => artifacts.deploymentChecks?.prod
  ];

export function hasCompletedPhaseEvidence(run: WorkflowRun | null | undefined): boolean {
  if (!run) return false;
  const gates = run.gates || makeDefaultGates();
  const artifacts = run.artifacts || makeDefaultArtifacts();
  const anyGateResolved = GATE_STATUS_GETTERS.some((get) => isGateResolved(get(gates)));
  const anyArtifactWritten = PHASE_ARTIFACT_GETTERS.some((get) => Boolean(get(artifacts)));
  return anyGateResolved || anyArtifactWritten;
}

export function isDecided(status: string | undefined): boolean {
  return status === "passed" || status === "failed";
}

// ---------------------------------------------------------------------------
// Missing-artifact diagnostics
// ---------------------------------------------------------------------------

export const MISSING_WRITE_SPECS: Array<{
  code: string;
  gate: (g: RunGates) => string | undefined;
  artifact: (a: RunArtifacts) => string | null | undefined;
}> = [
  {
    code: "review_result_missing",
    gate: (g) => g.review?.status,
    artifact: (a) => a.reviewResult
  },
  {
    code: "validation_result_missing",
    gate: (g) => g.validation?.status,
    artifact: (a) => a.validationResult
  },
  {
    code: "dev_deployment_check_missing",
    gate: (g) => g.deployment?.dev?.status,
    artifact: (a) => a.deploymentChecks?.dev
  },
  {
    code: "prod_deployment_check_missing",
    gate: (g) => g.deployment?.prod?.status,
    artifact: (a) => a.deploymentChecks?.prod
  }
];

export function summarizeMissingArtifactWritesForRun(
  run: WorkflowRun | null | undefined
): string[] {
  if (!run) return [];
  const gates = run.gates || makeDefaultGates();
  const artifacts = run.artifacts || makeDefaultArtifacts();

  const missing = MISSING_WRITE_SPECS.filter(
    (spec) => isDecided(spec.gate(gates)) && !spec.artifact(artifacts)
  ).map((spec) => spec.code);

  const substantialRun = isSubstantialRunHint(run);
  if (substantialRun && hasMeaningfulProgress(run) && !artifacts.runBrief) {
    missing.push("run_brief_missing");
  }
  if (
    substantialRun &&
    hasCompletedPhaseEvidence(run) &&
    !hasPendingGates(run) &&
    !artifacts.finalSynthesis
  ) {
    missing.push("final_synthesis_missing");
  }
  return missing;
}
