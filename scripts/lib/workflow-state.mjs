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

async function workflowStateExists(repoPath) {
  if (await pathReadable(path.join(repoPath, ...WORKFLOW_STATE_PATH))) {
    return true;
  }
  return pathReadable(path.join(repoPath, ...LEGACY_WORKFLOW_STATE_PATH));
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

function hasPendingGates(run) {
  return Boolean(
    run?.gates?.review?.status === "required" ||
    run?.gates?.validation?.status === "expected" ||
    run?.gates?.deployment?.dev?.status === "expected" ||
    run?.gates?.deployment?.prod?.status === "expected"
  );
}

function hasMeaningfulProgress(run) {
  if (!run) {
    return false;
  }

  return Boolean(
    hasAnyWorkflowGate(run) ||
    run?.artifacts?.handoffs?.length ||
    run?.artifacts?.reviewResult ||
    run?.artifacts?.validationPlan ||
    run?.artifacts?.validationResult ||
    run?.artifacts?.deploymentChecks?.dev ||
    run?.artifacts?.deploymentChecks?.prod ||
    run?.next
  );
}

function isSubstantialRunHint(run) {
  if (!run) {
    return false;
  }

  return Boolean(
    run.mode === "assisted single-session" ||
    run.mode === "team run" ||
    run.artifacts?.handoffs?.length ||
    run.artifacts?.validationPlan ||
    run.artifacts?.validationResult ||
    run.artifacts?.deploymentChecks?.dev ||
    run.artifacts?.deploymentChecks?.prod ||
    run.gates?.validation ||
    run.gates?.deployment?.dev ||
    run.gates?.deployment?.prod
  );
}

function hasCompletedPhaseEvidence(run) {
  if (!run) {
    return false;
  }

  const reviewStatus = run.gates?.review?.status || null;
  const validationStatus = run.gates?.validation?.status || null;
  const devDeployStatus = run.gates?.deployment?.dev?.status || null;
  const prodDeployStatus = run.gates?.deployment?.prod?.status || null;

  return Boolean(
    reviewStatus === "passed" ||
    reviewStatus === "failed" ||
    reviewStatus === "skipped" ||
    validationStatus === "passed" ||
    validationStatus === "failed" ||
    validationStatus === "skipped" ||
    devDeployStatus === "passed" ||
    devDeployStatus === "failed" ||
    devDeployStatus === "skipped" ||
    prodDeployStatus === "passed" ||
    prodDeployStatus === "failed" ||
    prodDeployStatus === "skipped" ||
    run.artifacts?.reviewResult ||
    run.artifacts?.validationResult ||
    run.artifacts?.deploymentChecks?.dev ||
    run.artifacts?.deploymentChecks?.prod
  );
}

function summarizeMissingArtifactWritesForRun(run) {
  if (!run) {
    return [];
  }

  const missing = [];
  const reviewStatus = run.gates?.review?.status || null;
  const validationStatus = run.gates?.validation?.status || null;
  const devDeployStatus = run.gates?.deployment?.dev?.status || null;
  const prodDeployStatus = run.gates?.deployment?.prod?.status || null;
  const hasProgress = hasMeaningfulProgress(run);
  const substantialRun = isSubstantialRunHint(run);

  if ((reviewStatus === "passed" || reviewStatus === "failed") && !run.artifacts?.reviewResult) {
    missing.push("review_result_missing");
  }
  if ((validationStatus === "passed" || validationStatus === "failed") && !run.artifacts?.validationResult) {
    missing.push("validation_result_missing");
  }
  if ((devDeployStatus === "passed" || devDeployStatus === "failed") && !run.artifacts?.deploymentChecks?.dev) {
    missing.push("dev_deployment_check_missing");
  }
  if ((prodDeployStatus === "passed" || prodDeployStatus === "failed") && !run.artifacts?.deploymentChecks?.prod) {
    missing.push("prod_deployment_check_missing");
  }
  if (substantialRun && hasProgress && !run.artifacts?.runBrief) {
    missing.push("run_brief_missing");
  }
  if (substantialRun && hasCompletedPhaseEvidence(run) && !hasPendingGates(run) && !run.artifacts?.finalSynthesis) {
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

function applyBadge(run, badge, note = "") {
  const updatedAt = nowIso();
  if (badge === "review_required") {
    run.gates.review = { status: "required", updatedAt, note };
    return;
  }
  if (badge === "review_passed") {
    run.gates.review = { status: "passed", updatedAt, note };
    return;
  }
  if (badge === "review_failed") {
    run.gates.review = { status: "failed", updatedAt, note };
    return;
  }
  if (badge === "review_skipped") {
    run.gates.review = { status: "skipped", updatedAt, note };
    return;
  }
  if (badge === "validation_expected") {
    run.gates.validation = { status: "expected", updatedAt, note };
    return;
  }
  if (badge === "validation_passed") {
    run.gates.validation = { status: "passed", updatedAt, note };
    return;
  }
  if (badge === "validation_failed") {
    run.gates.validation = { status: "failed", updatedAt, note };
    return;
  }
  if (badge === "validation_skipped") {
    run.gates.validation = { status: "skipped", updatedAt, note };
    return;
  }
  if (badge === "dev_deploy_expected") {
    run.gates.deployment.dev = { status: "expected", updatedAt, note };
    return;
  }
  if (badge === "dev_checked") {
    run.gates.deployment.dev = { status: "passed", updatedAt, note };
    return;
  }
  if (badge === "dev_failed") {
    run.gates.deployment.dev = { status: "failed", updatedAt, note };
    return;
  }
  if (badge === "dev_skipped") {
    run.gates.deployment.dev = { status: "skipped", updatedAt, note };
    return;
  }
  if (badge === "prod_deploy_expected") {
    run.gates.deployment.prod = { status: "expected", updatedAt, note };
    return;
  }
  if (badge === "prod_checked") {
    run.gates.deployment.prod = { status: "passed", updatedAt, note };
    return;
  }
  if (badge === "prod_failed") {
    run.gates.deployment.prod = { status: "failed", updatedAt, note };
    return;
  }
  if (badge === "prod_skipped") {
    run.gates.deployment.prod = { status: "skipped", updatedAt, note };
    return;
  }

  throw new Error(`Unsupported workflow badge: ${badge}`);
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

  if (artifact.kind === "handoff") {
    run.artifacts.handoffs = [...(run.artifacts.handoffs || []), artifact.path].slice(-10);
  } else if (artifact.kind === "review-result") {
    run.artifacts.reviewResult = artifact.path;
    applyBadge(
      run,
      fields.decision === "rejected" ? "review_failed" : "review_passed",
      fields.summary || ""
    );
  } else if (artifact.kind === "validation-plan") {
    run.artifacts.validationPlan = artifact.path;
    applyBadge(run, "validation_expected", fields.summary || fields.goal || "");
  } else if (artifact.kind === "validation-result") {
    run.artifacts.validationResult = artifact.path;
    applyBadge(
      run,
      fields.decision === "failed" ? "validation_failed" : "validation_passed",
      fields.summary || fields.goal || ""
    );
  } else if (artifact.kind === "deployment-check") {
    const environment = fields.environment === "prod" ? "prod" : "dev";
    run.artifacts.deploymentChecks[environment] = artifact.path;
    applyBadge(
      run,
      fields.decision === "failed"
        ? `${environment}_failed`
        : `${environment}_checked`,
      fields.summary || fields.goal || ""
    );
  } else if (artifact.kind === "final-synthesis") {
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

  run.updatedAt = nowIso();
  if (fields.next) {
    run.next = fields.next;
  }
  await saveWorkflowState(repoPath, state);
  return state.currentRun;
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

  const pendingBadges = [];
  if (currentRun.gates?.review?.status === "required") {
    pendingBadges.push("review_required");
  }
  if (currentRun.gates?.validation?.status === "expected") {
    pendingBadges.push("validation_expected");
  }
  if (currentRun.gates?.deployment?.dev?.status === "expected") {
    pendingBadges.push("dev_deploy_expected");
  }
  if (currentRun.gates?.deployment?.prod?.status === "expected") {
    pendingBadges.push("prod_deploy_expected");
  }
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
