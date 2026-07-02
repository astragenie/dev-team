/**
 * scripts/lib/gepa/no-winner-streak-tracker.ts — SLICE-99
 *
 * Persisted no-winner streak tracker. After 3 consecutive no-winner cycles
 * on the same agent, the next /crew:gepa-optimize <agent> invocation exits
 * non-zero before calling CandidateGenerator.generate.
 *
 * Streak state is persisted to:
 *   .claude/artifacts/crew/gepa/no-winner-streak.json
 *
 * Writes are atomic (tmp + rename) so a crash between write calls cannot
 * corrupt the persisted state.
 *
 * /crew:gepa-resume <agent> clears the streak (sets to 0).
 */

import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";

const StreakStateSchema = z.record(z.string(), z.number().int().nonnegative());
type StreakState = z.infer<typeof StreakStateSchema>;

export const NO_WINNER_STREAK_HALT = 3;

function defaultStreakPath(repoPath: string): string {
  return join(repoPath, ".claude", "artifacts", "crew", "gepa", "no-winner-streak.json");
}

function loadStreak(path: string): StreakState {
  if (!existsSync(path)) return {};
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = StreakStateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

/**
 * Atomic write via tmp + rename pattern.
 * Protects against torn reads if the process crashes mid-write.
 */
function atomicWriteStreak(path: string, state: StreakState): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const tmp = `${path}.tmp.${process.pid}`;
  writeFileSync(tmp, JSON.stringify(state, null, 2), "utf8");
  renameSync(tmp, path);
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface StreakCheckResult {
  /** Whether the streak threshold has been reached (3 consecutive no-wins). */
  halted: boolean;
  /** Current streak count for this agent. */
  streak: number;
}

export interface StreakTrackerOpts {
  /** Absolute path to repo root. */
  repoPath: string;
  /**
   * Override streak file path. Used in tests to avoid filesystem collisions.
   */
  streakPath?: string;
}

/**
 * Returns the current streak count for `agent`. Does not modify state.
 */
export function getStreakCount(agent: string, opts: StreakTrackerOpts): number {
  const path = opts.streakPath ?? defaultStreakPath(opts.repoPath);
  const state = loadStreak(path);
  return state[agent] ?? 0;
}

/**
 * Checks whether the streak halt threshold is reached for `agent`.
 * Returns a StreakCheckResult. Does not modify state.
 */
export function checkStreakHalt(agent: string, opts: StreakTrackerOpts): StreakCheckResult {
  const streak = getStreakCount(agent, opts);
  return { halted: streak >= NO_WINNER_STREAK_HALT, streak };
}

/**
 * Increments the no-winner streak for `agent` by 1.
 * Returns the new streak count.
 */
export function incrementStreak(agent: string, opts: StreakTrackerOpts): number {
  const path = opts.streakPath ?? defaultStreakPath(opts.repoPath);
  const state = loadStreak(path);
  const next = (state[agent] ?? 0) + 1;
  state[agent] = next;
  atomicWriteStreak(path, state);
  return next;
}

/**
 * Resets the no-winner streak for `agent` to 0.
 * Called on any winning cycle or after /crew:gepa-resume.
 */
export function resetStreak(agent: string, opts: StreakTrackerOpts): void {
  const path = opts.streakPath ?? defaultStreakPath(opts.repoPath);
  const state = loadStreak(path);
  state[agent] = 0;
  atomicWriteStreak(path, state);
}
