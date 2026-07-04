/**
 * tests/gepa/optimize-no-winner-streak.test.ts — SLICE-99
 *
 * Covers AC-7 (streak increments on no-winner, blocks at 3),
 * AC-8 (gepa-resume clears streak), and
 * AC-9 (winner resets streak to 0).
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  checkStreakHalt,
  getStreakCount,
  incrementStreak,
  resetStreak,
  NO_WINNER_STREAK_HALT
} from "../../scripts/lib/gepa/no-winner-streak-tracker.ts";
import { runGepaOptimizeCmd, runGepaResumeCmd } from "../../scripts/lib/gepa/gepa-optimize-cmd.ts";

function tmpStreakPath(): { repoPath: string; streakPath: string } {
  const repoPath = mkdtempSync(join(tmpdir(), "gepa-streak-"));
  const streakDir = join(repoPath, ".claude", "artifacts", "crew", "gepa");
  mkdirSync(streakDir, { recursive: true });
  const streakPath = join(streakDir, "no-winner-streak.json");
  return { repoPath, streakPath };
}

function setupRepoWithAgent(repoPath: string): void {
  const agentsDir = join(repoPath, "agents");
  mkdirSync(agentsDir, { recursive: true });
  writeFileSync(join(agentsDir, "fullstack-dev.md"), "# Champion\n" + "line\n".repeat(5), "utf8");
}

// ── Unit tests for streak tracker ──────────────────────────────────────────

describe("SLICE-99 AC-7 — streak tracker unit", () => {
  test("initial streak is 0", () => {
    const { repoPath, streakPath } = tmpStreakPath();
    const count = getStreakCount("fullstack-dev", { repoPath, streakPath });
    expect(count).toBe(0);
  });

  test("increment increments streak by 1", () => {
    const { repoPath, streakPath } = tmpStreakPath();
    const next = incrementStreak("fullstack-dev", { repoPath, streakPath });
    expect(next).toBe(1);
    expect(getStreakCount("fullstack-dev", { repoPath, streakPath })).toBe(1);
  });

  test("three increments → halted = true", () => {
    const { repoPath, streakPath } = tmpStreakPath();
    incrementStreak("fullstack-dev", { repoPath, streakPath });
    incrementStreak("fullstack-dev", { repoPath, streakPath });
    incrementStreak("fullstack-dev", { repoPath, streakPath });
    const check = checkStreakHalt("fullstack-dev", { repoPath, streakPath });
    expect(check.halted).toBe(true);
    expect(check.streak).toBe(3);
  });

  test("two increments → halted = false", () => {
    const { repoPath, streakPath } = tmpStreakPath();
    incrementStreak("fullstack-dev", { repoPath, streakPath });
    incrementStreak("fullstack-dev", { repoPath, streakPath });
    const check = checkStreakHalt("fullstack-dev", { repoPath, streakPath });
    expect(check.halted).toBe(false);
  });

  test("NO_WINNER_STREAK_HALT constant is 3", () => {
    expect(NO_WINNER_STREAK_HALT).toBe(3);
  });

  test("streaks are agent-scoped", () => {
    const { repoPath, streakPath } = tmpStreakPath();
    incrementStreak("fullstack-dev", { repoPath, streakPath });
    incrementStreak("fullstack-dev", { repoPath, streakPath });
    incrementStreak("fullstack-dev", { repoPath, streakPath });
    // Reviewer is unaffected.
    const reviewerCheck = checkStreakHalt("reviewer", { repoPath, streakPath });
    expect(reviewerCheck.halted).toBe(false);
    expect(reviewerCheck.streak).toBe(0);
  });
});

// ── AC-8: gepa-resume clears streak ────────────────────────────────────────

describe("SLICE-99 AC-8 — gepa-resume clears streak", () => {
  test("resetStreak sets count to 0", () => {
    const { repoPath, streakPath } = tmpStreakPath();
    incrementStreak("fullstack-dev", { repoPath, streakPath });
    incrementStreak("fullstack-dev", { repoPath, streakPath });
    incrementStreak("fullstack-dev", { repoPath, streakPath });
    expect(checkStreakHalt("fullstack-dev", { repoPath, streakPath }).halted).toBe(true);

    resetStreak("fullstack-dev", { repoPath, streakPath });
    expect(getStreakCount("fullstack-dev", { repoPath, streakPath })).toBe(0);
    expect(checkStreakHalt("fullstack-dev", { repoPath, streakPath }).halted).toBe(false);
  });

  test("runGepaResumeCmd clears streak and subsequent optimize proceeds", async () => {
    const { repoPath } = tmpStreakPath();
    setupRepoWithAgent(repoPath);

    // Manually set streak to 3 via incrementStreak.
    incrementStreak("fullstack-dev", { repoPath });
    incrementStreak("fullstack-dev", { repoPath });
    incrementStreak("fullstack-dev", { repoPath });

    // Verify optimize is blocked.
    const blockedResult = await runGepaOptimizeCmd(repoPath, [
      "fullstack-dev",
      "--budget",
      "10",
      "--k",
      "2",
      "--artifact-only"
    ]);
    expect(blockedResult.exitCode).toBe(3);
    expect(blockedResult.stderr).toContain("no_winner_streak: 3");
    expect(blockedResult.stderr).toContain("gepa-resume");

    // Run resume.
    const resumeResult = await runGepaResumeCmd(repoPath, ["fullstack-dev"]);
    expect(resumeResult.exitCode).toBe(0);
    expect(resumeResult.stdout).toContain("cleared");

    // Now optimize proceeds.
    const afterResult = await runGepaOptimizeCmd(repoPath, [
      "fullstack-dev",
      "--budget",
      "10",
      "--k",
      "2",
      "--artifact-only"
    ]);
    expect(afterResult.exitCode).toBe(0);
  });

  test("runGepaResumeCmd without agent → exit 2", async () => {
    const { repoPath } = tmpStreakPath();
    const result = await runGepaResumeCmd(repoPath, []);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("usage:");
  });
});

// ── AC-9: winner resets streak ─────────────────────────────────────────────

describe("SLICE-99 AC-9 — winner resets streak to 0", () => {
  test("resetStreak after any winning cycle resets to 0", () => {
    const { repoPath, streakPath } = tmpStreakPath();
    // Pre-populate with 2 no-winner cycles.
    incrementStreak("fullstack-dev", { repoPath, streakPath });
    incrementStreak("fullstack-dev", { repoPath, streakPath });
    expect(getStreakCount("fullstack-dev", { repoPath, streakPath })).toBe(2);

    // Simulate a winning cycle: resetStreak is called by the optimize runner.
    resetStreak("fullstack-dev", { repoPath, streakPath });
    expect(getStreakCount("fullstack-dev", { repoPath, streakPath })).toBe(0);
  });

  test("streak state is preserved across process restarts (persistent file)", () => {
    const { repoPath, streakPath } = tmpStreakPath();
    // Write streak via one instance of the tracker.
    incrementStreak("fullstack-dev", { repoPath, streakPath });
    incrementStreak("fullstack-dev", { repoPath, streakPath });

    // Read it via a fresh call (simulating new process).
    const count = getStreakCount("fullstack-dev", { repoPath, streakPath });
    expect(count).toBe(2);
  });

  test("streak file JSON is valid after atomic write", () => {
    const { repoPath, streakPath } = tmpStreakPath();
    incrementStreak("fullstack-dev", { repoPath, streakPath });
    const raw = readFileSync(streakPath, "utf8");
    expect(() => JSON.parse(raw)).not.toThrow();
    const parsed = JSON.parse(raw);
    expect(parsed["fullstack-dev"]).toBe(1);
  });
});

// ── AC-7 integration: optimize blocked at streak=3 ─────────────────────────

describe("SLICE-99 AC-7 — optimize blocked when streak >= 3", () => {
  test("optimize exits 3 with descriptive message when streak = 3", async () => {
    const { repoPath } = tmpStreakPath();
    setupRepoWithAgent(repoPath);

    // Pre-populate streak to 3.
    incrementStreak("fullstack-dev", { repoPath });
    incrementStreak("fullstack-dev", { repoPath });
    incrementStreak("fullstack-dev", { repoPath });

    const result = await runGepaOptimizeCmd(repoPath, [
      "fullstack-dev",
      "--budget",
      "10",
      "--artifact-only"
    ]);
    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("no_winner_streak: 3");
    expect(result.stderr).toContain("gepa-resume fullstack-dev");
  });

  test("optimize with streak=2 proceeds normally", async () => {
    const { repoPath } = tmpStreakPath();
    setupRepoWithAgent(repoPath);

    incrementStreak("fullstack-dev", { repoPath });
    incrementStreak("fullstack-dev", { repoPath });

    const result = await runGepaOptimizeCmd(repoPath, [
      "fullstack-dev",
      "--budget",
      "10",
      "--k",
      "2",
      "--artifact-only"
    ]);
    expect(result.exitCode).toBe(0);
  });
});
