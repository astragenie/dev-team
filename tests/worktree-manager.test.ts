import { test, expect } from "bun:test";
// #163 — chore-branch quick-win lane spawner.
//
// Verifies spawnChoreLane's three paths (fresh / reuse-live / re-attach) plus
// the date-keyed batching contract (same day → same lane) and non-git safety.

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { spawnChoreLane, choreLaneStatus } from "../scripts/lib/worktree-manager.ts";

// The developer's home dir (C:\Users\<user>) can itself be a git repo, which
// makes os.tmpdir() — nested under it — discover that repo upward. Cap git's
// upward walk at the tmp root so temp fixtures are seen as their own repos (or
// as genuinely non-git), independent of the machine's home-dir git state.
process.env.GIT_CEILING_DIRECTORIES = os.tmpdir();

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test",
  GIT_AUTHOR_EMAIL: "test@test.com",
  GIT_COMMITTER_NAME: "Test",
  GIT_COMMITTER_EMAIL: "test@test.com"
};

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, { cwd, env: GIT_ENV, stdio: "pipe" }).toString().trim();
}

async function makeRepo(label: string): Promise<string> {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), `wt-mgr-${label}-`));
  git(["init", "-q", "-b", "main"], repo);
  git(["config", "user.email", "test@test.com"], repo);
  git(["config", "user.name", "Test"], repo);
  await fs.writeFile(path.join(repo, "README.md"), "# test\n");
  git(["add", "-A"], repo);
  git(["commit", "-q", "-m", "init"], repo);
  return repo;
}

const DATE = "2026-07-10";
const BRANCH = `chore/quickwins-${DATE}`;

test("fresh spawn cuts chore/quickwins-<date> from main into a gitignored worktree", async () => {
  const repo = await makeRepo("fresh");

  const result = await spawnChoreLane(repo, { date: DATE });
  expect(result.ok).toBe(true);
  if (!result.ok) return;

  expect(result.value.branch).toBe(BRANCH);
  expect(result.value.reused).toBe(false);
  expect(result.value.base).toBe("main");
  expect(path.resolve(result.value.worktreePath)).toBe(
    path.resolve(repo, ".claude", "worktrees", `quickwins-${DATE}`)
  );

  // Worktree actually exists on disk and is checked out on the lane branch.
  await fs.access(result.value.worktreePath);
  const head = git(["rev-parse", "--abbrev-ref", "HEAD"], result.value.worktreePath);
  expect(head).toBe(BRANCH);

  // Lane branch tip equals main's tip (cut from base, not a stray commit).
  expect(git(["rev-parse", BRANCH], repo)).toBe(git(["rev-parse", "main"], repo));
});

test("second spawn on the same date reuses the live lane (batching: one PR/day)", async () => {
  const repo = await makeRepo("reuse");

  const first = await spawnChoreLane(repo, { date: DATE });
  const second = await spawnChoreLane(repo, { date: DATE });
  expect(first.ok && second.ok).toBe(true);
  if (!first.ok || !second.ok) return;

  expect(second.value.reused).toBe(true);
  expect(path.resolve(second.value.worktreePath)).toBe(path.resolve(first.value.worktreePath));
  // Exactly one lane worktree registered — no duplicate.
  const list = git(["worktree", "list", "--porcelain"], repo);
  const laneCount = list.split("\n").filter((l) => l === `branch refs/heads/${BRANCH}`).length;
  expect(laneCount).toBe(1);
});

test("branch survives but worktree pruned → re-attach a worktree at the existing branch", async () => {
  const repo = await makeRepo("reattach");

  const first = await spawnChoreLane(repo, { date: DATE });
  expect(first.ok).toBe(true);
  if (!first.ok) return;

  // Simulate an operator removing the worktree while keeping the branch.
  git(["worktree", "remove", "--force", first.value.worktreePath], repo);
  expect(git(["rev-parse", "--verify", BRANCH], repo).length > 0).toBe(true);

  const again = await spawnChoreLane(repo, { date: DATE });
  expect(again.ok).toBe(true);
  if (!again.ok) return;
  expect(again.value.reused).toBe(true);
  expect(again.value.branch).toBe(BRANCH);
  await fs.access(again.value.worktreePath);
});

test("choreLaneStatus reflects lane presence before and after spawn", async () => {
  const repo = await makeRepo("status");

  const before = await choreLaneStatus(repo, { date: DATE });
  expect(before.ok).toBe(true);
  if (!before.ok) return;
  expect(before.value.exists).toBe(false);
  expect(before.value.worktreePath).toBe(null);
  expect(before.value.branch).toBe(BRANCH);

  await spawnChoreLane(repo, { date: DATE });

  const after = await choreLaneStatus(repo, { date: DATE });
  expect(after.ok).toBe(true);
  if (!after.ok) return;
  expect(after.value.exists).toBe(true);
  expect(after.value.worktreePath).not.toBe(null);
});

test("spawning against a plain non-git directory returns an error, not a crash", async () => {
  const plain = await fs.mkdtemp(path.join(os.tmpdir(), "wt-mgr-plain-"));

  const result = await spawnChoreLane(plain, { date: DATE });
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.message).toMatch(/Not a git repository/);
});
