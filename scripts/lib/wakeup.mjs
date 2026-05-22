import fs from "node:fs/promises";
import path from "node:path";

import { listApprovals } from "./approvals.mjs";
import { listClaims } from "./claims.mjs";
import { readDeploymentGuidanceSummary } from "./deployment-guidance.mjs";
import { loadWorkflowState, summarizeWorkflowState } from "./workflow-state.mjs";

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
const JSONL_TAIL_BYTES = 64 * 1024;

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readRecentJsonl(filePath, count, maxBytes = JSONL_TAIL_BYTES) {
  if (!(await pathExists(filePath))) {
    return [];
  }

  const handle = await fs.open(filePath, "r");
  try {
    const stat = await handle.stat();
    if (stat.size === 0) {
      return [];
    }

    const start = Math.max(0, stat.size - maxBytes);
    const length = stat.size - start;
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, start);

    let raw = buffer.toString("utf8");
    if (start > 0) {
      const firstNewline = raw.indexOf("\n");
      raw = firstNewline === -1 ? "" : raw.slice(firstNewline + 1);
    }

    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(-count)
      .map((line) => JSON.parse(line));
  } finally {
    await handle.close();
  }
}

async function readJson(filePath) {
  if (!(await pathExists(filePath))) {
    return null;
  }
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

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

function newestOf(...artifacts) {
  return (
    artifacts
      .filter(Boolean)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] || null
  );
}

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
    latestDeploymentCheck
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
    latestArtifactByPrefix(repoPath, DEPLOYMENTS_DIR, "deployment-check")
  ]);

  const historyPath = path.join(repoPath, ...HISTORY_PATH);
  const resolvedHistoryPath = (await pathExists(historyPath))
    ? historyPath
    : path.join(repoPath, ...LEGACY_HISTORY_PATH);
  const sprintPath = path.join(repoPath, ...SPRINT_PATH);
  const resolvedSprintPath = (await pathExists(sprintPath))
    ? sprintPath
    : path.join(repoPath, ...LEGACY_SPRINT_PATH);

  const [recentEventsRaw, recentClaimHistory, archiveCounts] = await Promise.all([
    readRecentJsonl(path.join(repoPath, ...EVENTS_PATH), RECENT_EVENTS_LIMIT),
    readRecentJsonl(resolvedHistoryPath, RECENT_HISTORY_LIMIT),
    countArchive(repoPath)
  ]);
  const repoMemory = await listRepoGuidance(repoPath);

  const recentEvents = recentEventsRaw.map((event) => ({
    timestamp: event.timestamp,
    event: event.event,
    payloadPath: event.payloadPath || ""
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
    repoGuidance: {
      deployment: latestDeploymentGuidance
    },
    repoMemory,
    recentClaimHistory,
    recentEvents,
    latestArtifacts,
    workflowState,
    memory,
    summary: {
      memoryPolicy: memory.policy,
      activeClaims: claims.length,
      openApprovals: openApprovals.length,
      hasActiveWorkflow: workflow.hasActiveRun,
      pendingWorkflowBadges: workflow.pendingBadges,
      hasDeploymentGuidance: Boolean(latestDeploymentGuidance),
      repoMemoryFiles: repoMemory.length,
      hasRecentRunMemory: Boolean(
        latestRunBrief ||
        latestFinalSynthesis ||
        latestHandoff ||
        latestReview ||
        latestValidationPlan ||
        latestValidationResult ||
        latestDeploymentCheck
      ),
      latestArtifact: summarizeLatestArtifact(
        newestOf(
          latestFinalSynthesis,
          latestRunBrief,
          latestHandoff,
          latestReview,
          latestValidationPlan,
          latestValidationResult,
          latestDeploymentCheck
        )
      ),
      archiveCounts
    }
  };
}
