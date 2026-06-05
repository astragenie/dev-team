// Extracted from workflow-state.mjs — run lifecycle and gate helpers.

/**
 * @typedef {{ status: string, updatedAt: string, note?: string }} GateEntry
 * @typedef {{ dev: GateEntry|null, prod: GateEntry|null }} DeploymentGates
 * @typedef {{ review: GateEntry|null, validation: GateEntry|null, deployment: DeploymentGates, blocked: GateEntry|null, escalation: GateEntry|null }} RunGates
 * @typedef {{ runBrief: string|null, handoffs: string[], reviewResult: string|null, validationPlan: string|null, validationResult: string|null, deploymentChecks: { dev: string|null, prod: string|null }, finalSynthesis: string|null }} RunArtifacts
 * @typedef {{ title: string, goal: string, mode: string, status: string, startedAt: string, updatedAt: string, completedAt?: string, next: string, gates: RunGates, artifacts: RunArtifacts }} WorkflowRun
 * @typedef {{ title?: string, goal?: string, mode?: string, status?: string, next?: string, path?: string }} RunFields
 * @typedef {{ version: string, updatedAt: string, currentRun: WorkflowRun|null, recentRuns: WorkflowRun[] }} WorkflowState
 */

export const MAX_RECENT_RUNS = 5;

function nowIso() {
  return new Date().toISOString();
}

/**
 * @param {WorkflowState} state
 * @param {WorkflowRun|null} run
 * @returns {void}
 */
export function archiveRun(state, run) {
  if (!run) {
    return;
  }

  /** @type {WorkflowRun} */
  const archived = {
    title: run.title,
    goal: run.goal || "",
    mode: run.mode || "",
    status: run.status || "completed",
    startedAt: run.startedAt || run.updatedAt || nowIso(),
    updatedAt: run.updatedAt || nowIso(),
    completedAt: run.completedAt || run.updatedAt || nowIso(),
    next: run.next || "",
    gates: run.gates || {
      review: null,
      validation: null,
      deployment: {
        dev: null,
        prod: null
      },
      blocked: null,
      escalation: null
    },
    artifacts: run.artifacts || {
      runBrief: null,
      handoffs: [],
      reviewResult: null,
      validationPlan: null,
      validationResult: null,
      deploymentChecks: {
        dev: null,
        prod: null
      },
      finalSynthesis: null
    }
  };

  state.recentRuns = [archived, ...(state.recentRuns || [])].slice(0, MAX_RECENT_RUNS);
}

/**
 * @param {RunFields} [fields]
 * @returns {WorkflowRun}
 */
export function createRun(fields = {}) {
  return {
    title: fields.title || "Workflow Run",
    goal: fields.goal || "",
    mode: fields.mode || "",
    status: fields.status || "active",
    startedAt: nowIso(),
    updatedAt: nowIso(),
    next: fields.next || "",
    gates: {
      review: null,
      validation: null,
      deployment: {
        dev: null,
        prod: null
      },
      blocked: null,
      escalation: null
    },
    artifacts: {
      runBrief: fields.path || null,
      handoffs: [],
      reviewResult: null,
      validationPlan: null,
      validationResult: null,
      deploymentChecks: {
        dev: null,
        prod: null
      },
      finalSynthesis: null
    }
  };
}

/**
 * @param {WorkflowRun|null|undefined} run
 * @returns {boolean}
 */
export function hasAnyWorkflowGate(run) {
  return Boolean(
    run?.gates?.review ||
    run?.gates?.validation ||
    run?.gates?.deployment?.dev ||
    run?.gates?.deployment?.prod
  );
}

// Pending-gate predicates. Each maps a gate-status field on the run to its
// pending sentinel value.
/** @type {Array<(run: WorkflowRun|null|undefined) => boolean>} */
export const PENDING_GATE_CHECKS = [
  (run) => run?.gates?.review?.status === "required",
  (run) => run?.gates?.validation?.status === "expected",
  (run) => run?.gates?.deployment?.dev?.status === "expected",
  (run) => run?.gates?.deployment?.prod?.status === "expected",
  (run) => run?.gates?.blocked?.status === "blocked",
  (run) => run?.gates?.escalation?.status === "escalated"
];

/**
 * @param {WorkflowRun|null|undefined} run
 * @returns {boolean}
 */
export function hasPendingGates(run) {
  return PENDING_GATE_CHECKS.some((check) => check(run));
}

/**
 * @param {RunArtifacts|null|undefined} artifacts
 * @returns {boolean}
 */
export function hasReviewOrValidationArtifact(artifacts) {
  return Boolean(
    artifacts?.handoffs?.length ||
    artifacts?.reviewResult ||
    artifacts?.validationPlan ||
    artifacts?.validationResult ||
    artifacts?.deploymentChecks?.dev ||
    artifacts?.deploymentChecks?.prod
  );
}

/**
 * @param {RunArtifacts|null|undefined} artifacts
 * @returns {boolean}
 */
export function hasSubstantialArtifact(artifacts) {
  return Boolean(
    artifacts?.handoffs?.length ||
    artifacts?.validationPlan ||
    artifacts?.validationResult ||
    artifacts?.deploymentChecks?.dev ||
    artifacts?.deploymentChecks?.prod
  );
}

/**
 * @param {RunGates|null|undefined} gates
 * @returns {boolean}
 */
export function hasSubstantialGate(gates) {
  return Boolean(gates?.validation || gates?.deployment?.dev || gates?.deployment?.prod);
}

/**
 * @param {string} mode
 * @returns {boolean}
 */
export function hasSubstantialMode(mode) {
  return mode === "assisted single-session" || mode === "team run";
}

/**
 * @param {WorkflowRun|null|undefined} run
 * @returns {boolean}
 */
export function hasMeaningfulProgress(run) {
  if (!run) return false;
  return Boolean(
    hasAnyWorkflowGate(run) || hasReviewOrValidationArtifact(run.artifacts) || run.next
  );
}

/**
 * @param {WorkflowRun|null|undefined} run
 * @returns {boolean}
 */
export function isSubstantialRunHint(run) {
  if (!run) return false;
  return Boolean(
    hasSubstantialMode(run.mode) ||
    hasSubstantialArtifact(run.artifacts) ||
    hasSubstantialGate(run.gates)
  );
}

export const RESOLVED_GATE_STATUSES = new Set(["passed", "failed", "skipped"]);

/**
 * @param {string|undefined} status
 * @returns {boolean}
 */
export function isGateResolved(status) {
  return Boolean(status) && RESOLVED_GATE_STATUSES.has(status);
}

/** @type {Array<(gates: RunGates) => string|undefined>} */
export const GATE_STATUS_GETTERS = [
  (gates) => gates.review?.status,
  (gates) => gates.validation?.status,
  (gates) => gates.deployment?.dev?.status,
  (gates) => gates.deployment?.prod?.status
];

/** @type {Array<(artifacts: RunArtifacts) => string|null|undefined>} */
export const PHASE_ARTIFACT_GETTERS = [
  (artifacts) => artifacts.reviewResult,
  (artifacts) => artifacts.validationResult,
  (artifacts) => artifacts.deploymentChecks?.dev,
  (artifacts) => artifacts.deploymentChecks?.prod
];

/**
 * @param {WorkflowRun|null|undefined} run
 * @returns {boolean}
 */
export function hasCompletedPhaseEvidence(run) {
  if (!run) return false;
  /** @type {RunGates} */
  const gates =
    run.gates ||
    /** @type {RunGates} */ ({
      review: null,
      validation: null,
      deployment: { dev: null, prod: null },
      blocked: null,
      escalation: null
    });
  /** @type {RunArtifacts} */
  const artifacts =
    run.artifacts ||
    /** @type {RunArtifacts} */ ({
      runBrief: null,
      handoffs: [],
      reviewResult: null,
      validationPlan: null,
      validationResult: null,
      deploymentChecks: { dev: null, prod: null },
      finalSynthesis: null
    });
  const anyGateResolved = GATE_STATUS_GETTERS.some((get) => isGateResolved(get(gates)));
  const anyArtifactWritten = PHASE_ARTIFACT_GETTERS.some((get) => Boolean(get(artifacts)));
  return anyGateResolved || anyArtifactWritten;
}

/**
 * @param {string|undefined} status
 * @returns {boolean}
 */
export function isDecided(status) {
  return status === "passed" || status === "failed";
}

/** @type {Array<{ code: string, gate: (g: RunGates) => string|undefined, artifact: (a: RunArtifacts) => string|null|undefined }>} */
export const MISSING_WRITE_SPECS = [
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

/**
 * @param {WorkflowRun|null|undefined} run
 * @returns {string[]}
 */
export function summarizeMissingArtifactWritesForRun(run) {
  if (!run) return [];
  /** @type {RunGates} */
  const gates =
    run.gates ||
    /** @type {RunGates} */ ({
      review: null,
      validation: null,
      deployment: { dev: null, prod: null },
      blocked: null,
      escalation: null
    });
  /** @type {RunArtifacts} */
  const artifacts =
    run.artifacts ||
    /** @type {RunArtifacts} */ ({
      runBrief: null,
      handoffs: [],
      reviewResult: null,
      validationPlan: null,
      validationResult: null,
      deploymentChecks: { dev: null, prod: null },
      finalSynthesis: null
    });

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
