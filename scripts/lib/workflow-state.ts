import fs from "node:fs/promises";
import path from "node:path";
import {
  archiveRun,
  createRun,
  summarizeMissingArtifactWritesForRun
} from "./workflow-state-gates.ts";
import type {
  WorkflowState,
  WorkflowRun,
  RunFields,
  RunGates,
  GateEntry,
  GateStatus
} from "./workflow-state-gates.ts";
import { readFileIfExists } from "./fs-utils.mjs";
import { type Result, ok, err } from "./result.ts";

// Re-export core types so callers that import from workflow-state get them.
export type {
  GateStatus,
  GateEntry,
  DeploymentGates,
  RunGates,
  RunArtifacts,
  WorkflowRun,
  WorkflowState,
  RunFields
} from "./workflow-state-gates.ts";

const STATE_DIR = [".claude", "state", "crew"] as const;
const WORKFLOW_STATE_PATH = [...STATE_DIR, "workflow-state.json"] as const;
const WORKFLOW_STATE_LOCK_PATH = [...STATE_DIR, "workflow-state.lock"] as const;
// Legacy path retained for read-side fallback so repos installed before the
// engineering-os -> crew rename still pick up their existing workflow state.
// Saves always go to the new path; the installer migration (Step 3) cleans
// the legacy file up.
const LEGACY_WORKFLOW_STATE_PATH = [
  ".claude",
  "state",
  "engineering-os",
  "workflow-state.json"
] as const;

export interface LoadOptions {
  createIfMissing?: boolean;
}

export interface BadgeOptions {
  badge?: string | undefined;
  title?: string | undefined;
  goal?: string | undefined;
  mode?: string | undefined;
  next?: string | undefined;
  note?: string | undefined;
  blockedBy?: string | null;
  force?: boolean;
  summary?: string | undefined;
}

export interface ArtifactRef {
  kind: string;
  path: string;
  title: string;
}

type RegisterFields = RunFields &
  BadgeOptions & {
    decision?: string | undefined;
    environment?: string | undefined;
    status?: string | undefined;
  };

// ---------------------------------------------------------------------------
// Private utilities
// ---------------------------------------------------------------------------

function nowIso(): string {
  return new Date().toISOString();
}

function defaultWorkflowState(): WorkflowState {
  return {
    version: "1.0",
    updatedAt: nowIso(),
    currentRun: null,
    recentRuns: []
  };
}

async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

async function ensureFile(filePath: string, contents: string): Promise<void> {
  try {
    await fs.access(filePath);
  } catch {
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, contents);
  }
}

// ---------------------------------------------------------------------------
// Public scaffold / load / save
// ---------------------------------------------------------------------------

export async function ensureWorkflowStateScaffold(repoPath: string): Promise<void> {
  await ensureFile(
    path.join(repoPath, ...WORKFLOW_STATE_PATH),
    `${JSON.stringify(defaultWorkflowState(), null, 2)}\n`
  );
}

export async function loadWorkflowState(
  repoPath: string,
  options: LoadOptions = {}
): Promise<WorkflowState> {
  const workflowPath = path.join(repoPath, ...WORKFLOW_STATE_PATH);
  const workflowText = await readFileIfExists(workflowPath);
  if (workflowText !== null) {
    // State file is always written by this module; shape is trusted.
    return JSON.parse(workflowText) as WorkflowState;
  }

  const legacyPath = path.join(repoPath, ...LEGACY_WORKFLOW_STATE_PATH);
  const legacyText = await readFileIfExists(legacyPath);
  if (legacyText !== null) {
    return JSON.parse(legacyText) as WorkflowState;
  }

  if (options.createIfMissing === false) {
    return defaultWorkflowState();
  }

  await ensureWorkflowStateScaffold(repoPath);
  return JSON.parse(await fs.readFile(workflowPath, "utf8")) as WorkflowState;
}

// ---------------------------------------------------------------------------
// Advisory lock for merge-safe concurrent writes
// ---------------------------------------------------------------------------

async function acquireLock(lockPath: string, timeout = 5000): Promise<void> {
  const start = Date.now();
  const staleThreshold = 10000; // 10 seconds
  while (Date.now() - start < timeout) {
    try {
      // Ensure lock directory exists first
      await ensureDir(path.dirname(lockPath));
      // Try to create lock file exclusively (fails if exists)
      const fd = await fs.open(lockPath, "wx");
      await fd.close();
      return;
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      if (err.code !== "EEXIST") throw e;

      // Lock exists; check if it's stale
      try {
        const stat = await fs.stat(lockPath);
        const age = Date.now() - stat.mtimeMs;
        if (age > staleThreshold) {
          // Lock is stale, remove it and retry
          await fs.unlink(lockPath).catch(() => {});
          continue;
        }
      } catch {
        // Stat failed, continue to backoff
      }

      // Lock exists and is fresh, backoff
      await new Promise((r) => setTimeout(r, 10));
    }
  }
  throw new Error("Workflow state lock timeout");
}

async function releaseLock(lockPath: string): Promise<void> {
  try {
    await fs.unlink(lockPath);
  } catch {
    // ENOENT or other errors are fine; lock is released
  }
}

async function saveWorkflowState(
  repoPath: string,
  state: WorkflowState,
  lockHeld = false
): Promise<void> {
  const lockPath = path.join(repoPath, ...WORKFLOW_STATE_LOCK_PATH);
  if (!lockHeld) {
    await acquireLock(lockPath);
  }
  try {
    const workflowPath = path.join(repoPath, ...WORKFLOW_STATE_PATH);
    state.updatedAt = nowIso();
    await ensureDir(path.dirname(workflowPath));
    await fs.writeFile(workflowPath, `${JSON.stringify(state, null, 2)}\n`);
  } finally {
    if (!lockHeld) {
      await releaseLock(lockPath);
    }
  }
}

// ---------------------------------------------------------------------------
// Run lifecycle
// ---------------------------------------------------------------------------

export async function startWorkflowRun(
  repoPath: string,
  fields: RunFields = {}
): Promise<WorkflowRun> {
  const lockPath = path.join(repoPath, ...WORKFLOW_STATE_LOCK_PATH);
  await acquireLock(lockPath);
  try {
    const state = await loadWorkflowState(repoPath);
    if (state.currentRun) {
      archiveRun(state, state.currentRun);
    }
    state.currentRun = createRun(fields);
    await saveWorkflowState(repoPath, state, true);
    return state.currentRun;
  } finally {
    await releaseLock(lockPath);
  }
}

function ensureCurrentRun(state: WorkflowState, fields: RunFields = {}): WorkflowRun {
  if (!state.currentRun) {
    state.currentRun = createRun(fields);
  }
  return state.currentRun;
}

// ---------------------------------------------------------------------------
// Badge table — maps badge name to gate selector and status
// ---------------------------------------------------------------------------

type GateParent = RunGates | RunGates["deployment"];

interface BadgeSpec {
  selector: (run: WorkflowRun) => [GateParent, string];
  status: GateStatus;
  custom?: boolean;
}

const BADGE_TABLE: Record<string, BadgeSpec> = {
  review_required: { selector: (run) => [run.gates, "review"], status: "required" },
  review_passed: { selector: (run) => [run.gates, "review"], status: "passed" },
  review_failed: { selector: (run) => [run.gates, "review"], status: "failed" },
  review_skipped: { selector: (run) => [run.gates, "review"], status: "skipped" },
  validation_expected: { selector: (run) => [run.gates, "validation"], status: "expected" },
  validation_passed: { selector: (run) => [run.gates, "validation"], status: "passed" },
  validation_failed: { selector: (run) => [run.gates, "validation"], status: "failed" },
  validation_skipped: { selector: (run) => [run.gates, "validation"], status: "skipped" },
  validation_stale: { selector: (run) => [run.gates, "validation"], status: "stale", custom: true },
  dev_deploy_expected: {
    selector: (run) => [run.gates.deployment, "dev"],
    status: "expected"
  },
  dev_checked: { selector: (run) => [run.gates.deployment, "dev"], status: "passed" },
  dev_failed: { selector: (run) => [run.gates.deployment, "dev"], status: "failed" },
  dev_skipped: { selector: (run) => [run.gates.deployment, "dev"], status: "skipped" },
  prod_deploy_expected: {
    selector: (run) => [run.gates.deployment, "prod"],
    status: "expected"
  },
  prod_checked: { selector: (run) => [run.gates.deployment, "prod"], status: "passed" },
  prod_failed: { selector: (run) => [run.gates.deployment, "prod"], status: "failed" },
  prod_skipped: { selector: (run) => [run.gates.deployment, "prod"], status: "skipped" },
  blocked: { selector: (run) => [run.gates, "blocked"], status: "blocked", custom: true },
  escalated_to_lead: {
    selector: (run) => [run.gates, "escalation"],
    status: "escalated",
    custom: true
  }
};

function applyBadge(
  run: WorkflowRun,
  badge: string,
  note = "",
  blockedBy: string | null = null
): void {
  const spec = BADGE_TABLE[badge];
  if (!spec) {
    throw new Error(`Unsupported workflow badge: ${badge}`);
  }
  const [parent, key] = spec.selector(run);

  if (spec.custom) {
    const gateObj: GateEntry = { status: spec.status, updatedAt: nowIso(), note: note || "" };
    if (badge === "blocked" && blockedBy !== null) {
      gateObj.blockedBy = blockedBy;
    }
    (parent as unknown as Record<string, GateEntry | null>)[key] = gateObj;
  } else {
    (parent as unknown as Record<string, GateEntry | null>)[key] = {
      status: spec.status,
      updatedAt: nowIso(),
      note: note || ""
    };
  }
}

// ---------------------------------------------------------------------------
// Badge mutation
// ---------------------------------------------------------------------------

export async function markWorkflowBadge(
  repoPath: string,
  options: BadgeOptions = {}
): Promise<Result<WorkflowRun | null, Error>> {
  const lockPath = path.join(repoPath, ...WORKFLOW_STATE_LOCK_PATH);
  try {
    const badge = options.badge;
    if (!badge) {
      throw new Error("Workflow badge is required.");
    }

    await acquireLock(lockPath);
    try {
      const state = await loadWorkflowState(repoPath);
      const run = ensureCurrentRun(state, {
        title: options.title || "Workflow Run",
        goal: options.goal || "",
        mode: options.mode || "",
        next: options.next || ""
      });
      applyBadge(run, badge, options.note || "", options.blockedBy ?? null);
      run.updatedAt = nowIso();
      if (options.next) {
        run.next = options.next;
      }
      await saveWorkflowState(repoPath, state, true);
      return ok(state.currentRun);
    } finally {
      await releaseLock(lockPath);
    }
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}

// ---------------------------------------------------------------------------
// Artifact handlers — per-kind dispatch (AC-8: extracted from registerWorkflowArtifact)
// ---------------------------------------------------------------------------

type ArtifactHandler = (run: WorkflowRun, artifact: ArtifactRef, fields: RegisterFields) => void;

function handleHandoff(run: WorkflowRun, artifact: ArtifactRef): void {
  run.artifacts.handoffs = [...(run.artifacts.handoffs || []), artifact.path].slice(-10);
}

function handleReviewResult(run: WorkflowRun, artifact: ArtifactRef, fields: RegisterFields): void {
  run.artifacts.reviewResult = artifact.path;
  applyBadge(
    run,
    fields.decision === "rejected" ? "review_failed" : "review_passed",
    fields.summary || ""
  );
}

function handleValidationPlan(
  run: WorkflowRun,
  artifact: ArtifactRef,
  fields: RegisterFields
): void {
  run.artifacts.validationPlan = artifact.path;
  applyBadge(run, "validation_expected", fields.summary || fields.goal || "");
}

function handleValidationResult(
  run: WorkflowRun,
  artifact: ArtifactRef,
  fields: RegisterFields
): void {
  run.artifacts.validationResult = artifact.path;
  applyBadge(
    run,
    fields.decision === "failed" ? "validation_failed" : "validation_passed",
    fields.summary || fields.goal || ""
  );
}

function handleDeploymentCheck(
  run: WorkflowRun,
  artifact: ArtifactRef,
  fields: RegisterFields
): void {
  const environment = fields.environment === "prod" ? "prod" : "dev";
  run.artifacts.deploymentChecks[environment] = artifact.path;
  applyBadge(
    run,
    fields.decision === "failed" ? `${environment}_failed` : `${environment}_checked`,
    fields.summary || fields.goal || ""
  );
}

function handleFinalSynthesis(
  run: WorkflowRun,
  artifact: ArtifactRef,
  fields: RegisterFields
): void {
  const stateSnapshot: WorkflowState = {
    currentRun: run,
    version: "",
    updatedAt: "",
    recentRuns: []
  };
  const pendingBadges = summarizeWorkflowState(stateSnapshot).pendingBadges;
  const hasEscalation = run?.gates?.escalation?.status === "escalated";
  const force = fields.force === true;

  if (pendingBadges.length > 0 && !force) {
    throw new Error(
      `Cannot finalize run while workflow badges are still pending: ${pendingBadges.join(", ")}`
    );
  }
  if (hasEscalation && !force) {
    throw new Error("Cannot finalize run while escalated to lead. Use --force to override.");
  }
  run.artifacts.finalSynthesis = artifact.path;
  run.status = fields.status || "completed";
  run.completedAt = nowIso();
}

// Per-artifact-kind handlers used by registerWorkflowArtifact. Each takes
// (run, artifact, fields) and mutates run in place. Centralizing the
// dispatch keeps registerWorkflowArtifact below the complexity budget
// and makes adding a new artifact kind a one-entry change.
const ARTIFACT_HANDLERS: Record<string, ArtifactHandler> = {
  handoff: handleHandoff,
  "review-result": handleReviewResult,
  "validation-plan": handleValidationPlan,
  "validation-result": handleValidationResult,
  "deployment-check": handleDeploymentCheck,
  "final-synthesis": handleFinalSynthesis
};

function applyArtifactToRun(run: WorkflowRun, artifact: ArtifactRef, fields: RegisterFields): void {
  const handler = ARTIFACT_HANDLERS[artifact.kind];
  if (handler) {
    handler(run, artifact, fields);
  }
}

// ---------------------------------------------------------------------------
// Artifact registration
// ---------------------------------------------------------------------------

export async function registerWorkflowArtifact(
  repoPath: string,
  artifact: ArtifactRef,
  fields: RegisterFields = {}
): Promise<WorkflowRun | null> {
  const lockPath = path.join(repoPath, ...WORKFLOW_STATE_LOCK_PATH);
  await acquireLock(lockPath);
  try {
    const state = await loadWorkflowState(repoPath);

    if (artifact.kind === "run-brief") {
      // BUG-B fix: archive the existing run instead of silently overwriting.
      // Pre-fix behavior destroyed pending gates (e.g. review_required) and
      // never populated recentRuns. archiveRun safely no-ops on null.
      archiveRun(state, state.currentRun);
      state.currentRun = createRun({
        ...(fields.title !== undefined ? { title: fields.title } : {}),
        ...(fields.goal !== undefined ? { goal: fields.goal } : {}),
        ...(fields.mode !== undefined ? { mode: fields.mode } : {}),
        ...(fields.next !== undefined ? { next: fields.next } : {}),
        path: artifact.path
      });
      await saveWorkflowState(repoPath, state, true);
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
    await saveWorkflowState(repoPath, state, true);
    return state.currentRun;
  } finally {
    await releaseLock(lockPath);
  }
}

// ---------------------------------------------------------------------------
// State summary
// ---------------------------------------------------------------------------

// Pending-badge specs: each maps the runtime gate-status check to the
// badge name emitted in the workflow summary. Keeping these as data lets
// summarizeWorkflowState stay small enough to read at a glance.
const PENDING_BADGE_SPECS: Array<{
  badge: string;
  check: (run: WorkflowRun | null | undefined) => boolean;
}> = [
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
  { badge: "escalated_to_lead", check: (run) => run?.gates?.escalation?.status === "escalated" }
];

function collectPendingBadges(currentRun: WorkflowRun | null | undefined): string[] {
  return PENDING_BADGE_SPECS.filter((spec) => spec.check(currentRun)).map((spec) => spec.badge);
}

export interface WorkflowStateSummary {
  hasActiveRun: boolean;
  pendingBadges: string[];
  missingArtifactWrites: string[];
  currentRun: object | null;
}

export function summarizeWorkflowState(state: WorkflowState): WorkflowStateSummary {
  const currentRun = state?.currentRun ?? null;
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
