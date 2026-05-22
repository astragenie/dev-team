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
export async function collectRecentCosts(repoPath, limit = 5) {
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
          const m = line.match(
            /^-\s+(\S+)\s+\(priced as\s+\S+\):\s+(\d+)\s+msgs\s+\(([\d.]+)%\),\s+\$([\d.]+)\s+\(([\d.]+)%\)/
          );
          if (m)
            modelMix.push({
              model: m[1],
              messages: Number(m[2]),
              msgPct: Number(m[3]),
              usd: Number(m[4]),
              usdPct: Number(m[5])
            });
        }
      }

      if (usd != null) totalUsd += usd;

      const cacheWriteTokens = cacheCreate5m + cacheCreate1h;
      const toM = (n) => Number((n / 1_000_000).toFixed(3));

      // Dominant model = highest-spend real LLM in the mix. Skip
      // synthetic/unknown sentinel entries (auto-injected, no LLM call).
      // Surface a single percentage — msgPct — to avoid the "199%" confusion
      // that comes from reading msgPct/usdPct as one number.
      const dominantEntry =
        modelMix.find((m) => !/^<|unknown/i.test(m.model)) || modelMix[0] || null;
      const dominantModel = dominantEntry
        ? {
            model: dominantEntry.model,
            pct: dominantEntry.msgPct
          }
        : null;

      const inputM = toM(inputTokens);
      const outputM = toM(outputTokens);
      const cacheReadM = toM(cacheReadTokens);
      const cacheWriteM = toM(cacheWriteTokens);

      // Diagnostic counters from the cost-report body. These mirror the
      // signals the cost-advisor uses but are surfaced here too so the
      // brief-me consumer can render a diagnostics table without a second
      // CLI call.
      const compactionCount = num(/^- compaction_count:\s*(\d+)/m);
      const subagentDispatches = num(/^- subagent_dispatches:\s*(\d+)/m);
      const skillInvocations = num(/^- skill_invocations:\s*(\d+)/m);
      const turnsBeforeFirstTool = num(/^- turns_before_first_tool:\s*(\d+)/m);
      const userMsgAvgLen = num(/^- user_msg_avg_len:\s*(\d+)/m);
      const fileReReadCount = num(/^- redundant_read_count:\s*(\d+)/m);
      const sessionsScanned = num(/^- Sessions Scanned:\s*(\d+)/m);
      const toolResultP90 = num(/##\s+Tool Result Sizes[\s\S]*?-\s+p90:\s*([\d,]+)/);

      // Tool usage block: sum all counts + failures.
      let toolCalls = 0;
      let toolFailures = 0;
      const toolSection = text.split(/^##\s+/m).find((s) => s.startsWith("Tool Usage"));
      if (toolSection) {
        for (const line of toolSection.split(/\r?\n/)) {
          const m = line.match(/^-\s+\S+:\s*([\d,]+)(?:\s*\((\d+)\s+failed\))?/);
          if (m) {
            toolCalls += Number(m[1].replace(/,/g, ""));
            if (m[2]) toolFailures += Number(m[2]);
          }
        }
      }
      const toolFailureRate =
        toolCalls > 0 ? Number(((toolFailures / toolCalls) * 100).toFixed(1)) : 0;

      // Outcome from frontmatter
      const gradeAvg = fm.grade_avg != null ? Number(fm.grade_avg) : null;
      const reviewDecision = fm.review_decision || null;
      const validationDecision = fm.validation_decision || null;

      // Flag thresholds — empty flags array = clean slice
      const flags = [];
      if (compactionCount > 0) flags.push(`compact:${compactionCount}`);
      if (subagentDispatches > 3) flags.push(`subagent:${subagentDispatches}`);
      if (fileReReadCount > 5) flags.push(`reread:${fileReReadCount}`);
      if (toolFailures > 3) flags.push(`fails:${toolFailures}`);
      if (toolResultP90 > 8000) flags.push(`p90:${toolResultP90}b`);
      if (turnsBeforeFirstTool > 5) flags.push(`preamble:${turnsBeforeFirstTool}`);
      if (gradeAvg != null && gradeAvg < 0.75) flags.push(`grade:${gradeAvg}`);
      if (reviewDecision === "rejected") flags.push("review:rejected");
      if (validationDecision === "failed") flags.push("validation:failed");

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
        totalMillions: toM(totalTokens),
        cacheHitPct,
        // raw token counts
        inputTokens,
        outputTokens,
        cacheReadTokens,
        cacheWriteTokens,
        // millions: split axes for callers that want raw numbers
        inputMillions: inputM,
        outputMillions: outputM,
        cacheReadMillions: cacheReadM,
        cacheWriteMillions: cacheWriteM,
        // formatted string pairs for single-cell renderers
        // e.g. "0.024 / 0.077" — input M / output M
        ioMillionsStr: `${inputM} / ${outputM}`,
        cacheRWMillionsStr: `${cacheReadM} / ${cacheWriteM}`,
        dominantModel,
        dominantModelStr: dominantModel ? `${dominantModel.model} ${dominantModel.pct}%` : "-",
        modelMix,
        // diagnostics block — for the second 'diagnostics' table in brief-me
        compactionCount,
        subagentDispatches,
        skillInvocations,
        turnsBeforeFirstTool,
        userMsgAvgLen,
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
      });
    } catch {
      // skip unreadable file
    }
  }

  const avgUsd = recent.length ? Number((totalUsd / recent.length).toFixed(4)) : 0;
  const diagnostics = recent.filter((r) => r.hasFlags);
  return {
    recent,
    totalReports: files.length,
    sumUsdRecent: Number(totalUsd.toFixed(4)),
    avgUsdRecent: avgUsd,
    diagnostics
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
