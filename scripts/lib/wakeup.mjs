/* eslint-disable max-lines -- module assembles all wake-up data sources; 423 total lines (rule counts ~301 code lines excluding blanks/comments per skipBlankLines+skipComments) — acceptable for a single-concern aggregator */
import fs from "node:fs/promises";
import path from "node:path";

import { listApprovals } from "./approvals.ts";
import { listClaims } from "./claims.ts";
import { readDeploymentGuidanceSummary } from "./deployment-guidance/read.ts";
import { readFileIfExists } from "./fs-utils.mjs";
import { tailReadJsonl } from "./jsonl.mjs";
import { loadWorkflowState, summarizeWorkflowState } from "./workflow-state.ts";
import { collectHookHealth } from "./briefing/collect.ts";

const RUNS_DIR = [".claude", "artifacts", "crew", "runs"];
const HANDOFFS_DIR = [".claude", "artifacts", "crew", "handoffs"];
const REVIEWS_DIR = [".claude", "artifacts", "crew", "reviews"];
const VALIDATIONS_DIR = [".claude", "artifacts", "crew", "validations"];
const DEPLOYMENTS_DIR = [".claude", "artifacts", "crew", "deployments"];
const EVENTS_PATH = [".claude", "logs", "events.jsonl"];
const HISTORY_PATH = [".claude", "state", "crew", "history.jsonl"];
const SPRINT_PATH = [".claude", "state", "crew", "sprint.json"];
// Legacy paths kept as read-only fallbacks for repos installed before the
// engineering-os -> crew rename. Installer migration moves these forward.
const LEGACY_HISTORY_PATH = [".claude", "state", "engineering-os", "history.jsonl"];
const LEGACY_SPRINT_PATH = [".claude", "state", "engineering-os", "sprint.json"];
const LEGACY_REPO_GUIDES_DIR = [".claude", "engineering-os"];
const REPO_GUIDES_DIR = [".claude", "crew"];

const RECENT_EVENTS_LIMIT = 3;
const RECENT_HISTORY_LIMIT = 3;

/**
 * @param {string} targetPath
 * @returns {Promise<boolean>}
 */
async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} filePath
 * @returns {Promise<object | null>}
 */
async function readJson(filePath) {
  const text = await readFileIfExists(filePath);
  return text === null ? null : JSON.parse(text);
}

/**
 * @param {string} dirPath
 * @returns {Promise<number>}
 */
async function countFiles(dirPath) {
  if (!(await pathExists(dirPath))) {
    return 0;
  }

  const entries = await fs.readdir(dirPath);
  let count = 0;
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry);
    const stat = await fs.stat(fullPath);
    if (stat.isFile()) {
      count += 1;
    }
  }
  return count;
}

/**
 * @param {string} dirPath
 * @returns {Promise<{ path: string, mtimeMs: number }[]>}
 */
async function listFilesNewestFirst(dirPath) {
  if (!(await pathExists(dirPath))) {
    return [];
  }

  const entries = await fs.readdir(dirPath);
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry);
    const stat = await fs.stat(fullPath);
    if (stat.isFile()) {
      files.push({ path: fullPath, mtimeMs: stat.mtimeMs });
    }
  }
  return files.sort((left, right) => right.mtimeMs - left.mtimeMs);
}

/**
 * @param {string} repoPath
 * @param {string[]} subdir
 * @param {string} prefix
 * @returns {Promise<{ path: string, title: string, updatedAt: string } | null>}
 */
async function latestArtifactByPrefix(repoPath, subdir, prefix) {
  const dirPath = path.join(repoPath, ...subdir);
  const files = await listFilesNewestFirst(dirPath);
  const match = files.find((file) => path.basename(file.path).includes(`-${prefix}-`));
  if (!match) {
    return null;
  }

  const body = await fs.readFile(match.path, "utf8");
  const [heading = ""] = body.split("\n");
  return {
    path: match.path,
    title: heading.replace(/^#\s+/, "").trim(),
    updatedAt: new Date(match.mtimeMs).toISOString()
  };
}

/**
 * @param {string} dirPath
 * @param {{ path: string, kind: string }[]} guides
 * @returns {Promise<void>}
 */
async function collectGuideFiles(dirPath, guides) {
  if (!(await pathExists(dirPath))) {
    return;
  }
  const entries = await fs.readdir(dirPath);
  for (const entry of entries.sort()) {
    if (!entry.endsWith(".md")) {
      continue;
    }
    guides.push({
      path: path.join(dirPath, entry),
      kind: "repo-guide"
    });
  }
}

/**
 * @param {string} repoPath
 * @returns {Promise<{ path: string, kind: string }[]>}
 */
async function listRepoGuidance(repoPath) {
  const claudePath = path.join(repoPath, "CLAUDE.md");
  const guides = [];

  if (await pathExists(claudePath)) {
    guides.push({
      path: claudePath,
      kind: "claude-md"
    });
  }

  await collectGuideFiles(path.join(repoPath, ...REPO_GUIDES_DIR), guides);
  // Fallback for unmigrated repos: surface legacy guides until the installer
  // moves them. Step 3 migration relocates them under .claude/crew/.
  await collectGuideFiles(path.join(repoPath, ...LEGACY_REPO_GUIDES_DIR), guides);

  return guides;
}

/**
 * @param {(({ path: string, title: string, updatedAt: string }) | null | undefined)[]} artifacts
 * @returns {{ path: string, title: string, updatedAt: string } | null}
 */
function newestOf(...artifacts) {
  return (
    artifacts
      .filter(Boolean)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] || null
  );
}

/**
 * @param {({ path: string, title: string, updatedAt: string }) | null} artifact
 */
function summarizeLatestArtifact(artifact) {
  if (!artifact) {
    return null;
  }

  return {
    title: artifact.title,
    updatedAt: artifact.updatedAt,
    path: artifact.path
  };
}

/**
 * @param {string} repoPath
 * @returns {Promise<{ runs: number, handoffs: number, reviews: number, validations: number, deployments: number }>}
 */
async function countArchive(repoPath) {
  const [runs, handoffs, reviews, validations, deployments] = await Promise.all([
    countFiles(path.join(repoPath, ...RUNS_DIR)),
    countFiles(path.join(repoPath, ...HANDOFFS_DIR)),
    countFiles(path.join(repoPath, ...REVIEWS_DIR)),
    countFiles(path.join(repoPath, ...VALIDATIONS_DIR)),
    countFiles(path.join(repoPath, ...DEPLOYMENTS_DIR))
  ]);

  return { runs, handoffs, reviews, validations, deployments };
}

/**
 * @param {{ claims: object[], openApprovals: object[], sprint: object | null,
 *           workflow: object, latestDeploymentGuidance: object | null,
 *           latestRunBrief: object | null, latestFinalSynthesis: object | null,
 *           latestHandoff: object | null, latestReview: object | null,
 *           latestValidationPlan: object | null, latestValidationResult: object | null,
 *           latestDeploymentCheck: object | null, repoMemory: object[],
 *           recentEvents: object[], recentClaimHistory: object[],
 *           archiveCounts: object }} _
 * @returns {Record<string, unknown>}
 */
// eslint-disable-next-line max-lines-per-function -- linear accumulator over heterogeneous entry types — no meaningful split boundary
function buildMemoryBuckets({
  claims,
  openApprovals,
  sprint,
  workflow,
  latestDeploymentGuidance,
  latestRunBrief,
  latestFinalSynthesis,
  latestHandoff,
  latestReview,
  latestValidationPlan,
  latestValidationResult,
  latestDeploymentCheck,
  repoMemory,
  recentEvents,
  recentClaimHistory,
  archiveCounts
}) {
  return {
    policy: "bounded-v1",
    hot: {
      claims,
      openApprovals,
      sprint,
      workflow,
      repoGuidance: {
        deployment: latestDeploymentGuidance
      },
      repoMemory,
      latestArtifacts: {
        runBrief: latestRunBrief,
        finalSynthesis: latestFinalSynthesis,
        handoff: latestHandoff,
        validationPlan: latestValidationPlan,
        deploymentCheck: latestDeploymentCheck
      }
    },
    warm: {
      review: latestReview,
      validation: latestValidationResult,
      recentEvents,
      recentClaimHistory
    },
    cold: {
      archiveCounts,
      omittedByDefault: [
        "older_artifacts",
        "resolved_approvals",
        "full_event_log",
        "full_history_log"
      ]
    }
  };
}

/**
 * @param {string} repoPath
 * @param {{ readOnly?: boolean }} [options]
 */
// eslint-disable-next-line max-lines-per-function -- orchestrator: sequential async pipeline composing 8 independent data sources — extracting sub-functions would invert readability
export async function buildWakeUpBrief(repoPath, options = {}) {
  const readOnly = options.readOnly === true;
  const [
    openApprovals,
    claims,
    sprint,
    workflowState,
    latestDeploymentGuidance,
    latestRunBrief,
    latestFinalSynthesis,
    latestHandoff,
    latestReview,
    latestValidationPlan,
    latestValidationResult,
    latestDeploymentCheck,
    hookHealth
  ] = await Promise.all([
    listApprovals(repoPath, { status: "open", createIfMissing: !readOnly }),
    listClaims(repoPath, { createIfMissing: !readOnly }),
    readJson(
      (await pathExists(path.join(repoPath, ...SPRINT_PATH)))
        ? path.join(repoPath, ...SPRINT_PATH)
        : path.join(repoPath, ...LEGACY_SPRINT_PATH)
    ),
    loadWorkflowState(repoPath, { createIfMissing: !readOnly }),
    readDeploymentGuidanceSummary(repoPath),
    latestArtifactByPrefix(repoPath, RUNS_DIR, "run-brief"),
    latestArtifactByPrefix(repoPath, RUNS_DIR, "final-synthesis"),
    latestArtifactByPrefix(repoPath, HANDOFFS_DIR, "handoff"),
    latestArtifactByPrefix(repoPath, REVIEWS_DIR, "review-result"),
    latestArtifactByPrefix(repoPath, VALIDATIONS_DIR, "validation-plan"),
    latestArtifactByPrefix(repoPath, VALIDATIONS_DIR, "validation-result"),
    latestArtifactByPrefix(repoPath, DEPLOYMENTS_DIR, "deployment-check"),
    collectHookHealth(repoPath)
  ]);

  const historyPath = path.join(repoPath, ...HISTORY_PATH);
  const resolvedHistoryPath = (await pathExists(historyPath))
    ? historyPath
    : path.join(repoPath, ...LEGACY_HISTORY_PATH);
  const [recentEventsRaw, recentClaimHistory, archiveCounts] = await Promise.all([
    tailReadJsonl(path.join(repoPath, ...EVENTS_PATH), RECENT_EVENTS_LIMIT),
    tailReadJsonl(resolvedHistoryPath, RECENT_HISTORY_LIMIT),
    countArchive(repoPath)
  ]);
  const repoMemory = await listRepoGuidance(repoPath);

  const recentEvents = recentEventsRaw.map((event) => ({
    timestamp: /** @type {string} */ (event["timestamp"]),
    event: /** @type {string} */ (event["event"]),
    payloadPath: /** @type {string} */ (event["payloadPath"] || "")
  }));

  const latestArtifacts = {
    runBrief: latestRunBrief,
    finalSynthesis: latestFinalSynthesis,
    handoff: latestHandoff,
    review: latestReview,
    validationPlan: latestValidationPlan,
    validationResult: latestValidationResult,
    deploymentCheck: latestDeploymentCheck
  };

  const workflow = summarizeWorkflowState(workflowState);

  const memory = buildMemoryBuckets({
    claims,
    openApprovals,
    sprint,
    workflow,
    latestDeploymentGuidance,
    latestRunBrief,
    latestFinalSynthesis,
    latestHandoff,
    latestReview,
    latestValidationPlan,
    latestValidationResult,
    latestDeploymentCheck,
    repoMemory,
    recentEvents,
    recentClaimHistory,
    archiveCounts
  });

  return {
    repoPath,
    hasClaudeMd: await pathExists(path.join(repoPath, "CLAUDE.md")),
    sprint,
    claims,
    openApprovals,
    workflow,
    repoGuidance: { deployment: latestDeploymentGuidance },
    repoMemory,
    recentClaimHistory,
    recentEvents,
    latestArtifacts,
    workflowState,
    hookHealth,
    memory,
    summary: buildWakeUpSummary({
      memory,
      claims,
      openApprovals,
      workflow,
      latestDeploymentGuidance,
      repoMemory,
      latestArtifacts,
      archiveCounts
    })
  };
}

/**
 * @param {{ memory: Record<string, unknown>, claims: object[], openApprovals: object[],
 *           workflow: { hasActiveRun: boolean, pendingBadges: string[] },
 *           latestDeploymentGuidance: object | null, repoMemory: object[],
 *           latestArtifacts: object, archiveCounts: object }} _
 * @returns {object}
 */
function buildWakeUpSummary({
  memory,
  claims,
  openApprovals,
  workflow,
  latestDeploymentGuidance,
  repoMemory,
  latestArtifacts,
  archiveCounts
}) {
  const recentArtifactList =
    /** @type {(({ path: string, title: string, updatedAt: string }) | null | undefined)[]} */ (
      Object.values(latestArtifacts)
    );
  const newest = newestOf(...recentArtifactList);
  return {
    memoryPolicy: /** @type {string} */ (memory["policy"]),
    activeClaims: claims.length,
    openApprovals: openApprovals.length,
    hasActiveWorkflow: workflow.hasActiveRun,
    pendingWorkflowBadges: workflow.pendingBadges,
    hasDeploymentGuidance: Boolean(latestDeploymentGuidance),
    repoMemoryFiles: repoMemory.length,
    hasRecentRunMemory: recentArtifactList.some(Boolean),
    latestArtifact: summarizeLatestArtifact(newest),
    archiveCounts
  };
}
