import { test, expect } from "bun:test";
import fs from "node:fs/promises";
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

    expect(result1.code, "first badge mark should succeed").toBe(0);
    expect(result2.code, "second badge mark should succeed").toBe(0);

    // Verify both gates are set in final state
    const final = await loadWorkflowState(repoPath);
    expect(final.currentRun?.gates.review?.status, "review gate should be passed").toBe("passed");
    expect(final.currentRun?.gates.validation?.status, "validation gate should be passed").toBe(
      "passed"
    );
    expect(final.currentRun?.gates.review?.note, "review note should be persisted").toBe(
      "review OK"
    );
    expect(final.currentRun?.gates.validation?.note, "validation note should be persisted").toBe(
      "validation OK"
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
    expect(passResult.code).toBe(0);

    // Load state to verify
    let state = await loadWorkflowState(repoPath);
    expect(state.currentRun?.gates.validation?.status).toBe("passed");

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
    expect(staleResult.code, "validation_stale badge should succeed").toBe(0);

    // Verify state
    state = await loadWorkflowState(repoPath);
    expect(state.currentRun?.gates.validation?.status, "validation gate should be stale").toBe(
      "stale"
    );
    expect(state.currentRun?.gates.validation?.note, "stale note should be persisted").toBe(
      "invalidated by review needs_fix"
    );
  } finally {
    await fs.rm(repoPath, { recursive: true, force: true });
  }
});
