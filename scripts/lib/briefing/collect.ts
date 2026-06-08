// Data-collection layer for brief-me. Pure I/O — no rendering, no markdown.
//
// Returns shapes that briefing.ts orchestrator hands to ./render.ts.
// Extracted from briefing.mjs during the Tier B-7 split.

import fs from "node:fs/promises";
import path from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { buildCostAdvisor } from "../cost-advisor.ts";
import {
  parseCostReportText,
  dedupeForRollup,
  aggregateRoleDispatches
} from "./collect-cost-parser.ts";
import type { CostReport } from "./collect-cost-parser.ts";
import { tailReadJsonl } from "../jsonl.mjs";
import { getCachedArtifact } from "../artifact-cache.mjs";
import { pathExists } from "../fs-utils.ts";

const execFile = promisify(execFileCallback);
const BRANCH_COMMITS_LIMIT = 5;
const REPO_ACTIVITY_LIMIT = 8;

// ---------------------------------------------------------------------------
// Shared interfaces
// ---------------------------------------------------------------------------

export interface WorkingTreeStatus {
  isGitRepo: boolean;
  branch: string;
  upstream: string;
  ahead: number;
  behind: number;
  modifiedCount: number;
  untrackedCount: number;
  stagedCount: number;
  hasChanges: boolean;
  changedPaths: string[];
}

export interface CommitEntry {
  hash: string;
  date: string;
  author: string;
  refs: string;
  subject: string;
}

export interface GitActivity {
  isGitRepo: boolean;
  workingTree: WorkingTreeStatus;
  recentBranchCommits: CommitEntry[];
  recentRepoActivity: CommitEntry[];
  [key: string]: unknown;
}

interface ArtifactSummary {
  path: string;
  title: string;
  updatedAt: string;
  goal: string;
  mode: string;
  next: string;
  findings: unknown;
}

export interface ArtifactEntry {
  kind: string;
  label: string;
  title: string;
  updatedAt: string;
  path: string;
  goal?: string;
  mode?: string;
  next?: string;
  findings?: unknown;
}

export interface CostHealthResult {
  grade: string;
  topConcern: string | null;
  reportCount: number;
}

export interface ModelCompliance {
  sonnetPct: number;
  compliant: boolean;
  sliceCount: number;
}

export interface HookStatus {
  name: string;
  errorCount24h: number;
  status: "green" | "yellow";
}

export interface HookHealth {
  hooks: HookStatus[];
}

// For wakeUpBrief parameter (index signature allows unknown fields)
export interface WakeUpBriefLike {
  latestArtifacts?: Record<string, unknown>;
  workflowState?: {
    currentRun?: {
      artifacts?: {
        runBrief?: string;
        finalSynthesis?: string;
        reviewResult?: string;
        validationPlan?: string;
        validationResult?: string;
        deploymentChecks?: { dev?: string; prod?: string };
        handoffs?: string[];
      };
    };
  };
  hookHealth?: HookHealth;
  [key: string]: unknown;
}

interface ModelBurnEntry {
  model: string;
  slices: number;
  messages: number;
  usd: number;
}

interface RecentCostsResult {
  recent: CostReport[];
  totalReports: number;
  dedupedCount: number;
  sumUsdRecent?: number;
  avgUsdRecent?: number;
  modelBurn?: ModelBurnEntry[];
  roleDispatches: Record<string, number>;
  diagnostics?: CostReport[];
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function parseInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function runGit(repoPath: string, args: string[]): Promise<string | null> {
  try {
    const result = await execFile("git", args, { cwd: repoPath });
    return result.stdout.trim();
  } catch {
    return null;
  }
}

function parseStatusHeader(header: string): {
  branch: string;
  upstream: string;
  ahead: number;
  behind: number;
} {
  const branchMatch = header.match(/^##\s+([^\s.]+|HEAD)(?:\.\.\.([^\s[]+))?(?:\s+\[(.+)\])?/);
  const details = branchMatch?.[3] ?? "";
  const aheadMatch = details.match(/ahead\s+(\d+)/);
  const behindMatch = details.match(/behind\s+(\d+)/);

  return {
    branch: branchMatch?.[1] ?? "",
    upstream: branchMatch?.[2] ?? "",
    ahead: aheadMatch ? parseInteger(aheadMatch[1] ?? "") : 0,
    behind: behindMatch ? parseInteger(behindMatch[1] ?? "") : 0
  };
}

function parseStatusCounts(entries: string[]): {
  modifiedCount: number;
  untrackedCount: number;
  stagedCount: number;
  changedPaths: string[];
} {
  let modifiedCount = 0;
  let untrackedCount = 0;
  let stagedCount = 0;
  const changedPaths: string[] = [];

  for (const entry of entries) {
    const code = entry.slice(0, 2);
    const relativePath = entry.slice(3).trim();
    if (!relativePath) continue;
    changedPaths.push(relativePath);
    if (code.includes("?")) {
      untrackedCount += 1;
      continue;
    }
    if (code.charAt(0) !== "" && code.charAt(0) !== " ") stagedCount += 1;
    if (code.charAt(1) !== "" && code.charAt(1) !== " ") modifiedCount += 1;
  }

  return { modifiedCount, untrackedCount, stagedCount, changedPaths };
}

function parseWorkingTree(statusOutput: string | null): WorkingTreeStatus {
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
  const header = parseStatusHeader(lines[0] ?? "");
  const entries = lines.slice(1);
  const counts = parseStatusCounts(entries);

  return {
    isGitRepo: true,
    ...header,
    ...counts,
    hasChanges: entries.length > 0
  };
}

function parseCommits(stdout: string | null): CommitEntry[] {
  if (!stdout) {
    return [];
  }

  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [hash = "", date = "", author = "", refs = "", subject = ""] = line.split("\t");
      return { hash, date, author, refs, subject };
    });
}

// ---------------------------------------------------------------------------
// Exported collectors
// ---------------------------------------------------------------------------

export async function collectGitActivity(repoPath: string): Promise<GitActivity> {
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

function collectArtifactActivity(wakeUpBrief: WakeUpBriefLike): ArtifactEntry[] {
  const labels: Record<string, string> = {
    runBrief: "Run brief",
    finalSynthesis: "Final synthesis",
    handoff: "Handoff",
    review: "Review result",
    validationPlan: "Validation plan",
    validationResult: "Validation result",
    deploymentCheck: "Deployment check"
  };

  return Object.entries(wakeUpBrief.latestArtifacts ?? {})
    .filter(([, artifact]) => Boolean(artifact))
    .map(([kind, artifact]) => {
      const a = artifact as { title?: string; updatedAt?: string; path?: string };
      return {
        kind,
        label: labels[kind] ?? kind,
        title: a.title ?? "",
        updatedAt: a.updatedAt ?? "",
        path: a.path ?? ""
      };
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function extractMarkdownField(body: string, label: string): string {
  const match = body.match(new RegExp(`^\\*\\*${label}\\*\\*:\\s*(.+)$`, "m"));
  return match ? (match[1] ?? "").trim() : "";
}

async function readArtifactSummary(
  filePath: string,
  fallbackTitle = ""
): Promise<ArtifactSummary | null> {
  if (!filePath) return null;
  let cached;
  try {
    cached = await getCachedArtifact(filePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
  const { fm, body, mtimeMs } = cached;
  const bodyAfterFm = body.startsWith("---") ? body.slice(body.indexOf("\n---", 3) + 4) : body;
  const [heading = ""] = bodyAfterFm.split("\n");
  return {
    path: filePath,
    title: heading.replace(/^#\s+/, "").trim() || fallbackTitle,
    updatedAt: new Date(mtimeMs).toISOString(),
    goal: extractMarkdownField(body, "Goal"),
    mode: extractMarkdownField(body, "Mode"),
    next: extractMarkdownField(body, "Next"),
    findings: (fm as Record<string, unknown>)["findings"] ?? null
  };
}

async function resolveRunArtifacts(
  runArtifacts: {
    runBrief?: string;
    finalSynthesis?: string;
    reviewResult?: string;
    validationPlan?: string;
    validationResult?: string;
    deploymentChecks?: { dev?: string; prod?: string };
    handoffs?: string[];
  },
  labels: Record<string, string>
): Promise<ArtifactEntry[]> {
  const candidates: Array<[string, string | undefined]> = [
    ["runBrief", runArtifacts.runBrief],
    ["finalSynthesis", runArtifacts.finalSynthesis],
    ["review", runArtifacts.reviewResult],
    ["validationPlan", runArtifacts.validationPlan],
    ["validationResult", runArtifacts.validationResult],
    ["deploymentCheck", runArtifacts.deploymentChecks?.dev ?? runArtifacts.deploymentChecks?.prod],
    ["handoff", runArtifacts.handoffs?.slice(-1)[0]]
  ];
  const summaries = await Promise.all(
    candidates.map(async ([kind, artifactPath]): Promise<ArtifactEntry | null> => {
      const summary = await readArtifactSummary(artifactPath ?? "");
      if (!summary) return null;
      return {
        kind,
        label: labels[kind] ?? kind,
        title: summary.title,
        updatedAt: summary.updatedAt,
        path: summary.path,
        goal: summary.goal,
        mode: summary.mode,
        next: summary.next,
        findings: summary.findings ?? null
      };
    })
  );
  return summaries.filter((s): s is ArtifactEntry => s !== null);
}

export async function collectRelevantArtifacts(
  wakeUpBrief: WakeUpBriefLike
): Promise<ArtifactEntry[]> {
  const runArtifacts = wakeUpBrief.workflowState?.currentRun?.artifacts;
  if (!runArtifacts) {
    return collectArtifactActivity(wakeUpBrief);
  }

  const labels: Record<string, string> = {
    runBrief: "Run brief",
    finalSynthesis: "Final synthesis",
    handoff: "Handoff",
    review: "Review result",
    validationPlan: "Validation plan",
    validationResult: "Validation result",
    deploymentCheck: "Deployment check"
  };
  const present = await resolveRunArtifacts(runArtifacts, labels);
  return present.length > 0 ? present : collectArtifactActivity(wakeUpBrief);
}

async function findAutonomousLoopCli(): Promise<string | null> {
  const home = process.env["HOME"] ?? process.env["USERPROFILE"];
  if (!home) return null;
  const cacheDirs = [
    `${home}/.claude/plugins/cache/astra/loop`,
    `${home}/.claude/plugins/cache/autonomous-loop-dev/autonomous-loop`,
    `${home}/.claude/plugins/cache/autonomous-loop/autonomous-loop`
  ];
  // Use a local alias to avoid shadowing the top-level `fs` import.
  const { promises: fsLocal } = await import("node:fs");

  // Scan all cache directories in parallel, then pick the highest-priority hit.
  const perDirCandidates = await Promise.all(
    cacheDirs.map(async (cacheDir): Promise<string | null> => {
      let entries: string[];
      try {
        entries = await fsLocal.readdir(cacheDir);
      } catch {
        return null;
      }
      const versions = entries.sort().reverse();
      for (const v of versions) {
        const newName = `${cacheDir}/${v}/scripts/loop.mjs`;
        const legacyName = `${cacheDir}/${v}/scripts/autonomous-loop.mjs`;
        if (await pathExists(newName)) return newName;
        if (await pathExists(legacyName)) return legacyName;
      }
      return null;
    })
  );

  // Return the first non-null result, preserving priority order.
  return perDirCandidates.find((c) => c !== null) ?? null;
}

// Scan .claude/artifacts/crew/runs/ for cost-report-*.md files and parse
// their headers into a compact summary. Best-effort: corrupted or partial
// reports are skipped silently.

async function statFiles(files: string[]): Promise<Array<{ f: string; mtime: number }>> {
  const results = await Promise.all(
    files.map(async (f) => {
      try {
        const s = await fs.stat(f);
        return { f, mtime: s.mtimeMs };
      } catch {
        return null;
      }
    })
  );
  return results.filter((s): s is { f: string; mtime: number } => s !== null);
}

async function listCostReportFilesByMtime(
  dirs: string | string[],
  limit: number
): Promise<string[]> {
  // Accept either a single dir (legacy) or an array of dirs to merge.
  const dirList = Array.isArray(dirs) ? dirs : [dirs];

  // Scan all directories in parallel — each readdir is independent I/O.
  const perDirFiles = await Promise.all(
    dirList.map(async (dir): Promise<string[]> => {
      if (!(await pathExists(dir))) return [];
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return [];
      }
      return entries
        .filter((e) => e.isFile() && /-cost-report-.+\.md$/.test(e.name))
        .map((e) => path.join(dir, e.name));
    })
  );

  const files = perDirFiles.flat();
  if (files.length === 0) return [];
  const stats = await statFiles(files);
  return stats
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit)
    .map((entry) => entry.f);
}

function computeModelBurn(rollupSet: CostReport[]): ModelBurnEntry[] {
  const modelBurnMap = new Map<string, ModelBurnEntry>();
  for (const r of rollupSet) {
    if (!Array.isArray(r.modelMix)) continue;
    for (const m of r.modelMix) {
      if (!modelBurnMap.has(m.model)) {
        modelBurnMap.set(m.model, { model: m.model, slices: 0, messages: 0, usd: 0 });
      }
      const agg = modelBurnMap.get(m.model)!;
      agg.slices += 1;
      agg.messages += m.messages || 0;
      agg.usd += m.usd || 0;
    }
  }
  return Array.from(modelBurnMap.values())
    .map((m) => ({ ...m, usd: Number(m.usd.toFixed(4)) }))
    .sort((a, b) => b.usd - a.usd);
}

export async function collectRecentCosts(repoPath: string, limit = 5): Promise<RecentCostsResult> {
  const dirs = [
    path.join(repoPath, ".claude", "artifacts", "crew", "cost"),
    path.join(repoPath, ".claude", "artifacts", "crew", "runs") // legacy fallback
  ];
  const sorted = await listCostReportFilesByMtime(dirs, limit);
  if (sorted.length === 0)
    return {
      recent: [] as CostReport[],
      totalReports: 0,
      dedupedCount: 0,
      roleDispatches: {} as Record<string, number>
    };

  const results = await Promise.allSettled(
    sorted.map(async (filePath) => {
      const text = await fs.readFile(filePath, "utf8");
      return parseCostReportText(filePath, text);
    })
  );
  const recent = results
    .filter((r): r is PromiseFulfilledResult<CostReport> => r.status === "fulfilled")
    .map((r) => r.value);

  // Deduplicate overlapping windows before computing rollup sums.
  // recent[] is kept whole for per-row table rendering.
  const rollupSet = dedupeForRollup(recent);
  const dedupedCount = rollupSet.length;

  let totalUsd = 0;
  for (const r of rollupSet) {
    if (r.usd != null) totalUsd += r.usd;
  }

  const avgUsd = dedupedCount ? Number((totalUsd / dedupedCount).toFixed(4)) : 0;
  const modelBurn = computeModelBurn(rollupSet);

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
const SEVERITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

/**
 * Compute a lightweight cost health snapshot for the brief-me surface.
 *
 * Uses buildCostAdvisor to derive the grade and recommendations from the most
 * recent cost report. Returns null when no cost reports exist (backward compat
 * — callers should omit the costHealth field entirely in that case).
 */
export async function collectCostHealth(repoPath: string): Promise<CostHealthResult | null> {
  // FEAT-034: prefer per-slice variant for honest grading. Fall back to any
  // cost report when no slice-variant exists (legacy + repos that have not
  // yet generated a new-pattern report).
  let advisor;
  try {
    advisor = await buildCostAdvisor(repoPath, {
      limit: 5,
      nameFilter: (name: string) => /-cost-report-slice-/.test(name)
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
  const sorted = [...(recommendations as Array<{ severity: string; message: string }>)].sort(
    (a, b) => (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3)
  );
  const topConcern = sorted.length > 0 ? (sorted[0]?.message ?? null) : null;

  return {
    grade: grade as string,
    topConcern,
    reportCount: (reports as unknown[]).length
  };
}

/**
 * Compute the cost-aggregate snapshot (rollup across worktrees / sessions).
 *
 * Returns the latest aggregate-variant cost report grade + concern. Returns
 * null when no aggregate-variant file exists (single-source-only worlds and
 * legacy-only worlds both return null). Surfaced in brief-me alongside
 * costHealth for context — never used for grading.
 */
export async function collectCostAggregate(repoPath: string): Promise<CostHealthResult | null> {
  let advisor;
  try {
    advisor = await buildCostAdvisor(repoPath, {
      limit: 5,
      nameFilter: (name: string) => /-cost-report-aggregate-/.test(name)
    });
  } catch {
    return null;
  }
  if (!advisor.target) {
    return null;
  }

  const { grade, recommendations = [], reports = [] } = advisor;
  const sorted = [...(recommendations as Array<{ severity: string; message: string }>)].sort(
    (a, b) => (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3)
  );
  const topConcern = sorted.length > 0 ? (sorted[0]?.message ?? null) : null;

  return {
    grade: grade as string,
    topConcern,
    reportCount: (reports as unknown[]).length
  };
}

/**
 * Compute Sonnet compliance across a set of cost reports.
 * Returns null if no reports with modelMix are available.
 */
export function computeModelCompliance(
  reports: Array<{ modelMix?: Array<{ model: string; usdPct: number }> | null }>
): ModelCompliance | null {
  const valid = reports.filter((r) => Array.isArray(r.modelMix) && (r.modelMix?.length ?? 0) > 0);
  if (valid.length === 0) return null;
  const sonnetSlicePcts = valid.map((r) => {
    const entry = (r.modelMix as Array<{ model: string; usdPct: number }>).find((m) =>
      /sonnet/i.test(m.model)
    );
    return entry ? entry.usdPct : 0;
  });
  const sonnetPct = sonnetSlicePcts.reduce((a, b) => a + b, 0) / sonnetSlicePcts.length;
  return {
    sonnetPct: Math.round(sonnetPct * 10) / 10,
    compliant: sonnetPct >= 60,
    sliceCount: valid.length
  };
}

export async function collectModelCompliance(repoPath: string): Promise<ModelCompliance | null> {
  const costs = await collectRecentCosts(repoPath, 5);
  return computeModelCompliance(costs.recent);
}

const KNOWN_HOOKS = [
  "check-redundant-read",
  "record-read-content",
  "preflight-shell",
  "check-subagent-return"
];
const HOOK_HEALTH_TAIL = 100;
const HOOK_HEALTH_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function collectHookHealth(repoPath: string): Promise<HookHealth> {
  const eventsPath = path.join(repoPath, ".claude", "logs", "events.jsonl");
  const raw = await tailReadJsonl(eventsPath, HOOK_HEALTH_TAIL);
  const cutoff = Date.now() - HOOK_HEALTH_WINDOW_MS;
  const counts = new Map<string, number>();
  for (const e of raw) {
    if (e["type"] !== "hook_error" || typeof e["hook"] !== "string") continue;
    const hookName = e["hook"] as string;
    const tsVal = e["ts"];
    if (typeof tsVal !== "string") continue;
    const ts = new Date(tsVal).getTime();
    if (isNaN(ts) || ts < cutoff) continue;
    counts.set(hookName, (counts.get(hookName) ?? 0) + 1);
  }
  const hooks: HookStatus[] = KNOWN_HOOKS.map((name) => {
    const errorCount24h = counts.get(name) ?? 0;
    return {
      name,
      errorCount24h,
      status: errorCount24h > 0 ? "yellow" : "green"
    };
  });
  return { hooks };
}

export async function fetchAutonomousLoopBrief(repoPath: string): Promise<unknown> {
  try {
    const cli = await findAutonomousLoopCli();
    if (!cli) return null;
    const { stdout } = await execFile("node", [cli, "brief", "--repo", repoPath], {
      maxBuffer: 1024 * 1024
    });
    return JSON.parse(stdout) as unknown;
  } catch {
    return null;
  }
}
