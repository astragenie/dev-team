// #163 — concurrent chore-branch worktree lane.
//
// Before this fix, `.claude/state/crew/claims.json` was keyed off whatever
// repoPath a caller passed in. A linked worktree (the active wave/slice
// checkout, or a quick-win chore-branch lane cut alongside it) has its own
// physical `.claude/state/` directory that git never shares across
// worktrees — so each worktree's claims were invisible to every other
// worktree's claims, and the "verify a quick win's file set is disjoint
// from the active wave branch" check the issue asks for was structurally
// impossible: there was nothing to check against. resolveCanonicalRepoRoot
// (scripts/lib/repo-root.ts) fixes this by converging claim state on the
// MAIN worktree regardless of which worktree a caller invokes from — the
// same pattern already shipped for learnings.jsonl / grades.jsonl in
// astragenie/runner-plugin (FEAT-188 S1b, runner-plugin#326).
//
// workflow-state.ts (currentRun / gates) is deliberately NOT canonicalized:
// each worktree runs its own build/fix/slice ceremony and must keep its own
// currentRun. The last test below is a regression guard proving that stays
// true after this change.

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";

import { claimFiles, releaseFiles, listClaims } from "../scripts/lib/claims.ts";
import { startWorkflowRun, loadWorkflowState } from "../scripts/lib/workflow-state.ts";

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test",
  GIT_AUTHOR_EMAIL: "test@test.com",
  GIT_COMMITTER_NAME: "Test",
  GIT_COMMITTER_EMAIL: "test@test.com"
};

function git(args: string[], cwd: string): void {
  execFileSync("git", args, { cwd, env: GIT_ENV, stdio: "pipe" });
}

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

// Mirrors the wave/chore-lane topology: one main repo, two sibling linked
// worktrees on independent branches (the active wave/slice checkout and a
// concurrent chore-branch lane), both cut from the same main history.
async function setupWaveAndChoreLane(
  label: string
): Promise<{ repo: string; wave: string; chore: string }> {
  const repo = await makeTempDir(`claims-repo-${label}-`);
  git(["init", "-q", "-b", "main"], repo);
  git(["config", "user.email", "test@test.com"], repo);
  git(["config", "user.name", "Test"], repo);
  await fs.writeFile(path.join(repo, "README.md"), "# test\n");
  git(["add", "-A"], repo);
  git(["commit", "-q", "-m", "init"], repo);

  const wave = path.join(await makeTempDir(`claims-wave-${label}-`), "wave-worktree");
  git(["worktree", "add", "-b", `wave/${label}`, wave, "main"], repo);

  const chore = path.join(await makeTempDir(`claims-chore-${label}-`), "chore-worktree");
  git(["worktree", "add", "-b", `chore/${label}`, chore, "main"], repo);

  return { repo, wave, chore };
}

test("claiming the same file from the wave worktree and a concurrent chore-branch worktree surfaces a cross-lane conflict", async () => {
  const { wave, chore } = await setupWaveAndChoreLane("conflict");

  const waveClaim = await claimFiles(wave, ["src/shared.ts"], { owner: "wave-builder" });
  assert.equal(waveClaim.ok, true);
  assert.deepEqual(waveClaim.ok ? waveClaim.value.claimed : [], ["src/shared.ts"]);

  // Same file, claimed from the OTHER worktree by a different owner — this
  // is exactly the "file-claim check between lanes" the issue asks for.
  const choreClaim = await claimFiles(chore, ["src/shared.ts"], { owner: "chore-lane" });
  assert.equal(choreClaim.ok, true);
  if (!choreClaim.ok) return;
  assert.deepEqual(choreClaim.value.claimed, [], "conflicting file must not be re-claimed");
  assert.equal(choreClaim.value.conflicts.length, 1);
  assert.equal(choreClaim.value.conflicts[0]?.owner, "wave-builder");
});

test("disjoint files claimed from each worktree are both visible via listClaims from either worktree (clean cross-lane listing)", async () => {
  const { wave, chore } = await setupWaveAndChoreLane("listing");

  await claimFiles(wave, ["src/wave-only.ts"], { owner: "wave-builder" });
  await claimFiles(chore, ["docs/quickwin.md"], { owner: "chore-lane" });

  const fromWave = await listClaims(wave);
  const fromChore = await listClaims(chore);

  for (const claims of [fromWave, fromChore]) {
    const paths = claims.map((c) => c.path).sort();
    assert.deepEqual(paths, ["docs/quickwin.md", "src/wave-only.ts"]);
  }
});

test("releasing a claim from the chore-branch worktree is visible from the wave worktree", async () => {
  const { wave, chore } = await setupWaveAndChoreLane("release");

  await claimFiles(wave, ["src/temp.ts"], { owner: "wave-builder" });
  const release = await releaseFiles(chore, ["src/temp.ts"], { owner: "wave-builder" });
  assert.equal(release.ok, true);
  if (!release.ok) return;
  assert.deepEqual(release.value.released, ["src/temp.ts"]);

  const remaining = await listClaims(wave);
  assert.deepEqual(remaining, []);
});

test("starting a workflow run in the wave worktree does not create or touch workflow-state in the chore-branch worktree (currentRun stays per-worktree)", async () => {
  const { wave, chore } = await setupWaveAndChoreLane("no-collision");

  await startWorkflowRun(wave, { title: "Wave slice run" });

  const waveState = await loadWorkflowState(wave);
  assert.equal(waveState.currentRun?.title, "Wave slice run");

  // The chore worktree must not see the wave's currentRun, and must not
  // even have a workflow-state.json written by the wave's run.
  const choreStateFile = path.join(chore, ".claude", "state", "crew", "workflow-state.json");
  await assert.rejects(fs.access(choreStateFile), "chore worktree must have no workflow-state.json yet");

  const choreState = await loadWorkflowState(chore, { createIfMissing: false });
  assert.equal(choreState.currentRun, null);
});

test("claiming from the main repo path itself (no active worktree) is unaffected — regression guard", async () => {
  const { repo } = await setupWaveAndChoreLane("main-direct");

  const result = await claimFiles(repo, ["src/main-direct.ts"], { owner: "solo" });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.value.claimed, ["src/main-direct.ts"]);

  const claims = await listClaims(repo);
  assert.deepEqual(
    claims.map((c) => c.path),
    ["src/main-direct.ts"]
  );
});

test("claiming against a plain non-git directory falls back to repoPath unchanged (test-fixture safety)", async () => {
  const plain = await makeTempDir("claims-plain-");

  const result = await claimFiles(plain, ["a.ts"], { owner: "solo" });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.value.claimed, ["a.ts"]);

  const claimsPath = path.join(plain, ".claude", "state", "crew", "claims.json");
  await assert.doesNotReject(fs.access(claimsPath));
});
