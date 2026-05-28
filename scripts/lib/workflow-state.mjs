import fs from "node:fs/promises";
import path from "node:path";

/**
 * @typedef {{ status: string, updatedAt: string, note?: string }} GateEntry
 * @typedef {{ dev: GateEntry|null, prod: GateEntry|null }} DeploymentGates
 * @typedef {{
 *   review: GateEntry|null,
 *   validation: GateEntry|null,
 *   deployment: DeploymentGates,
 *   blocked: GateEntry|null,
 *   escalation: GateEntry|null
 * }} RunGates
 * @typedef {{
 *   runBrief: string|null,
 *   handoffs: string[],
 *   reviewResult: string|null,
 *   validationPlan: string|null,
 *   validationResult: string|null,
 *   deploymentChecks: { dev: string|null, prod: string|null },
 *   finalSynthesis: string|null
 * }} RunArtifacts
 * @typedef {{
 *   title: string,
 *   goal: string,
 *   mode: string,
 *   status: string,
 *   startedAt: string,
 *   updatedAt: string,
 *   completedAt?: string,
 *   next: string,
 *   gates: RunGates,
 *   artifacts: RunArtifacts
 * }} WorkflowRun
 * @typedef {{
 *   version: string,
 *   updatedAt: string,
 *   currentRun: WorkflowRun|null,
 *   recentRuns: WorkflowRun[]
 * }} WorkflowState
 * @typedef {{
 *   title?: string,
 *   goal?: string,
 *   mode?: string,
 *   status?: string,
 *   next?: string,
 *   path?: string
 * }} RunFields
 * @typedef {{
 *   badge?: string,
 *   title?: string,
 *   goal?: string,
 *   mode?: string,
 *   next?: string,
 *   note?: string,
 *   blockedBy?: string|null,
 *   force?: boolean,
 *   summary?: string
 * }} BadgeOptions
 * @typedef {{ kind: string, path: string, title: string }} ArtifactRef
 * @typedef {{ createIfMissing?: boolean }} LoadOptions
 */

const STATE_DIR = [".claude", "state", "crew"];
const WORKFLOW_STATE_PATH = [...STATE_DIR, "workflow-state.json"];
// Legacy path retained for read-side fallback so repos installed before the
// engineering-os -> crew rename still pick up their existing workflow state.
// Saves always go to the new path; the installer migration (Step 3) cleans
// the legacy file up.
const LEGACY_WORKFLOW_STATE_PATH = [".claude", "state", "engineering-os", "workflow-state.json"];
const MAX_RECENT_RUNS = 5;

function nowIso() {
  return new Date().toISOString();
}

/**
 * @returns {WorkflowState}
 */
function defaultWorkflowState() {
  return {
    version: "1.0",
    updatedAt: nowIso(),
    currentRun: null,
    recentRuns: []
  };
}

/**
 * @param {string} dirPath
 * @returns {Promise<void>}
 */
async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * @param {string} filePath
 * @param {string} contents
 * @returns {Promise<void>}
 */
async function ensureFile(filePath, contents) {
  try {
    await fs.access(filePath);
  } catch {
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, contents);
  }
}

/**
 * @param {string} repoPath
 * @returns {Promise<void>}
 */
export async function ensureWorkflowStateScaffold(repoPath) {
  await ensureFile(
    path.join(repoPath, ...WORKFLOW_STATE_PATH),
    `${JSON.stringify(defaultWorkflowState(), null, 2)}\n`
  );
}

/**
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
async function pathReadable(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} repoPath
 * @param {LoadOptions} [options]
 * @returns {Promise<WorkflowState>}
 */
export async function loadWorkflowState(repoPath, options = {}) {
  const workflowPath = path.join(repoPath, ...WORKFLOW_STATE_PATH);
  if (await pathReadable(workflowPath)) {
    return JSON.parse(await fs.readFile(workflowPath, "utf8"));
  }

  const legacyPath = path.join(repoPath, ...LEGACY_WORKFLOW_STATE_PATH);
  if (await pathReadable(legacyPath)) {
    return JSON.parse(await fs.readFile(legacyPath, "utf8"));
  }

  if (options.createIfMissing === false) {
    return defaultWorkflowState();
  }

  await ensureWorkflowStateScaffold(repoPath);
  return JSON.parse(await fs.readFile(workflowPath, "utf8"));
}

/**
 * @param {string} repoPath
 * @param {WorkflowState} state
 * @returns {Promise<void>}
 */
async function saveWorkflowState(repoPath, state) {
  const workflowPath = path.join(repoPath, ...WORKFLOW_STATE_PATH);
  state.updatedAt = nowIso();
  await ensureDir(path.dirname(workflowPath));
  await fs.writeFile(workflowPath, `${JSON.stringify(state, null, 2)}\n`);
}

/**
 * @param {WorkflowState} state
 * @param {WorkflowRun|null} run
 * @returns {void}
 */
/**
 * @param {WorkflowState} state
 * @param {WorkflowRun|null} run
 * @returns {void}
 */
function archiveRun(state, run) {
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
      deployment: { dev: null, prod: null },
      blocked: null,
      escalation: null
    },
    artifacts: run.artifacts || {
      runBrief: null,
      handoffs: [],
      reviewResult: null,
      validationPlan: null,
      validationResult: null,
      deploymentChecks: { dev: null, prod: null },
      finalSynthesis: null
    }
  };

  state.recentRuns = [archived, ...(state.recentRuns || [])].slice(0, MAX_RECENT_RUNS);
}

/**
 * @param {RunFields} [fields]
 * @returns {WorkflowRun}
 */
function createRun(fields = {}) {
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
function hasAnyWorkflowGate(run) {
  return Boolean(
    run?.gates?.review ||
    run?.gates?.validation ||
    run?.gates?.deployment?.dev ||
    run?.gates?.deployment?.prod
  );
}

// Pending-gate predicates. Each maps a gate-status field on the run to its
// pending sentinel value. The shared PENDING_BADGE_SPECS table cannot be
// reused here because it accepts `currentRun.gates?.foo` while this helper
// is called with `run` from contexts where gates may be missing entirely.
/** @type {Array<(run: WorkflowRun|null|undefined) => boolean>} */
const PENDING_GATE_CHECKS = [
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
function hasPendingGates(run) {
  return PENDING_GATE_CHECKS.some((check) => check(run));
}

// Artifact-shape helpers shared by progress/substance/evidence checks.
/**
 * @param {RunArtifacts|null|undefined} artifacts
 * @returns {boolean}
 */
function hasReviewOrValidationArtifact(artifacts) {
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
function hasSubstantialArtifact(artifacts) {
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
function hasSubstantialGate(gates) {
  return Boolean(gates?.validation || gates?.deployment?.dev || gates?.deployment?.prod);
}

/**
 * @param {string} mode
 * @returns {boolean}
 */
function hasSubstantialMode(mode) {
  return mode === "assisted single-session" || mode === "team run";
}

/**
 * @param {WorkflowRun|null|undefined} run
 * @returns {boolean}
 */
function hasMeaningfulProgress(run) {
  if (!run) return false;
  return Boolean(
    hasAnyWorkflowGate(run) || hasReviewOrValidationArtifact(run.artifacts) || run.next
  );
}

/**
 * @param {WorkflowRun|null|undefined} run
 * @returns {boolean}
 */
function isSubstantialRunHint(run) {
  if (!run) return false;
  return Boolean(
    hasSubstantialMode(run.mode) ||
    hasSubstantialArtifact(run.artifacts) ||
    hasSubstantialGate(run.gates)
  );
}

// A gate is "resolved" when its status is one of the terminal values
// (passed/failed/skipped) — i.e. someone has explicitly closed it,
// regardless of whether the outcome was success or failure.
const RESOLVED_GATE_STATUSES = new Set(["passed", "failed", "skipped"]);

/**
 * @param {string|undefined} status
 * @returns {boolean}
 */
function isGateResolved(status) {
  return Boolean(status) && RESOLVED_GATE_STATUSES.has(status);
}

// Gate-status accessors used to test "is any gate resolved?".
/** @type {Array<(gates: RunGates) => string|undefined>} */
const GATE_STATUS_GETTERS = [
  (gates) => gates.review?.status,
  (gates) => gates.validation?.status,
  (gates) => gates.deployment?.dev?.status,
  (gates) => gates.deployment?.prod?.status
];

// Closed-artifact accessors used to test "is any phase artifact written?".
/** @type {Array<(artifacts: RunArtifacts) => string|null|undefined>} */
const PHASE_ARTIFACT_GETTERS = [
  (artifacts) => artifacts.reviewResult,
  (artifacts) => artifacts.validationResult,
  (artifacts) => artifacts.deploymentChecks?.dev,
  (artifacts) => artifacts.deploymentChecks?.prod
];

/**
 * @param {WorkflowRun|null|undefined} run
 * @returns {boolean}
 */
function hasCompletedPhaseEvidence(run) {
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

// "Decided" means the gate was explicitly closed pass/fail (not pending,
// not skipped). A decided gate without its corresponding artifact is a
// missing write-back.
/**
 * @param {string|undefined} status
 * @returns {boolean}
 */
function isDecided(status) {
  return status === "passed" || status === "failed";
}

// Spec table mapping each gate to its expected artifact slot and the
// missing-code emitted when the gate is decided but the artifact is absent.
/** @type {Array<{ code: string, gate: (g: RunGates) => string|undefined, artifact: (a: RunArtifacts) => string|null|undefined }>} */
const MISSING_WRITE_SPECS = [
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
function summarizeMissingArtifactWritesForRun(run) {
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

/**
 * @param {string} repoPath
 * @param {RunFields} [fields]
 * @returns {Promise<WorkflowRun>}
 */
export async function startWorkflowRun(repoPath, fields = {}) {
  const state = await loadWorkflowState(repoPath);
  if (state.currentRun) {
    archiveRun(state, state.currentRun);
  }

  state.currentRun = createRun(fields);
  await saveWorkflowState(repoPath, state);
  return state.currentRun;
}

/**
 * @param {WorkflowState} state
 * @param {RunFields} [fields]
 * @returns {WorkflowRun}
 */
function ensureCurrentRun(state, fields = {}) {
  if (!state.currentRun) {
    state.currentRun = createRun(fields);
  }
  return state.currentRun;
}

// Badge -> (gate selector, status). `selector` takes the run and returns
// a [parent, key] tuple so the badge can assign without having to repeat
// the `run.gates.deployment.dev = ...` chain inline.
/** @type {Record<string, { selector: (run: WorkflowRun) => [Record<string, unknown>, string], status: string, custom?: boolean }>} */
const BADGE_TABLE = {
  review_required: { selector: (run) => [run.gates, "review"], status: "required" },
  review_passed: { selector: (run) => [run.gates, "review"], status: "passed" },
  review_failed: { selector: (run) => [run.gates, "review"], status: "failed" },
  review_skipped: { selector: (run) => [run.gates, "review"], status: "skipped" },
  validation_expected: { selector: (run) => [run.gates, "validation"], status: "expected" },
  validation_passed: { selector: (run) => [run.gates, "validation"], status: "passed" },
  validation_failed: { selector: (run) => [run.gates, "validation"], status: "failed" },
  validation_skipped: { selector: (run) => [run.gates, "validation"], status: "skipped" },
  dev_deploy_expected: { selector: (run) => [run.gates.deployment, "dev"], status: "expected" },
  dev_checked: { selector: (run) => [run.gates.deployment, "dev"], status: "passed" },
  dev_failed: { selector: (run) => [run.gates.deployment, "dev"], status: "failed" },
  dev_skipped: { selector: (run) => [run.gates.deployment, "dev"], status: "skipped" },
  prod_deploy_expected: { selector: (run) => [run.gates.deployment, "prod"], status: "expected" },
  prod_checked: { selector: (run) => [run.gates.deployment, "prod"], status: "passed" },
  prod_failed: { selector: (run) => [run.gates.deployment, "prod"], status: "failed" },
  prod_skipped: { selector: (run) => [run.gates.deployment, "prod"], status: "skipped" },
  blocked: { selector: (run) => [run.gates, "blocked"], status: "blocked", custom: true },
  escalated_to_human: {
    selector: (run) => [run.gates, "escalation"],
    status: "escalated",
    custom: true
  }
};

/**
 * @param {WorkflowRun} run
 * @param {string} badge
 * @param {string} [note]
 * @param {string|null} [blockedBy]
 * @returns {void}
 */
function applyBadge(run, badge, note = "", blockedBy = null) {
  const spec = BADGE_TABLE[badge];
  if (!spec) {
    throw new Error(`Unsupported workflow badge: ${badge}`);
  }
  const [parent, key] = spec.selector(run);

  if (spec.custom) {
    // Custom badges (blocked, escalation) need special handling for their fields
    /** @type {Record<string, string|null>} */
    const gateObj = { status: spec.status, updatedAt: nowIso(), note: note || "" };
    if (badge === "blocked" && blockedBy !== null) {
      gateObj.blockedBy = blockedBy;
    }
    parent[key] = /** @type {GateEntry} */ (/** @type {unknown} */ (gateObj));
  } else {
    parent[key] = { status: spec.status, updatedAt: nowIso(), note: note || "" };
  }
}

/**
 * @param {string} repoPath
 * @param {BadgeOptions} [options]
 * @returns {Promise<WorkflowRun|null>}
 */
export async function markWorkflowBadge(repoPath, options = {}) {
  const badge = options.badge;
  if (!badge) {
    throw new Error("Workflow badge is required.");
  }

  const state = await loadWorkflowState(repoPath);
  const run = ensureCurrentRun(state, {
    title: options.title || "Workflow Run",
    goal: options.goal || "",
    mode: options.mode || "",
    next: options.next || ""
  });
  applyBadge(run, badge, options.note || "", options.blockedBy || null);
  run.updatedAt = nowIso();
  if (options.next) {
    run.next = options.next;
  }
  await saveWorkflowState(repoPath, state);
  return state.currentRun;
}

// Per-artifact-kind handlers used by registerWorkflowArtifact. Each takes
// (run, artifact, fields) and mutates run in place. Centralizing the
// dispatch keeps registerWorkflowArtifact below the complexity budget
// and makes adding a new artifact kind a one-entry change.
/** @type {Record<string, (run: WorkflowRun, artifact: ArtifactRef, fields: RunFields & BadgeOptions & { decision?: string, environment?: string, status?: string }) => void>} */
const ARTIFACT_HANDLERS = {
  handoff(run, artifact) {
    run.artifacts.handoffs = [...(run.artifacts.handoffs || []), artifact.path].slice(-10);
  },
  "review-result"(run, artifact, fields) {
    run.artifacts.reviewResult = artifact.path;
    applyBadge(
      run,
      fields.decision === "rejected" ? "review_failed" : "review_passed",
      fields.summary || ""
    );
  },
  "validation-plan"(run, artifact, fields) {
    run.artifacts.validationPlan = artifact.path;
    applyBadge(run, "validation_expected", fields.summary || fields.goal || "");
  },
  "validation-result"(run, artifact, fields) {
    run.artifacts.validationResult = artifact.path;
    applyBadge(
      run,
      fields.decision === "failed" ? "validation_failed" : "validation_passed",
      fields.summary || fields.goal || ""
    );
  },
  "deployment-check"(run, artifact, fields) {
    const environment = fields.environment === "prod" ? "prod" : "dev";
    run.artifacts.deploymentChecks[environment] = artifact.path;
    applyBadge(
      run,
      fields.decision === "failed" ? `${environment}_failed` : `${environment}_checked`,
      fields.summary || fields.goal || ""
    );
  },
  "final-synthesis"(run, artifact, fields) {
    const pendingBadges = summarizeWorkflowState(
      /** @type {WorkflowState} */ ({ currentRun: run, version: "", updatedAt: "", recentRuns: [] })
    ).pendingBadges;
    const hasEscalation = run?.gates?.escalation?.status === "escalated";
    const force = fields.force === true;

    if (pendingBadges.length > 0 && !force) {
      throw new Error(
        `Cannot finalize run while workflow badges are still pending: ${pendingBadges.join(", ")}`
      );
    }
    if (hasEscalation && !force) {
      throw new Error("Cannot finalize run while escalated to human. Use --force to override.");
    }
    run.artifacts.finalSynthesis = artifact.path;
    run.status = fields.status || "completed";
    run.completedAt = nowIso();
  }
};

/**
 * @param {WorkflowRun} run
 * @param {ArtifactRef} artifact
 * @param {RunFields & BadgeOptions & { decision?: string, environment?: string, status?: string }} fields
 * @returns {void}
 */
function applyArtifactToRun(run, artifact, fields) {
  const handler = ARTIFACT_HANDLERS[artifact.kind];
  if (handler) {
    handler(run, artifact, fields);
  }
}

/**
 * @param {string} repoPath
 * @param {ArtifactRef} artifact
 * @param {RunFields & BadgeOptions & { decision?: string, environment?: string, status?: string }} [fields]
 * @returns {Promise<WorkflowRun|null>}
 */
export async function registerWorkflowArtifact(repoPath, artifact, fields = {}) {
  const state = await loadWorkflowState(repoPath);

  if (artifact.kind === "run-brief") {
    // BUG-B fix: archive the existing run instead of silently overwriting.
    // Pre-fix behavior destroyed pending gates (e.g. review_required) and
    // never populated recentRuns. archiveRun safely no-ops on null.
    archiveRun(state, state.currentRun);
    state.currentRun = createRun({
      title: fields.title,
      goal: fields.goal,
      mode: fields.mode,
      next: fields.next,
      path: artifact.path
    });
    await saveWorkflowState(repoPath, state);
    return state.currentRun;
  }

  const run = ensureCurrentRun(state, {
    title: fields.title || artifact.title,
    goal: fields.goal || "",
    mode: fields.mode || "",
    next: fields.next || ""
  });

  applyArtifactToRun(run, artifact, fields);

  run.updatedAt = nowIso();
  if (fields.next) {
    run.next = fields.next;
  }
  await saveWorkflowState(repoPath, state);
  return state.currentRun;
}

// Pending-badge specs: each maps the runtime gate-status check to the
// badge name emitted in the workflow summary. Keeping these as data lets
// summarizeWorkflowState stay small enough to read at a glance.
/** @type {Array<{ badge: string, check: (run: WorkflowRun|null|undefined) => boolean }>} */
const PENDING_BADGE_SPECS = [
  { badge: "review_required", check: (run) => run?.gates?.review?.status === "required" },
  { badge: "validation_expected", check: (run) => run?.gates?.validation?.status === "expected" },
  {
    badge: "dev_deploy_expected",
    check: (run) => run?.gates?.deployment?.dev?.status === "expected"
  },
  {
    badge: "prod_deploy_expected",
    check: (run) => run?.gates?.deployment?.prod?.status === "expected"
  },
  { badge: "blocked", check: (run) => run?.gates?.blocked?.status === "blocked" },
  { badge: "escalated_to_human", check: (run) => run?.gates?.escalation?.status === "escalated" }
];

/**
 * @param {WorkflowRun|null|undefined} currentRun
 * @returns {string[]}
 */
function collectPendingBadges(currentRun) {
  return PENDING_BADGE_SPECS.filter((spec) => spec.check(currentRun)).map((spec) => spec.badge);
}

/**
 * @param {WorkflowState} state
 * @returns {{ hasActiveRun: boolean, pendingBadges: string[], missingArtifactWrites: string[], currentRun: object|null }}
 */
export function summarizeWorkflowState(state) {
  const currentRun = state?.currentRun || null;
  if (!currentRun) {
    return {
      hasActiveRun: false,
      pendingBadges: [],
      missingArtifactWrites: [],
      currentRun: null
    };
  }

  const pendingBadges = collectPendingBadges(currentRun);
  const missingArtifactWrites = summarizeMissingArtifactWritesForRun(currentRun);

  return {
    hasActiveRun: currentRun.status !== "completed",
    pendingBadges,
    missingArtifactWrites,
    currentRun: {
      title: currentRun.title,
      goal: currentRun.goal,
      mode: currentRun.mode,
      status: currentRun.status,
      next: currentRun.next,
      gates: currentRun.gates,
      artifacts: currentRun.artifacts,
      updatedAt: currentRun.updatedAt
    }
  };
}
