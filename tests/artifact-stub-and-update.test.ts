import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cliPath = path.join(repoRoot, "scripts", "crew.ts");

async function makeTempRepo(prefix: string) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  await execFile("node", ["--experimental-strip-types", cliPath, "init", "--repo", dir]);
  return dir;
}

async function cleanup(dir: string) {
  await fs.rm(dir, { recursive: true, force: true });
}

// Helper: invoke CLI synchronously and return { status, stdout, stderr }
function runCli(args: string[]) {
  const result = spawnSync(process.execPath, ["--experimental-strip-types", cliPath, ...args], {
    encoding: "utf8",
    timeout: 30_000
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

// Scenario 1: Status field renders when set
test("artifact status renders in output when --status is set", async () => {
  const repoPath = await makeTempRepo("artifact-status-render-");
  try {
    const { status, stdout } = runCli([
      "write-handoff",
      "--repo",
      repoPath,
      "--title",
      "Status test",
      "--status",
      "in-progress",
      "--summary",
      "test status field"
    ]);
    assert.equal(status, 0, "expected exit 0");
    const result = JSON.parse(stdout);
    const body = await fs.readFile(result.path, "utf8");
    assert.match(body, /Status: in-progress/, "artifact must contain 'Status: in-progress'");
  } finally {
    await cleanup(repoPath);
  }
});

// Scenario 2: Status field omitted when not set
test("artifact status omitted when --status is not set", async () => {
  const repoPath = await makeTempRepo("artifact-status-omit-");
  try {
    const { status, stdout } = runCli([
      "write-handoff",
      "--repo",
      repoPath,
      "--title",
      "No status",
      "--summary",
      "no status field"
    ]);
    assert.equal(status, 0, "expected exit 0");
    const result = JSON.parse(stdout);
    const body = await fs.readFile(result.path, "utf8");
    // Should not have "Status:" line (but may have other fields)
    const lines = body.split("\n");
    const statusLines = lines.filter((l) => l.startsWith("- Status:"));
    assert.equal(statusLines.length, 0, "artifact should not contain '- Status:' when not set");
  } finally {
    await cleanup(repoPath);
  }
});

// Scenario 3: --update flag writes to exact path and does not create second file
test("write-handoff with --update overwrites stub in place, no second file created", async () => {
  const repoPath = await makeTempRepo("artifact-update-handoff-");
  try {
    // First call: create stub with in-progress status
    const stubResult = runCli([
      "write-handoff",
      "--repo",
      repoPath,
      "--title",
      "Update test",
      "--status",
      "in-progress",
      "--summary",
      "initial stub"
    ]);
    assert.equal(stubResult.status, 0);
    const stubArtifact = JSON.parse(stubResult.stdout);
    const stubPath = stubArtifact.path;

    // Verify stub exists and contains in-progress
    let stubBody = await fs.readFile(stubPath, "utf8");
    assert.match(stubBody, /Status: in-progress/, "stub should contain 'Status: in-progress'");

    // List files before update
    const dirBefore = path.dirname(stubPath);
    const filesBefore = await fs.readdir(dirBefore);
    const handoffCountBefore = filesBefore.filter((f) => f.includes("handoff")).length;

    // Second call: finalize with --update to the same path
    const finalResult = runCli([
      "write-handoff",
      "--repo",
      repoPath,
      "--update",
      stubPath,
      "--title",
      "Update test",
      "--status",
      "completed",
      "--summary",
      "final artifact",
      "--deliverable",
      "completed work"
    ]);
    assert.equal(finalResult.status, 0);

    // List files after update
    const filesAfter = await fs.readdir(dirBefore);
    const handoffCountAfter = filesAfter.filter((f) => f.includes("handoff")).length;

    // Verify only ONE handoff file exists (no second file created)
    assert.equal(
      handoffCountAfter,
      handoffCountBefore,
      "should not create a second file; update should overwrite"
    );

    // Verify the file was updated with new content
    stubBody = await fs.readFile(stubPath, "utf8");
    assert.match(stubBody, /Status: completed/, "updated stub should contain 'Status: completed'");
    assert.match(stubBody, /final artifact/, "updated stub should contain 'final artifact'");
    assert.match(stubBody, /completed work/, "updated stub should contain 'completed work'");
  } finally {
    await cleanup(repoPath);
  }
});

// Scenario 4: write-review-result with --update
test("write-review-result with --update overwrites stub in place", async () => {
  const repoPath = await makeTempRepo("artifact-update-review-");
  try {
    // Create stub
    const stubResult = runCli([
      "write-review-result",
      "--repo",
      repoPath,
      "--title",
      "Review test",
      "--status",
      "in-progress",
      "--summary",
      "initial review"
    ]);
    assert.equal(stubResult.status, 0);
    const stubArtifact = JSON.parse(stubResult.stdout);
    const stubPath = stubArtifact.path;

    // Finalize with --update
    const finalResult = runCli([
      "write-review-result",
      "--repo",
      repoPath,
      "--update",
      stubPath,
      "--title",
      "Review test",
      "--status",
      "completed",
      "--decision",
      "approved",
      "--summary",
      "final review",
      "--test-summary",
      "all pass"
    ]);
    assert.equal(finalResult.status, 0);

    // Verify content
    const body = await fs.readFile(stubPath, "utf8");
    assert.match(body, /Status: completed/, "should have updated status");
    assert.match(body, /final review/, "should have updated summary");
    assert.match(body, /Decision: approved/, "should have decision");
  } finally {
    await cleanup(repoPath);
  }
});

// Scenario 5: write-validation-result with --update
test("write-validation-result with --update overwrites stub in place", async () => {
  const repoPath = await makeTempRepo("artifact-update-validation-");
  try {
    // Create stub
    const stubResult = runCli([
      "write-validation-result",
      "--repo",
      repoPath,
      "--title",
      "Validation test",
      "--status",
      "in-progress",
      "--summary",
      "initial validation"
    ]);
    assert.equal(stubResult.status, 0);
    const stubArtifact = JSON.parse(stubResult.stdout);
    const stubPath = stubArtifact.path;

    // Finalize with --update
    const finalResult = runCli([
      "write-validation-result",
      "--repo",
      repoPath,
      "--update",
      stubPath,
      "--title",
      "Validation test",
      "--status",
      "completed",
      "--decision",
      "passed_with_notes",
      "--summary",
      "final validation",
      "--environment",
      "prod"
    ]);
    assert.equal(finalResult.status, 0);

    // Verify content
    const body = await fs.readFile(stubPath, "utf8");
    assert.match(body, /Status: completed/, "should have updated status");
    assert.match(body, /final validation/, "should have updated summary");
    assert.match(body, /Decision: passed_with_notes/, "should have decision");
  } finally {
    await cleanup(repoPath);
  }
});

// Scenario 6: Backward compatibility - existing behavior unchanged without --update
test("artifact write without --update creates new timestamped file (backward compat)", async () => {
  const repoPath = await makeTempRepo("artifact-backward-compat-");
  try {
    // First call
    const result1 = runCli([
      "write-handoff",
      "--repo",
      repoPath,
      "--title",
      "First call",
      "--summary",
      "first"
    ]);
    const artifact1 = JSON.parse(result1.stdout);

    // Second call without --update
    const result2 = runCli([
      "write-handoff",
      "--repo",
      repoPath,
      "--title",
      "Second call",
      "--summary",
      "second"
    ]);
    const artifact2 = JSON.parse(result2.stdout);

    // Verify two different files exist
    assert.notEqual(
      artifact1.path,
      artifact2.path,
      "should create two separate files without --update"
    );
    const exists1 = await fs.stat(artifact1.path);
    const exists2 = await fs.stat(artifact2.path);
    assert.ok(exists1, "first artifact should exist");
    assert.ok(exists2, "second artifact should exist");
  } finally {
    await cleanup(repoPath);
  }
});
