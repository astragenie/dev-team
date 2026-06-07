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
const cliPath = path.join(repoRoot, "scripts", "crew.mjs");

async function makeTempRepo(prefix) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  await execFile("node", [cliPath, "init", "--repo", dir]);
  return dir;
}

async function cleanup(dir) {
  await fs.rm(dir, { recursive: true, force: true });
}

// Helper: invoke CLI synchronously and return { status, stdout, stderr }
function runCli(args) {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    encoding: "utf8",
    timeout: 30_000
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

// Scenario 1: approved + no test-summary flags → exit 2 with meaningful stderr
test("write-review-result: approved code-bearing review without test flags exits 2 and reports refusal", async () => {
  const repoPath = await makeTempRepo("crew-wrr-gate-refuse-");
  try {
    const { status, stderr } = runCli([
      "write-review-result",
      "--repo",
      repoPath,
      "--title",
      "Gate test",
      "--decision",
      "approved",
      "--summary",
      "looks good"
    ]);
    assert.equal(status, 2, "expected exit code 2 when approved + no test flags");
    assert.match(stderr, /refused/, "stderr must mention 'refused'");
    assert.match(stderr, /--test-summary/, "stderr must mention '--test-summary'");
  } finally {
    await cleanup(repoPath);
  }
});

// Scenario 2: approved + --non-code → exit 0, artifact contains Non-Code Review: yes
test("write-review-result: approved + --non-code exits 0 and writes Non-Code Review: yes", async () => {
  const repoPath = await makeTempRepo("crew-wrr-noncode-");
  try {
    const { status, stdout } = runCli([
      "write-review-result",
      "--repo",
      repoPath,
      "--title",
      "Non-code review",
      "--decision",
      "approved",
      "--summary",
      "doc change only",
      "--non-code"
    ]);
    assert.equal(status, 0, "expected exit 0 with --non-code");
    const result = JSON.parse(stdout);
    const body = await fs.readFile(result.path, "utf8");
    assert.match(body, /Non-Code Review: yes/, "artifact must contain 'Non-Code Review: yes'");
  } finally {
    await cleanup(repoPath);
  }
});

// Scenario 3: approved + --test-summary → exit 0, artifact contains Test Adequacy: <value>
test("write-review-result: approved + --test-summary exits 0 and writes Test Adequacy field", async () => {
  const repoPath = await makeTempRepo("crew-wrr-test-summary-");
  try {
    const summaryText = "covered by N tests";
    const { status, stdout } = runCli([
      "write-review-result",
      "--repo",
      repoPath,
      "--title",
      "Summary test review",
      "--decision",
      "approved",
      "--summary",
      "all good",
      "--test-summary",
      summaryText
    ]);
    assert.equal(status, 0, "expected exit 0 with --test-summary");
    const result = JSON.parse(stdout);
    const body = await fs.readFile(result.path, "utf8");
    assert.match(
      body,
      /Test Adequacy: covered by N tests/,
      "artifact must contain Test Adequacy field"
    );
  } finally {
    await cleanup(repoPath);
  }
});

// Scenario 4: rejected + no flags → exit 0 (gate bypassed for rejections)
test("write-review-result: rejected decision bypasses the test-adequacy gate", async () => {
  const repoPath = await makeTempRepo("crew-wrr-rejected-");
  try {
    const { status, stdout } = runCli([
      "write-review-result",
      "--repo",
      repoPath,
      "--title",
      "Rejected review",
      "--decision",
      "rejected",
      "--summary",
      "missing null guard"
    ]);
    assert.equal(status, 0, "expected exit 0 for rejected decision");
    const result = JSON.parse(stdout);
    assert.ok(result.path, "artifact path must be present");
  } finally {
    await cleanup(repoPath);
  }
});

// Scenario 5: approved_with_notes + no flags → exit 2 (gate also fires on approved_with_notes branch)
test("write-review-result: approved_with_notes without test flags also exits 2", async () => {
  const repoPath = await makeTempRepo("crew-wrr-approved-with-notes-");
  try {
    const { status, stderr } = runCli([
      "write-review-result",
      "--repo",
      repoPath,
      "--title",
      "Notes gate test",
      "--decision",
      "approved_with_notes",
      "--summary",
      "minor nits"
    ]);
    assert.equal(status, 2, "expected exit 2 for approved_with_notes without test flags");
    assert.match(stderr, /refused/, "stderr must mention 'refused'");
  } finally {
    await cleanup(repoPath);
  }
});

// Scenario 7: unknown decision → exit 2
test("write-review-result: unknown decision exits 2", async () => {
  const repoPath = await makeTempRepo("crew-wrr-unknown-decision-");
  try {
    const { status, stderr } = runCli([
      "write-review-result",
      "--repo",
      repoPath,
      "--title",
      "Unknown decision",
      "--decision",
      "lgtm",
      "--summary",
      "looks good to me",
      "--test-summary",
      "n/a"
    ]);
    assert.equal(status, 2, "expected exit 2 for unknown decision");
    assert.match(stderr, /unknown.*decision/i, "stderr must mention unknown decision");
    assert.match(stderr, /approved/, "stderr must list valid decisions");
  } finally {
    await cleanup(repoPath);
  }
});

// Scenario 6: approved + --test-summary-skip-reason → exit 0, artifact contains Test Adequacy Skip Reason
test("write-review-result: approved + --test-summary-skip-reason exits 0 and writes skip reason", async () => {
  const repoPath = await makeTempRepo("crew-wrr-skip-reason-");
  try {
    const { status, stdout } = runCli([
      "write-review-result",
      "--repo",
      repoPath,
      "--title",
      "Skip reason review",
      "--decision",
      "approved",
      "--summary",
      "doc-only",
      "--test-summary-skip-reason",
      "doc-only refactor"
    ]);
    assert.equal(status, 0, "expected exit 0 with --test-summary-skip-reason");
    const result = JSON.parse(stdout);
    const body = await fs.readFile(result.path, "utf8");
    assert.match(
      body,
      /Test Adequacy Skip Reason: doc-only refactor/,
      "artifact must contain 'Test Adequacy Skip Reason: doc-only refactor'"
    );
  } finally {
    await cleanup(repoPath);
  }
});

// Scenario 7: --findings flag persisted in artifact frontmatter
test("write-review-result: --findings persisted in artifact frontmatter", async () => {
  const repoPath = await makeTempRepo("crew-wrr-findings-");
  try {
    const { status, stdout } = runCli([
      "write-review-result",
      "--repo",
      repoPath,
      "--title",
      "Findings review",
      "--decision",
      "approved",
      "--summary",
      "looks good",
      "--test-summary",
      "all pass",
      "--findings",
      "🔴:1,🟡:2,❓:0"
    ]);
    assert.equal(status, 0, "expected exit 0 with --findings");
    const result = JSON.parse(stdout);
    const body = await fs.readFile(result.path, "utf8");
    assert.match(body, /findings:.*🔴:1,🟡:2,❓:0/, "artifact must contain findings frontmatter");
  } finally {
    await cleanup(repoPath);
  }
});
