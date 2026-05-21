import fs from "node:fs/promises";
import path from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

import { discoverDeploymentClues } from "./deployment-guidance.mjs";
import { buildWakeUpBrief } from "./wakeup.mjs";

const execFile = promisify(execFileCallback);
const BRANCH_COMMITS_LIMIT = 5;
const REPO_ACTIVITY_LIMIT = 8;

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function parseInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function runGit(repoPath, args) {
  try {
    const result = await execFile("git", args, { cwd: repoPath });
    return result.stdout.trim();
  } catch {
    return null;
  }
}

function parseStatusHeader(header) {
  const branchMatch = header.match(/^##\s+([^\s.]+|HEAD)(?:\.\.\.([^\s[]+))?(?:\s+\[(.+)\])?/);
  const details = branchMatch?.[3] || "";
  const aheadMatch = details.match(/ahead\s+(\d+)/);
  const behindMatch = details.match(/behind\s+(\d+)/);

  return {
    branch: branchMatch?.[1] || "",
    upstream: branchMatch?.[2] || "",
    ahead: aheadMatch ? parseInteger(aheadMatch[1]) : 0,
    behind: behindMatch ? parseInteger(behindMatch[1]) : 0
  };
}

function parseWorkingTree(statusOutput) {
  if (!statusOutput) {
    return {
      isGitRepo: false,
      branch: "",
      upstream: "",
      ahead: 0,
      behind: 0,
      modifiedCount: 0,
      untrackedCount: 0,
      stagedCount: 0,
      hasChanges: false,
      changedPaths: []
    };
  }

  const lines = statusOutput.split("\n").filter(Boolean);
  const header = parseStatusHeader(lines[0] || "");
  const entries = lines.slice(1);
  let modifiedCount = 0;
  let untrackedCount = 0;
  let stagedCount = 0;
  const changedPaths = [];

  for (const entry of entries) {
    const code = entry.slice(0, 2);
    const relativePath = entry.slice(3).trim();
    if (!relativePath) {
      continue;
    }
    changedPaths.push(relativePath);
    if (code.includes("?")) {
      untrackedCount += 1;
      continue;
    }
    if (code[0] && code[0] !== " ") {
      stagedCount += 1;
    }
    if (code[1] && code[1] !== " ") {
      modifiedCount += 1;
    }
  }

  return {
    isGitRepo: true,
    ...header,
    modifiedCount,
    untrackedCount,
    stagedCount,
    hasChanges: entries.length > 0,
    changedPaths
  };
}

function parseCommits(stdout) {
  if (!stdout) {
    return [];
  }

  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [hash = "", date = "", author = "", refs = "", subject = ""] = line.split("\t");
      return {
        hash,
        date,
        author,
        refs,
        subject
      };
    });
}

async function collectGitActivity(repoPath) {
  const statusOutput = await runGit(repoPath, ["status", "--short", "--branch"]);
  const workingTree = parseWorkingTree(statusOutput);
  if (!workingTree.isGitRepo) {
    return {
      isGitRepo: false,
      workingTree,
      recentBranchCommits: [],
      recentRepoActivity: []
    };
  }

  const [recentBranchCommitsOutput, recentRepoActivityOutput] = await Promise.all([
    runGit(repoPath, [
      "log",
      "--date=short",
      `--pretty=format:%h\t%ad\t%an\t\t%s`,
      `-${BRANCH_COMMITS_LIMIT}`
    ]),
    runGit(repoPath, [
      "log",
      "--all",
      "--date=short",
      `--pretty=format:%h\t%ad\t%an\t%d\t%s`,
      `-${REPO_ACTIVITY_LIMIT}`
    ])
  ]);

  return {
    isGitRepo: true,
    workingTree,
    recentBranchCommits: parseCommits(recentBranchCommitsOutput),
    recentRepoActivity: parseCommits(recentRepoActivityOutput)
  };
}

function collectArtifactActivity(wakeUpBrief) {
  const labels = {
    runBrief: "Run brief",
    finalSynthesis: "Final synthesis",
    handoff: "Handoff",
    review: "Review result",
    validationPlan: "Validation plan",
    validationResult: "Validation result",
    deploymentCheck: "Deployment check"
  };

  return Object.entries(wakeUpBrief.latestArtifacts || {})
    .filter(([, artifact]) => Boolean(artifact))
    .map(([kind, artifact]) => ({
      kind,
      label: labels[kind] || kind,
      title: artifact.title,
      updatedAt: artifact.updatedAt,
      path: artifact.path
    }))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function extractMarkdownField(body, label) {
  const match = body.match(new RegExp(`^\\*\\*${label}\\*\\*:\\s*(.+)$`, "m"));
  return match ? match[1].trim() : "";
}

async function readArtifactSummary(filePath, fallbackTitle = "") {
  if (!filePath || !(await pathExists(filePath))) {
    return null;
  }

  const stat = await fs.stat(filePath);
  const body = await fs.readFile(filePath, "utf8");
  const [heading = ""] = body.split("\n");

  return {
    path: filePath,
    title: heading.replace(/^#\s+/, "").trim() || fallbackTitle,
    updatedAt: stat.mtime.toISOString(),
    goal: extractMarkdownField(body, "Goal"),
    mode: extractMarkdownField(body, "Mode"),
    next: extractMarkdownField(body, "Next")
  };
}

async function collectRelevantArtifacts(wakeUpBrief) {
  const runArtifacts = wakeUpBrief.workflowState?.currentRun?.artifacts;
  if (!runArtifacts) {
    return collectArtifactActivity(wakeUpBrief);
  }

  const labels = {
    runBrief: "Run brief",
    finalSynthesis: "Final synthesis",
    handoff: "Handoff",
    review: "Review result",
    validationPlan: "Validation plan",
    validationResult: "Validation result",
    deploymentCheck: "Deployment check"
  };
  const candidates = [
    ["runBrief", runArtifacts.runBrief],
    ["finalSynthesis", runArtifacts.finalSynthesis],
    ["review", runArtifacts.reviewResult],
    ["validationPlan", runArtifacts.validationPlan],
    ["validationResult", runArtifacts.validationResult],
    ["deploymentCheck", runArtifacts.deploymentChecks?.dev || runArtifacts.deploymentChecks?.prod],
    ["handoff", runArtifacts.handoffs?.slice(-1)[0]]
  ];
  const summaries = await Promise.all(
    candidates.map(async ([kind, artifactPath]) => {
      const summary = await readArtifactSummary(artifactPath);
      if (!summary) {
        return null;
      }
      return {
        kind,
        label: labels[kind] || kind,
        title: summary.title,
        updatedAt: summary.updatedAt,
        path: summary.path,
        goal: summary.goal,
        mode: summary.mode,
        next: summary.next
      };
    })
  );
  const present = summaries.filter(Boolean);
  return present.length > 0 ? present : collectArtifactActivity(wakeUpBrief);
}

function buildRetrievalGuide(wakeUpBrief, artifacts) {
  const guide = [];

  for (const entry of wakeUpBrief.repoMemory.slice(0, 3)) {
    guide.push({
      kind: entry.kind,
      path: entry.path
    });
  }
  if (wakeUpBrief.repoGuidance?.deployment?.path) {
    guide.push({
      kind: "deployment-guidance",
      path: wakeUpBrief.repoGuidance.deployment.path
    });
  }
  for (const artifact of artifacts.slice(0, 3)) {
    guide.push({
      kind: artifact.kind,
      path: artifact.path
    });
  }

  return guide.filter(
    (entry, index, list) => list.findIndex((candidate) => candidate.path === entry.path) === index
  );
}

function buildCurrentObjective(wakeUpBrief, artifacts) {
  const currentRun = wakeUpBrief.workflow?.currentRun;
  if (currentRun) {
    return {
      source: "workflow",
      title: currentRun.title || "Workflow Run",
      goal: currentRun.goal || "",
      mode: currentRun.mode || "",
      status: currentRun.status || "",
      next: currentRun.next || ""
    };
  }

  const latestRun = artifacts.find((artifact) => artifact.kind === "runBrief");
  if (latestRun) {
    return {
      source: "run-artifact",
      title: latestRun.title,
      goal: latestRun.goal || "",
      mode: latestRun.mode || "",
      status: "idle",
      next: latestRun.next || ""
    };
  }

  const latestSynthesis = wakeUpBrief.latestArtifacts?.finalSynthesis;
  if (latestSynthesis) {
    return {
      source: "latest-final-synthesis",
      title: latestSynthesis.title,
      goal: "",
      mode: "",
      status: "completed",
      next: ""
    };
  }

  return {
    source: "none",
    title: "No active objective recorded",
    goal: "",
    mode: "",
    status: "idle",
    next: ""
  };
}

function buildBlockedOrMissing(wakeUpBrief, deploymentClues, gitActivity) {
  const blocked = [];
  const pending = new Set(wakeUpBrief.workflow?.pendingBadges || []);
  const missingWrites = new Set(wakeUpBrief.workflow?.missingArtifactWrites || []);
  const gates = wakeUpBrief.workflow?.currentRun?.gates || {};

  if (pending.has("review_required")) {
    blocked.push("Independent review is still required before commit, PR, or final completion.");
  }
  if (gates.review?.status === "failed") {
    blocked.push(`Independent review failed${gates.review.note ? `: ${gates.review.note}` : "."}`);
  }
  if (pending.has("validation_expected")) {
    blocked.push("Validation evidence is still expected for the current run.");
  }
  if (gates.validation?.status === "failed") {
    blocked.push(`Validation failed${gates.validation.note ? `: ${gates.validation.note}` : "."}`);
  }
  if (pending.has("dev_deploy_expected")) {
    blocked.push("Dev deployment evidence is still missing for the current run.");
  }
  if (gates.deployment?.dev?.status === "failed") {
    blocked.push(`Dev deployment checks failed${gates.deployment.dev.note ? `: ${gates.deployment.dev.note}` : "."}`);
  }
  if (pending.has("prod_deploy_expected")) {
    blocked.push("Production deployment evidence is still missing for the current run.");
  }
  if (gates.deployment?.prod?.status === "failed") {
    blocked.push(`Production deployment checks failed${gates.deployment.prod.note ? `: ${gates.deployment.prod.note}` : "."}`);
  }
  if (missingWrites.has("review_result_missing")) {
    blocked.push("Independent review appears complete, but the review artifact write-back is still missing.");
  }
  if (missingWrites.has("validation_result_missing")) {
    blocked.push("Validation appears complete, but the validation-result artifact write-back is still missing.");
  }
  if (missingWrites.has("dev_deployment_check_missing")) {
    blocked.push("Dev deployment evidence exists in workflow state, but the deployment-check artifact is still missing.");
  }
  if (missingWrites.has("prod_deployment_check_missing")) {
    blocked.push("Production deployment evidence exists in workflow state, but the deployment-check artifact is still missing.");
  }
  if (missingWrites.has("run_brief_missing")) {
    blocked.push("This run has meaningful progress, but the run-brief artifact is still missing.");
  }
  if (missingWrites.has("final_synthesis_missing")) {
    blocked.push("Meaningful workflow phases completed, but the final synthesis artifact is still missing.");
  }
  if (wakeUpBrief.openApprovals.length > 0) {
    blocked.push(`${wakeUpBrief.openApprovals.length} open approval(s) still need a decision.`);
  }
  if (!wakeUpBrief.hasClaudeMd) {
    blocked.push("This repo is not fully adopted into Crew yet.");
  }
  if (!wakeUpBrief.repoGuidance?.deployment && deploymentClues.clues.length > 0 && !wakeUpBrief.workflow?.hasActiveRun) {
    blocked.push("Deployment clues exist, but durable deployment guidance has not been recorded yet.");
  }
  if (gitActivity.workingTree.behind > 0) {
    blocked.push(`Current branch is behind ${gitActivity.workingTree.upstream || "upstream"} by ${gitActivity.workingTree.behind} commit(s).`);
  }

  return blocked;
}

function buildImportantReminders(wakeUpBrief, deploymentClues, gitActivity) {
  const reminders = [];
  const missingWrites = new Set(wakeUpBrief.workflow?.missingArtifactWrites || []);

  if (gitActivity.isGitRepo && gitActivity.workingTree.hasChanges) {
    reminders.push(
      `Working tree has ${gitActivity.workingTree.stagedCount} staged, ${gitActivity.workingTree.modifiedCount} modified, and ${gitActivity.workingTree.untrackedCount} untracked path(s).`
    );
  }
  if (!wakeUpBrief.summary.hasRecentRunMemory) {
    reminders.push("No recent run artifacts are recorded for this repo yet.");
  }
  if (!wakeUpBrief.repoGuidance?.deployment && deploymentClues.clues.length > 0) {
    reminders.push(
      `Deployment clues were found in ${deploymentClues.clues.slice(0, 3).join(", ")}${deploymentClues.clues.length > 3 ? ", ..." : ""}.`
    );
  }
  if (wakeUpBrief.claims.length > 0) {
    reminders.push(`${wakeUpBrief.claims.length} active claim(s) are still present in repo-local state.`);
  }
  if (wakeUpBrief.repoMemory.length <= 1) {
    reminders.push("Repo-specific memory is still thin; keep durable guidance and lessons learned up to date.");
  }
  if (missingWrites.size > 0) {
    reminders.push("A workflow phase appears complete, but the matching artifact write-back is still missing.");
  }

  return reminders;
}

function recommendedNextStep(wakeUpBrief, deploymentClues, gitActivity) {
  const pending = new Set(wakeUpBrief.workflow?.pendingBadges || []);
  const missingWrites = new Set(wakeUpBrief.workflow?.missingArtifactWrites || []);
  const currentRun = wakeUpBrief.workflow?.currentRun || null;
  const gates = currentRun?.gates || {};

  if (!wakeUpBrief.hasClaudeMd) {
    return "Run /crew:adopt so the repo has the Crew harness, repo guidance, and local workflow state.";
  }
  if (pending.has("review_required")) {
    return "Run independent review next before committing, opening a PR, or calling the work done.";
  }
  if (gates.review?.status === "failed") {
    return "Address the failed review findings before moving the work forward.";
  }
  if (pending.has("validation_expected")) {
    return "Run validation next and record the evidence before moving the work forward.";
  }
  if (gates.validation?.status === "failed") {
    return "Investigate the failed validation evidence and fix the issue before continuing.";
  }
  if (pending.has("dev_deploy_expected")) {
    return "Use /crew:ship to gather dev deployment evidence and verify the environment transition.";
  }
  if (gates.deployment?.dev?.status === "failed") {
    return "Investigate the failed dev deployment checks before attempting another rollout.";
  }
  if (pending.has("prod_deploy_expected")) {
    return "Decide whether production promotion is appropriate, then use /crew:ship to collect prod evidence.";
  }
  if (gates.deployment?.prod?.status === "failed") {
    return "Investigate the failed production checks immediately before any further promotion work.";
  }
  if (missingWrites.has("review_result_missing")) {
    return "Write the review-result artifact now so the run has an inspectable review gate record.";
  }
  if (missingWrites.has("validation_result_missing")) {
    return "Write the validation-result artifact now so the run keeps the evidence it already collected.";
  }
  if (missingWrites.has("dev_deployment_check_missing")) {
    return "Write the dev deployment-check artifact now so the environment evidence is recoverable next time.";
  }
  if (missingWrites.has("prod_deployment_check_missing")) {
    return "Write the production deployment-check artifact now so the rollout evidence is preserved.";
  }
  if (missingWrites.has("run_brief_missing")) {
    return "Write the run-brief artifact now so this workstream has a bounded starting point for recovery.";
  }
  if (missingWrites.has("final_synthesis_missing")) {
    return "Write the final synthesis now so the completed work and next step are preserved before you move on.";
  }
  if (wakeUpBrief.openApprovals.length > 0) {
    return "Resolve the open approval queue before pushing the workflow forward.";
  }
  if (currentRun?.next) {
    return currentRun.next;
  }
  if (!wakeUpBrief.repoGuidance?.deployment && deploymentClues.clues.length > 0) {
    return "Capture durable deployment guidance next so ship work can reuse repo-specific environment knowledge.";
  }
  if (gitActivity.workingTree.behind > 0) {
    return `Review or pull the ${gitActivity.workingTree.behind} upstream commit(s) before starting the next work chunk.`;
  }
  if (gitActivity.workingTree.hasChanges) {
    return "Decide whether the current uncommitted changes belong in the active work chunk or should be reviewed and split.";
  }
  return "Start the next work chunk with /crew:build or /crew:fix, or just describe the task to the lead.";
}

function buildSecondaryOptions(wakeUpBrief, deploymentClues, gitActivity) {
  const options = [];

  if (gitActivity.isGitRepo && gitActivity.workingTree.hasChanges) {
    options.push("Inspect the current working tree and decide whether anything should be staged, split, or discarded.");
  }
  if (!wakeUpBrief.repoGuidance?.deployment && deploymentClues.clues.length > 0) {
    options.push("Write repo deployment guidance now so later ship work does not need to rediscover CI/CD from scratch.");
  }
  if (!wakeUpBrief.summary.hasRecentRunMemory) {
    options.push("Leave a run brief once substantial work starts so the next session has bounded context to recover.");
  }
  if (wakeUpBrief.workflow?.hasActiveRun && !wakeUpBrief.workflow.currentRun?.next) {
    options.push("Record a concrete next step in workflow state or the next artifact so recovery nudges stay specific.");
  }

  return options.slice(0, 3);
}

// Best-effort lookup of the autonomous-loop plugin CLI from the Claude Code
// plugin cache. Returns null if not installed. The brief integration is
// optional — crew works fine without the plugin present.
async function findAutonomousLoopCli() {
  const home = process.env.HOME || process.env.USERPROFILE;
  if (!home) return null;
  const candidates = [
    `${home}/.claude/plugins/cache/autonomous-loop-dev/autonomous-loop/0.1.0/scripts/autonomous-loop.mjs`,
    `${home}/.claude/plugins/cache/autonomous-loop/autonomous-loop/0.1.0/scripts/autonomous-loop.mjs`
  ];
  for (const candidate of candidates) {
    if (await pathExists(candidate)) return candidate;
  }
  return null;
}

// Scan .claude/artifacts/crew/runs/ for cost-report-*.md files and parse
// their headers into a compact summary. Best-effort: corrupted or partial
// reports are skipped silently.
async function collectRecentCosts(repoPath, limit = 5) {
  const dir = path.join(repoPath, ".claude", "artifacts", "crew", "runs");
  if (!(await pathExists(dir))) {
    return { recent: [], totalReports: 0 };
  }
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return { recent: [], totalReports: 0 };
  }
  const files = entries
    .filter((e) => e.isFile() && /-cost-report-.+\.md$/.test(e.name))
    .map((e) => path.join(dir, e.name));
  if (files.length === 0) return { recent: [], totalReports: 0 };

  const stats = await Promise.all(
    files.map(async (f) => {
      try {
        const s = await fs.stat(f);
        return { f, mtime: s.mtimeMs };
      } catch {
        return null;
      }
    })
  );
  const sorted = stats
    .filter(Boolean)
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit);

  const recent = [];
  let totalUsd = 0;
  for (const { f } of sorted) {
    try {
      const text = await fs.readFile(f, "utf8");

      // Frontmatter fields (newer cost-reports). Falls through to body
      // patterns when missing, so reports written before the schema
      // change still parse.
      const fmMatch = text.match(/^---\n([\s\S]*?)\n---/);
      const fm = {};
      if (fmMatch) {
        for (const line of fmMatch[1].split(/\r?\n/)) {
          const kv = line.match(/^([\w_]+):\s*(.*)$/);
          if (kv) fm[kv[1]] = kv[2].trim();
        }
      }

      const runTitle = (fm.run_title || text.match(/^- Run Title:\s*(.+)$/m)?.[1] || "")
        .replace(/^"|"$/g, "").trim() || null;
      const usd = fm.usd != null
        ? Number(fm.usd)
        : Number(text.match(/^- Total USD:\s*\$([\d.]+)/m)?.[1] || 0) || null;
      const windowStart = text.match(/^- Window Start:\s*(.+)$/m)?.[1]?.trim() || null;
      const windowEnd = text.match(/^- Window End:\s*(.+)$/m)?.[1]?.trim() || null;
      const durationMs = fm.duration_ms ? Number(fm.duration_ms)
        : (windowStart && windowEnd ? Date.parse(windowEnd) - Date.parse(windowStart) : 0);
      const messages = Number(text.match(/^- Assistant Messages Counted:\s*(\d+)/m)?.[1] || 0);
      const totalTokens = fm.total_tokens
        ? Number(fm.total_tokens)
        : Number(text.match(/^- Total Tokens:\s*([\d,]+)/m)?.[1]?.replace(/,/g, "") || 0);
      const cacheHitPct = fm.cache_hit_pct
        ? Number(fm.cache_hit_pct)
        : Number(text.match(/^- Cache Hit %:\s*([\d.]+)/m)?.[1] || 0);

      const num = (re) => Number(text.match(re)?.[1]?.replace(/,/g, "") || 0);
      const inputTokens = num(/^- input:\s*([\d,]+)/m);
      const outputTokens = num(/^- output:\s*([\d,]+)/m);
      const cacheReadTokens = num(/^- cache_read:\s*([\d,]+)/m);
      const cacheCreate1h = num(/^- cache_create_1h:\s*([\d,]+)/m);
      const cacheCreate5m = num(/^- cache_create_5m:\s*([\d,]+)/m);

      // Model Mix lines: `- <model> (priced as <key>): <N> msgs (<msgPct>%), $<usd> (<usdPct>%)`
      const modelMix = [];
      const mixSection = text.split(/^##\s+/m).find((s) => s.startsWith("Model Mix"));
      if (mixSection) {
        for (const line of mixSection.split(/\r?\n/)) {
          const m = line.match(/^-\s+(\S+)\s+\(priced as\s+\S+\):\s+(\d+)\s+msgs\s+\(([\d.]+)%\),\s+\$([\d.]+)\s+\(([\d.]+)%\)/);
          if (m) modelMix.push({
            model: m[1],
            messages: Number(m[2]),
            msgPct: Number(m[3]),
            usd: Number(m[4]),
            usdPct: Number(m[5])
          });
        }
      }

      if (usd != null) totalUsd += usd;

      const cacheCreateTokens = cacheCreate5m + cacheCreate1h;
      const cacheRWTokens = cacheReadTokens + cacheCreateTokens;
      const ioTokens = inputTokens + outputTokens;
      const toM = (n) => Number((n / 1_000_000).toFixed(3));

      // Dominant model = top entry of modelMix (already sorted by usd desc
      // upstream). Skip the synthetic / unknown sentinel models so the
      // headline reflects a real LLM choice.
      const dominantEntry = modelMix.find((m) => !/^<|unknown/i.test(m.model)) || modelMix[0] || null;
      const dominantModel = dominantEntry ? {
        model: dominantEntry.model,
        msgPct: dominantEntry.msgPct,
        usdPct: dominantEntry.usdPct
      } : null;

      recent.push({
        path: f,
        runTitle,
        usd,
        windowStart,
        windowEnd,
        durationMs,
        durationMin: durationMs ? Number((durationMs / 60000).toFixed(1)) : 0,
        messages,
        totalTokens,
        cacheHitPct,
        inputTokens,
        outputTokens,
        cacheReadTokens,
        cacheCreateTokens,
        cacheRWTokens,
        cacheRWMillions: toM(cacheRWTokens),
        ioTokens,
        ioMillions: toM(ioTokens),
        dominantModel,
        modelMix
      });
    } catch {
      // skip unreadable file
    }
  }

  const avgUsd = recent.length ? Number((totalUsd / recent.length).toFixed(4)) : 0;
  return {
    recent,
    totalReports: files.length,
    sumUsdRecent: Number(totalUsd.toFixed(4)),
    avgUsdRecent: avgUsd
  };
}

async function fetchAutonomousLoopBrief(repoPath) {
  try {
    const cli = await findAutonomousLoopCli();
    if (!cli) return null;
    const { stdout } = await execFile("node", [cli, "brief", "--repo", repoPath], {
      maxBuffer: 1024 * 1024
    });
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

export async function buildBriefingReport(repoPath) {
  const [wakeUpBrief, gitActivity, deploymentClues, autonomousLoopBrief, costs] = await Promise.all([
    buildWakeUpBrief(repoPath, { readOnly: true }),
    collectGitActivity(repoPath),
    discoverDeploymentClues(repoPath),
    fetchAutonomousLoopBrief(repoPath),
    collectRecentCosts(repoPath, 5)
  ]);

  // Attach cost summary to autonomous-loop block when the plugin is installed,
  // so the user-facing "Autonomous Loop" section in brief-me renders it
  // alongside backlog counts and grades. Also expose top-level for non-loop users.
  if (autonomousLoopBrief && costs.recent.length > 0) {
    autonomousLoopBrief.costs = costs;
  }

  const artifacts = await collectRelevantArtifacts(wakeUpBrief);
  const currentObjective = buildCurrentObjective(wakeUpBrief, artifacts);
  const blockedOrMissing = buildBlockedOrMissing(wakeUpBrief, deploymentClues, gitActivity);
  const reminders = buildImportantReminders(wakeUpBrief, deploymentClues, gitActivity);
  const nextStep = recommendedNextStep(wakeUpBrief, deploymentClues, gitActivity);
  const secondaryOptions = buildSecondaryOptions(wakeUpBrief, deploymentClues, gitActivity);
  const retrievalGuide = buildRetrievalGuide(wakeUpBrief, artifacts);

  return {
    repoPath: wakeUpBrief.repoPath,
    wakeUp: wakeUpBrief,
    git: gitActivity,
    sections: {
      currentObjective,
      recentActivity: {
        latestArtifacts: artifacts,
        repoMemory: wakeUpBrief.repoMemory,
        retrievalGuide,
        git: gitActivity
      },
      inProgress: {
        workflow: wakeUpBrief.workflow,
        activeClaims: wakeUpBrief.claims,
        openApprovals: wakeUpBrief.openApprovals
      },
      blockedOrMissing,
      importantReminders: reminders,
      recommendedNextStep: nextStep,
      secondaryOptions
    },
    summary: {
      isGitRepo: gitActivity.isGitRepo,
      hasActiveWorkflow: wakeUpBrief.workflow.hasActiveRun,
      pendingWorkflowBadges: wakeUpBrief.workflow.pendingBadges,
      hasRecentArtifacts: artifacts.length > 0,
      hasDeploymentGuidance: Boolean(wakeUpBrief.repoGuidance?.deployment),
      discoveredDeploymentClues: deploymentClues.clues.length,
      autonomousLoopInstalled: Boolean(autonomousLoopBrief),
      costReports: costs.totalReports,
      recentCostUsdSum: costs.sumUsdRecent || 0,
      recentCostUsdAvg: costs.avgUsdRecent || 0
    },
    autonomousLoop: autonomousLoopBrief,
    costs
  };
}
