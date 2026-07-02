/**
 * tests/gepa/gepa-revert.test.ts — SLICE-106
 *
 * Covers AC-6: gepa-revert deletes soak pointer, finds promotion commit,
 * runs `git revert` (never force-push, never reset), and emits gepa_soak_revert.
 */

import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { runGepaRevertCmd } from "../../scripts/lib/gepa/gepa-killswitch-cmds.ts";

// ── Git helpers ───────────────────────────────────────────────────────────────

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test",
  GIT_AUTHOR_EMAIL: "test@test.com",
  GIT_COMMITTER_NAME: "Test",
  GIT_COMMITTER_EMAIL: "test@test.com"
};

function git(cwd: string, args: string[]): ReturnType<typeof spawnSync> {
  return spawnSync("git", args, { cwd, encoding: "utf8", env: GIT_ENV });
}

function initRepo(dir: string): void {
  git(dir, ["init", "-b", "main"]);
  git(dir, ["config", "user.email", "test@test.com"]);
  git(dir, ["config", "user.name", "Test"]);
  writeFileSync(join(dir, "README.md"), "# test\n", "utf8");
  git(dir, ["add", "README.md"]);
  git(dir, ["commit", "-m", "init"]);
}

function addAgentAndCommit(dir: string, agent: string, content: string, commitMsg: string): string {
  const agentsDir = join(dir, "agents");
  mkdirSync(agentsDir, { recursive: true });
  const agentPath = join(agentsDir, `${agent}.md`);
  writeFileSync(agentPath, content, "utf8");
  git(dir, ["add", agentPath]);
  git(dir, ["commit", "-m", commitMsg]);
  const sha = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: dir,
    encoding: "utf8"
  }).stdout.trim();
  return sha;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

let tmpDir: string;
let repoPath: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "gepa-revert-test-"));
  repoPath = join(tmpDir, "repo");
  mkdirSync(repoPath);
  initRepo(repoPath);
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("gepa-revert — AC-6 missing agent arg", () => {
  it("exits 2 with usage message when --agent not provided", async () => {
    const result = await runGepaRevertCmd(repoPath, []);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("usage:");
  });
});

describe("gepa-revert — AC-6 no promotion commit found", () => {
  it("exits 0 with informational message when no chore(gepa): promote commit exists", async () => {
    // Just a normal agent file — no promotion commit.
    addAgentAndCommit(repoPath, "fullstack-dev", "# Agent\nOriginal body.\n", "docs: add agent");

    const result = await runGepaRevertCmd(repoPath, ["--agent", "fullstack-dev"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("no promotion commit found");
    expect(result.stdout).toContain("fullstack-dev");
  });
});

describe("gepa-revert — AC-6 success: git revert on promotion commit", () => {
  it("creates a revert commit and removes soak pointer; NEVER uses git reset", async () => {
    const AGENT = "fullstack-dev";

    // Step 1: initial agent content.
    addAgentAndCommit(repoPath, AGENT, "# Agent\nOriginal body.\n", "docs: initial agent");

    // Step 2: promotion commit (with gepa: frontmatter).
    const provenanceContent = [
      "---",
      "gepa:",
      `  champion_from_trial: trial-uuid-abc`,
      `  prior_prompt_hash: abc123`,
      `  promoted_at: 2026-07-01T10:00:00.000Z`,
      "---",
      "# Agent",
      "Improved body after GEPA optimization.",
      ""
    ].join("\n");
    const promotionSha = addAgentAndCommit(
      repoPath,
      AGENT,
      provenanceContent,
      `chore(gepa): promote ${AGENT} from cycle cccc-dddd`
    );

    // Step 3: Write a soak.json with an active entry for the agent.
    const gepaDir = join(repoPath, ".claude", "artifacts", "crew", "gepa");
    mkdirSync(gepaDir, { recursive: true });
    const soakJson = {
      [AGENT]: {
        agent: AGENT,
        started_at: "2026-07-01T10:00:00.000Z",
        champion_path: join(repoPath, "agents", `${AGENT}.md`),
        trials: [],
        main_pass_rate: 0.9
      }
    };
    writeFileSync(join(gepaDir, "soak.json"), JSON.stringify(soakJson, null, 2), "utf8");

    // Step 4: Run gepa-revert.
    const result = await runGepaRevertCmd(repoPath, ["--agent", AGENT]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("soak pointer removed");
    expect(result.stdout).toContain(`reverted promotion commit ${promotionSha}`);
    expect(result.stdout).toContain("gepa_soak_revert logged");

    // Step 5: Verify soak pointer was removed from soak.json.
    const soakRaw = readFileSync(join(gepaDir, "soak.json"), "utf8");
    const soakUpdated = JSON.parse(soakRaw) as Record<string, unknown>;
    expect(Object.keys(soakUpdated)).not.toContain(AGENT);

    // Step 6: Verify a new revert commit was created (not a reset).
    const logOutput = git(repoPath, ["log", "--oneline", "-3"]).stdout;
    expect(logOutput).toContain("Revert");
    expect(logOutput).not.toContain("reset");

    // Step 7: Verify no force-push marker in reflog.
    const reflogOutput = git(repoPath, ["reflog", "--all"]).stdout;
    expect(reflogOutput).not.toContain("forced-update");

    // Step 8: Verify event was emitted.
    const eventsPath = join(repoPath, ".claude", "logs", "events.jsonl");
    expect(existsSync(eventsPath)).toBe(true);
    const eventsRaw = readFileSync(eventsPath, "utf8");
    const events = eventsRaw
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    const revertEvent = events.find((e: Record<string, unknown>) => e.event === "gepa_soak_revert");
    expect(revertEvent).toBeDefined();
    expect(revertEvent.agent).toBe(AGENT);
    expect(typeof revertEvent.revert_commit).toBe("string");
  });
});

describe("gepa-revert — AC-6 NEVER git reset, NEVER git push --force", () => {
  it("gepa-revert uses git revert, not git reset — reflog shows no forced-update", async () => {
    const AGENT = "backend-dev";

    addAgentAndCommit(repoPath, AGENT, "# Backend Agent\nOriginal.\n", "docs: backend agent");
    addAgentAndCommit(
      repoPath,
      AGENT,
      "# Backend Agent\nPromoted.\n",
      `chore(gepa): promote ${AGENT} from cycle aaaa-bbbb`
    );

    await runGepaRevertCmd(repoPath, ["--agent", AGENT]);

    // reflog must not contain force-based operations.
    const reflog = String(git(repoPath, ["reflog", "--all"]).stdout);
    expect(reflog).not.toContain("forced-update");
    expect(reflog).not.toContain("reset");

    // HEAD should be ahead of the promotion commit (revert adds a new commit).
    const log = String(git(repoPath, ["log", "--oneline"]).stdout);
    const logLines = log
      .trim()
      .split("\n")
      .filter((l: string) => l.length > 0);
    // Revert commit + promotion commit + original + init = 4 commits.
    expect(logLines.length).toBeGreaterThanOrEqual(3);
    expect(logLines[0]).toMatch(/Revert/i);
  });
});
