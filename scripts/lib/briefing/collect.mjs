// Data-collection layer for brief-me. Pure I/O — no rendering, no markdown.
//
// Returns shapes that briefing.mjs orchestrator hands to ./render.mjs.
// Extracted from briefing.mjs during the Tier B-7 split.

import fs from "node:fs/promises";
import path from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { buildCostAdvisor } from "../cost-advisor.mjs";
import {
  parseCostReportText,
  dedupeForRollup,
  aggregateRoleDispatches
} from "./collect-cost-parser.mjs";

const execFile = promisify(execFileCallback);
const BRANCH_COMMITS_LIMIT = 5;
const REPO_ACTIVITY_LIMIT = 8;

/** @param {string} targetPath */
async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

/** @param {string} value */
function parseInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * @param {string} repoPath
 * @param {string[]} args
 */
async function runGit(repoPath, args) {
  try {
    const result = await execFile("git", args, { cwd: repoPath });
    return result.stdout.trim();
  } catch {
    return null;
  }
}

/** @param {string} header */
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

/** @param {string | null} statusOutput */
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

/** @param {string | null} stdout */
function parseCommits(stdout) {
  if (!stdout) {
    return [];
  }

  return stdout
    .split("\n")
    .map((/** @type {string} */ line) => line.trim())
    .filter(Boolean)
    .map((/** @type {string} */ line) => {
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

/** @param {string} repoPath */
export async function collectGitActivity(repoPath) {
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

/** @param {Record<string, any>} wakeUpBrief */
function collectArtifactActivity(wakeUpBrief) {
  /** @type {Record<string, string>} */
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

/**
 * @param {string} body
 * @param {string} label
 */
function extractMarkdownField(body, label) {
  const match = body.match(new RegExp(`^\\*\\*${label}\\*\\*:\\s*(.+)$`, "m"));
  return match ? match[1].trim() : "";
}

/**
 * @param {string} filePath
 * @param {string} [fallbackTitle]
 */
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

/** @param {Record<string, any>} wakeUpBrief */
export async function collectRelevantArtifacts(wakeUpBrief) {
  const runArtifacts = wakeUpBrief.workflowState?.currentRun?.artifacts;
  if (!runArtifacts) {
    return collectArtifactActivity(wakeUpBrief);
  }

  /** @type {Record<string, string>} */
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
        label: labels[/** @type {string} */ (kind)] || kind,
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

async function findAutonomousLoopCli() {
  const home = process.env.HOME || process.env.USERPROFILE;
  if (!home) return null;
  const cacheDirs = [
    `${home}/.claude/plugins/cache/astra/loop`,
    `${home}/.claude/plugins/cache/autonomous-loop-dev/autonomous-loop`,
    `${home}/.claude/plugins/cache/autonomous-loop/autonomous-loop`
  ];
  const { promises: fs } = await import("node:fs");
  for (const cacheDir of cacheDirs) {
    let entries;
    try {
      entries = await fs.readdir(cacheDir);
    } catch {
      continue;
    }
    const versions = entries.sort().reverse();
    for (const v of versions) {
      const newName = `${cacheDir}/${v}/scripts/loop.mjs`;
      const legacyName = `${cacheDir}/${v}/scripts/autonomous-loop.mjs`;
      if (await pathExists(newName)) return newName;
      if (await pathExists(legacyName)) return legacyName;
    }
  }
  return null;
}

// Scan .claude/artifacts/crew/runs/ for cost-report-*.md files and parse
// their headers into a compact summary. Best-effort: corrupted or partial
// reports are skipped silently.

/**
 * @param {string | string[]} dirs
 * @param {number} limit
 */
async function listCostReportFilesByMtime(dirs, limit) {
  // Accept either a single dir (legacy) or an array of dirs to merge.
  const dirList = Array.isArray(dirs) ? dirs : [dirs];
  const files = [];
  for (const dir of dirList) {
    if (!(await pathExists(dir))) continue;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (e.isFile() && /-cost-report-.+\.md$/.test(e.name)) {
        files.push(path.join(dir, e.name));
      }
    }
  }
  if (files.length === 0) return [];
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
  return stats
    .filter(Boolean)
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit)
    .map((entry) => entry.f);
}

/**
 * @param {string} repoPath
 * @param {number} [limit]
 */
export async function collectRecentCosts(repoPath, limit = 5) {
  const dirs = [
    path.join(repoPath, ".claude", "artifacts", "crew", "cost"),
    path.join(repoPath, ".claude", "artifacts", "crew", "runs") // legacy fallback
  ];
  const sorted = await listCostReportFilesByMtime(dirs, limit);
  if (sorted.length === 0)
    return {
      recent: /** @type {ReturnType<typeof parseCostReportText>[]} */ ([]),
      totalReports: 0,
      dedupedCount: 0,
      roleDispatches: /** @type {Record<string, number>} */ ({})
    };

  /** @type {ReturnType<typeof parseCostReportText>[]} */
  const recent = [];
  for (const filePath of sorted) {
    try {
      const text = await fs.readFile(filePath, "utf8");
      const report = parseCostReportText(filePath, text);
      recent.push(report);
    } catch {
      // skip unreadable file
    }
  }

  // Deduplicate overlapping windows before computing rollup sums.
  // recent[] is kept whole for per-row table rendering.
  const rollupSet = dedupeForRollup(recent);
  const dedupedCount = rollupSet.length;

  let totalUsd = 0;
  for (const r of rollupSet) {
    if (r.usd != null) totalUsd += r.usd;
  }

  const avgUsd = dedupedCount ? Number((totalUsd / dedupedCount).toFixed(4)) : 0;

  // Model Burn rollup: aggregate modelMix[] across deduped slices so
  // brief-me can show "across the last N slices, opus burned X tokens / $Y".
  // Tokens aren't in modelMix; reconstruct from per-slice totals * usdPct.
  // That's approximate but only used for the summary line.
  const modelBurnMap = new Map();
  for (const r of rollupSet) {
    if (!Array.isArray(r.modelMix)) continue;
    for (const m of r.modelMix) {
      if (!modelBurnMap.has(m.model)) {
        modelBurnMap.set(m.model, { model: m.model, slices: 0, messages: 0, usd: 0 });
      }
      const agg = modelBurnMap.get(m.model);
      agg.slices += 1;
      agg.messages += m.messages || 0;
      agg.usd += m.usd || 0;
    }
  }
  const modelBurn = Array.from(modelBurnMap.values())
    .map((m) => ({ ...m, usd: Number(m.usd.toFixed(4)) }))
    .sort((a, b) => b.usd - a.usd);

  return {
    recent,
    totalReports: sorted.length,
    dedupedCount,
    sumUsdRecent: Number(totalUsd.toFixed(4)),
    avgUsdRecent: avgUsd,
    modelBurn,
    roleDispatches: aggregateRoleDispatches(rollupSet),
    diagnostics: recent.filter((r) => r.hasFlags)
  };
}

// Severity priority order for picking the top concern from recommendations.
/** @type {Record<string, number>} */
const SEVERITY_RANK = { high: 0, medium: 1, low: 2 };

/**
 * Compute a lightweight cost health snapshot for the brief-me surface.
 *
 * Uses buildCostAdvisor to derive the grade and recommendations from the most
 * recent cost report. Returns null when no cost reports exist (backward compat
 * — callers should omit the costHealth field entirely in that case).
 *
 * @param {string} repoPath
 * @returns {Promise<{ grade: string, topConcern: string|null, reportCount: number }|null>}
 */
export async function collectCostHealth(repoPath) {
  // FEAT-034: prefer per-slice variant for honest grading. Fall back to any
  // cost report when no slice-variant exists (legacy + repos that have not
  // yet generated a new-pattern report).
  let advisor;
  try {
    advisor = await buildCostAdvisor(repoPath, {
      limit: 5,
      nameFilter: (name) => /-cost-report-slice-/.test(name)
    });
    if (!advisor.target) {
      advisor = await buildCostAdvisor(repoPath, { limit: 5 });
    }
  } catch {
    return null;
  }
  if (!advisor.target) {
    return null;
  }

  const { grade, recommendations = [], reports = [] } = advisor;

  // Pick the highest-severity recommendation as the top concern. Ties are
  // broken by insertion order (rules fire in declaration order).
  const sorted = [...recommendations].sort(
    (a, b) => (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3)
  );
  const topConcern = sorted.length > 0 ? sorted[0].message : null;

  return {
    grade,
    topConcern,
    reportCount: reports.length
  };
}

/**
 * Compute the cost-aggregate snapshot (rollup across worktrees / sessions).
 *
 * Returns the latest aggregate-variant cost report grade + concern. Returns
 * null when no aggregate-variant file exists (single-source-only worlds and
 * legacy-only worlds both return null). Surfaced in brief-me alongside
 * costHealth for context — never used for grading.
 *
 * @param {string} repoPath
 * @returns {Promise<{ grade: string, topConcern: string|null, reportCount: number }|null>}
 */
export async function collectCostAggregate(repoPath) {
  let advisor;
  try {
    advisor = await buildCostAdvisor(repoPath, {
      limit: 5,
      nameFilter: (name) => /-cost-report-aggregate-/.test(name)
    });
  } catch {
    return null;
  }
  if (!advisor.target) {
    return null;
  }

  const { grade, recommendations = [], reports = [] } = advisor;
  const sorted = [...recommendations].sort(
    (a, b) => (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3)
  );
  const topConcern = sorted.length > 0 ? sorted[0].message : null;

  return {
    grade,
    topConcern,
    reportCount: reports.length
  };
}

/**
 * Compute Sonnet compliance across a set of cost reports.
 * Returns null if no reports with modelMix are available.
 * @param {Array<{modelMix?: Array<{model: string, usdPct: number}>|null}>} reports
 * @returns {{ sonnetPct: number, compliant: boolean, sliceCount: number } | null}
 */
export function computeModelCompliance(reports) {
  const valid = reports.filter((r) => Array.isArray(r.modelMix) && r.modelMix.length > 0);
  if (valid.length === 0) return null;
  const sonnetSlicePcts = valid.map((r) => {
    const entry = r.modelMix.find((m) => /sonnet/i.test(m.model));
    return entry ? entry.usdPct : 0;
  });
  const sonnetPct = sonnetSlicePcts.reduce((a, b) => a + b, 0) / sonnetSlicePcts.length;
  return {
    sonnetPct: Math.round(sonnetPct * 10) / 10,
    compliant: sonnetPct >= 60,
    sliceCount: valid.length
  };
}

/**
 * @param {string} repoPath
 * @returns {Promise<{ sonnetPct: number, compliant: boolean, sliceCount: number } | null>}
 */
export async function collectModelCompliance(repoPath) {
  const costs = await collectRecentCosts(repoPath, 5);
  return computeModelCompliance(costs.recent);
}

/** @param {string} repoPath */
export async function fetchAutonomousLoopBrief(repoPath) {
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
