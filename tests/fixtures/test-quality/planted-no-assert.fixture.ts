/**
 * FIXTURE — not a real test. Input file for test-quality integration test.
 * Excluded from bun test suite via bunfig.toml test.exclude pattern.
 *
 * Planted signal:
 *   - assertion-free test body (HIGH)
 */
import { test } from "bun:test";
test("does the thing", () => {
  const x = 1 + 1;
  console.log(x); // no expect/assert call — HIGH
});
