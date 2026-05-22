import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

import { auditRepo, bootstrapRepo, initRepo, installGlobal } from "../scripts/lib/installer.mjs";

const execFile = promisify(execFileCallback);

async function makeTempDir(prefix) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

test("bootstrap adds harness files to an existing repo and preserves CLAUDE.md", async () => {
  const repoPath = await makeTempDir("crew-bootstrap-");
  await fs.writeFile(
    path.join(repoPath, "CLAUDE.md"),
    "# Existing Repo Rules\n\nKeep tests fast.\n"
  );

  const result = await bootstrapRepo(repoPath);
  const claudeMd = await fs.readFile(path.join(repoPath, "CLAUDE.md"), "utf8");
  const workflowMd = await fs.readFile(
    path.join(repoPath, ".claude", "crew", "workflow.md"),
    "utf8"
  );
  const protocolMd = await fs.readFile(
    path.join(repoPath, ".claude", "crew", "protocol.md"),
    "utf8"
  );
  const settings = JSON.parse(
    await fs.readFile(path.join(repoPath, ".claude", "settings.json"), "utf8")
  );
  const claimsState = JSON.parse(
    await fs.readFile(path.join(repoPath, ".claude", "state", "crew", "claims.json"), "utf8")
  );

  assert.equal(result.mode, "bootstrap");
  assert.match(claudeMd, /# Existing Repo Rules/);
  assert.match(claudeMd, /crew:start/);
  assert.match(claudeMd, /@\.claude\/crew\/constitution\.md/);
  assert.doesNotMatch(claudeMd, /@\.claude\/crew\/workflow\.md/);
  assert.match(
    workflowMd,
    /Builder owns code-bearing tasks, including tests for changed behavior when practical/
  );
  assert.match(protocolMd, /Validation Result/);
  assert.match(protocolMd, /Deployment Result/);
  assert.match(protocolMd, /whether tests were added or updated/);
  assert.ok(settings.hooks.SessionStart);
  assert.ok(settings.hooks.TaskCreated);
  assert.ok(settings.hooks.PreToolUse);
  assert.deepEqual(claimsState.claims, {});
});

test("bootstrap creates .gitignore with marker block and preserves user lines", async () => {
  const repoPath = await makeTempDir("crew-gitignore-new-");
  await fs.writeFile(path.join(repoPath, "CLAUDE.md"), "# Repo\n");
  await bootstrapRepo(repoPath);

  const ignore = await fs.readFile(path.join(repoPath, ".gitignore"), "utf8");
  assert.match(ignore, /# crew:start/);
  assert.match(ignore, /# crew:end/);
  assert.match(ignore, /\.claude\/logs\//);
});

test("bootstrap merges marker block into existing .gitignore without losing user lines", async () => {
  const repoPath = await makeTempDir("crew-gitignore-merge-");
  await fs.writeFile(path.join(repoPath, "CLAUDE.md"), "# Repo\n");
  await fs.writeFile(path.join(repoPath, ".gitignore"), "node_modules/\nmy-secret.env\n");
  await bootstrapRepo(repoPath);

  const ignore = await fs.readFile(path.join(repoPath, ".gitignore"), "utf8");
  assert.match(ignore, /node_modules\//);
  assert.match(ignore, /my-secret\.env/);
  assert.match(ignore, /# crew:start[\s\S]*# crew:end/);
});

test("bootstrap is idempotent for .gitignore marker block", async () => {
  const repoPath = await makeTempDir("crew-gitignore-idem-");
  await fs.writeFile(path.join(repoPath, "CLAUDE.md"), "# Repo\n");
  await bootstrapRepo(repoPath);
  await bootstrapRepo(repoPath);

  const ignore = await fs.readFile(path.join(repoPath, ".gitignore"), "utf8");
  const starts = ignore.match(/# crew:start/g) ?? [];
  assert.equal(starts.length, 1);
});

test("bootstrap is idempotent for CLAUDE.md imports", async () => {
  const repoPath = await makeTempDir("crew-idempotent-");
  await fs.writeFile(path.join(repoPath, "CLAUDE.md"), "# Repo\n");

  await bootstrapRepo(repoPath);
  await bootstrapRepo(repoPath);

  const claudeMd = await fs.readFile(path.join(repoPath, "CLAUDE.md"), "utf8");
  const occurrences = claudeMd.match(/crew:start/g) ?? [];
  assert.equal(occurrences.length, 1);
});

test("bootstrap upgrades legacy harness paths and CLAUDE import block", async () => {
  const repoPath = await makeTempDir("crew-legacy-upgrade-");
  await fs.mkdir(path.join(repoPath, ".claude", "engineering-os"), { recursive: true });
  await fs.mkdir(path.join(repoPath, ".claude", "artifacts", "engineering-os", "runs"), {
    recursive: true
  });
  await fs.mkdir(path.join(repoPath, ".claude", "state", "engineering-os"), {
    recursive: true
  });
  await fs.writeFile(
    path.join(repoPath, "CLAUDE.md"),
    [
      "# Repo",
      "",
      "<!-- engineering-os:start -->",
      "@.claude/engineering-os/constitution.md",
      "<!-- engineering-os:end -->",
      ""
    ].join("\n")
  );
  await fs.writeFile(
    path.join(repoPath, ".claude", "engineering-os", "constitution.md"),
    "# Legacy Constitution\n"
  );
  await fs.writeFile(
    path.join(repoPath, ".claude", "state", "engineering-os", "claims.json"),
    '{\n  "claims": {\n    "src/legacy.ts": {\n      "owner": "builder"\n    }\n  }\n}\n'
  );

  await bootstrapRepo(repoPath);

  const claudeMd = await fs.readFile(path.join(repoPath, "CLAUDE.md"), "utf8");
  const claimsState = await fs.readFile(
    path.join(repoPath, ".claude", "state", "crew", "claims.json"),
    "utf8"
  );
  assert.match(claudeMd, /<!-- crew:start -->/);
  assert.doesNotMatch(claudeMd, /engineering-os:start/);
  assert.equal(
    await fs
      .access(path.join(repoPath, ".claude", "crew", "constitution.md"))
      .then(() => true)
      .catch(() => false),
    true
  );
  assert.equal(
    await fs
      .access(path.join(repoPath, ".claude", "state", "crew", "claims.json"))
      .then(() => true)
      .catch(() => false),
    true
  );
  assert.match(claimsState, /src\/legacy\.ts/);
  assert.equal(
    await fs
      .access(path.join(repoPath, ".claude", "engineering-os"))
      .then(() => true)
      .catch(() => false),
    false
  );
});

test("init creates a new repo harness and audit sees it", async () => {
  const rootPath = await makeTempDir("crew-root-");
  const repoPath = path.join(rootPath, "demo-repo");

  const result = await initRepo(repoPath);
  const audit = await auditRepo(repoPath);

  assert.equal(result.mode, "init");
  assert.equal(audit.exists, true);
  assert.equal(audit.hasClaudeMd, true);
  assert.equal(audit.hasHarnessLayer, true);
  assert.equal(audit.hasStateLayer, true);
  assert.equal(audit.hasWorkflowState, true);
});

test("bootstrap installs a soft git gate reminder hook", async () => {
  const repoPath = await makeTempDir("engineering-os-git-gate-hook-");
  await fs.writeFile(path.join(repoPath, "CLAUDE.md"), "# Repo\n");

  await bootstrapRepo(repoPath);

  const settings = JSON.parse(
    await fs.readFile(path.join(repoPath, ".claude", "settings.json"), "utf8")
  );
  assert.ok(settings.hooks.PreToolUse);
  assert.match(
    settings.hooks.PreToolUse[0].hooks[0].command,
    /\.claude\/hooks\/check_git_gate\.sh/
  );

  const hookPath = path.join(repoPath, ".claude", "hooks", "check_git_gate.sh");
  const hookStat = await fs.stat(hookPath);
  if (process.platform !== "win32") {
    assert.ok((hookStat.mode & 0o111) !== 0);
  }

  const workflowPath = path.join(repoPath, ".claude", "state", "crew", "workflow-state.json");
  await fs.writeFile(
    workflowPath,
    `${JSON.stringify(
      {
        version: "1.0",
        updatedAt: "2026-01-01T00:00:00.000Z",
        currentRun: {
          title: "Gate test",
          goal: "Check reminder hook",
          mode: "single-session",
          status: "active",
          gates: {
            review: { status: "required", updatedAt: "2026-01-01T00:00:00.000Z", note: "" },
            validation: null,
            deployment: { dev: null, prod: null }
          }
        },
        recentRuns: []
      },
      null,
      2
    )}\n`
  );

  const hookInput = JSON.stringify({
    session_id: "session-1",
    transcript_path: "/tmp/transcript.jsonl",
    cwd: repoPath,
    permission_mode: "default",
    hook_event_name: "PreToolUse",
    tool_name: "Bash",
    tool_input: {
      command: 'git commit -m "test"'
    }
  });

  const { stdout } = await execFile("bash", ["-lc", 'printf \'%s\' "$HOOK_INPUT" | "$HOOK_PATH"'], {
    cwd: repoPath,
    env: {
      ...process.env,
      HOOK_INPUT: hookInput,
      HOOK_PATH: hookPath
    }
  });
  const reminder = JSON.parse(stdout);
  assert.equal(reminder.continue, true);
  assert.equal(reminder.suppressOutput, true);
  assert.match(reminder.systemMessage, /pending workflow gates before git commit: review_required/);
});

test("bootstrap git gate reminder also warns when a completed phase is missing its artifact write-back", async () => {
  const repoPath = await makeTempDir("engineering-os-git-gate-artifact-gap-");
  await fs.writeFile(path.join(repoPath, "CLAUDE.md"), "# Repo\n");

  await bootstrapRepo(repoPath);

  const hookPath = path.join(repoPath, ".claude", "hooks", "check_git_gate.sh");
  const workflowPath = path.join(repoPath, ".claude", "state", "crew", "workflow-state.json");
  await fs.writeFile(
    workflowPath,
    `${JSON.stringify(
      {
        version: "1.0",
        updatedAt: "2026-01-01T00:00:00.000Z",
        currentRun: {
          title: "Artifact gap test",
          goal: "Check reminder hook",
          mode: "single-session",
          status: "active",
          gates: {
            review: { status: "passed", updatedAt: "2026-01-01T00:00:00.000Z", note: "" },
            validation: null,
            deployment: { dev: null, prod: null }
          },
          artifacts: {
            runBrief: null,
            handoffs: [],
            reviewResult: null,
            validationPlan: null,
            validationResult: null,
            deploymentChecks: { dev: null, prod: null },
            finalSynthesis: null
          }
        },
        recentRuns: []
      },
      null,
      2
    )}\n`
  );

  const hookInput = JSON.stringify({
    session_id: "session-1",
    transcript_path: "/tmp/transcript.jsonl",
    cwd: repoPath,
    permission_mode: "default",
    hook_event_name: "PreToolUse",
    tool_name: "Bash",
    tool_input: {
      command: "gh pr create --fill"
    }
  });

  const { stdout } = await execFile("bash", ["-lc", 'printf \'%s\' "$HOOK_INPUT" | "$HOOK_PATH"'], {
    cwd: repoPath,
    env: {
      ...process.env,
      HOOK_INPUT: hookInput,
      HOOK_PATH: hookPath
    }
  });
  const reminder = JSON.parse(stdout);
  assert.equal(reminder.continue, true);
  assert.equal(reminder.suppressOutput, true);
  assert.match(
    reminder.systemMessage,
    /phase-complete write-backs still missing before gh pr: review-result artifact/
  );
});

test("init rejects a non-empty existing directory without opt-in", async () => {
  const repoPath = await makeTempDir("crew-existing-");
  await fs.writeFile(path.join(repoPath, "README.md"), "hello\n");

  await assert.rejects(() => initRepo(repoPath), /already exists and is not empty/);
});

test("installGlobal writes one managed global memory copy and is idempotent", async () => {
  const originalHome = process.env.HOME;
  const homePath = await makeTempDir("engineering-os-global-home-");
  process.env.HOME = homePath;

  try {
    const first = await installGlobal();
    assert.equal(first.mode, "install-global");
    assert.deepEqual(first.writes, [
      "~/.claude/engineering-os/constitution.md",
      "~/.claude/engineering-os/workflow.md",
      "~/.claude/engineering-os/metadata.json",
      "~/.claude/CLAUDE.md"
    ]);
    assert.equal(first.global.hasGlobalMemory, true);
    assert.equal(first.global.globalMemoryStale, false);

    const claudeMd = await fs.readFile(path.join(homePath, ".claude", "CLAUDE.md"), "utf8");
    assert.match(claudeMd, /@~\/\.claude\/engineering-os\/constitution\.md/);
    assert.match(claudeMd, /@~\/\.claude\/engineering-os\/workflow\.md/);

    const metadata = JSON.parse(
      await fs.readFile(path.join(homePath, ".claude", "engineering-os", "metadata.json"), "utf8")
    );
    assert.equal(metadata.managedBy, "crew");

    const second = await installGlobal();
    assert.deepEqual(second.writes, []);
    assert.equal(second.global.hasGlobalMemory, true);
  } finally {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
  }
});
