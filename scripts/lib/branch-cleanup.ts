// Branch cleanup helpers for parallel-runner and crew fleet.
//
// Determines whether a branch is effectively merged into a base branch,
// handling both standard merges (tracked by `git branch --merged`) and
// squash-merges (missed by `git branch --merged` but detectable via an
// empty `git diff <base>...<branch> --stat`).

import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

// Run a git command in the given repo directory.
// Returns stdout on success, null on any error (non-zero exit, ENOENT, etc.).
async function runGit(repoPath: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFile("git", args, { cwd: repoPath });
    return stdout.trim();
  } catch {
    return null;
  }
}

// Returns true when `branch` appears in `git branch --merged <base>`, i.e.
// its entire history is reachable from `base`. This is the standard merged
// detection but misses squash-merge PRs.
export async function isStandardMerged(
  repoPath: string,
  branch: string,
  base: string = "main"
): Promise<boolean> {
  const out = await runGit(repoPath, ["branch", "--merged", base]);
  if (out === null) return false;
  // Each line is "  <branch>" or "* <branch>" — strip whitespace/asterisk.
  return out
    .split("\n")
    .map((l) => l.replace(/^\*?\s+/, "").trim())
    .includes(branch);
}

// Returns true when `git diff <branch> <base> --stat` is empty.
// An empty two-dot diff (branch → base, reversed) means the base already
// contains all changes from branch — the fingerprint of a squash-merged PR.
// When a PR is squash-merged, the squash commit on base incorporates the
// same file changes, so `git diff <branch> <base>` shows nothing outstanding.
//
// Note: `git diff <base>...<branch>` (three-dot) does NOT work here because
// it shows changes from the merge-base to branch, which is still non-empty
// after a squash-merge (the branch tip is not an ancestor of base).
export async function isSquashMerged(
  repoPath: string,
  branch: string,
  base: string = "main"
): Promise<boolean> {
  const out = await runGit(repoPath, ["diff", branch, base, "--stat"]);
  // null means git failed (e.g. unknown ref) — treat as not merged.
  if (out === null) return false;
  return out.length === 0;
}

// Comprehensive merged check: returns true when the branch is merged via
// either the standard path OR a squash-merge.
//
// Callers that previously relied solely on `git branch --merged` should
// switch to this function to avoid leaving orphaned worktree branches.
export async function isBranchMerged(
  repoPath: string,
  branch: string,
  base: string = "main"
): Promise<boolean> {
  const [standard, squash] = await Promise.all([
    isStandardMerged(repoPath, branch, base),
    isSquashMerged(repoPath, branch, base)
  ]);
  return standard || squash;
}
