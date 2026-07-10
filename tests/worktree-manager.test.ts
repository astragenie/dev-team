// #163 — chore-branch quick-win lane spawner.
//
// Verifies spawnChoreLane's three paths (fresh / reuse-live / re-attach) plus
// the date-keyed batching contract (same day → same lane) and non-git safety.

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";

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
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.value.branch, BRANCH);
  assert.equal(result.value.reused, false);
  assert.equal(result.value.base, "main");
  assert.equal(
    path.resolve(result.value.worktreePath),
    path.resolve(repo, ".claude", "worktrees", `quickwins-${DATE}`)
  );

  // Worktree actually exists on disk and is checked out on the lane branch.
  await assert.doesNotReject(fs.access(result.value.worktreePath));
  const head = git(["rev-parse", "--abbrev-ref", "HEAD"], result.value.worktreePath);
  assert.equal(head, BRANCH);

  // Lane branch tip equals main's tip (cut from base, not a stray commit).
  assert.equal(git(["rev-parse", BRANCH], repo), git(["rev-parse", "main"], repo));
});

test("second spawn on the same date reuses the live lane (batching: one PR/day)", async () => {
  const repo = await makeRepo("reuse");

  const first = await spawnChoreLane(repo, { date: DATE });
  const second = await spawnChoreLane(repo, { date: DATE });
  assert.equal(first.ok && second.ok, true);
  if (!first.ok || !second.ok) return;

  assert.equal(second.value.reused, true);
  assert.equal(
    path.resolve(second.value.worktreePath),
    path.resolve(first.value.worktreePath)
  );
  // Exactly one lane worktree registered — no duplicate.
  const list = git(["worktree", "list", "--porcelain"], repo);
  const laneCount = list.split("\n").filter((l) => l === `branch refs/heads/${BRANCH}`).length;
  assert.equal(laneCount, 1);
});

test("branch survives but worktree pruned → re-attach a worktree at the existing branch", async () => {
  const repo = await makeRepo("reattach");

  const first = await spawnChoreLane(repo, { date: DATE });
  assert.equal(first.ok, true);
  if (!first.ok) return;

  // Simulate an operator removing the worktree while keeping the branch.
  git(["worktree", "remove", "--force", first.value.worktreePath], repo);
  assert.equal(git(["rev-parse", "--verify", BRANCH], repo).length > 0, true);

  const again = await spawnChoreLane(repo, { date: DATE });
  assert.equal(again.ok, true);
  if (!again.ok) return;
  assert.equal(again.value.reused, true);
  assert.equal(again.value.branch, BRANCH);
  await assert.doesNotReject(fs.access(again.value.worktreePath));
});

test("choreLaneStatus reflects lane presence before and after spawn", async () => {
  const repo = await makeRepo("status");

  const before = await choreLaneStatus(repo, { date: DATE });
  assert.equal(before.ok, true);
  if (!before.ok) return;
  assert.equal(before.value.exists, false);
  assert.equal(before.value.worktreePath, null);
  assert.equal(before.value.branch, BRANCH);

  await spawnChoreLane(repo, { date: DATE });

  const after = await choreLaneStatus(repo, { date: DATE });
  assert.equal(after.ok, true);
  if (!after.ok) return;
  assert.equal(after.value.exists, true);
  assert.notEqual(after.value.worktreePath, null);
});

test("spawning against a plain non-git directory returns an error, not a crash", async () => {
  const plain = await fs.mkdtemp(path.join(os.tmpdir(), "wt-mgr-plain-"));

  const result = await spawnChoreLane(plain, { date: DATE });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error.message, /Not a git repository/);
});
