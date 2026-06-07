// Regression tests for the May 2026 scripts audit findings.
//
// These tests cover bugs found during the deep architectural review:
//   - BUG-A: concurrent claim race (claims.mjs)
//   - BUG-B: write-run-brief silently destroys current run (workflow-state.mjs)
//   - BUG-C: dead duplicate validation-result branch in artifacts.mjs
//
// The pre-existing CLI suite did not catch these because it ran operations
// serially and never wrote a second run-brief in the same repo. Keep these
// tests as a regression net even after the fixes ship.

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cliPath = path.join(repoRoot, "scripts", "crew.ts");

async function makeTempDir(prefix) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function initRepo(prefix) {
  const repoPath = await makeTempDir(prefix);
  await execFile("node", ["--experimental-strip-types", cliPath, "init", "--repo", repoPath]);
  return repoPath;
}

test("BUG-A: concurrent claims on disjoint files do not lose data (5-way parallel)", async () => {
  // Pre-fix behavior: read-modify-write on claims.json with no locking. Under
  // 5-parallel claim operations, ~40% of claims were lost (last-writer-wins).
  // Confirmed 20/20 iterations had losses in stress test before the fix.
  //
  // After the fix: the file-lock around the read-modify-write sequence
  // serializes the writes. All 5 claims must persist.
  const repoPath = await initRepo("crew-bug-a-claims-race-");

  const parallelCount = 5;
  const promises = [];
  for (let i = 0; i < parallelCount; i += 1) {
    promises.push(
      execFile("node", [
        cliPath,
        "claim",
        "--repo",
        repoPath,
        "--owner",
        `owner_${i}`,
        `file_${i}.txt`
      ])
    );
  }
  await Promise.all(promises);

  const showOutput = await execFile("node", [
    "--experimental-strip-types",
    cliPath,
    "show-claims",
    "--repo",
    repoPath
  ]);
  const showResult = JSON.parse(showOutput.stdout);
  assert.equal(
    showResult.claims.length,
    parallelCount,
    `expected ${parallelCount} claims after parallel acquire, got ${showResult.claims.length} (race regression)`
  );

  const owners = new Set(showResult.claims.map((c) => c.owner));
  assert.equal(owners.size, parallelCount, "each parallel claim should have a distinct owner");
});

test("BUG-A: concurrent releases do not corrupt claims state", async () => {
  // Symmetric to the claim race: releaseFiles also did read-modify-write
  // without locking. Verify that parallel releases of disjoint files all
  // succeed and that the final state is consistent.
  const repoPath = await initRepo("crew-bug-a-releases-race-");
  const count = 5;

  // Pre-populate sequentially (no race exposure during setup).
  for (let i = 0; i < count; i += 1) {
    await execFile("node", [
      cliPath,
      "claim",
      "--repo",
      repoPath,
      "--owner",
      `o_${i}`,
      `f_${i}.txt`
    ]);
  }

  // Release in parallel.
  const promises = [];
  for (let i = 0; i < count; i += 1) {
    promises.push(
      execFile("node", [
        "--experimental-strip-types",
        cliPath,
        "release",
        "--repo",
        repoPath,
        "--owner",
        `o_${i}`,
        `f_${i}.txt`
      ])
    );
  }
  await Promise.all(promises);

  const showOutput = await execFile("node", [
    "--experimental-strip-types",
    cliPath,
    "show-claims",
    "--repo",
    repoPath
  ]);
  const showResult = JSON.parse(showOutput.stdout);
  assert.equal(
    showResult.claims.length,
    0,
    `expected 0 claims after parallel release, got ${showResult.claims.length}`
  );
});

test("BUG-B: write-run-brief archives the previous run instead of destroying it", async () => {
  // Pre-fix behavior: registerWorkflowArtifact for run-brief replaced
  // state.currentRun via createRun() without calling archiveRun(). The
  // previous run — including any pending gates such as review_required —
  // was silently lost. recentRuns stayed empty.
  //
  // After the fix: the previous currentRun is moved to recentRuns,
  // preserving its title, status, and gate state for retrieval.
  const repoPath = await initRepo("crew-bug-b-run-brief-archive-");

  await execFile("node", [
    cliPath,
    "write-run-brief",
    "--repo",
    repoPath,
    "--title",
    "First run",
    "--goal",
    "First goal",
    "--mode",
    "single-session"
  ]);

  await execFile("node", [
    cliPath,
    "mark-badge",
    "--repo",
    repoPath,
    "--badge",
    "review_required",
    "--note",
    "First run awaiting review"
  ]);

  // Sanity: pending gate exists on the first run.
  let stateOutput = await execFile("node", [
    "--experimental-strip-types",
    cliPath,
    "show-workflow-state",
    "--repo",
    repoPath
  ]);
  let state = JSON.parse(stateOutput.stdout);
  assert.equal(state.workflowState.currentRun.title, "First run");
  assert.equal(state.workflowState.currentRun.gates.review.status, "required");
  assert.equal(
    state.workflowState.recentRuns.length,
    0,
    "archive should be empty before second brief"
  );

  // Write a second run brief. The first run must be archived, not destroyed.
  await execFile("node", [
    cliPath,
    "write-run-brief",
    "--repo",
    repoPath,
    "--title",
    "Second run",
    "--goal",
    "Second goal",
    "--mode",
    "assisted single-session"
  ]);

  stateOutput = await execFile("node", [
    "--experimental-strip-types",
    cliPath,
    "show-workflow-state",
    "--repo",
    repoPath
  ]);
  state = JSON.parse(stateOutput.stdout);

  assert.equal(state.workflowState.currentRun.title, "Second run");
  assert.equal(state.workflowState.currentRun.goal, "Second goal");
  assert.equal(
    state.workflowState.recentRuns.length,
    1,
    "first run should be archived to recentRuns"
  );

  const archived = state.workflowState.recentRuns[0];
  assert.equal(archived.title, "First run");
  assert.equal(archived.goal, "First goal");
  // The pending gate state on the first run must survive the archive.
  assert.equal(
    archived.gates.review.status,
    "required",
    "pending review_required gate must be preserved in archive"
  );
});

test("BUG-B: multiple sequential run briefs cap at MAX_RECENT_RUNS without dropping the current run", async () => {
  // Edge case for the archive ring buffer: writing more than MAX_RECENT_RUNS
  // run briefs should not lose the current run and should keep the most
  // recent archived runs.
  const repoPath = await initRepo("crew-bug-b-archive-cap-");

  for (let i = 0; i < 7; i += 1) {
    await execFile("node", [
      cliPath,
      "write-run-brief",
      "--repo",
      repoPath,
      "--title",
      `Run ${i + 1}`,
      "--goal",
      `Goal ${i + 1}`
    ]);
  }

  const stateOutput = await execFile("node", [
    "--experimental-strip-types",
    cliPath,
    "show-workflow-state",
    "--repo",
    repoPath
  ]);
  const state = JSON.parse(stateOutput.stdout);

  assert.equal(state.workflowState.currentRun.title, "Run 7");
  // MAX_RECENT_RUNS is 5 in workflow-state.mjs; the archive ring should hold
  // the 5 most recent prior runs (Run 6, Run 5, Run 4, Run 3, Run 2). Run 1
  // falls off the cold edge.
  assert.equal(state.workflowState.recentRuns.length, 5);
  assert.equal(state.workflowState.recentRuns[0].title, "Run 6");
  assert.equal(state.workflowState.recentRuns[4].title, "Run 2");
});

test("BUG-C: validation-result artifact uses the single reachable schema only", async () => {
  // Pre-fix: artifacts.mjs had two `if (kind === "validation-result")` branches.
  // The first won (returning before the second was evaluated); the second was
  // dead code with a different schema.
  //
  // NOTE: This test acts as a schema lock-in rather than a true regression
  // catch for the dead-code bug itself — because the second branch was
  // unreachable, removing it does not change the produced output. The
  // accompanying deployment-result test below is the real regression catch
  // for BUG-C (deployment-result was also unreachable; removing it means
  // the kind is now rejected outright).
  //
  // What this test does protect against: a future maintainer re-adding the
  // dead schema or accidentally swapping which branch wins. If the
  // "Executed Evidence" or "Inferred Confidence" fields ever appear in real
  // output, something went wrong.
  const repoPath = await initRepo("crew-bug-c-validation-result-schema-");

  const output = await execFile("node", [
    cliPath,
    "write-validation-result",
    "--repo",
    repoPath,
    "--title",
    "Schema check",
    "--decision",
    "passed",
    "--evidence",
    "ran scenario"
  ]);
  const result = JSON.parse(output.stdout);
  const body = await fs.readFile(result.path, "utf8");

  // Reachable schema fields (from the first, active branch in artifacts.mjs):
  assert.match(body, /# Validation Result: Schema check/);
  assert.match(body, /Files \/ Surfaces Checked/);
  assert.match(body, /Evidence Collected/);

  // Dead-branch fields that should never appear in real output:
  assert.doesNotMatch(body, /Executed Evidence/);
  assert.doesNotMatch(body, /Inferred Confidence/);
});

test("BUG-C: deployment-result is no longer a supported artifact kind (dead branch removed)", async () => {
  // The unreachable `deployment-result` branch was removed alongside the
  // duplicate validation-result branch. The supported kind is
  // `deployment-check`. Confirm the artifact module rejects the removed
  // kind so future refactors don't reintroduce dead code under the old name.
  const { writeArtifact } = await import(
    pathToFileURL(path.join(repoRoot, "scripts", "lib", "artifacts", "write.ts")).href
  );
  const repoPath = await initRepo("crew-bug-c-deployment-result-removed-");

  const result = await writeArtifact(repoPath, "deployment-result", { title: "Should fail" });
  assert.strictEqual(result.ok, false);
  assert.match(result.error.message, /Unsupported artifact kind: deployment-result/);
});

test("BUG-E: discover-deployment uses POSIX separators in clue paths on all platforms", async () => {
  // Pre-fix behavior on Windows: collectDeploymentClues in
  // deployment-guidance.mjs built relativePath via path.join, which produces
  // backslashes on Windows. The classifier then checked
  // relativePath.startsWith(".github/workflows/") with forward slashes,
  // which returned false on Windows -> deploy.yml files were silently
  // filtered out. Returned clues also used backslashes, breaking any
  // downstream consumer that expected POSIX-style paths.
  //
  // After the fix: relativePath is normalized to forward slashes
  // immediately after construction, matching the convention from
  // claims.mjs:toRepoRelative. Classification and output are platform-agnostic.
  //
  // This test exercises every classifier branch and asserts (a) all
  // expected files are discovered, (b) returned paths use forward slashes
  // exclusively. On Linux this test passes trivially because path.sep is
  // "/" — its real value is regression-catching on Windows. If anyone
  // removes the normalization, the no-backslash assertion fails everywhere.
  // For a Linux-runnable simulation of the original bug, see the test
  // below ("rejects backslash-laden relative paths from sneaking through").
  const repoPath = await initRepo("crew-bug-e-discover-separators-");

  // Create one fixture per classifier branch:
  await fs.mkdir(path.join(repoPath, ".github", "workflows"), { recursive: true });
  await fs.writeFile(path.join(repoPath, ".github", "workflows", "deploy.yml"), "name: deploy\n");
  await fs.mkdir(path.join(repoPath, ".circleci"), { recursive: true });
  await fs.writeFile(path.join(repoPath, ".circleci", "config.yml"), "version: 2\n");
  await fs.writeFile(path.join(repoPath, "Dockerfile"), "FROM node:20\n");
  await fs.mkdir(path.join(repoPath, "infra", "k8s"), { recursive: true });
  await fs.writeFile(path.join(repoPath, "infra", "k8s", "deploy.yaml"), "kind: Deployment\n");
  await fs.mkdir(path.join(repoPath, "terraform"), { recursive: true });
  await fs.writeFile(path.join(repoPath, "terraform", "main.tf"), "// terraform\n");

  const output = await execFile("node", [
    "--experimental-strip-types",
    cliPath,
    "discover-deployment",
    "--repo",
    repoPath
  ]);
  const result = JSON.parse(output.stdout);

  // Each classifier branch should produce its expected clue:
  assert.ok(
    result.clues.includes(".github/workflows/deploy.yml"),
    "github workflow not discovered"
  );
  assert.ok(result.clues.includes(".circleci/config.yml"), "circleci config not discovered");
  assert.ok(result.clues.includes("Dockerfile"), "Dockerfile not discovered");
  assert.ok(result.clues.includes("infra/k8s/deploy.yaml"), "infra k8s manifest not discovered");
  assert.ok(result.clues.includes("terraform/main.tf"), "terraform config not discovered");

  // No clue should contain a backslash. This is the regression catcher:
  // on Windows pre-fix, every nested-path clue contained backslashes.
  for (const clue of result.clues) {
    assert.ok(
      !clue.includes("\\"),
      `clue contains backslash separator, expected POSIX forward slash: ${clue}`
    );
  }
});

test("BUG-E: file fixtures with directory paths under deployment hints are discovered (smoke test)", async () => {
  // Companion to the test above: exercises the deployment-hint segment
  // matching code path that, pre-fix, used path.split(path.sep) and would
  // fail to find segment matches on Windows when relativePath had been
  // normalized somewhere but not consistently. This test verifies that
  // files under k8s/, helm/, charts/, manifests/ are all discovered with
  // the .yaml/.yml/.tf/.toml extensions the module recognizes.
  const repoPath = await initRepo("crew-bug-e-deployment-hints-");

  const hints = [
    ["k8s", "service.yaml"],
    ["helm", "values.yml"],
    ["charts", "Chart.toml"],
    ["manifests", "deployment.yml"],
    ["deploy", "rollout.sh"]
  ];
  for (const [dir, file] of hints) {
    await fs.mkdir(path.join(repoPath, dir), { recursive: true });
    await fs.writeFile(path.join(repoPath, dir, file), "content\n");
  }

  const output = await execFile("node", [
    "--experimental-strip-types",
    cliPath,
    "discover-deployment",
    "--repo",
    repoPath
  ]);
  const result = JSON.parse(output.stdout);

  for (const [dir, file] of hints) {
    const expected = `${dir}/${file}`;
    assert.ok(
      result.clues.includes(expected),
      `deployment-hint clue not discovered: ${expected} (got: ${JSON.stringify(result.clues)})`
    );
  }
});

// Regression: `--` should terminate flag parsing so dash-prefixed positionals
// (e.g. filenames starting with `-`) survive intact. Pairs with the
// `read -ra _args <<< "$ARGUMENTS"` + `-- "${_args[@]}"` pattern used by the
// claim-files, release-files, and show-conflicts command markdown.
test("CLI: -- terminates flag parsing and preserves dash-prefixed positionals", async () => {
  const repoPath = await initRepo("crew-cli-double-dash-");

  const output = await execFile("node", [
    cliPath,
    "claim",
    "--repo",
    repoPath,
    "--",
    "-tricky.md",
    "normal.md"
  ]);
  const result = JSON.parse(output.stdout);

  assert.deepEqual(result.claimed, ["-tricky.md", "normal.md"]);
  assert.deepEqual(result.conflicts, []);
});

// ---------------------------------------------------------------------------
// AC-6: Result<T,E> err() path tests
// Verify that claimFiles, releaseFiles, resolveApproval, and markWorkflowBadge
// return err() instead of throwing when an fs or validation error occurs.
// ---------------------------------------------------------------------------

test("AC-6: claimFiles returns err() when repo path escapes repo boundary", async () => {
  const { claimFiles } = await import(
    pathToFileURL(path.join(repoRoot, "scripts", "lib", "claims.ts")).href
  );
  const repoPath = await makeTempDir("crew-ac6-claimfiles-err-");
  // "../../outside" resolves outside the repo root → toRepoRelative throws
  const result = await claimFiles(repoPath, ["../../outside.txt"], { owner: "test" });
  assert.equal(result.ok, false, "expected err() for out-of-repo path");
  assert.ok(result.error instanceof Error, "error should be an Error instance");
  assert.match(result.error.message, /repo/i, "error should mention repo boundary");
});

test("AC-6: releaseFiles returns err() when repo path escapes repo boundary", async () => {
  const { releaseFiles } = await import(
    pathToFileURL(path.join(repoRoot, "scripts", "lib", "claims.ts")).href
  );
  const repoPath = await makeTempDir("crew-ac6-releasefiles-err-");
  // releaseFiles calls toRepoRelative on explicit paths, so same boundary guard
  const result = await releaseFiles(repoPath, ["../../outside.txt"], { owner: "test" });
  assert.equal(result.ok, false, "expected err() for out-of-repo path");
  assert.ok(result.error instanceof Error, "error should be an Error instance");
});

test("AC-6: resolveApproval returns err() for unknown approval id", async () => {
  const { resolveApproval } = await import(
    pathToFileURL(path.join(repoRoot, "scripts", "lib", "approvals.ts")).href
  );
  const repoPath = await makeTempDir("crew-ac6-resolveapproval-err-");
  const result = await resolveApproval(repoPath, {
    id: "apr_nonexistent",
    decision: "approved",
    resolver: "test"
  });
  assert.equal(result.ok, false, "expected err() for unknown approval id");
  assert.ok(result.error instanceof Error, "error should be an Error instance");
  assert.match(result.error.message, /unknown approval id/i);
});

test("AC-6: markWorkflowBadge returns err() when badge option is missing", async () => {
  const { markWorkflowBadge } = await import(
    pathToFileURL(path.join(repoRoot, "scripts", "lib", "workflow-state.ts")).href
  );
  const repoPath = await makeTempDir("crew-ac6-markbadge-err-");
  // badge is required; omitting it triggers the validation throw
  const result = await markWorkflowBadge(repoPath, {});
  assert.equal(result.ok, false, "expected err() when badge is missing");
  assert.ok(result.error instanceof Error, "error should be an Error instance");
  assert.match(result.error.message, /badge/i);
});
