// TDD: Wave 1.5 — fix runner-plugin issue #360 (capture tee/trial guard
// doesn't bound OS-process wall-time; unguarded fireCaptureTeeSilent on the
// hot artifact-write path).
//
// guarded-fire.ts is the shared timeout-race helper extracted from
// capture-failure-trial-guard.ts (DRY: single place to tune the ceiling,
// reused by both the tee capture path in write.ts and the failure-trial
// guard). Two properties matter:
//   1. The returned promise resolves at min(fn duration, timeoutMs) — never
//      hangs, never throws.
//   2. The internal race timer is `.unref()`'d, so a fire-and-forget caller
//      that never awaits the result does not keep the OS process alive for
//      the full timeoutMs — this is the actual root cause fix for #360
//      (a *ref'd* setTimeout inside a Promise.race keeps ticking in the
//      background even after the race resolves via the other branch,
//      forcing every CLI invocation to pay the full ceiling in wall-clock
//      process lifetime, even on the fast/warm path).
//
// Platform note baked into every test below: on Bun/Windows, an unref'd
// timer raced against a competitor that holds NO handle of its own (e.g. a
// bare `new Promise(() => {})`) never gets a chance to fire — with nothing
// else pumping the event loop, the loop never advances to the timer's
// deadline, and the process hangs rather than exiting or resolving. That
// is a property of "nothing is happening," not a defect in this module:
// every REAL wrapped fn (a dynamic import, an fs write, a real setTimeout)
// holds its own genuine handle and keeps the loop pumping, which is
// exactly what lets the guard's unref'd timer fire on schedule. So every
// test here races against a "slow but real" competitor (backed by its own
// timer) rather than a handle-less stand-in — this avoids the platform
// stall AND matches the scenario the guard actually handles in production
// (a slow dynamic import, never a promise that holds nothing at all). No
// test in this suite relies on being force-killed — every test terminates
// on its own.
import { describe, expect, test } from "bun:test";
import { fireGuarded } from "../../scripts/lib/gepa/guarded-fire.ts";

function slowButReal(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("fireGuarded", () => {
  test("resolves within the timeout budget when the wrapped fn is slower", async () => {
    const t0 = performance.now();
    await fireGuarded(() => slowButReal(5000), 50);
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(500);
  });

  test("still runs the wrapped fn to completion on the fast/normal path", async () => {
    let ran = false;
    await fireGuarded(async () => {
      ran = true;
    }, 1500);
    expect(ran).toBe(true);
  });

  test("never propagates when the wrapped fn rejects", async () => {
    await expect(
      fireGuarded(async () => {
        throw new Error("boom");
      }, 1500)
    ).resolves.toBeUndefined();
  });

  test("never propagates when the wrapped fn throws synchronously", async () => {
    await expect(
      fireGuarded(() => {
        throw new Error("boom-sync");
      }, 1500)
    ).resolves.toBeUndefined();
  });

  // The critical regression test for #360: a detached (unawaited) guarded
  // call whose wrapped fn is FAST (the realistic warm path) must not force
  // the hosting process to linger for the full ceiling. If the race timer
  // were ref'd (pre-fix behavior), the process would have to wait out the
  // full 5s ceiling before Bun/Node considers the event loop empty, even
  // though the real work finished in ~10ms. With the timer unref'd, the
  // process exits as soon as its own remaining work (none, here) is done —
  // total wall time should be dominated by Bun's own startup cost, not by
  // the ceiling. This test always completes on its own (bounded by the
  // child's natural exit, not a kill).
  test("guard timer is unref'd — a detached fast call does not hold the process open for the ceiling", async () => {
    const cwd = process.cwd().replace(/\\/g, "/");
    const t0 = performance.now();
    const child = Bun.spawn({
      cmd: [
        "bun",
        "run",
        "-e",
        `
        const { fireGuarded } = await import("${cwd}/scripts/lib/gepa/guarded-fire.ts");
        async function fastFn() {
          await new Promise((r) => setTimeout(r, 10));
        }
        // Fire-and-forget: never awaited. Ceiling is deliberately huge (5s)
        // so a ref'd-timer regression would make this test obviously slow.
        void fireGuarded(fastFn, 5000);
        `
      ],
      stdout: "pipe",
      stderr: "pipe"
    });
    await child.exited;
    const elapsed = performance.now() - t0;
    // Bun process startup alone is typically several hundred ms; the
    // regression this guards against is a full extra 5s tacked on top.
    expect(elapsed).toBeLessThan(3000);
  }, 10_000);
});
