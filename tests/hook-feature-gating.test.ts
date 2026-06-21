// tests/hook-feature-gating.test.ts
// Test suite for feature-flag gating in hooks
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const CHECK_REDUNDANT_READ_PATH = path.join(__dirname, "..", "hooks", "check-redundant-read.ts");
const CHECK_SUBAGENT_RETURN_PATH = path.join(__dirname, "..", "hooks", "check-subagent-return.ts");
const PREFLIGHT_SHELL_PATH = path.join(__dirname, "..", "hooks", "preflight-shell.ts");

async function makeRepo() {
  return await fs.mkdtemp(path.join(os.tmpdir(), "hook-gating-test-"));
}

async function cleanup(dir: string) {
  await fs.rm(dir, { recursive: true, force: true });
}

function runHook(
  hookPath: string,
  stdin: string,
  env: Record<string, string> = {}
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn("node", ["--experimental-strip-types", hookPath], {
      env: { ...process.env, ...env }
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (b) => (stdout += b.toString("utf8")));
    proc.stderr.on("data", (b) => (stderr += b.toString("utf8")));
    proc.on("close", (exitCode) => resolve({ exitCode: exitCode ?? -1, stdout, stderr }));
    proc.stdin.end(stdin);
  });
}

// ──────────────────────────────────────────────────────────────────────────
// check-redundant-read.ts feature gating
// ──────────────────────────────────────────────────────────────────────────

test("check-redundant-read: feature disabled in crew.json → no warn/no state", async () => {
  const repo = await makeRepo();
  try {
    const file = path.join(repo, "test.txt");
    await fs.writeFile(file, "content", "utf8");

    // Create crew.json with feature disabled
    const crewDir = path.join(repo, ".claude");
    await fs.mkdir(crewDir, { recursive: true });
    await fs.writeFile(
      path.join(crewDir, "crew.json"),
      JSON.stringify({
        features: {
          "redundant-read-stop": { enabled: false }
        }
      }),
      "utf8"
    );

    const result = await runHook(
      CHECK_REDUNDANT_READ_PATH,
      JSON.stringify({
        session_id: "test_disabled",
        tool_name: "Read",
        tool_input: { file_path: file },
        cwd: repo
      })
    );

    assert.equal(result.exitCode, 0);
    // No stdout output when feature is disabled
    assert.equal(result.stdout, "");
    // State should NOT be created
    const stateFile = path.join(repo, ".claude", "state", "cost-hygiene", "test_disabled.json");
    try {
      await fs.stat(stateFile);
      assert.fail("State file should not exist when feature is disabled");
    } catch (err) {
      // Expected: file does not exist
    }
  } finally {
    await cleanup(repo);
  }
});

test("check-redundant-read: feature enabled (default or explicit) → fires normally", async () => {
  const repo = await makeRepo();
  try {
    const file = path.join(repo, "test.txt");
    await fs.writeFile(file, "content", "utf8");

    // Create crew.json with feature enabled
    const crewDir = path.join(repo, ".claude");
    await fs.mkdir(crewDir, { recursive: true });
    await fs.writeFile(
      path.join(crewDir, "crew.json"),
      JSON.stringify({
        features: {
          "redundant-read-stop": { enabled: true }
        }
      }),
      "utf8"
    );

    const result = await runHook(
      CHECK_REDUNDANT_READ_PATH,
      JSON.stringify({
        session_id: "test_enabled",
        tool_name: "Read",
        tool_input: { file_path: file },
        cwd: repo
      })
    );

    assert.equal(result.exitCode, 0);
    // State should be created when feature is enabled
    const stateFile = path.join(repo, ".claude", "state", "cost-hygiene", "test_enabled.json");
    const raw = await fs.readFile(stateFile, "utf8");
    const state = JSON.parse(raw);
    assert.equal(state.entries[file].read_count, 1);
  } finally {
    await cleanup(repo);
  }
});

test("check-redundant-read: missing crew.json → feature defaults to enabled", async () => {
  const repo = await makeRepo();
  try {
    const file = path.join(repo, "test.txt");
    await fs.writeFile(file, "content", "utf8");

    // No crew.json — feature should default to enabled
    const result = await runHook(
      CHECK_REDUNDANT_READ_PATH,
      JSON.stringify({
        session_id: "test_default",
        tool_name: "Read",
        tool_input: { file_path: file },
        cwd: repo
      })
    );

    assert.equal(result.exitCode, 0);
    // State should be created (feature defaults to enabled)
    const stateFile = path.join(repo, ".claude", "state", "cost-hygiene", "test_default.json");
    const raw = await fs.readFile(stateFile, "utf8");
    const state = JSON.parse(raw);
    assert.equal(state.entries[file].read_count, 1);
  } finally {
    await cleanup(repo);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// check-subagent-return.ts feature gating
// ──────────────────────────────────────────────────────────────────────────

test("check-subagent-return: feature disabled in crew.json → no warn output", async () => {
  const repo = await makeRepo();
  try {
    // Create crew.json with feature disabled
    const crewDir = path.join(repo, ".claude");
    await fs.mkdir(crewDir, { recursive: true });
    await fs.writeFile(
      path.join(crewDir, "crew.json"),
      JSON.stringify({
        features: {
          "subagent-inline-warn": { enabled: false }
        }
      }),
      "utf8"
    );

    // Large body that would normally trigger a warning
    const largeBody = "x".repeat(10000) + " no artifact path";

    const result = await runHook(
      CHECK_SUBAGENT_RETURN_PATH,
      JSON.stringify({
        session_id: "test_disabled",
        tool_name: "Agent",
        tool_response: largeBody,
        cwd: repo
      })
    );

    assert.equal(result.exitCode, 0);
    // No stdout output when feature is disabled
    assert.equal(result.stdout, "");
  } finally {
    await cleanup(repo);
  }
});

test("check-subagent-return: feature enabled → warns on large inline return", async () => {
  const repo = await makeRepo();
  try {
    // Create crew.json with feature enabled
    const crewDir = path.join(repo, ".claude");
    await fs.mkdir(crewDir, { recursive: true });
    await fs.writeFile(
      path.join(crewDir, "crew.json"),
      JSON.stringify({
        features: {
          "subagent-inline-warn": { enabled: true }
        }
      }),
      "utf8"
    );

    // Large body without artifact path should trigger warning
    const largeBody = "x".repeat(10000) + " no artifact path";

    const result = await runHook(
      CHECK_SUBAGENT_RETURN_PATH,
      JSON.stringify({
        session_id: "test_enabled",
        tool_name: "Agent",
        tool_response: largeBody,
        cwd: repo
      })
    );

    assert.equal(result.exitCode, 0);
    // Should emit warning when feature is enabled
    assert.notEqual(result.stdout, "");
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.decision, "approve");
    assert.match(parsed.systemMessage, /inline|subagent/i);
  } finally {
    await cleanup(repo);
  }
});

test("check-subagent-return: missing crew.json → feature defaults to enabled", async () => {
  const repo = await makeRepo();
  try {
    // Large body without artifact path
    const largeBody = "x".repeat(10000) + " no artifact path";

    const result = await runHook(
      CHECK_SUBAGENT_RETURN_PATH,
      JSON.stringify({
        session_id: "test_default",
        tool_name: "Agent",
        tool_response: largeBody,
        cwd: repo
      })
    );

    assert.equal(result.exitCode, 0);
    // Should emit warning (feature defaults to enabled)
    assert.notEqual(result.stdout, "");
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.decision, "approve");
  } finally {
    await cleanup(repo);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// preflight-shell.ts feature gating
// ──────────────────────────────────────────────────────────────────────────

test("preflight-shell: feature disabled in crew.json → no preflight output", async () => {
  const repo = await makeRepo();
  try {
    // Create crew.json with feature disabled
    const crewDir = path.join(repo, ".claude");
    await fs.mkdir(crewDir, { recursive: true });
    await fs.writeFile(
      path.join(crewDir, "crew.json"),
      JSON.stringify({
        features: {
          "shell-preflight": { enabled: false }
        }
      }),
      "utf8"
    );

    // Command that would normally trigger a warning
    const result = await runHook(
      PREFLIGHT_SHELL_PATH,
      JSON.stringify({
        session_id: "test_disabled",
        tool_name: "Bash",
        tool_input: { command: "echo $env:HOME" },
        cwd: repo
      })
    );

    assert.equal(result.exitCode, 0);
    // No stdout output when feature is disabled
    assert.equal(result.stdout, "");
  } finally {
    await cleanup(repo);
  }
});

test("preflight-shell: feature enabled → runs preflight checks", async () => {
  const repo = await makeRepo();
  try {
    // Create crew.json with feature enabled
    const crewDir = path.join(repo, ".claude");
    await fs.mkdir(crewDir, { recursive: true });
    await fs.writeFile(
      path.join(crewDir, "crew.json"),
      JSON.stringify({
        features: {
          "shell-preflight": { enabled: true }
        }
      }),
      "utf8"
    );

    // Command with $env: in Bash (should warn)
    const result = await runHook(
      PREFLIGHT_SHELL_PATH,
      JSON.stringify({
        session_id: "test_enabled",
        tool_name: "Bash",
        tool_input: { command: "echo $env:HOME" },
        cwd: repo
      })
    );

    assert.equal(result.exitCode, 0);
    // Should emit warning when feature is enabled
    assert.notEqual(result.stdout, "");
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.decision, "approve");
    assert.match(parsed.systemMessage, /\$env:/);
  } finally {
    await cleanup(repo);
  }
});

test("preflight-shell: missing crew.json → feature defaults to enabled", async () => {
  const repo = await makeRepo();
  try {
    // No crew.json — feature should default to enabled

    // Command with $env: in Bash (should warn)
    const result = await runHook(
      PREFLIGHT_SHELL_PATH,
      JSON.stringify({
        session_id: "test_default",
        tool_name: "Bash",
        tool_input: { command: "echo $env:HOME" },
        cwd: repo
      })
    );

    assert.equal(result.exitCode, 0);
    // Should emit warning (feature defaults to enabled)
    assert.notEqual(result.stdout, "");
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.decision, "approve");
  } finally {
    await cleanup(repo);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// cost-hygiene umbrella feature (replaces former CREW_COST_HYGIENE env var)
// ──────────────────────────────────────────────────────────────────────────

test("check-redundant-read: cost-hygiene feature disabled → no warn/no state (umbrella)", async () => {
  const repo = await makeRepo();
  try {
    const file = path.join(repo, "test.txt");
    await fs.writeFile(file, "content", "utf8");

    // Umbrella disable: cost-hygiene off, redundant-read-stop on. Umbrella wins.
    const crewDir = path.join(repo, ".claude");
    await fs.mkdir(crewDir, { recursive: true });
    await fs.writeFile(
      path.join(crewDir, "crew.json"),
      JSON.stringify({
        features: {
          "cost-hygiene": { enabled: false },
          "redundant-read-stop": { enabled: true }
        }
      }),
      "utf8"
    );

    const result = await runHook(
      CHECK_REDUNDANT_READ_PATH,
      JSON.stringify({
        session_id: "test_umbrella_off",
        tool_name: "Read",
        tool_input: { file_path: file },
        cwd: repo
      })
    );

    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, "");
    const stateFile = path.join(repo, ".claude", "state", "cost-hygiene", "test_umbrella_off.json");
    try {
      await fs.stat(stateFile);
      assert.fail("State file should not exist when cost-hygiene feature is disabled");
    } catch (err) {
      // Expected: file does not exist
    }
  } finally {
    await cleanup(repo);
  }
});
