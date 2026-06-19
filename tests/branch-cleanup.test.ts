// Tests for scripts/lib/branch-cleanup.ts
//
// Uses a real git repo in a tmpdir to exercise the three exported functions:
//   isStandardMerged, isSquashMerged, isBranchMerged
//
// Key scenario: squash-merged branch — git branch --merged misses it, but
// git diff <branch> <base> --stat (two-dot, reversed) is empty, so
// isBranchMerged correctly returns true.

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
import assert from "node:assert/strict";

import { isStandardMerged, isSquashMerged, isBranchMerged } from "../scripts/lib/branch-cleanup.ts";

const execFile = promisify(execFileCallback);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function git(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFile("git", args, { cwd });
  return stdout.trim();
}

// Create a bare git repo with a single commit on main.
async function initRepo(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "branch-cleanup-"));
  await git(dir, "init", "-q", "-b", "main");
  await git(dir, "config", "user.email", "test@example.com");
  await git(dir, "config", "user.name", "Test");
  // Initial commit
  await fs.writeFile(path.join(dir, "README.md"), "# repo\n");
  await git(dir, "add", "README.md");
  await git(dir, "commit", "-q", "-m", "init");
  return dir;
}

// Create a branch off main with one commit, then SQUASH-merge it back to main.
// A squash-merge: git merge --squash <branch> && git commit
// After this, `git branch --merged main` will NOT list the branch because the
// branch tip is not an ancestor of main (the squash created a new commit).
async function createSquashMergedBranch(dir: string, branchName: string): Promise<void> {
  await git(dir, "checkout", "-q", "-b", branchName);
  await fs.writeFile(path.join(dir, "feature.txt"), "feature content\n");
  await git(dir, "add", "feature.txt");
  await git(dir, "commit", "-q", "-m", "feat: add feature");
  // Return to main, squash-merge
  await git(dir, "checkout", "-q", "main");
  await git(dir, "merge", "--squash", "-q", branchName);
  await git(dir, "commit", "-q", "-m", "squash merge feature");
}

// Create a branch off main with one commit, then standard-merge it back.
async function createStandardMergedBranch(dir: string, branchName: string): Promise<void> {
  await git(dir, "checkout", "-q", "-b", branchName);
  await fs.writeFile(path.join(dir, "other.txt"), "other content\n");
  await git(dir, "add", "other.txt");
  await git(dir, "commit", "-q", "-m", "feat: add other");
  await git(dir, "checkout", "-q", "main");
  await git(dir, "merge", "-q", "--no-ff", "-m", "merge other", branchName);
}

// Create an unmerged branch with one commit (still ahead of main).
async function createUnmergedBranch(dir: string, branchName: string): Promise<void> {
  await git(dir, "checkout", "-q", "-b", branchName);
  await fs.writeFile(path.join(dir, "wip.txt"), "wip content\n");
  await git(dir, "add", "wip.txt");
  await git(dir, "commit", "-q", "-m", "wip: not merged yet");
  await git(dir, "checkout", "-q", "main");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("isStandardMerged: returns false for squash-merged branch", async () => {
  const dir = await initRepo();
  await createSquashMergedBranch(dir, "feat/squash");

  const result = await isStandardMerged(dir, "feat/squash", "main");
  // Squash merge does NOT make the branch appear in `git branch --merged`
  assert.equal(result, false, "squash-merged branch should NOT appear in standard merged check");
});

test("isSquashMerged: returns true for squash-merged branch (empty two-dot diff)", async () => {
  const dir = await initRepo();
  await createSquashMergedBranch(dir, "feat/squash");

  const result = await isSquashMerged(dir, "feat/squash", "main");
  assert.equal(result, true, "squash-merged branch should have empty diff vs main");
});

test("isBranchMerged: returns true for squash-merged branch", async () => {
  const dir = await initRepo();
  await createSquashMergedBranch(dir, "feat/squash");

  const result = await isBranchMerged(dir, "feat/squash", "main");
  assert.equal(result, true, "isBranchMerged should detect squash-merged branch as merged");
});

test("isStandardMerged: returns true for standard-merged branch", async () => {
  const dir = await initRepo();
  await createStandardMergedBranch(dir, "feat/standard");

  const result = await isStandardMerged(dir, "feat/standard", "main");
  assert.equal(result, true, "standard-merged branch should appear in git branch --merged");
});

test("isSquashMerged: returns true for standard-merged branch (diff also empty)", async () => {
  // After a standard merge, the branch tip IS an ancestor of main, so the
  // two-dot diff is also empty — isSquashMerged returns true here too.
  // That is acceptable: it is a superset check (branch has no unmerged diff).
  const dir = await initRepo();
  await createStandardMergedBranch(dir, "feat/standard");

  const result = await isSquashMerged(dir, "feat/standard", "main");
  // After standard merge, two-dot diff is empty (branch already in main).
  assert.equal(result, true, "standard-merged branch also has empty three-dot diff");
});

test("isBranchMerged: returns true for standard-merged branch", async () => {
  const dir = await initRepo();
  await createStandardMergedBranch(dir, "feat/standard");

  const result = await isBranchMerged(dir, "feat/standard", "main");
  assert.equal(result, true, "standard-merged branch should be detected as merged");
});

test("isStandardMerged: returns false for unmerged branch", async () => {
  const dir = await initRepo();
  await createUnmergedBranch(dir, "feat/wip");

  const result = await isStandardMerged(dir, "feat/wip", "main");
  assert.equal(result, false, "unmerged branch should NOT appear in git branch --merged");
});

test("isSquashMerged: returns false for unmerged branch", async () => {
  const dir = await initRepo();
  await createUnmergedBranch(dir, "feat/wip");

  const result = await isSquashMerged(dir, "feat/wip", "main");
  assert.equal(result, false, "unmerged branch should have non-empty diff vs main");
});

test("isBranchMerged: returns false for unmerged branch", async () => {
  const dir = await initRepo();
  await createUnmergedBranch(dir, "feat/wip");

  const result = await isBranchMerged(dir, "feat/wip", "main");
  assert.equal(result, false, "unmerged branch should not be detected as merged");
});

test("isSquashMerged: returns false for unknown branch ref", async () => {
  const dir = await initRepo();

  const result = await isSquashMerged(dir, "nonexistent/branch", "main");
  assert.equal(result, false, "unknown branch ref should not be detected as squash-merged");
});

test("isBranchMerged: returns false for unknown branch ref", async () => {
  const dir = await initRepo();

  const result = await isBranchMerged(dir, "nonexistent/branch", "main");
  assert.equal(result, false, "unknown branch ref should not be detected as merged");
});
