/**
 * tests/gepa/run-with-lock.test.ts — SLICE-98
 *
 * Covers the lock-acquire/run/release flow for the eval CLI wrapper.
 * Uses a tmp lockRoot per test so the file-lock manager is isolated.
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runWithLock } from "../../scripts/lib/gepa/run-with-lock.ts";

function tmpLockRoot(): string {
  return mkdtempSync(join(tmpdir(), "run-with-lock-"));
}

describe("SLICE-98 — runWithLock happy path", () => {
  test("acquires lock, runs fn, returns ok with result", async () => {
    const outcome = await runWithLock(
      { agent: "fullstack-dev", phase: "eval", lockRoot: tmpLockRoot() },
      async () => "fn-result",
    );
    expect(outcome.status).toBe("ok");
    if (outcome.status === "ok") {
      expect(outcome.result).toBe("fn-result");
    }
  });

  test("releases lock after success — subsequent acquire succeeds", async () => {
    const lockRoot = tmpLockRoot();
    const first = await runWithLock(
      { agent: "fullstack-dev", phase: "eval", lockRoot },
      async () => "first",
    );
    expect(first.status).toBe("ok");
    const second = await runWithLock(
      { agent: "fullstack-dev", phase: "eval", lockRoot },
      async () => "second",
    );
    expect(second.status).toBe("ok");
  });
});

describe("SLICE-98 — runWithLock error handling", () => {
  test("fn throws — lock still released, error surfaced via status", async () => {
    const lockRoot = tmpLockRoot();
    const outcome = await runWithLock(
      { agent: "fullstack-dev", phase: "eval", lockRoot },
      async () => {
        throw new Error("boom");
      },
    );
    expect(outcome.status).toBe("error");
    if (outcome.status === "error") {
      expect(outcome.error).toBeInstanceOf(Error);
      expect((outcome.error as Error).message).toBe("boom");
    }
    // Subsequent acquire must succeed — lock was released despite throw.
    const next = await runWithLock(
      { agent: "fullstack-dev", phase: "eval", lockRoot },
      async () => "ok",
    );
    expect(next.status).toBe("ok");
  });

  test("eval phase and optimize phase use independent locks", async () => {
    const lockRoot = tmpLockRoot();
    // Acquire eval lock, hold it open, and try to acquire optimize concurrently.
    let evalReleased = false;
    const evalPromise = runWithLock(
      { agent: "fullstack-dev", phase: "eval", lockRoot },
      async () => {
        // Hold lock until optimize finishes.
        await new Promise((resolve) => setTimeout(resolve, 50));
        evalReleased = true;
        return "eval-done";
      },
    );
    // Optimize uses a different lock file — should succeed in parallel.
    const optimizeOutcome = await runWithLock(
      { agent: "fullstack-dev", phase: "optimize", lockRoot },
      async () => "optimize-done",
    );
    expect(optimizeOutcome.status).toBe("ok");
    expect(evalReleased).toBe(false); // optimize finished BEFORE eval released
    await evalPromise;
  });
});
