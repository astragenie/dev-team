import fs from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";
import { runCrew } from "../scripts/crew.ts";
import { makeTempDir } from "./helpers/cli-fixtures.ts";
import { loadWorkflowState } from "../scripts/lib/workflow-state.ts";

test("concurrent markWorkflowBadge calls merge correctly (no lost updates)", async () => {
  const repoPath = await makeTempDir("workflow-state-concurrent-");
  try {
    // Start a run
    await runCrew(["write-run-brief", "--repo", repoPath, "--title", "Concurrent test run"]);

    // Fire two concurrent badge writes (reviewer + validator)
    const [result1, result2] = await Promise.all([
      runCrew([
        "mark-badge",
        "--repo",
        repoPath,
        "--badge",
        "review_passed",
        "--note",
        "review OK"
      ]),
      runCrew([
        "mark-badge",
        "--repo",
        repoPath,
        "--badge",
        "validation_passed",
        "--note",
        "validation OK"
      ])
    ]);

    assert.equal(result1.code, 0, "first badge mark should succeed");
    assert.equal(result2.code, 0, "second badge mark should succeed");

    // Verify both gates are set in final state
    const final = await loadWorkflowState(repoPath);
    assert.equal(final.currentRun?.gates.review?.status, "passed", "review gate should be passed");
    assert.equal(
      final.currentRun?.gates.validation?.status,
      "passed",
      "validation gate should be passed"
    );
    assert.equal(
      final.currentRun?.gates.review?.note,
      "review OK",
      "review note should be persisted"
    );
    assert.equal(
      final.currentRun?.gates.validation?.note,
      "validation OK",
      "validation note should be persisted"
    );
  } finally {
    await fs.rm(repoPath, { recursive: true, force: true });
  }
});

test("validation_stale badge sets validation gate to stale status", async () => {
  const repoPath = await makeTempDir("workflow-state-validation-stale-");
  try {
    // Start a run
    await runCrew(["write-run-brief", "--repo", repoPath, "--title", "Validation stale test"]);

    // Mark validation as passed first
    const passResult = await runCrew([
      "mark-badge",
      "--repo",
      repoPath,
      "--badge",
      "validation_passed",
      "--note",
      "initial validation passed"
    ]);
    assert.equal(passResult.code, 0);

    // Load state to verify
    let state = await loadWorkflowState(repoPath);
    assert.equal(state.currentRun?.gates.validation?.status, "passed");

    // Now mark as stale
    const staleResult = await runCrew([
      "mark-badge",
      "--repo",
      repoPath,
      "--badge",
      "validation_stale",
      "--note",
      "invalidated by review needs_fix"
    ]);
    assert.equal(staleResult.code, 0, "validation_stale badge should succeed");

    // Verify state
    state = await loadWorkflowState(repoPath);
    assert.equal(
      state.currentRun?.gates.validation?.status,
      "stale",
      "validation gate should be stale"
    );
    assert.equal(
      state.currentRun?.gates.validation?.note,
      "invalidated by review needs_fix",
      "stale note should be persisted"
    );
  } finally {
    await fs.rm(repoPath, { recursive: true, force: true });
  }
});
