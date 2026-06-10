import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

const BRANCH_COMMITS_LIMIT = 5;
const REPO_ACTIVITY_LIMIT = 8;

// ---------------------------------------------------------------------------
// Exported interfaces
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
// Exported collector (with FEAT-129 Promise.all verbatim)
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
