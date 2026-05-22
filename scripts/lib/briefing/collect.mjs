// Data-collection layer for brief-me. Pure I/O — no rendering, no markdown.
//
// Returns shapes that briefing.mjs orchestrator hands to ./render.mjs.
// Extracted from briefing.mjs during the Tier B-7 split.

import fs from "node:fs/promises";
import path from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

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

export async function collectRelevantArtifacts(wakeUpBrief) {
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
// --- cost-report parsing helpers used by collectRecentCosts ---

function parseFrontmatterBlock(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  const fm = {};
  if (match) {
    for (const line of match[1].split(/\r?\n/)) {
      const kv = line.match(/^([\w_]+):\s*(.*)$/);
      if (kv) fm[kv[1]] = kv[2].trim();
    }
  }
  return fm;
}

function parseModelMix(text) {
  const out = [];
  const section = text.split(/^##\s+/m).find((s) => s.startsWith("Model Mix"));
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

function parseToolUsage(text) {
  let toolCalls = 0;
  let toolFailures = 0;
  const section = text.split(/^##\s+/m).find((s) => s.startsWith("Tool Usage"));
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

function computeDominantModel(modelMix) {
  const dominantEntry = modelMix.find((m) => !/^<|unknown/i.test(m.model)) || modelMix[0] || null;
  if (!dominantEntry) return null;
  return { model: dominantEntry.model, pct: dominantEntry.msgPct };
}

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

function bodyNum(text, re) {
  return Number(text.match(re)?.[1]?.replace(/,/g, "") || 0);
}

// Header/window fields. Frontmatter wins when present; falls through to
// body markdown patterns for pre-frontmatter cost-reports.
function parseHeaderFields(text, fm) {
  const runTitle =
    (fm.run_title || text.match(/^- Run Title:\s*(.+)$/m)?.[1] || "")
      .replace(/^"|"$/g, "")
      .trim() || null;
  const usd =
    fm.usd != null
      ? Number(fm.usd)
      : Number(text.match(/^- Total USD:\s*\$([\d.]+)/m)?.[1] || 0) || null;
  const windowStart = text.match(/^- Window Start:\s*(.+)$/m)?.[1]?.trim() || null;
  const windowEnd = text.match(/^- Window End:\s*(.+)$/m)?.[1]?.trim() || null;
  const durationMs = fm.duration_ms
    ? Number(fm.duration_ms)
    : windowStart && windowEnd
      ? Date.parse(windowEnd) - Date.parse(windowStart)
      : 0;
  return { runTitle, usd, windowStart, windowEnd, durationMs };
}

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
    messages: Number(text.match(/^- Assistant Messages Counted:\s*(\d+)/m)?.[1] || 0)
  };
}

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

  const toM = (n) => Number((n / 1_000_000).toFixed(3));
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
    messages
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
    flags,
    flagsStr: flags.join(" / "),
    hasFlags: flags.length > 0
  };
}

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


export async function collectRecentCosts(repoPath, limit = 5) {
  const dirs = [
    path.join(repoPath, ".claude", "artifacts", "crew", "cost"),
    path.join(repoPath, ".claude", "artifacts", "crew", "runs") // legacy fallback
  ];
  const sorted = await listCostReportFilesByMtime(dirs, limit);
  if (sorted.length === 0) return { recent: [], totalReports: 0 };

  const recent = [];
  let totalUsd = 0;
  for (const filePath of sorted) {
    try {
      const text = await fs.readFile(filePath, "utf8");
      const report = parseCostReportText(filePath, text);
      if (report.usd != null) totalUsd += report.usd;
      recent.push(report);
    } catch {
      // skip unreadable file
    }
  }

  const avgUsd = recent.length ? Number((totalUsd / recent.length).toFixed(4)) : 0;

  // Item 2 — Model Burn rollup: aggregate modelMix[] across recent slices so
  // brief-me can show "across the last N slices, opus burned X tokens / $Y".
  // Tokens aren't in modelMix; reconstruct from per-slice totals * usdPct.
  // That's approximate but only used for the summary line.
  const modelBurnMap = new Map();
  for (const r of recent) {
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
    sumUsdRecent: Number(totalUsd.toFixed(4)),
    avgUsdRecent: avgUsd,
    modelBurn,
    diagnostics: recent.filter((r) => r.hasFlags)
  };
}

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
