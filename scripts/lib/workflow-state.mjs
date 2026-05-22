import fs from "node:fs/promises";
import path from "node:path";

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

function defaultWorkflowState() {
  return {
    version: "1.0",
    updatedAt: nowIso(),
    currentRun: null,
    recentRuns: []
  };
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function ensureFile(filePath, contents) {
  try {
    await fs.access(filePath);
  } catch {
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, contents);
  }
}

export async function ensureWorkflowStateScaffold(repoPath) {
  await ensureFile(
    path.join(repoPath, ...WORKFLOW_STATE_PATH),
    `${JSON.stringify(defaultWorkflowState(), null, 2)}\n`
  );
}

async function pathReadable(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

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

async function saveWorkflowState(repoPath, state) {
  const workflowPath = path.join(repoPath, ...WORKFLOW_STATE_PATH);
  state.updatedAt = nowIso();
  await ensureDir(path.dirname(workflowPath));
  await fs.writeFile(workflowPath, `${JSON.stringify(state, null, 2)}\n`);
}

function archiveRun(state, run) {
  if (!run) {
    return;
  }

  const archived = {
    title: run.title,
    goal: run.goal || "",
    mode: run.mode || "",
    status: run.status || "completed",
    startedAt: run.startedAt || run.updatedAt || nowIso(),
    completedAt: run.completedAt || run.updatedAt || nowIso(),
    gates: run.gates || { review: null, validation: null }
  };

  state.recentRuns = [archived, ...(state.recentRuns || [])].slice(0, MAX_RECENT_RUNS);
}

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
      }
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
const PENDING_GATE_CHECKS = [
  (run) => run?.gates?.review?.status === "required",
  (run) => run?.gates?.validation?.status === "expected",
  (run) => run?.gates?.deployment?.dev?.status === "expected",
  (run) => run?.gates?.deployment?.prod?.status === "expected"
];

function hasPendingGates(run) {
  return PENDING_GATE_CHECKS.some((check) => check(run));
}

// Artifact-shape helpers shared by progress/substance/evidence checks.
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

function hasSubstantialArtifact(artifacts) {
  return Boolean(
    artifacts?.handoffs?.length ||
    artifacts?.validationPlan ||
    artifacts?.validationResult ||
    artifacts?.deploymentChecks?.dev ||
    artifacts?.deploymentChecks?.prod
  );
}

function hasSubstantialGate(gates) {
  return Boolean(gates?.validation || gates?.deployment?.dev || gates?.deployment?.prod);
}

function hasSubstantialMode(mode) {
  return mode === "assisted single-session" || mode === "team run";
}

function hasMeaningfulProgress(run) {
  if (!run) return false;
  return Boolean(
    hasAnyWorkflowGate(run) || hasReviewOrValidationArtifact(run.artifacts) || run.next
  );
}

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

function isGateResolved(status) {
  return Boolean(status) && RESOLVED_GATE_STATUSES.has(status);
}

// Gate-status accessors used to test "is any gate resolved?".
const GATE_STATUS_GETTERS = [
  (gates) => gates.review?.status,
  (gates) => gates.validation?.status,
  (gates) => gates.deployment?.dev?.status,
  (gates) => gates.deployment?.prod?.status
];

// Closed-artifact accessors used to test "is any phase artifact written?".
const PHASE_ARTIFACT_GETTERS = [
  (artifacts) => artifacts.reviewResult,
  (artifacts) => artifacts.validationResult,
  (artifacts) => artifacts.deploymentChecks?.dev,
  (artifacts) => artifacts.deploymentChecks?.prod
];

function hasCompletedPhaseEvidence(run) {
  if (!run) return false;
  const gates = run.gates || {};
  const artifacts = run.artifacts || {};
  const anyGateResolved = GATE_STATUS_GETTERS.some((get) => isGateResolved(get(gates)));
  const anyArtifactWritten = PHASE_ARTIFACT_GETTERS.some((get) => Boolean(get(artifacts)));
  return anyGateResolved || anyArtifactWritten;
}

// "Decided" means the gate was explicitly closed pass/fail (not pending,
// not skipped). A decided gate without its corresponding artifact is a
// missing write-back.
function isDecided(status) {
  return status === "passed" || status === "failed";
}

// Spec table mapping each gate to its expected artifact slot and the
// missing-code emitted when the gate is decided but the artifact is absent.
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

function summarizeMissingArtifactWritesForRun(run) {
  if (!run) return [];
  const gates = run.gates || {};
  const artifacts = run.artifacts || {};

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

export async function startWorkflowRun(repoPath, fields = {}) {
  const state = await loadWorkflowState(repoPath);
  if (state.currentRun) {
    archiveRun(state, state.currentRun);
  }

  state.currentRun = createRun(fields);
  await saveWorkflowState(repoPath, state);
  return state.currentRun;
}

function ensureCurrentRun(state, fields = {}) {
  if (!state.currentRun) {
    state.currentRun = createRun(fields);
  }
  return state.currentRun;
}

// Badge -> (gate selector, status). `selector` takes the run and returns
// a [parent, key] tuple so the badge can assign without having to repeat
// the `run.gates.deployment.dev = ...` chain inline.
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
  prod_skipped: { selector: (run) => [run.gates.deployment, "prod"], status: "skipped" }
};

function applyBadge(run, badge, note = "") {
  const spec = BADGE_TABLE[badge];
  if (!spec) {
    throw new Error(`Unsupported workflow badge: ${badge}`);
  }
  const [parent, key] = spec.selector(run);
  parent[key] = { status: spec.status, updatedAt: nowIso(), note };
}

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
  applyBadge(run, badge, options.note || "");
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
    const pendingBadges = summarizeWorkflowState({ currentRun: run }).pendingBadges;
    if (pendingBadges.length > 0) {
      throw new Error(
        `Cannot finalize run while workflow badges are still pending: ${pendingBadges.join(", ")}`
      );
    }
    run.artifacts.finalSynthesis = artifact.path;
    run.status = fields.status || "completed";
    run.completedAt = nowIso();
  }
};

function applyArtifactToRun(run, artifact, fields) {
  const handler = ARTIFACT_HANDLERS[artifact.kind];
  if (handler) {
    handler(run, artifact, fields);
  }
}

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
const PENDING_BADGE_SPECS = [
  { badge: "review_required", check: (run) => run.gates?.review?.status === "required" },
  { badge: "validation_expected", check: (run) => run.gates?.validation?.status === "expected" },
  {
    badge: "dev_deploy_expected",
    check: (run) => run.gates?.deployment?.dev?.status === "expected"
  },
  {
    badge: "prod_deploy_expected",
    check: (run) => run.gates?.deployment?.prod?.status === "expected"
  }
];

function collectPendingBadges(currentRun) {
  return PENDING_BADGE_SPECS.filter((spec) => spec.check(currentRun)).map((spec) => spec.badge);
}

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
