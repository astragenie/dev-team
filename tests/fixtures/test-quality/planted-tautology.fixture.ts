/**
 * FIXTURE — not a real test. Input file for test-quality integration test.
 * Excluded from bun test suite via bunfig.toml test.exclude pattern.
 *
 * Planted signals:
 *   - tautological assert: expect(true).toBe(true) (HIGH)
 *   - over-mocking: ≥5 mock() calls in single test body (MEDIUM)
 */
import { test, expect, mock } from "bun:test";
test("trivially true", () => {
  expect(true).toBe(true); // tautological — HIGH
  mock(() => 1);
  mock(() => 2);
  mock(() => 3);
  mock(() => 4);
  mock(() => 5); // over-mocking ≥5 — MEDIUM
});
