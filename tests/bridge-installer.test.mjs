// Tests for the generic Crew commit bridge installer + backfill
// (scripts/lib/bridge-installer.mjs), plus the wiggin-loop compat alias.

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

import {
  installCommitBridge,
  installWigginBridge,
  backfillCommitBridge,
  backfillWigginBridge,
  listBridgePresets
} from "../scripts/lib/bridge-installer.mjs";

const execFile = promisify(execFileCallback);

const BRIDGE_DESCRIPTION = "crew:commit-bridge";
const BRIDGE_HOOK_FILE = "commit_bridge.sh";

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

test("install-commit-bridge with default preset writes hooks, README, settings", async () => {
  const repoPath = await initGitRepo("crew-bridge-default-");

  const result = await installCommitBridge(repoPath);

  assert.equal(result.mode, "install-commit-bridge");
  assert.equal(result.preset, "wiggin-loop");
  assert.match(result.commitPattern, /SLICE_/);
  assert.equal(result.triggerFilename, "completed-slices.md");
  assert.ok(result.writes.some((p) => p.includes("post-commit")));
  assert.ok(result.writes.some((p) => p.includes(BRIDGE_HOOK_FILE)));
  assert.ok(result.writes.some((p) => p.includes("README.md")));
  assert.ok(result.writes.some((p) => p.endsWith("settings.json")));

  assert.ok(await pathExists(path.join(repoPath, ".git", "hooks", "post-commit")));
  assert.ok(await pathExists(path.join(repoPath, ".claude", "hooks", BRIDGE_HOOK_FILE)));
  assert.ok(await pathExists(path.join(repoPath, ".claude", "hooks", "README.md")));

  const settings = JSON.parse(
    await fs.readFile(path.join(repoPath, ".claude", "settings.json"), "utf8")
  );
  const postToolUse = settings.hooks?.PostToolUse || [];
  assert.equal(postToolUse.length, 1);
  assert.equal(postToolUse[0].matcher, "Edit|Write|MultiEdit");
  assert.equal(postToolUse[0].hooks[0].description, BRIDGE_DESCRIPTION);
});

test("install-commit-bridge with --preset conventional-commits applies that preset", async () => {
  const repoPath = await initGitRepo("crew-bridge-conv-");

  const result = await installCommitBridge(repoPath, { preset: "conventional-commits" });

  assert.equal(result.preset, "conventional-commits");
  assert.equal(result.triggerFilename, "CHANGELOG.md");
  assert.equal(result.reviewerLabel, "conventional-commits");

  // Generated hook script embeds the pattern.
  const hook = await fs.readFile(path.join(repoPath, ".git", "hooks", "post-commit"), "utf8");
  assert.match(hook, /feat\|fix\|refactor\|perf/);
});

test("install-commit-bridge accepts explicit overrides on top of a preset", async () => {
  const repoPath = await initGitRepo("crew-bridge-overrides-");

  const result = await installCommitBridge(repoPath, {
    commitPattern: "^EPIC_[0-9]+",
    triggerFilename: "epics-done.md",
    reviewerLabel: "epic-tracker"
  });

  assert.equal(result.commitPattern, "^EPIC_[0-9]+");
  assert.equal(result.triggerFilename, "epics-done.md");
  assert.equal(result.reviewerLabel, "epic-tracker");

  const hook = await fs.readFile(path.join(repoPath, ".git", "hooks", "post-commit"), "utf8");
  assert.match(hook, /\^EPIC_\[0-9\]\+/);
  assert.match(hook, /epic-tracker/);

  const bridge = await fs.readFile(path.join(repoPath, ".claude", "hooks", BRIDGE_HOOK_FILE), "utf8");
  assert.match(bridge, /epics-done\.md/);
});

test("install-commit-bridge throws on unknown preset", async () => {
  const repoPath = await initGitRepo("crew-bridge-bad-preset-");
  await assert.rejects(
    () => installCommitBridge(repoPath, { preset: "nope" }),
    /Unknown preset "nope"/
  );
});

test("install-commit-bridge preserves existing PostToolUse hooks", async () => {
  const repoPath = await initGitRepo("crew-bridge-preserve-");

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

  await installCommitBridge(repoPath);

  const settings = JSON.parse(await fs.readFile(settingsPath, "utf8"));
  const postToolUse = settings.hooks.PostToolUse;
  assert.equal(postToolUse.length, 2);
  const descriptions = postToolUse.flatMap((entry) => entry.hooks.map((h) => h.description));
  assert.ok(descriptions.includes("user:read-tracker"));
  assert.ok(descriptions.includes(BRIDGE_DESCRIPTION));
});

test("install-commit-bridge is idempotent and migrates legacy crew:wiggin-loop-bridge registrations", async () => {
  const repoPath = await initGitRepo("crew-bridge-idempotent-");

  // First, seed a legacy registration from the old wiggin-only installer.
  const settingsPath = path.join(repoPath, ".claude", "settings.json");
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(
    settingsPath,
    `${JSON.stringify(
      {
        hooks: {
          PostToolUse: [
            {
              matcher: "Edit|Write|MultiEdit",
              hooks: [
                {
                  type: "command",
                  command: "${PWD}/.claude/hooks/wiggin_loop_bridge.sh",
                  description: "crew:wiggin-loop-bridge"
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
  // Also seed the legacy hook file so the cleanup path is exercised.
  await fs.mkdir(path.join(repoPath, ".claude", "hooks"), { recursive: true });
  await fs.writeFile(path.join(repoPath, ".claude", "hooks", "wiggin_loop_bridge.sh"), "#legacy\n");

  await installCommitBridge(repoPath);
  await installCommitBridge(repoPath);

  const settings = JSON.parse(await fs.readFile(settingsPath, "utf8"));
  const descriptions = (settings.hooks.PostToolUse || []).flatMap((entry) =>
    entry.hooks.map((h) => h.description)
  );
  assert.deepEqual(
    descriptions,
    [BRIDGE_DESCRIPTION],
    "legacy crew:wiggin-loop-bridge should be replaced by crew:commit-bridge and not duplicated on re-run"
  );

  assert.equal(
    await pathExists(path.join(repoPath, ".claude", "hooks", "wiggin_loop_bridge.sh")),
    false,
    "legacy wiggin_loop_bridge.sh should be removed in favor of commit_bridge.sh"
  );
});

test("install-commit-bridge throws when target is not a git repo", async () => {
  const tmpPath = await makeTempDir("crew-bridge-no-git-");
  await assert.rejects(
    () => installCommitBridge(tmpPath),
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

  const result = await backfillCommitBridge(repoPath);

  assert.equal(result.mode, "backfill-commit-bridge");
  assert.equal(result.count, 3);
  assert.equal(result.skippedOrFailed, 0);

  const reviewsDir = path.join(repoPath, ".claude", "artifacts", "crew", "reviews");
  const entries = await fs.readdir(reviewsDir);
  assert.equal(entries.length, 3);

  const sliceArtifact = entries.find((name) => name.includes("slice-00"));
  assert.ok(sliceArtifact);
});

test("backfill with --preset conventional-commits matches feat/fix-style commits", async () => {
  const repoPath = await initGitRepo("crew-bridge-backfill-conv-");

  await commit(repoPath, "chore: scaffold");
  await commit(repoPath, "feat(api): add endpoint");
  await commit(repoPath, "fix: bug");
  await commit(repoPath, "docs: README");

  const result = await backfillCommitBridge(repoPath, { preset: "conventional-commits" });
  assert.equal(result.count, 2, "should match feat(api) and fix; ignore chore and docs");
});

test("backfill with explicit --commit-pattern overrides the preset", async () => {
  const repoPath = await initGitRepo("crew-bridge-backfill-pattern-");

  await commit(repoPath, "EPIC_001: foo");
  await commit(repoPath, "feat: nothing");
  await commit(repoPath, "EPIC_002: bar");

  const result = await backfillCommitBridge(repoPath, {
    commitPattern: "^EPIC_[0-9]+",
    reviewerLabel: "epic-tracker"
  });
  assert.equal(result.count, 2);
});

test("listBridgePresets returns built-in presets with required fields", () => {
  const presets = listBridgePresets();
  assert.ok(presets.length >= 2);
  const wiggin = presets.find((p) => p.name === "wiggin-loop");
  assert.ok(wiggin);
  assert.ok(wiggin.commitPattern);
  assert.ok(wiggin.triggerFilename);
  assert.ok(wiggin.reviewerLabel);
});

test("installWigginBridge alias still works and uses the wiggin-loop preset", async () => {
  const repoPath = await initGitRepo("crew-bridge-wiggin-alias-");
  const result = await installWigginBridge(repoPath);
  assert.equal(result.preset, "wiggin-loop");
});

test("backfillWigginBridge alias still works and uses the wiggin-loop preset", async () => {
  const repoPath = await initGitRepo("crew-bridge-wiggin-backfill-alias-");
  await commit(repoPath, "feat: SLICE_00 init");
  await commit(repoPath, "chore: setup");
  const result = await backfillWigginBridge(repoPath);
  assert.equal(result.preset, "wiggin-loop");
  assert.equal(result.count, 1);
});
