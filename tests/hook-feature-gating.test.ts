// tests/hook-feature-gating.test.ts
// Test suite for feature-flag gating in hooks
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const CHECK_REDUNDANT_READ_PATH = path.join(__dirname, "..", "hooks", "check-redundant-read.ts");
const CHECK_SUBAGENT_RETURN_PATH = path.join(__dirname, "..", "hooks", "check-subagent-return.ts");
const PREFLIGHT_SHELL_PATH = path.join(__dirname, "..", "hooks", "preflight-shell.ts");
const PRE_PUSH_VERIFIER_PATH = path.join(__dirname, "..", "hooks", "pre-push-verifier.ts");
const CHECK_TASK_UPDATE_BURST_PATH = path.join(
  __dirname,
  "..",
  "hooks",
  "check-task-update-burst.ts"
);
const PRE_TOOL_USE_BASH_GATE_PATH = path.join(
  __dirname,
  "..",
  "hooks",
  "pre-tool-use-bash-gate.ts"
);
const POST_TOOL_USE_BASH_GATE_PATH = path.join(
  __dirname,
  "..",
  "hooks",
  "post-tool-use-bash-gate.ts"
);
const OTEL_POST_TOOL_USE_PATH = path.join(__dirname, "..", "hooks", "otel-post-tool-use.ts");

async function makeRepo() {
  return await fs.mkdtemp(path.join(os.tmpdir(), "hook-gating-test-"));
}

async function cleanup(dir: string) {
  await fs.rm(dir, { recursive: true, force: true });
}

// pre-push-verifier.ts shells out to `git rev-parse --show-toplevel` to
// resolve the repo root (issue #164 worktree fix). A plain mkdtemp dir isn't
// a git repo, so that call falls through to whatever git repo happens to
// enclose the OS tmpdir (e.g. a dotfiles repo in $HOME) instead of failing
// cleanly — `git init` makes the fixture self-contained so resolution lands
// on the fixture itself, matching how a real repo/worktree behaves.
async function makeGitRepo() {
  const dir = await makeRepo();
  spawnSync("git", ["init", "--quiet", dir], { encoding: "utf8", windowsHide: true });
  return dir;
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

// ──────────────────────────────────────────────────────────────────────────
// pre-push-verifier.ts feature gating
// ──────────────────────────────────────────────────────────────────────────

test("pre-push-verifier: feature disabled (default, no crew.json) → push allowed", async () => {
  const repo = await makeGitRepo();
  try {
    const payload = JSON.stringify({
      session_id: "test_push_disabled",
      tool_name: "Bash",
      tool_input: { command: "git push origin main" },
      cwd: repo
    });
    const result = await runHook(PRE_PUSH_VERIFIER_PATH, payload);
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, "");
  } finally {
    await cleanup(repo);
  }
});

test("pre-push-verifier: feature disabled explicitly in crew.json → push allowed", async () => {
  const repo = await makeGitRepo();
  try {
    const crewDir = path.join(repo, ".claude");
    await fs.mkdir(crewDir, { recursive: true });
    await fs.writeFile(
      path.join(crewDir, "crew.json"),
      JSON.stringify({ features: { "push-verify": { enabled: false } } }),
      "utf8"
    );
    const payload = JSON.stringify({
      session_id: "test_push_explicit_off",
      tool_name: "Bash",
      tool_input: { command: "git push origin main" },
      cwd: repo
    });
    const result = await runHook(PRE_PUSH_VERIFIER_PATH, payload);
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, "");
  } finally {
    await cleanup(repo);
  }
});

test("pre-push-verifier: feature enabled + no PASS artifact → push blocked", async () => {
  const repo = await makeGitRepo();
  try {
    const crewDir = path.join(repo, ".claude");
    await fs.mkdir(crewDir, { recursive: true });
    await fs.writeFile(
      path.join(crewDir, "crew.json"),
      JSON.stringify({ features: { "push-verify": { enabled: true } } }),
      "utf8"
    );
    const payload = JSON.stringify({
      session_id: "test_push_enabled_no_artifact",
      tool_name: "Bash",
      tool_input: { command: "git push origin main" },
      cwd: repo
    });
    const result = await runHook(PRE_PUSH_VERIFIER_PATH, payload);
    assert.equal(result.exitCode, 0);
    assert.notEqual(result.stdout, "");
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.decision, "block");
  } finally {
    await cleanup(repo);
  }
});

test("pre-push-verifier: feature enabled + PASS artifact within 1h → push allowed", async () => {
  const repo = await makeGitRepo();
  try {
    const crewDir = path.join(repo, ".claude");
    await fs.mkdir(crewDir, { recursive: true });
    await fs.writeFile(
      path.join(crewDir, "crew.json"),
      JSON.stringify({ features: { "push-verify": { enabled: true } } }),
      "utf8"
    );
    const validationsDir = path.join(crewDir, "artifacts", "crew", "validations");
    await fs.mkdir(validationsDir, { recursive: true });
    await fs.writeFile(
      path.join(validationsDir, "20991231T235959Z-pass.md"),
      "# Validation\n\nDecision: passed\n",
      "utf8"
    );
    const payload = JSON.stringify({
      session_id: "test_push_enabled_pass",
      tool_name: "Bash",
      tool_input: { command: "git push origin main" },
      cwd: repo
    });
    const result = await runHook(PRE_PUSH_VERIFIER_PATH, payload);
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, "");
  } finally {
    await cleanup(repo);
  }
});

test("pre-push-verifier: feature enabled + deployment.md push.verify:false → push allowed", async () => {
  const repo = await makeGitRepo();
  try {
    const crewDir = path.join(repo, ".claude");
    await fs.mkdir(crewDir, { recursive: true });
    await fs.writeFile(
      path.join(crewDir, "crew.json"),
      JSON.stringify({ features: { "push-verify": { enabled: true } } }),
      "utf8"
    );
    const crewMdDir = path.join(crewDir, "crew");
    await fs.mkdir(crewMdDir, { recursive: true });
    await fs.writeFile(
      path.join(crewMdDir, "deployment.md"),
      "## Settings\n\n- `push.verify: false` — repo opted out\n",
      "utf8"
    );
    const payload = JSON.stringify({
      session_id: "test_push_deployment_opt_out",
      tool_name: "Bash",
      tool_input: { command: "git push origin main" },
      cwd: repo
    });
    const result = await runHook(PRE_PUSH_VERIFIER_PATH, payload);
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, "");
  } finally {
    await cleanup(repo);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Issue #164 regressions: worktree-aware cwd resolution + not-found message
// ──────────────────────────────────────────────────────────────────────────

test("pre-push-verifier: cd-prefixed command resolves the worktree's own PASS artifact, not the session cwd", async () => {
  const sessionCwd = await makeGitRepo();
  const worktree = await makeGitRepo();
  try {
    // The worktree carries its own crew.json + fresh PASS artifact. The
    // session cwd (main checkout) has neither — proves the scan follows the
    // `cd` target, not the PreToolUse `cwd` field.
    const worktreeCrewDir = path.join(worktree, ".claude");
    await fs.mkdir(worktreeCrewDir, { recursive: true });
    await fs.writeFile(
      path.join(worktreeCrewDir, "crew.json"),
      JSON.stringify({ features: { "push-verify": { enabled: true } } }),
      "utf8"
    );
    const worktreeValidationsDir = path.join(worktreeCrewDir, "artifacts", "crew", "validations");
    await fs.mkdir(worktreeValidationsDir, { recursive: true });
    await fs.writeFile(
      path.join(worktreeValidationsDir, "20991231T235959Z-pass.md"),
      "# Validation\n\nDecision: passed\n",
      "utf8"
    );

    const payload = JSON.stringify({
      session_id: "test_push_worktree_pass",
      tool_name: "Bash",
      tool_input: { command: `cd "${worktree}" && git push origin main` },
      cwd: sessionCwd
    });
    const result = await runHook(PRE_PUSH_VERIFIER_PATH, payload);
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, "");
  } finally {
    await cleanup(sessionCwd);
    await cleanup(worktree);
  }
});

test("pre-push-verifier: cd-prefixed command does not leak a PASS artifact from the session cwd's main checkout", async () => {
  const sessionCwd = await makeGitRepo();
  const worktree = await makeGitRepo();
  try {
    // crew.json lives in the worktree (the repo actually being pushed).
    const worktreeCrewDir = path.join(worktree, ".claude");
    await fs.mkdir(worktreeCrewDir, { recursive: true });
    await fs.writeFile(
      path.join(worktreeCrewDir, "crew.json"),
      JSON.stringify({ features: { "push-verify": { enabled: true } } }),
      "utf8"
    );

    // The main checkout (session cwd) has a foreign PASS artifact that must
    // NOT green-light a push from the worktree — the pre-fix bug scanned
    // this dir instead of the worktree's own.
    const sessionValidationsDir = path.join(
      sessionCwd,
      ".claude",
      "artifacts",
      "crew",
      "validations"
    );
    await fs.mkdir(sessionValidationsDir, { recursive: true });
    await fs.writeFile(
      path.join(sessionValidationsDir, "20991231T235959Z-pass.md"),
      "# Validation\n\nDecision: passed\n",
      "utf8"
    );

    const payload = JSON.stringify({
      session_id: "test_push_worktree_no_leak",
      tool_name: "Bash",
      tool_input: { command: `cd "${worktree}" && git push origin main` },
      cwd: sessionCwd
    });
    const result = await runHook(PRE_PUSH_VERIFIER_PATH, payload);
    assert.equal(result.exitCode, 0);
    assert.notEqual(result.stdout, "");
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.decision, "block");
    // Defect #3: the message must report the dir actually scanned (the
    // worktree's own validations dir), proving defect #1 is fixed too.
    const expectedScannedDir = path.join(worktree, ".claude", "artifacts", "crew", "validations");
    assert.ok(
      parsed.reason.includes(expectedScannedDir),
      `expected block reason to reference ${expectedScannedDir}, got: ${parsed.reason}`
    );
  } finally {
    await cleanup(sessionCwd);
    await cleanup(worktree);
  }
});

test("pre-push-verifier: not-found message reports scanned dir, window count, and newest decision (not a generic string)", async () => {
  const repo = await makeGitRepo();
  try {
    const crewDir = path.join(repo, ".claude");
    await fs.mkdir(crewDir, { recursive: true });
    await fs.writeFile(
      path.join(crewDir, "crew.json"),
      JSON.stringify({ features: { "push-verify": { enabled: true } } }),
      "utf8"
    );
    // Artifact exists and is within the window, but is not a PASS —
    // distinct from "dir empty" and must not produce the same message.
    const validationsDir = path.join(crewDir, "artifacts", "crew", "validations");
    await fs.mkdir(validationsDir, { recursive: true });
    await fs.writeFile(
      path.join(validationsDir, "20991231T235959Z-fail.md"),
      "---\ndecision: fail\n---\n\n# Validation\n\nsome failure\n",
      "utf8"
    );

    const payload = JSON.stringify({
      session_id: "test_push_notfound_message",
      tool_name: "Bash",
      tool_input: { command: "git push origin main" },
      cwd: repo
    });
    const result = await runHook(PRE_PUSH_VERIFIER_PATH, payload);
    assert.equal(result.exitCode, 0);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.decision, "block");
    assert.ok(parsed.reason.includes(validationsDir), "reason should include the scanned dir");
    assert.match(parsed.reason, /1 validation artifact\(s\) found within the last hour/);
    assert.match(parsed.reason, /decision=fail/);
  } finally {
    await cleanup(repo);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// P1.0 feature-flag envelope — check-task-update-burst.ts (task-update-burst-warn)
// ──────────────────────────────────────────────────────────────────────────

test("check-task-update-burst: task-update-burst-warn disabled → no burst rows even after 3 calls", async () => {
  const repo = await makeRepo();
  try {
    const crewDir = path.join(repo, ".claude");
    await fs.mkdir(crewDir, { recursive: true });
    await fs.writeFile(
      path.join(crewDir, "crew.json"),
      JSON.stringify({ features: { "task-update-burst-warn": { enabled: false } } }),
      "utf8"
    );

    const payload = (sid: string) =>
      JSON.stringify({
        session_id: sid,
        cwd: repo,
        tool_input: { taskId: "1", status: "in_progress" }
      });

    for (let i = 0; i < 3; i++) {
      const result = await runHook(CHECK_TASK_UPDATE_BURST_PATH, payload("burst-off"));
      assert.equal(result.exitCode, 0);
    }

    const burstLog = path.join(repo, ".claude", "logs", "task-update-bursts.jsonl");
    await assert.rejects(fs.access(burstLog), "burst log should not exist when flag disabled");
  } finally {
    await cleanup(repo);
  }
});

test("check-task-update-burst: missing crew.json → task-update-burst-warn defaults enabled, fires on 3rd call", async () => {
  const repo = await makeRepo();
  try {
    const payload = (sid: string) =>
      JSON.stringify({
        session_id: sid,
        cwd: repo,
        tool_input: { taskId: "1", status: "in_progress" }
      });

    for (let i = 0; i < 3; i++) {
      const result = await runHook(CHECK_TASK_UPDATE_BURST_PATH, payload("burst-on"));
      assert.equal(result.exitCode, 0);
    }

    const burstLog = path.join(repo, ".claude", "logs", "task-update-bursts.jsonl");
    const raw = await fs.readFile(burstLog, "utf8");
    assert.match(raw, /"consecutive_count":3/);
  } finally {
    await cleanup(repo);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// P1.0 feature-flag envelope — bash-gate hooks (bash-gate-telemetry)
// ──────────────────────────────────────────────────────────────────────────

test("pre-tool-use-bash-gate: bash-gate-telemetry disabled → stderr diagnostic reports disabled, exit 0", async () => {
  const repo = await makeRepo();
  try {
    const crewDir = path.join(repo, ".claude");
    await fs.mkdir(crewDir, { recursive: true });
    await fs.writeFile(
      path.join(crewDir, "crew.json"),
      JSON.stringify({ features: { "bash-gate-telemetry": { enabled: false } } }),
      "utf8"
    );
    const payload = JSON.stringify({
      session_id: "s1",
      cwd: repo,
      tool_input: { command: "bun run lint" }
    });
    const result = await runHook(PRE_TOOL_USE_BASH_GATE_PATH, payload);
    assert.equal(result.exitCode, 0);
    assert.match(result.stderr, /\[features\] bash-gate-telemetry: disabled/);
  } finally {
    await cleanup(repo);
  }
});

test("pre-tool-use-bash-gate: missing crew.json → bash-gate-telemetry defaults enabled", async () => {
  const repo = await makeRepo();
  try {
    const payload = JSON.stringify({
      session_id: "s1",
      cwd: repo,
      tool_input: { command: "bun run lint" }
    });
    const result = await runHook(PRE_TOOL_USE_BASH_GATE_PATH, payload);
    assert.equal(result.exitCode, 0);
    assert.match(result.stderr, /\[features\] bash-gate-telemetry: enabled/);
  } finally {
    await cleanup(repo);
  }
});

test("post-tool-use-bash-gate: bash-gate-telemetry disabled → stderr diagnostic reports disabled, exit 0", async () => {
  const repo = await makeRepo();
  try {
    const crewDir = path.join(repo, ".claude");
    await fs.mkdir(crewDir, { recursive: true });
    await fs.writeFile(
      path.join(crewDir, "crew.json"),
      JSON.stringify({ features: { "bash-gate-telemetry": { enabled: false } } }),
      "utf8"
    );
    const payload = JSON.stringify({
      session_id: "s1",
      cwd: repo,
      tool_input: { command: "bun run lint" },
      tool_response: { exitCode: 0 }
    });
    const result = await runHook(POST_TOOL_USE_BASH_GATE_PATH, payload);
    assert.equal(result.exitCode, 0);
    assert.match(result.stderr, /\[features\] bash-gate-telemetry: disabled/);
  } finally {
    await cleanup(repo);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// P1.0 feature-flag envelope — otel-post-tool-use.ts (otel-telemetry)
// ──────────────────────────────────────────────────────────────────────────

test("otel-post-tool-use: otel-telemetry disabled → stderr diagnostic reports disabled, exit 0, no span attempt", async () => {
  const repo = await makeRepo();
  try {
    const crewDir = path.join(repo, ".claude");
    await fs.mkdir(crewDir, { recursive: true });
    await fs.writeFile(
      path.join(crewDir, "crew.json"),
      JSON.stringify({ features: { "otel-telemetry": { enabled: false } } }),
      "utf8"
    );
    const payload = JSON.stringify({
      session_id: "s1",
      cwd: repo,
      tool_name: "Read",
      tool_input: { file_path: "x.ts" }
    });
    const result = await runHook(OTEL_POST_TOOL_USE_PATH, payload, {
      CREW_OTEL_ENABLED: "1"
    });
    assert.equal(result.exitCode, 0);
    assert.match(result.stderr, /\[features\] otel-telemetry: disabled/);
  } finally {
    await cleanup(repo);
  }
});

test("otel-post-tool-use: missing crew.json → otel-telemetry defaults enabled (diagnostic fires before the CREW_OTEL_ENABLED gate)", async () => {
  const repo = await makeRepo();
  try {
    const payload = JSON.stringify({
      session_id: "s1",
      cwd: repo,
      tool_name: "Read",
      tool_input: { file_path: "x.ts" }
    });
    const result = await runHook(OTEL_POST_TOOL_USE_PATH, payload);
    assert.equal(result.exitCode, 0);
    assert.match(result.stderr, /\[features\] otel-telemetry: enabled/);
  } finally {
    await cleanup(repo);
  }
});
