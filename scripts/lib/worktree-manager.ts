// #163 — quick-win parallel lane: chore-branch worktree spawner.
//
// Cuts (or reuses) a dedicated `chore/quickwins-<YYYY-MM-DD>` worktree so
// small wins (doc drift, stale comments, artifact hygiene) commit + PR +
// merge independently of the active wave/slice branch, instead of piling
// onto it. The lane is deliberately DATE-KEYED: a second spawn on the same
// day reuses the existing branch/worktree so the day's wins batch into one
// PR (issue ask #4), rather than one branch per one-liner.
//
// The lane is always cut from the MAIN worktree (via resolveCanonicalRepoRoot)
// regardless of which worktree the caller invokes from — a linked worktree
// cannot itself host sibling worktrees cleanly, and the claim state the
// disjoint-check reads (scripts/lib/claims.ts, #163) already converges there.
// Worktrees live under `<mainRoot>/.claude/worktrees/` (gitignored).

import path from "node:path";
import { runGit as runGitStd } from "@astragenie/plugin-std/git";
import { type Result, ok, err } from "./result.ts";
import { resolveCanonicalRepoRoot } from "./repo-root.ts";

const WORKTREES_SUBDIR = [".claude", "worktrees"];
const CHORE_BRANCH_PREFIX = "chore/quickwins-";

interface GitOutcome {
  ok: boolean;
  stdout: string;
  stderr: string;
}

async function git(args: string[], cwd: string): Promise<GitOutcome> {
  try {
    const r = await runGitStd(args, { cwd, maxBuffer: 1024 * 1024 });
    return { ok: r.ok, stdout: r.stdout.trim(), stderr: r.stderr.trim() };
  } catch (error) {
    return { ok: false, stdout: "", stderr: error instanceof Error ? error.message : String(error) };
  }
}

async function refExists(cwd: string, ref: string): Promise<boolean> {
  return (await git(["rev-parse", "--verify", "--quiet", ref], cwd)).ok;
}

// Base to cut the lane from: prefer origin/main (the issue's contract — a
// chore lane should track the published mainline, not a possibly-dirty local
// main), fall back to a local `main`, then `HEAD` so offline repos and plain
// test fixtures with no remote still work.
async function resolveBase(mainRoot: string): Promise<string> {
  for (const ref of ["origin/main", "main"]) {
    if (await refExists(mainRoot, ref)) return ref;
  }
  return "HEAD";
}

function laneName(date: string): { branch: string; dirName: string } {
  return { branch: `${CHORE_BRANCH_PREFIX}${date}`, dirName: `quickwins-${date}` };
}

// UTC today (YYYY-MM-DD). Callers pass an explicit date for determinism/tests.
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

// The checkout path of the worktree currently holding `branch`, or null.
// Parses `git worktree list --porcelain`, whose records pair a `worktree
// <abs-path>` line with a `branch refs/heads/<name>` line.
async function worktreePathForBranch(mainRoot: string, branch: string): Promise<string | null> {
  const out = await git(["worktree", "list", "--porcelain"], mainRoot);
  if (!out.ok) return null;
  let currentPath: string | null = null;
  for (const line of out.stdout.split("\n")) {
    if (line.startsWith("worktree ")) {
      currentPath = line.slice("worktree ".length).trim();
    } else if (line.startsWith("branch ") && currentPath) {
      if (line.slice("branch ".length).trim() === `refs/heads/${branch}`) return currentPath;
    }
  }
  return null;
}

export interface ChoreLaneResult {
  branch: string;
  worktreePath: string;
  base: string;
  reused: boolean;
}

export interface ChoreLaneOptions {
  // Date component (YYYY-MM-DD) of the lane branch. Defaults to today (UTC).
  date?: string;
}

// Spawn — or reuse — today's quick-win chore lane. Idempotent per date:
//   1. branch + registered worktree already present  → reuse as-is.
//   2. branch present but worktree gone (pruned)      → re-attach a worktree.
//   3. neither                                        → cut fresh from base.
export async function spawnChoreLane(
  repoPath: string,
  options: ChoreLaneOptions = {}
): Promise<Result<ChoreLaneResult, Error>> {
  const mainRoot = await resolveCanonicalRepoRoot(repoPath);
  if (!(await git(["rev-parse", "--git-dir"], mainRoot)).ok) {
    return err(new Error(`Not a git repository: ${repoPath}`));
  }

  const date = options.date ?? todayUtc();
  const { branch, dirName } = laneName(date);
  const worktreePath = path.join(mainRoot, ...WORKTREES_SUBDIR, dirName);

  // 1. Lane already live → reuse (this is how a day's wins batch into one PR).
  const existingPath = await worktreePathForBranch(mainRoot, branch);
  if (existingPath) {
    return ok({ branch, worktreePath: existingPath, base: branch, reused: true });
  }

  // 2. Branch exists but no worktree → re-attach at the existing branch tip.
  if (await refExists(mainRoot, `refs/heads/${branch}`)) {
    const add = await git(["worktree", "add", worktreePath, branch], mainRoot);
    if (!add.ok) {
      return err(new Error(`git worktree add (re-attach ${branch}) failed: ${add.stderr}`));
    }
    return ok({ branch, worktreePath, base: branch, reused: true });
  }

  // 3. Fresh lane cut from base.
  const base = await resolveBase(mainRoot);
  const add = await git(["worktree", "add", "-b", branch, worktreePath, base], mainRoot);
  if (!add.ok) {
    return err(new Error(`git worktree add (new lane ${branch} from ${base}) failed: ${add.stderr}`));
  }
  return ok({ branch, worktreePath, base, reused: false });
}

export interface ChoreLaneStatus {
  exists: boolean;
  branch: string;
  worktreePath: string | null;
}

// Read-only: is today's (or the given date's) lane currently live?
export async function choreLaneStatus(
  repoPath: string,
  options: ChoreLaneOptions = {}
): Promise<Result<ChoreLaneStatus, Error>> {
  const mainRoot = await resolveCanonicalRepoRoot(repoPath);
  const { branch } = laneName(options.date ?? todayUtc());
  const existingPath = await worktreePathForBranch(mainRoot, branch);
  return ok({ exists: existingPath !== null, branch, worktreePath: existingPath });
}
