// Data-collection layer for brief-me. Pure I/O — no rendering, no markdown.
//
// Returns shapes that briefing.mjs orchestrator hands to ./render.mjs.
// Extracted from briefing.mjs during the Tier B-7 split.

import fs from "node:fs/promises";
import path from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { buildCostAdvisor } from "../cost-advisor.mjs";

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
// --- cost-report parsing helpers used by collectRecentCosts ---

/** @param {string} text */
function parseFrontmatterBlock(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  /** @type {Record<string, string>} */
  const fm = {};
  if (match) {
    for (const line of match[1].split(/\r?\n/)) {
      const kv = line.match(/^([\w_]+):\s*(.*)$/);
      if (kv) fm[kv[1]] = kv[2].trim();
    }
  }
  return fm;
}

/** @param {string} text */
function parseModelMix(text) {
  /** @type {Array<{model: string, messages: number, msgPct: number, usd: number, usdPct: number}>} */
  const out = [];
  const section = text
    .split(/^##\s+/m)
    .find((/** @type {string} */ s) => s.startsWith("Model Mix"));
  if (!section) return out;
  for (const line of section.split(/\r?\n/)) {
    const m = line.match(
      /^-\s+(\S+)\s+\(priced as\s+\S+\):\s+(\d+)\s+msgs\s+\(([\d.]+)%\),\s+\$([\d.]+)\s+\(([\d.]+)%\)/
    );
    if (m)
      out.push({
        model: m[1],
        messages: Number(m[2]),
        msgPct: Number(m[3]),
        usd: Number(m[4]),
        usdPct: Number(m[5])
      });
  }
  return out;
}

/** @param {string} text */
function parseToolUsage(text) {
  let toolCalls = 0;
  let toolFailures = 0;
  const section = text
    .split(/^##\s+/m)
    .find((/** @type {string} */ s) => s.startsWith("Tool Usage"));
  if (section) {
    for (const line of section.split(/\r?\n/)) {
      const m = line.match(/^-\s+\S+:\s*([\d,]+)(?:\s*\((\d+)\s+failed\))?/);
      if (m) {
        toolCalls += Number(m[1].replace(/,/g, ""));
        if (m[2]) toolFailures += Number(m[2]);
      }
    }
  }
  return { toolCalls, toolFailures };
}

/** @param {Array<{model: string, msgPct: number}>} modelMix */
function computeDominantModel(modelMix) {
  const dominantEntry =
    modelMix.find(
      (/** @type {{model: string, msgPct: number}} */ m) => !/^<|unknown/i.test(m.model)
    ) ||
    modelMix[0] ||
    null;
  if (!dominantEntry) return null;
  return { model: dominantEntry.model, pct: dominantEntry.msgPct };
}

/**
 * @param {{compactionCount: number, subagentDispatches: number, fileReReadCount: number, toolFailures: number, toolResultP90: number, turnsBeforeFirstTool: number, gradeAvg: number | null, reviewDecision: string | null, validationDecision: string | null, autoDetected: boolean, sourceProject: string | null, aggregateAll: boolean, sourceCount: number}} metrics
 */
function deriveFlags(metrics) {
  const flags = [];
  if (metrics.compactionCount > 0) flags.push(`compact:${metrics.compactionCount}`);
  if (metrics.subagentDispatches > 3) flags.push(`subagent:${metrics.subagentDispatches}`);
  if (metrics.fileReReadCount > 5) flags.push(`reread:${metrics.fileReReadCount}`);
  if (metrics.toolFailures > 3) flags.push(`fails:${metrics.toolFailures}`);
  if (metrics.toolResultP90 > 8000) flags.push(`p90:${metrics.toolResultP90}b`);
  if (metrics.turnsBeforeFirstTool > 5) flags.push(`preamble:${metrics.turnsBeforeFirstTool}`);
  if (metrics.gradeAvg != null && metrics.gradeAvg < 0.75) flags.push(`grade:${metrics.gradeAvg}`);
  if (metrics.reviewDecision === "rejected") flags.push("review:rejected");
  if (metrics.validationDecision === "failed") flags.push("validation:failed");
  if (metrics.autoDetected && metrics.sourceProject) flags.push(`xrepo:${metrics.sourceProject}`);
  if (metrics.aggregateAll && metrics.sourceCount > 1)
    flags.push(`multi-src:${metrics.sourceCount}`);
  return flags;
}

/**
 * @param {string} text
 * @param {RegExp} re
 */
function bodyNum(text, re) {
  return Number(text.match(re)?.[1]?.replace(/,/g, "") || 0);
}

// Header/window fields. Frontmatter wins when present; falls through to
// body markdown patterns for pre-frontmatter cost-reports.
/**
 * @param {string} text
 * @param {Record<string, string>} fm
 */
function parseRunTitle(text, fm) {
  const raw = fm.run_title || text.match(/^- Run Title:\s*(.+)$/m)?.[1] || "";
  const stripped = raw.replace(/^"|"$/g, "").trim();
  return stripped || null;
}

/**
 * @param {string} text
 * @param {Record<string, string>} fm
 */
function parseUsd(text, fm) {
  if (fm.usd != null) return Number(fm.usd);
  const fromBody = Number(text.match(/^- Total USD:\s*\$([\d.]+)/m)?.[1] || 0);
  return fromBody || null;
}

/**
 * @param {Record<string, string>} fm
 * @param {string | null} windowStart
 * @param {string | null} windowEnd
 */
function parseDurationMs(fm, windowStart, windowEnd) {
  if (fm.duration_ms) return Number(fm.duration_ms);
  if (windowStart && windowEnd) return Date.parse(windowEnd) - Date.parse(windowStart);
  return 0;
}

/**
 * @param {string} text
 * @param {Record<string, string>} fm
 */
function parseHeaderFields(text, fm) {
  const windowStart = text.match(/^- Window Start:\s*(.+)$/m)?.[1]?.trim() || null;
  const windowEnd = text.match(/^- Window End:\s*(.+)$/m)?.[1]?.trim() || null;
  return {
    runTitle: parseRunTitle(text, fm),
    usd: parseUsd(text, fm),
    windowStart,
    windowEnd,
    durationMs: parseDurationMs(fm, windowStart, windowEnd)
  };
}

/**
 * @param {string} text
 * @param {Record<string, string>} fm
 */
function parseTokenFields(text, fm) {
  const totalTokens = fm.total_tokens
    ? Number(fm.total_tokens)
    : bodyNum(text, /^- Total Tokens:\s*([\d,]+)/m);
  const cacheHitPct = fm.cache_hit_pct
    ? Number(fm.cache_hit_pct)
    : Number(text.match(/^- Cache Hit %:\s*([\d.]+)/m)?.[1] || 0);
  const inputTokens = bodyNum(text, /^- input:\s*([\d,]+)/m);
  const outputTokens = bodyNum(text, /^- output:\s*([\d,]+)/m);
  const cacheReadTokens = bodyNum(text, /^- cache_read:\s*([\d,]+)/m);
  const cacheCreate1h = bodyNum(text, /^- cache_create_1h:\s*([\d,]+)/m);
  const cacheCreate5m = bodyNum(text, /^- cache_create_5m:\s*([\d,]+)/m);
  return {
    totalTokens,
    cacheHitPct,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens: cacheCreate5m + cacheCreate1h
  };
}

/**
 * Parse the subagent_dispatches_by_role block from cost-report text.
 * Handles two layouts:
 *  (a) inside ## Conversation Shape — rendered by renderCostReportConversation
 *  (b) inside ## Subagent Role Breakdown — used by test helpers and legacy variants
 *
 * Both emit lines of the form:
 *   - subagent_dispatches_by_role:
 *     - <role>: <count>
 *
 * @param {string} text
 * @returns {Record<string, number>}
 */
function parseRoleDispatches(text) {
  // Find the start of the subagent_dispatches_by_role key anywhere in the text.
  const keyIdx = text.indexOf("- subagent_dispatches_by_role:");
  if (keyIdx === -1) return {};

  /** @type {Record<string, number>} */
  const out = {};
  // Walk lines after the key, collecting indented "  - role: count" entries.
  // Role names may contain colons (e.g. "crew:builder"), so match the LAST
  // ": <digits>" segment to split role from count.
  const afterKey = text.slice(keyIdx + 1);
  for (const line of afterKey.split(/\r?\n/)) {
    const m = line.match(/^\s{2,}-\s+(.+):\s*(\d+)\s*$/);
    if (m) {
      out[m[1].trim()] = Number(m[2]);
    } else if (line.match(/^-\s+\S/) || line.match(/^##/)) {
      // Hit a sibling bullet or a new section — stop collecting.
      break;
    }
  }
  return out;
}

/** @param {string} text */
function parseDiagnosticFields(text) {
  return {
    compactionCount: bodyNum(text, /^- compaction_count:\s*(\d+)/m),
    subagentDispatches: bodyNum(text, /^- subagent_dispatches:\s*(\d+)/m),
    skillInvocations: bodyNum(text, /^- skill_invocations:\s*(\d+)/m),
    turnsBeforeFirstTool: bodyNum(text, /^- turns_before_first_tool:\s*(\d+)/m),
    userMsgAvgLen: bodyNum(text, /^- user_msg_avg_len:\s*(\d+)/m),
    fileReReadCount: bodyNum(text, /^- redundant_read_count:\s*(\d+)/m),
    sessionsScanned: bodyNum(text, /^- Sessions Scanned:\s*(\d+)/m),
    toolResultP90: bodyNum(text, /##\s+Tool Result Sizes[\s\S]*?-\s+p90:\s*([\d,]+)/),
    messages: Number(text.match(/^- Assistant Messages Counted:\s*(\d+)/m)?.[1] || 0),
    roleDispatches: parseRoleDispatches(text)
  };
}

/** @param {Record<string, string>} fm */
function parseOutcomeFields(fm) {
  return {
    gradeAvg: fm.grade_avg != null ? Number(fm.grade_avg) : null,
    reviewDecision: fm.review_decision || null,
    validationDecision: fm.validation_decision || null,
    sourceProject: fm.source_project || null,
    autoDetected: String(fm.auto_detected || "").toLowerCase() === "true",
    aggregateAll: String(fm.aggregate_all || "").toLowerCase() === "true",
    sourceCount: fm.source_count ? Number(fm.source_count) : 0
  };
}

/**
 * @param {string} filePath
 * @param {string} text
 */
function parseCostReportText(filePath, text) {
  const fm = parseFrontmatterBlock(text);
  const header = parseHeaderFields(text, fm);
  const tokens = parseTokenFields(text, fm);
  const diag = parseDiagnosticFields(text);
  const outcome = parseOutcomeFields(fm);
  const modelMix = parseModelMix(text);
  const dominantModel = computeDominantModel(modelMix);
  const { toolCalls, toolFailures } = parseToolUsage(text);
  const toolFailureRate = toolCalls > 0 ? Number(((toolFailures / toolCalls) * 100).toFixed(1)) : 0;

  const toM = (/** @type {number} */ n) => Number((n / 1_000_000).toFixed(3));
  const inputM = toM(tokens.inputTokens);
  const outputM = toM(tokens.outputTokens);
  const cacheReadM = toM(tokens.cacheReadTokens);
  const cacheWriteM = toM(tokens.cacheWriteTokens);

  const { runTitle, usd, windowStart, windowEnd, durationMs } = header;
  const {
    compactionCount,
    subagentDispatches,
    skillInvocations,
    turnsBeforeFirstTool,
    userMsgAvgLen,
    fileReReadCount,
    sessionsScanned,
    toolResultP90,
    messages,
    roleDispatches
  } = diag;
  const {
    gradeAvg,
    reviewDecision,
    validationDecision,
    sourceProject,
    autoDetected,
    aggregateAll,
    sourceCount
  } = outcome;
  const { totalTokens, cacheHitPct, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens } =
    tokens;

  const flags = deriveFlags({
    compactionCount,
    subagentDispatches,
    fileReReadCount,
    toolFailures,
    toolResultP90,
    turnsBeforeFirstTool,
    gradeAvg,
    reviewDecision,
    validationDecision,
    autoDetected,
    sourceProject,
    aggregateAll,
    sourceCount
  });

  return {
    path: filePath,
    runTitle,
    usd,
    windowStart,
    windowEnd,
    durationMs,
    durationMin: durationMs ? Number((durationMs / 60000).toFixed(1)) : 0,
    messages,
    totalTokens,
    totalMillions: toM(totalTokens),
    cacheHitPct,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    inputMillions: inputM,
    outputMillions: outputM,
    cacheReadMillions: cacheReadM,
    cacheWriteMillions: cacheWriteM,
    ioMillionsStr: `${inputM} / ${outputM}`,
    cacheRWMillionsStr: `${cacheReadM} / ${cacheWriteM}`,
    dominantModel,
    dominantModelStr: dominantModel ? `${dominantModel.model} ${dominantModel.pct}%` : "-",
    modelMix,
    compactionCount,
    subagentDispatches,
    skillInvocations,
    turnsBeforeFirstTool,
    userMsgAvgLen,
    sourceProject,
    autoDetected,
    aggregateAll,
    sourceCount,
    fileReReadCount,
    sessionsScanned,
    toolCalls,
    toolFailures,
    toolFailureRate,
    toolResultP90,
    gradeAvg,
    reviewDecision,
    validationDecision,
    roleDispatches,
    flags,
    flagsStr: flags.join(" / "),
    hasFlags: flags.length > 0
  };
}

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
 * Deduplicate a list of parsed cost reports so that the rollup summary
 * (sumUsdRecent, avgUsdRecent, modelBurn) does not double-count overlapping
 * windows.
 *
 * Algorithm:
 * 1. Bucket reports by exact (windowStart, windowEnd) pair.
 * 2. For each bucket, keep only the latest aggregate snapshot; if no aggregate
 *    exists in the bucket, keep only the latest slice/legacy report.
 * 3. From the surviving per-bucket winners, remove any slice whose window is
 *    fully contained inside a surviving aggregate row's window (the slice cost
 *    is already counted inside the aggregate).
 * 4. The resulting set is the "deduped" set used for rollup arithmetic.
 *
 * The raw `recent[]` array is never modified — all reports remain for the
 * per-row table render.
 *
 * @param {ReturnType<typeof parseCostReportText>[]} reports  Newest-first.
 * @returns {ReturnType<typeof parseCostReportText>[]}
 */
function dedupeForRollup(reports) {
  // Step 1 — bucket by exact (windowStart, windowEnd).
  // Within each bucket prefer the aggregate variant; among same-variant entries
  // the first one encountered (newest file first) wins.
  /** @type {Map<string, ReturnType<typeof parseCostReportText>>} */
  const bucketWinner = new Map();

  for (const r of reports) {
    const key = `${r.windowStart ?? ""}|${r.windowEnd ?? ""}`;
    const existing = bucketWinner.get(key);
    if (!existing) {
      bucketWinner.set(key, r);
    } else {
      // Upgrade to aggregate if the current winner is not one yet.
      if (!existing.aggregateAll && r.aggregateAll) {
        bucketWinner.set(key, r);
      }
      // Among two aggregates or two slices, keep the already-stored one
      // (reports array is newest-first, so first encountered = newest).
    }
  }

  const winners = Array.from(bucketWinner.values());

  // Step 2 — collect aggregate windows so we can omit fully-contained slices.
  const aggregateWindows = winners
    .filter((r) => r.aggregateAll && r.windowStart && r.windowEnd)
    .map((r) => ({ start: Date.parse(r.windowStart), end: Date.parse(r.windowEnd) }));

  /**
   * @param {ReturnType<typeof parseCostReportText>} r
   */
  function isContainedInAggregate(r) {
    if (r.aggregateAll) return false; // aggregates are never dropped for containment
    if (!r.windowStart || !r.windowEnd) return false;
    const rStart = Date.parse(r.windowStart);
    const rEnd = Date.parse(r.windowEnd);
    return aggregateWindows.some((aw) => rStart >= aw.start && rEnd <= aw.end);
  }

  return winners.filter((r) => !isContainedInAggregate(r));
}

/**
 * Aggregate subagent role dispatch counts across a set of cost reports.
 * @param {ReturnType<typeof parseCostReportText>[]} reports
 * @returns {Record<string, number>}
 */
function aggregateRoleDispatches(reports) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const r of reports) {
    if (!r.roleDispatches) continue;
    for (const [role, count] of Object.entries(r.roleDispatches)) {
      out[role] = (out[role] ?? 0) + count;
    }
  }
  return out;
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
