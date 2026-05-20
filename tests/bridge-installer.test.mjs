// Tests for the Wiggin Loop bridge installer + backfill (scripts/lib/bridge-installer.mjs).
//
// These cover what the WigginHarnes smoke test already proved manually,
// plus regressions worth catching automatically:
//   - installer writes the post-commit + PostToolUse hook + README + settings
//   - settings.json merge preserves existing PostToolUse entries
//   - install is idempotent (re-running is a no-op or content-stable)
//   - install errors when the target is not a git repo
//   - backfill picks up SLICE-pattern commits, skips non-matching ones
//   - backfill produces one Crew review-result artifact per matched commit

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

import { installWigginBridge, backfillWigginBridge } from "../scripts/lib/bridge-installer.mjs";

const execFile = promisify(execFileCallback);

async function makeTempDir(prefix) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function initGitRepo(prefix) {
  const repoPath = await makeTempDir(prefix);
  await execFile("git", ["init", "--quiet"], { cwd: repoPath });
  await execFile("git", ["config", "user.email", "test@example.com"], { cwd: repoPath });
  await execFile("git", ["config", "user.name", "Test"], { cwd: repoPath });
  await execFile("git", ["config", "commit.gpgsign", "false"], { cwd: repoPath });
  return repoPath;
}

async function commit(repoPath, subject, body = "") {
  // Touch a unique file so each commit has a real change.
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const filePath = path.join(repoPath, `f-${stamp}.txt`);
  await fs.writeFile(filePath, stamp);
  await execFile("git", ["add", "."], { cwd: repoPath });
  const args = ["commit", "-q", "-m", subject];
  if (body) args.push("-m", body);
  await execFile("git", args, { cwd: repoPath });
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

test("install-wiggin-bridge writes hook + bridge + README and registers settings", async () => {
  const repoPath = await initGitRepo("crew-bridge-install-");

  const result = await installWigginBridge(repoPath);

  assert.equal(result.mode, "install-wiggin-bridge");
  assert.ok(result.writes.some((p) => p.includes("post-commit")));
  assert.ok(result.writes.some((p) => p.includes("wiggin_loop_bridge.sh")));
  assert.ok(result.writes.some((p) => p.includes("README.md")));
  assert.ok(result.writes.some((p) => p.endsWith("settings.json")));

  assert.ok(await pathExists(path.join(repoPath, ".git", "hooks", "post-commit")));
  assert.ok(await pathExists(path.join(repoPath, ".claude", "hooks", "wiggin_loop_bridge.sh")));
  assert.ok(await pathExists(path.join(repoPath, ".claude", "hooks", "README.md")));

  const settings = JSON.parse(
    await fs.readFile(path.join(repoPath, ".claude", "settings.json"), "utf8")
  );
  const postToolUse = settings.hooks?.PostToolUse || [];
  assert.equal(postToolUse.length, 1);
  assert.equal(postToolUse[0].matcher, "Edit|Write|MultiEdit");
  assert.equal(postToolUse[0].hooks[0].description, "crew:wiggin-loop-bridge");
});

test("install-wiggin-bridge preserves existing PostToolUse hooks", async () => {
  const repoPath = await initGitRepo("crew-bridge-preserve-");

  // Seed settings.json with an unrelated PostToolUse hook the user already has.
  const settingsPath = path.join(repoPath, ".claude", "settings.json");
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(
    settingsPath,
    `${JSON.stringify(
      {
        hooks: {
          PostToolUse: [
            {
              matcher: "Read",
              hooks: [
                {
                  type: "command",
                  command: "echo read-event",
                  description: "user:read-tracker"
                }
              ]
            }
          ]
        }
      },
      null,
      2
    )}\n`
  );

  await installWigginBridge(repoPath);

  const settings = JSON.parse(await fs.readFile(settingsPath, "utf8"));
  const postToolUse = settings.hooks.PostToolUse;
  assert.equal(postToolUse.length, 2, "user's existing hook should still be present alongside the bridge");
  const descriptions = postToolUse.flatMap((entry) => entry.hooks.map((h) => h.description));
  assert.ok(descriptions.includes("user:read-tracker"));
  assert.ok(descriptions.includes("crew:wiggin-loop-bridge"));
});

test("install-wiggin-bridge is idempotent (re-running does not duplicate the bridge entry)", async () => {
  const repoPath = await initGitRepo("crew-bridge-idempotent-");

  await installWigginBridge(repoPath);
  await installWigginBridge(repoPath);

  const settings = JSON.parse(
    await fs.readFile(path.join(repoPath, ".claude", "settings.json"), "utf8")
  );
  const bridgeEntries = (settings.hooks.PostToolUse || []).flatMap((entry) =>
    entry.hooks.filter((h) => h.description === "crew:wiggin-loop-bridge")
  );
  assert.equal(bridgeEntries.length, 1, "second install should not append a duplicate bridge hook");
});

test("install-wiggin-bridge throws when target is not a git repo", async () => {
  const tmpPath = await makeTempDir("crew-bridge-no-git-");
  await assert.rejects(
    () => installWigginBridge(tmpPath),
    /Not a git repository/
  );
});

test("backfill picks up SLICE-pattern commits, skips non-matching commits", async () => {
  const repoPath = await initGitRepo("crew-bridge-backfill-");

  await commit(repoPath, "chore: scaffold");
  await commit(repoPath, "feat(slice-00): scaffold");
  await commit(repoPath, "feat: SLICE_01 — registry");
  await commit(repoPath, "docs: notes");
  await commit(repoPath, "merge: LoopBrain all 3 slices into main");
  await commit(repoPath, "fix: tweak");

  const result = await backfillWigginBridge(repoPath);

  assert.equal(result.mode, "backfill-wiggin-bridge");
  assert.equal(result.count, 3, "should pick up slice-00, SLICE_01, and 'all 3 slices' merge");
  assert.equal(result.skippedOrFailed, 0);
  assert.equal(result.artifacts.length, 3);

  const reviewsDir = path.join(repoPath, ".claude", "artifacts", "crew", "reviews");
  const entries = await fs.readdir(reviewsDir);
  assert.equal(entries.length, 3, "one review-result artifact per matching commit");

  // Spot-check that the artifact references the commit subject.
  const sliceArtifact = entries.find((name) => name.includes("slice-00"));
  assert.ok(sliceArtifact, "slice-00 commit should have produced a matching artifact filename");
});
