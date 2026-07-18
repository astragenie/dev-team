/**
 * tests/gepa/auto-pr-shape.test.ts — SLICE-105
 *
 * Covers AC-1, AC-7, AC-8, AC-9, AC-10:
 *   AC-1: runAutoPr creates the correct branch, commits with the right message,
 *         and the PR body contains the required literal strings.
 *   AC-7: winner prompt hash == champion hash → no PR opened, no_op_promotion=true.
 *   AC-8: branch collision → retry suffix (-retry-1) OR exit with gepa_branch_collision;
 *         NEVER --force.
 *   AC-9: gh not authenticated → GhAuthError thrown BEFORE any branch creation.
 *   AC-10: PR labels include gepa, agent:<agent>, and protection label.
 *
 * Implementation approach:
 *   - Creates a real git repo in a temp dir (git init + initial commit).
 *   - Shimmed `gh` and `git` binaries that record calls to a log file
 *     so the tests can assert on what was invoked.
 *
 * Note: git operations run against a real local repo; `gh` is fully shimmed.
 */

import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { runAutoPr, GhAuthError } from "../../scripts/lib/gepa/auto-pr.ts";
import { GhAbsentError } from "../../scripts/lib/gepa/branch-protection-check.ts";
import type { OptimizationResult } from "../../scripts/lib/gepa/optimize-runner.ts";

// ── Constants ─────────────────────────────────────────────────────────────────

const AGENT = "fullstack-dev";
const TRIAL_UUID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const CYCLE_UUID = "cccccccc-dddd-4eee-8fff-000000000000";
const RUN_UUID = CYCLE_UUID;

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeOptResult(overrides: Partial<OptimizationResult> = {}): OptimizationResult {
  return {
    run_id: RUN_UUID,
    cycle_id: CYCLE_UUID,
    agent: AGENT,
    k: 5,
    candidates_evaluated: 5,
    partial: false,
    no_winner: false,
    winner: {
      candidate_id: TRIAL_UUID,
      pareto_rank: 1,
      score: 0.9,
      pass: true,
      cost_usd: 0.001234,
      latency_ms: 850,
      prompt_path: "" // filled in per-test
    },
    trials: [],
    generator_mode: "synthetic",
    started_at: "2026-07-02T10:00:00.000Z",
    finished_at: "2026-07-02T10:05:00.000Z",
    ...overrides
  };
}

// ── Git repo setup ────────────────────────────────────────────────────────────

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

function initGitRepo(dir: string, originDir: string): void {
  // Create a bare repo as origin.
  mkdirSync(originDir, { recursive: true });
  spawnSync("git", ["init", "--bare", "-b", "main", originDir], { encoding: "utf8" });

  // Init the working repo.
  git(dir, ["init", "-b", "main"]);
  git(dir, ["config", "user.email", "test@test.com"]);
  git(dir, ["config", "user.name", "Test"]);
  git(dir, ["remote", "add", "origin", originDir]);
  writeFileSync(join(dir, "README.md"), "# test\n", "utf8");
  git(dir, ["add", "README.md"]);
  git(dir, ["commit", "-m", "init"]);
  git(dir, ["push", "origin", "main"]);
}

function setupAgentFile(repoPath: string, content: string): string {
  const agentsDir = join(repoPath, "agents");
  mkdirSync(agentsDir, { recursive: true });
  const agentPath = join(agentsDir, `${AGENT}.md`);
  writeFileSync(agentPath, content, "utf8");
  git(repoPath, ["add", agentPath]);
  git(repoPath, ["commit", "-m", "add agent"]);
  // Push to origin so that `git checkout -b <branch> origin/main` finds the file.
  git(repoPath, ["push", "origin", "main"]);
  return agentPath;
}

function writeCandidateFile(repoPath: string, content: string): string {
  const dir = join(repoPath, ".claude", "artifacts", "crew", "gepa", "candidates", CYCLE_UUID);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${TRIAL_UUID}.md`);
  writeFileSync(path, content, "utf8");
  return path;
}

// ── gh shim builder ───────────────────────────────────────────────────────────

interface ShimResponse {
  matchArgs?: string;
  exitCode: number;
  stdout: string;
  stderr?: string;
}

/**
 * Write a Node.js-based `gh` shim that records calls to callLog and returns
 * canned responses.
 *
 * On Windows, writes a .cmd wrapper; on POSIX a shell wrapper.
 */
function writeGhShim(dir: string, callLog: string, responses: ShimResponse[]): string {
  mkdirSync(dir, { recursive: true });
  const shimMjs = join(dir, "gh-impl.mjs");
  // The shim:
  //   1. Flattens all argv elements into a JSON array written to callLog
  //      (so multiline --body values are preserved).
  //   2. Matches against the flat joined string for response selection.
  const script = [
    `import { appendFileSync } from "node:fs";`,
    `const argv = process.argv.slice(2);`,
    `const args = argv.join(" ");`,
    // Write each call as a JSON array line so multiline body is preserved.
    `appendFileSync(${JSON.stringify(callLog)}, JSON.stringify(argv) + "\\n");`,
    `const responses = ${JSON.stringify(responses)};`,
    `for (const r of responses) {`,
    `  if (!r.matchArgs || args.includes(r.matchArgs)) {`,
    `    if (r.stdout) process.stdout.write(r.stdout);`,
    `    if (r.stderr) process.stderr.write(r.stderr || "");`,
    `    process.exit(r.exitCode);`,
    `  }`,
    `}`,
    `process.exit(1);`
  ].join("\n");
  writeFileSync(shimMjs, script, "utf8");

  if (process.platform === "win32") {
    const cmdPath = join(dir, "gh.cmd");
    writeFileSync(cmdPath, `@node "${shimMjs}" %*\r\n`, "utf8");
    return cmdPath;
  }

  const shimPath = join(dir, "gh");
  writeFileSync(shimPath, `#!/bin/sh\nexec node "${shimMjs}" "$@"\n`, { mode: 0o755 });
  return shimPath;
}

// ── Test setup ────────────────────────────────────────────────────────────────

let tmpDir: string;
let repoPath: string;
let originPath: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "auto-pr-test-"));
  repoPath = join(tmpDir, "repo");
  originPath = join(tmpDir, "origin.git");
  mkdirSync(repoPath);
  initGitRepo(repoPath, originPath);
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ── AC-9: gh not authenticated ────────────────────────────────────────────────

describe("runAutoPr — AC-9 gh not authenticated", () => {
  it("throws GhAuthError BEFORE any branch creation when gh auth fails", () => {
    const callLog = join(tmpDir, "gh-calls.txt");
    const shimDir = join(tmpDir, "bin-auth");
    writeGhShim(shimDir, callLog, [
      { matchArgs: "auth status", exitCode: 1, stdout: "", stderr: "Not logged in\n" }
    ]);

    setupAgentFile(repoPath, "# Agent\nBody content.\n");
    const candidatePath = writeCandidateFile(repoPath, "# Different content\nModified body.\n");

    const result = makeOptResult();
    result.winner!.prompt_path = candidatePath;

    const ghPath = join(shimDir, process.platform === "win32" ? "gh.cmd" : "gh");

    let threw = false;
    let thrownErr: unknown;
    try {
      runAutoPr({ repoPath, agent: AGENT, result, ghPath, repo: "myorg/myrepo" });
    } catch (err) {
      threw = true;
      thrownErr = err;
    }

    expect(threw).toBe(true);
    expect(thrownErr).toBeInstanceOf(GhAuthError);

    // No branch should have been created.
    const branchCheck = spawnSync("git", ["branch", "--list", `gepa/${AGENT}/*`], {
      cwd: repoPath,
      encoding: "utf8"
    });
    expect(branchCheck.stdout.trim()).toBe("");
  });

  it("throws GhAbsentError when gh binary does not exist", () => {
    setupAgentFile(repoPath, "# Agent\nBody.\n");
    const candidatePath = writeCandidateFile(repoPath, "# Different\n");
    const result = makeOptResult();
    result.winner!.prompt_path = candidatePath;

    let threw = false;
    let thrownErr: unknown;
    try {
      runAutoPr({
        repoPath,
        agent: AGENT,
        result,
        ghPath: join(tmpDir, "nonexistent-gh"),
        repo: "myorg/myrepo"
      });
    } catch (err) {
      threw = true;
      thrownErr = err;
    }
    expect(threw).toBe(true);
    expect(thrownErr).toBeInstanceOf(GhAbsentError);
  });
});

// ── AC-7: no-op promotion ─────────────────────────────────────────────────────

describe("runAutoPr — AC-7 no-op promotion (same hash)", () => {
  it("returns no_op_promotion:true when winner content == champion content", () => {
    const body = "# Agent\nSame content in both files.\n";
    setupAgentFile(repoPath, body);
    const candidatePath = writeCandidateFile(repoPath, body);

    const callLog = join(tmpDir, "gh-calls-noop.txt");
    const shimDir = join(tmpDir, "bin-noop");
    writeGhShim(shimDir, callLog, [
      // auth should not even be reached — but just in case
      { matchArgs: "auth status", exitCode: 0, stdout: "Logged in\n" }
    ]);
    const ghPath = join(shimDir, process.platform === "win32" ? "gh.cmd" : "gh");

    const result = makeOptResult();
    result.winner!.prompt_path = candidatePath;

    const prResult = runAutoPr({ repoPath, agent: AGENT, result, ghPath, repo: "myorg/myrepo" });

    expect(prResult.pr_opened).toBe(false);
    expect(prResult.no_op_promotion).toBe(true);

    // No gh auth call should have been made (returned before auth check).
    // The callLog should either not exist or be empty.
    const calls = existsSync(callLog) ? readFileSync(callLog, "utf8") : "";
    expect(calls).toBe("");
  });
});

// ── AC-1: successful PR opened ────────────────────────────────────────────────

describe("runAutoPr — AC-1 successful auto-PR", () => {
  it("creates correct branch name, commits with right message, PR body has required strings", () => {
    const championContent = "# Agent\nLine 1.\nLine 2.\n";
    const winnerContent = "# Agent\nLine 1.\nLine 2 — improved.\n";
    setupAgentFile(repoPath, championContent);
    const candidatePath = writeCandidateFile(repoPath, winnerContent);

    const callLog = join(tmpDir, "gh-calls-ac1.txt");
    const shimDir = join(tmpDir, "bin-ac1");
    const prUrl = "https://github.com/myorg/myrepo/pull/42";

    writeGhShim(shimDir, callLog, [
      { matchArgs: "auth status", exitCode: 0, stdout: "Logged in\n" },
      {
        matchArgs: "branches/main/protection",
        exitCode: 0,
        stdout: JSON.stringify({
          required_status_checks: {
            checks: [{ context: "ci/test", app_id: null }],
            contexts: ["ci/test"]
          }
        })
      },
      // gh pr create
      { matchArgs: "pr create", exitCode: 0, stdout: `${prUrl}\n` },
      // gh pr edit --add-label
      { matchArgs: "pr edit", exitCode: 0, stdout: "" }
    ]);

    const ghPath = join(shimDir, process.platform === "win32" ? "gh.cmd" : "gh");
    const result = makeOptResult();
    result.winner!.prompt_path = candidatePath;

    const prResult = runAutoPr({
      repoPath,
      agent: AGENT,
      result,
      ghPath,
      repo: "myorg/myrepo"
    });

    expect(prResult.pr_opened).toBe(true);
    expect(prResult.pr_url).toBe(prUrl);
    // Branch name must be `gepa/<agent>/<trial-id>`.
    expect(prResult.branch).toBe(`gepa/${AGENT}/${TRIAL_UUID}`);

    // Verify the commit message.
    const log = spawnSync("git", ["log", "--oneline", "-1"], {
      cwd: repoPath,
      encoding: "utf8"
    });
    expect(log.stdout).toContain(`chore(gepa): promote ${AGENT} from cycle ${CYCLE_UUID}`);

    // Verify PR body strings — body is passed via --body-file (not inline).
    const callLines = readFileSync(callLog, "utf8")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l) as string[]);
    const prCreateCall = callLines.find((a) => a[0] === "pr" && a[1] === "create");
    expect(prCreateCall).toBeDefined();
    const bodyFileIdx = prCreateCall!.indexOf("--body-file");
    expect(bodyFileIdx).toBeGreaterThan(-1);
    const bodyFilePath = prCreateCall![bodyFileIdx + 1] ?? "";
    expect(existsSync(bodyFilePath)).toBe(true);
    const bodyValue = readFileSync(bodyFilePath, "utf8");
    expect(bodyValue).toContain("Pareto rank");
    expect(bodyValue).toContain("held-out pass");
    expect(bodyValue).toContain("cost delta");
    expect(bodyValue).toContain(`${RUN_UUID}.json`);
  });
});

// ── AC-8: branch collision ────────────────────────────────────────────────────

describe("runAutoPr — AC-8 branch collision → retry suffix (no force-push)", () => {
  it("appends -retry-1 suffix when the branch already exists on origin", () => {
    const championContent = "# Agent\nOriginal.\n";
    const winnerContent = "# Agent\nImproved.\n";
    setupAgentFile(repoPath, championContent);
    const candidatePath = writeCandidateFile(repoPath, winnerContent);

    // Create and push the base branch to origin to simulate a collision.
    const baseBranch = `gepa/${AGENT}/${TRIAL_UUID}`;
    git(repoPath, ["checkout", "-b", baseBranch]);
    git(repoPath, ["push", "origin", baseBranch]);
    git(repoPath, ["checkout", "main"]);

    const callLog = join(tmpDir, "gh-calls-ac8.txt");
    const shimDir = join(tmpDir, "bin-ac8");
    const prUrl = "https://github.com/myorg/myrepo/pull/43";

    writeGhShim(shimDir, callLog, [
      { matchArgs: "auth status", exitCode: 0, stdout: "Logged in\n" },
      {
        matchArgs: "branches/main/protection",
        exitCode: 1,
        stdout: '{"message":"Not Found"}',
        stderr: "Not Found\n"
      },
      { matchArgs: "pr create", exitCode: 0, stdout: `${prUrl}\n` },
      { matchArgs: "pr edit", exitCode: 0, stdout: "" }
    ]);

    const ghPath = join(shimDir, process.platform === "win32" ? "gh.cmd" : "gh");
    const result = makeOptResult();
    result.winner!.prompt_path = candidatePath;

    // runAutoPr detects the collision and should use the -retry-1 suffix.
    const prResult = runAutoPr({
      repoPath,
      agent: AGENT,
      result,
      ghPath,
      repo: "myorg/myrepo"
    });

    // Should have opened a PR with the retry branch.
    expect(prResult.pr_opened).toBe(true);
    expect(prResult.branch).toBe(`${baseBranch}-retry-1`);

    // Verify no --force flag was used in push.
    // gh calls don't include git push, but verify reflog is clean.
    const reflog = git(repoPath, ["reflog", "--all"]);
    expect(reflog.stdout).not.toContain("forced-update");
  });
});

// ── AC-10: PR labels ──────────────────────────────────────────────────────────

describe("runAutoPr — AC-10 PR labels", () => {
  it("applies gepa, agent:fullstack-dev, branch_protection_present when protection enforced", () => {
    const championContent = "# Agent\nBody.\n";
    const winnerContent = "# Agent\nImproved body.\n";
    setupAgentFile(repoPath, championContent);
    const candidatePath = writeCandidateFile(repoPath, winnerContent);

    const callLog = join(tmpDir, "gh-calls-ac10-present.txt");
    const shimDir = join(tmpDir, "bin-ac10-present");
    const prUrl = "https://github.com/myorg/myrepo/pull/44";

    writeGhShim(shimDir, callLog, [
      { matchArgs: "auth status", exitCode: 0, stdout: "Logged in\n" },
      {
        matchArgs: "branches/main/protection",
        exitCode: 0,
        stdout: JSON.stringify({
          required_status_checks: {
            checks: [{ context: "ci/build", app_id: null }],
            contexts: ["ci/build"]
          }
        })
      },
      { matchArgs: "pr create", exitCode: 0, stdout: `${prUrl}\n` },
      { matchArgs: "pr edit", exitCode: 0, stdout: "" }
    ]);

    const ghPath = join(shimDir, process.platform === "win32" ? "gh.cmd" : "gh");
    const result = makeOptResult();
    result.winner!.prompt_path = candidatePath;

    runAutoPr({ repoPath, agent: AGENT, result, ghPath, repo: "myorg/myrepo" });

    const calls = readFileSync(callLog, "utf8");
    expect(calls).toContain("gepa");
    expect(calls).toContain(`agent:${AGENT}`);
    expect(calls).toContain("branch_protection_present");
    expect(calls).not.toContain("branch_protection_missing");
  });

  it("applies branch_protection_missing and opens --draft when protection absent", () => {
    const championContent = "# Agent\nBody.\n";
    const winnerContent = "# Agent\nDraft improved body.\n";
    setupAgentFile(repoPath, championContent);
    const candidatePath = writeCandidateFile(repoPath, winnerContent);

    const callLog = join(tmpDir, "gh-calls-ac10-missing.txt");
    const shimDir = join(tmpDir, "bin-ac10-missing");
    const prUrl = "https://github.com/myorg/myrepo/pull/45";

    writeGhShim(shimDir, callLog, [
      { matchArgs: "auth status", exitCode: 0, stdout: "Logged in\n" },
      {
        matchArgs: "branches/main/protection",
        exitCode: 1,
        stdout: '{"message":"Not Found"}',
        stderr: "Not Found\n"
      },
      { matchArgs: "pr create", exitCode: 0, stdout: `${prUrl}\n` },
      { matchArgs: "pr edit", exitCode: 0, stdout: "" }
    ]);

    const ghPath = join(shimDir, process.platform === "win32" ? "gh.cmd" : "gh");
    const result = makeOptResult();
    result.winner!.prompt_path = candidatePath;

    runAutoPr({ repoPath, agent: AGENT, result, ghPath, repo: "myorg/myrepo" });

    const calls = readFileSync(callLog, "utf8");
    expect(calls).toContain("branch_protection_missing");
    expect(calls).toContain("--draft");
    expect(calls).not.toContain("branch_protection_present");
  });
});
