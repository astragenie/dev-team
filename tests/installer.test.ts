import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test, expect } from "bun:test";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { auditRepo, bootstrapRepo, initRepo, installGlobal } from "../scripts/lib/installer.ts";

const execFile = promisify(execFileCallback);
const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

async function makeTempDir(prefix: string) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

test("bootstrap adds harness files to an existing repo and preserves CLAUDE.md", async () => {
  const repoPath = await makeTempDir("crew-bootstrap-");
  await fs.writeFile(
    path.join(repoPath, "CLAUDE.md"),
    "# Existing Repo Rules\n\nKeep tests fast.\n"
  );

  const bootstrapResult = await bootstrapRepo(repoPath);
  expect(bootstrapResult.ok, "bootstrapRepo should succeed").toBeTruthy();
  if (!bootstrapResult.ok) throw new Error("bootstrapRepo should succeed");
  const result = bootstrapResult.value;
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

  expect(result.mode).toBe("bootstrap");
  expect(claudeMd).toMatch(/# Existing Repo Rules/);
  expect(claudeMd).toMatch(/crew:start/);
  expect(claudeMd).toMatch(/@\.claude\/crew\/constitution\.md/);
  expect(claudeMd).not.toMatch(/@\.claude\/crew\/workflow\.md/);
  expect(workflowMd).toMatch(
    /Builder owns code-bearing tasks, including tests for changed behavior when practical/
  );
  expect(protocolMd).toMatch(/Validation Result/);
  expect(protocolMd).toMatch(/Deployment Result/);
  expect(protocolMd).toMatch(/whether tests were added or updated/);
  expect(settings.hooks.SessionStart).toBeTruthy();
  expect(settings.hooks.TaskCreated).toBeTruthy();
  expect(settings.hooks.PreToolUse).toBeTruthy();
  expect(claimsState.claims).toEqual({});
});

test("bootstrap creates .gitignore with marker block and preserves user lines", async () => {
  const repoPath = await makeTempDir("crew-gitignore-new-");
  await fs.writeFile(path.join(repoPath, "CLAUDE.md"), "# Repo\n");
  await bootstrapRepo(repoPath);

  const ignore = await fs.readFile(path.join(repoPath, ".gitignore"), "utf8");
  expect(ignore).toMatch(/# crew:start/);
  expect(ignore).toMatch(/# crew:end/);
  expect(ignore).toMatch(/\.claude\/logs\//);
});

test("bootstrap merges marker block into existing .gitignore without losing user lines", async () => {
  const repoPath = await makeTempDir("crew-gitignore-merge-");
  await fs.writeFile(path.join(repoPath, "CLAUDE.md"), "# Repo\n");
  await fs.writeFile(path.join(repoPath, ".gitignore"), "node_modules/\nmy-secret.env\n");
  await bootstrapRepo(repoPath);

  const ignore = await fs.readFile(path.join(repoPath, ".gitignore"), "utf8");
  expect(ignore).toMatch(/node_modules\//);
  expect(ignore).toMatch(/my-secret\.env/);
  expect(ignore).toMatch(/# crew:start[\s\S]*# crew:end/);
});

test("bootstrap is idempotent for .gitignore marker block", async () => {
  const repoPath = await makeTempDir("crew-gitignore-idem-");
  await fs.writeFile(path.join(repoPath, "CLAUDE.md"), "# Repo\n");
  await bootstrapRepo(repoPath);
  await bootstrapRepo(repoPath);

  const ignore = await fs.readFile(path.join(repoPath, ".gitignore"), "utf8");
  const starts = ignore.match(/# crew:start/g) ?? [];
  expect(starts.length).toBe(1);
});

test("bootstrap is idempotent for CLAUDE.md imports", async () => {
  const repoPath = await makeTempDir("crew-idempotent-");
  await fs.writeFile(path.join(repoPath, "CLAUDE.md"), "# Repo\n");

  await bootstrapRepo(repoPath);
  await bootstrapRepo(repoPath);

  const claudeMd = await fs.readFile(path.join(repoPath, "CLAUDE.md"), "utf8");
  const occurrences = claudeMd.match(/crew:start/g) ?? [];
  expect(occurrences.length).toBe(1);
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
    '{\n  "claims": {\n    "src/legacy.ts": {\n      "owner": "fullstack-dev"\n    }\n  }\n}\n'
  );

  await bootstrapRepo(repoPath);

  const claudeMd = await fs.readFile(path.join(repoPath, "CLAUDE.md"), "utf8");
  const claimsState = await fs.readFile(
    path.join(repoPath, ".claude", "state", "crew", "claims.json"),
    "utf8"
  );
  expect(claudeMd).toMatch(/<!-- crew:start -->/);
  expect(claudeMd).not.toMatch(/engineering-os:start/);
  expect(
    await fs
      .access(path.join(repoPath, ".claude", "crew", "constitution.md"))
      .then(() => true)
      .catch(() => false)
  ).toBe(true);
  expect(
    await fs
      .access(path.join(repoPath, ".claude", "state", "crew", "claims.json"))
      .then(() => true)
      .catch(() => false)
  ).toBe(true);
  expect(claimsState).toMatch(/src\/legacy\.ts/);
  expect(
    await fs
      .access(path.join(repoPath, ".claude", "engineering-os"))
      .then(() => true)
      .catch(() => false)
  ).toBe(false);
});

test("init creates a new repo harness and audit sees it", async () => {
  const rootPath = await makeTempDir("crew-root-");
  const repoPath = path.join(rootPath, "demo-repo");

  const result = await initRepo(repoPath);
  const audit = await auditRepo(repoPath);

  expect(result.mode).toBe("init");
  expect(audit.exists).toBe(true);
  expect(audit.hasClaudeMd).toBe(true);
  expect(audit.hasHarnessLayer).toBe(true);
  expect(audit.hasStateLayer).toBe(true);
  expect(audit.hasWorkflowState).toBe(true);
});

test("bootstrap installs a soft git gate reminder hook", async () => {
  const repoPath = await makeTempDir("crew-git-gate-hook-");
  await fs.writeFile(path.join(repoPath, "CLAUDE.md"), "# Repo\n");

  await bootstrapRepo(repoPath);

  const settings = JSON.parse(
    await fs.readFile(path.join(repoPath, ".claude", "settings.json"), "utf8")
  );
  expect(settings.hooks.PreToolUse).toBeTruthy();
  expect(settings.hooks.PreToolUse[0].hooks[0].command).toMatch(
    /\.claude\/hooks\/check_git_gate\.sh/
  );

  const hookPath = path.join(repoPath, ".claude", "hooks", "check_git_gate.sh");
  const hookStat = await fs.stat(hookPath);
  if (process.platform !== "win32") {
    expect((hookStat.mode & 0o111) !== 0).toBeTruthy();
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
  expect(reminder.continue).toBe(true);
  expect(reminder.suppressOutput).toBe(true);
  expect(reminder.systemMessage).toMatch(
    /pending workflow gates before git commit: review_required/
  );
});

test("bootstrap git gate reminder also warns when a completed phase is missing its artifact write-back", async () => {
  const repoPath = await makeTempDir("crew-git-gate-artifact-gap-");
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
  expect(reminder.continue).toBe(true);
  expect(reminder.suppressOutput).toBe(true);
  expect(reminder.systemMessage).toMatch(
    /phase-complete write-backs still missing before gh pr: review-result artifact/
  );
});

test("init rejects a non-empty existing directory without opt-in", async () => {
  const repoPath = await makeTempDir("crew-existing-");
  await fs.writeFile(path.join(repoPath, "README.md"), "hello\n");

  await expect(initRepo(repoPath)).rejects.toThrow(/already exists and is not empty/);
});

test("installGlobal migrates legacy ~/.claude/engineering-os/ to ~/.claude/crew/", async () => {
  const originalHome = process.env.HOME;
  const homePath = await makeTempDir("crew-global-migrate-");
  process.env.HOME = homePath;

  try {
    const legacyDir = path.join(homePath, ".claude", "engineering-os");
    await fs.mkdir(legacyDir, { recursive: true });
    await fs.writeFile(path.join(legacyDir, "constitution.md"), "# Old Constitution\n");
    await fs.writeFile(path.join(legacyDir, "workflow.md"), "# Old Workflow\n");
    await fs.writeFile(
      path.join(legacyDir, "metadata.json"),
      '{"managedBy":"crew","version":"1.0"}\n'
    );
    await fs.mkdir(path.join(homePath, ".claude"), { recursive: true });
    await fs.writeFile(
      path.join(homePath, ".claude", "CLAUDE.md"),
      "@~/.claude/engineering-os/constitution.md\n@~/.claude/engineering-os/workflow.md\n"
    );

    const result = await installGlobal();
    expect(result.global.hasGlobalMemory).toBe(true);
    expect(
      result.writes.some((w) => w.includes("migrated")),
      "should report migration in writes"
    ).toBeTruthy();

    const claudeMd = await fs.readFile(path.join(homePath, ".claude", "CLAUDE.md"), "utf8");
    expect(claudeMd).toMatch(/@~\/\.claude\/crew\/constitution\.md/);
    expect(claudeMd).toMatch(/@~\/\.claude\/crew\/workflow\.md/);
    expect(claudeMd).not.toMatch(/engineering-os/);

    const legacyExists = await fs
      .access(legacyDir)
      .then(() => true)
      .catch(() => false);
    expect(legacyExists, "legacy dir should be removed").toBe(false);
  } finally {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
  }
});

test("installGlobal writes one managed global memory copy and is idempotent", async () => {
  const originalHome = process.env.HOME;
  const homePath = await makeTempDir("crew-global-home-");
  process.env.HOME = homePath;

  try {
    const first = await installGlobal();
    expect(first.mode).toBe("install-global");
    expect(first.writes).toEqual([
      "~/.claude/crew/constitution.md",
      "~/.claude/crew/workflow.md",
      "~/.claude/crew/metadata.json",
      "~/.claude/CLAUDE.md"
    ]);
    expect(first.global.hasGlobalMemory).toBe(true);
    expect(first.global.globalMemoryStale).toBe(false);

    const claudeMd = await fs.readFile(path.join(homePath, ".claude", "CLAUDE.md"), "utf8");
    expect(claudeMd).toMatch(/@~\/\.claude\/crew\/constitution\.md/);
    expect(claudeMd).toMatch(/@~\/\.claude\/crew\/workflow\.md/);

    const metadata = JSON.parse(
      await fs.readFile(path.join(homePath, ".claude", "crew", "metadata.json"), "utf8")
    );
    expect(metadata.managedBy).toBe("crew");

    const second = await installGlobal();
    expect(second.writes).toEqual([]);
    expect(second.global.hasGlobalMemory).toBe(true);
  } finally {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
  }
});

// Missing-script guard (cross-referenced from astragenie/runner-plugin#402):
// a checkout can carry a committed .claude/settings.json that references
// .claude/hooks/* while the hooks were never materialized in that clone
// (crew:install not run — the scripts live only in the plugin cache). The
// unguarded commands then error "No such file or directory" on EVERY tool
// call. The emitted commands must no-op silently when the script file is
// absent, and still execute it normally when present.
test("settings hook commands no-op silently when .claude/hooks is not materialized", async () => {
  const repoPath = await makeTempDir("crew-hook-guard-missing-");
  await fs.writeFile(path.join(repoPath, "CLAUDE.md"), "# Repo\n");

  await bootstrapRepo(repoPath);
  const settings = JSON.parse(
    await fs.readFile(path.join(repoPath, ".claude", "settings.json"), "utf8")
  );

  // Simulate the fresh-checkout state: settings.json present, hooks absent.
  await fs.rm(path.join(repoPath, ".claude", "hooks"), { recursive: true, force: true });

  const commands: string[] = [];
  for (const entries of Object.values(settings.hooks) as any[]) {
    for (const entry of entries) {
      for (const hook of entry.hooks ?? []) commands.push(hook.command);
    }
  }
  expect(
    commands.length >= 6,
    `expected all crew hook commands, got ${commands.length}`
  ).toBeTruthy();

  for (const command of commands) {
    // execFile rejects on non-zero exit — resolving IS the assertion.
    const { stdout, stderr } = await execFile("bash", ["-c", command], { cwd: repoPath });
    expect(stdout.trim(), `guarded command must stay silent: ${command}`).toBe("");
    expect(stderr.trim(), `guarded command must not error: ${command}`).toBe("");
  }
});

test("guarded hook command still executes the materialized script (stdin preserved)", async () => {
  const repoPath = await makeTempDir("crew-hook-guard-present-");
  await fs.writeFile(path.join(repoPath, "CLAUDE.md"), "# Repo\n");

  await bootstrapRepo(repoPath);
  const settings = JSON.parse(
    await fs.readFile(path.join(repoPath, ".claude", "settings.json"), "utf8")
  );
  const sessionStartCommand = settings.hooks.SessionStart[0].hooks[0].command as string;

  await execFile(
    "bash",
    ["-c", `printf '%s' '{"hook_event_name":"SessionStart"}' | ( ${sessionStartCommand} )`],
    { cwd: repoPath }
  );

  const events = await fs.readFile(path.join(repoPath, ".claude", "logs", "events.jsonl"), "utf8");
  expect(events).toMatch(/"event":"session_start"/);
});

// dev-team dogfoods this plugin: its own tracked .claude/settings.json is a
// hand-maintained superset of DEFAULT_SETTINGS (it wires two repo-local
// hooks — subagent_handoff_check.sh and session_end_checkpoint.sh — that
// are not part of the shared installer template). That file can drift out
// of sync with the guardedHookCommand convention (astragenie/dev-team#202:
// a tracked settings.json referencing .claude/hooks/* while the scripts
// were never materialized errors on every matching tool call). Regression
// guard: every .claude/hooks/* command actually committed at repo root
// must degrade silently when .claude/hooks/ is not materialized, exactly
// like the installer-generated form asserted above.
test("repo's own tracked .claude/settings.json hook commands no-op silently when .claude/hooks is absent", async () => {
  const settings = JSON.parse(
    await fs.readFile(path.join(repoRoot, ".claude", "settings.json"), "utf8")
  );

  const hookCommands: string[] = [];
  for (const entries of Object.values(settings.hooks) as any[]) {
    for (const entry of entries) {
      for (const hook of entry.hooks ?? []) {
        if (typeof hook.command === "string" && hook.command.includes(".claude/hooks/")) {
          hookCommands.push(hook.command);
        }
      }
    }
  }
  expect(
    hookCommands.length >= 8,
    `expected all tracked .claude/hooks/* commands, got ${hookCommands.length}`
  ).toBeTruthy();

  // Run each command from a cwd that has no .claude/hooks/ directory at all
  // — the fresh-checkout / unmaterialized-worktree scenario from #202.
  const repoPath = await makeTempDir("crew-own-settings-guard-");

  for (const command of hookCommands) {
    const { stdout, stderr } = await execFile("bash", ["-c", command], { cwd: repoPath });
    expect(stdout.trim(), `guarded command must stay silent: ${command}`).toBe("");
    expect(stderr.trim(), `guarded command must not error: ${command}`).toBe("");
  }
});
