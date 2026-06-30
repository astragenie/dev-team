/**
 * scripts/lib/gepa/run-with-lock.ts — SLICE-98
 *
 * Wraps an eval (or any agent-scoped) operation in a `fileLockManager`
 * lock from gepa-core so two concurrent runs cannot corrupt the same
 * `<agent>.jsonl` trial file.
 *
 * Scope choice (matches FEAT-183 SLICE-100 lock design): one lock per
 * (agent, phase) tuple. `phase` is "eval" for /crew:gepa-eval, "optimize"
 * for /crew:gepa-optimize (SLICE-99), "soak" for soak monitor (SLICE-104).
 *
 * If acquisition fails because another process holds the lock, returns
 * a `lock_held` result without invoking the callable. The CLI translates
 * that to exit code 2 and a clear stderr message — no automatic retry
 * (per design spec failure mode: caller decides).
 */

import path from "node:path";
import { fileLockManager } from "@astragenie/gepa-core";

/**
 * Phases recognized by gepa-core's `fileLockManager` today (0.3.x):
 * "eval" and "optimize". Future phases (e.g. "soak" at SLICE-104) require
 * widening the gepa-core enum first.
 */
export type LockPhase = "eval" | "optimize";

const DEFAULT_LOCK_ROOT = path.join(".claude", "artifacts", "crew", "gepa", "locks");

export interface RunWithLockOpts {
  /** Agent name. Forms half of the lock key. */
  agent: string;
  /** Phase — drives the second half of the lock key. */
  phase: LockPhase;
  /**
   * Lock files directory. Default: `.claude/artifacts/crew/gepa/locks/`.
   * Override only in tests.
   */
  lockRoot?: string;
}

export type RunWithLockOutcome<T> =
  | { status: "ok"; result: T }
  | { status: "lock_held"; agent: string; phase: LockPhase; lockPath?: string }
  | { status: "error"; error: unknown };

/**
 * Acquire a lock for (agent, phase), run `fn`, release the lock.
 *
 * The lock is released even if `fn` throws — the error is forwarded to the
 * caller via the `error` status. If `fileLockManager.acquire()` returns
 * null (another process holds the lock), `fn` is never called and the
 * outcome is `lock_held`.
 */
export async function runWithLock<T>(
  opts: RunWithLockOpts,
  fn: () => Promise<T>,
): Promise<RunWithLockOutcome<T>> {
  const manager = fileLockManager(opts.lockRoot ?? DEFAULT_LOCK_ROOT);
  const acquired = await manager.acquire(opts.agent, opts.phase);
  if (!acquired) {
    return {
      status: "lock_held",
      agent: opts.agent,
      phase: opts.phase,
    };
  }
  try {
    const result = await fn();
    return { status: "ok", result };
  } catch (error) {
    return { status: "error", error };
  } finally {
    await acquired.released();
  }
}
