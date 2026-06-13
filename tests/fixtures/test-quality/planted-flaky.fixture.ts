/**
 * FIXTURE — not a real test. Input file for test-quality integration test.
 * Excluded from bun test suite via bunfig.toml test.exclude pattern.
 *
 * Planted signals:
 *   - shared module-scope mutable variable (HIGH)
 *   - hard-coded sleep (HIGH)
 *   - soft flaky signal in test name (MEDIUM)
 */
import { test, expect } from "bun:test";
let sharedCounter = 0; // shared module-scope mutation
test("eventually completes", async () => {
  await new Promise((r) => setTimeout(r, 100)); // planted hard-coded sleep
  sharedCounter += 1;
  expect(sharedCounter).toBeGreaterThan(0);
});
