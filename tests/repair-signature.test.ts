/**
 * tests/repair-signature.test.ts — dev-team#257 piece 3.
 *
 * Covers normalizeSignature() normalization rules and
 * createRepairSignatureTracker()'s consecutive-repeat stop decision.
 */

import { describe, expect, test } from "bun:test";
import { createRepairSignatureTracker, normalizeSignature } from "../scripts/lib/repair-signature.ts";

describe("normalizeSignature", () => {
  test("returns '' for undefined/null/empty input", () => {
    expect(normalizeSignature(undefined)).toBe("");
    expect(normalizeSignature(null)).toBe("");
    expect(normalizeSignature("")).toBe("");
    expect(normalizeSignature("   \n\n  ")).toBe("");
  });

  test("takes the first non-empty line", () => {
    expect(normalizeSignature("\n\n  TypeError: x is not a function\nat foo.ts:12")).toBe(
      "TypeError: x is not a function"
    );
  });

  test("collapses internal whitespace", () => {
    expect(normalizeSignature("expected   2   tests\tto pass")).toBe("expected 2 tests to pass");
  });

  test("strips bare line:column noise", () => {
    expect(normalizeSignature("assert failed at 42:7 in check")).toBe(
      "assert failed at <path> in check"
    );
  });

  test("normalizes absolute paths (posix and windows) to <path>", () => {
    expect(normalizeSignature("Error in /home/user/repo/src/foo.ts")).toBe(
      "Error in <path>"
    );
    expect(normalizeSignature("Error in C:\\work\\repo\\src\\foo.ts")).toBe(
      "Error in <path>"
    );
  });

  test("two retries hitting the same failure at a different line/path compare equal", () => {
    const a = normalizeSignature("FAIL /repo/a/foo.test.ts:10:3 - expected true, got false");
    const b = normalizeSignature("FAIL /repo/b/foo.test.ts:55:9 - expected true, got false");
    expect(normalizeSignature(a)).toBe(normalizeSignature(b));
  });
});

describe("createRepairSignatureTracker — shouldStop", () => {
  test("same signature twice in a row stops (default N=2)", () => {
    const tracker = createRepairSignatureTracker();
    expect(tracker.shouldStop("sig-a")).toBe(false);
    expect(tracker.shouldStop("sig-a")).toBe(true);
  });

  test("alternating signatures never stop", () => {
    const tracker = createRepairSignatureTracker();
    expect(tracker.shouldStop("sig-a")).toBe(false);
    expect(tracker.shouldStop("sig-b")).toBe(false);
    expect(tracker.shouldStop("sig-a")).toBe(false);
    expect(tracker.shouldStop("sig-b")).toBe(false);
  });

  test("N override — requires stopAfterRepeats consecutive repeats", () => {
    const tracker = createRepairSignatureTracker({ stopAfterRepeats: 3 });
    expect(tracker.shouldStop("sig-a")).toBe(false);
    expect(tracker.shouldStop("sig-a")).toBe(false);
    expect(tracker.shouldStop("sig-a")).toBe(true);
  });

  test("a break in the streak resets the count", () => {
    const tracker = createRepairSignatureTracker({ stopAfterRepeats: 2 });
    expect(tracker.shouldStop("sig-a")).toBe(false);
    expect(tracker.shouldStop("sig-b")).toBe(false);
    expect(tracker.shouldStop("sig-a")).toBe(false);
    expect(tracker.shouldStop("sig-a")).toBe(true);
  });

  test("empty/undefined signature never stops, regardless of prior streak", () => {
    const tracker = createRepairSignatureTracker();
    expect(tracker.shouldStop("sig-a")).toBe(false);
    expect(tracker.shouldStop("")).toBe(false);
    expect(tracker.shouldStop(undefined)).toBe(false);
    expect(tracker.shouldStop(null as unknown as string)).toBe(false);
  });

  test("reset() clears tracked history", () => {
    const tracker = createRepairSignatureTracker();
    expect(tracker.shouldStop("sig-a")).toBe(false);
    tracker.reset();
    expect(tracker.shouldStop("sig-a")).toBe(false);
  });

  test("stopAfterRepeats=1 stops on the very first signature", () => {
    const tracker = createRepairSignatureTracker({ stopAfterRepeats: 1 });
    expect(tracker.shouldStop("sig-a")).toBe(true);
  });
});
