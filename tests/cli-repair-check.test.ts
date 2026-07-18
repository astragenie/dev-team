/**
 * tests/cli-repair-check.test.ts — dev-team#257 piece 3.
 *
 * Covers the `repair-check` CLI subcommand, the one adopted consumer of
 * scripts/lib/repair-signature.ts. Each call is a fresh process in real
 * usage, so the command re-seeds its tracker from --prev-signature on every
 * invocation — these tests exercise that two-call handshake directly via
 * runCrew() rather than the pure lib's own in-memory tracker tests
 * (tests/repair-signature.test.ts).
 */

import { expect, test } from "bun:test";
import { runCrew } from "../scripts/crew.ts";

test("repair-check: first call never stops, returns a signature", async () => {
  const { code, output } = await runCrew([
    "repair-check",
    "--failure-output",
    "TypeError: x is not a function\nat foo.ts:12"
  ]);
  expect(code).toBe(0);
  const result = JSON.parse(output);
  expect(result.shouldStop).toBe(false);
  expect(result.signature).toBe("TypeError: x is not a function");
});

test("repair-check: same failure on the next call (seeded via --prev-signature) stops", async () => {
  const first = await runCrew([
    "repair-check",
    "--failure-output",
    "FAIL tests/foo.test.ts:10:3 - expected true, got false"
  ]);
  const firstResult = JSON.parse(first.output);
  expect(firstResult.shouldStop).toBe(false);

  const second = await runCrew([
    "repair-check",
    "--failure-output",
    "FAIL tests/foo.test.ts:55:9 - expected true, got false",
    "--prev-signature",
    firstResult.signature
  ]);
  const secondResult = JSON.parse(second.output);
  expect(secondResult.shouldStop).toBe(true);
  expect(secondResult.signature).toBe(firstResult.signature);
});

test("repair-check: a different failure on the next call does not stop", async () => {
  const first = await runCrew(["repair-check", "--failure-output", "error A"]);
  const firstResult = JSON.parse(first.output);

  const second = await runCrew([
    "repair-check",
    "--failure-output",
    "error B",
    "--prev-signature",
    firstResult.signature
  ]);
  const secondResult = JSON.parse(second.output);
  expect(secondResult.shouldStop).toBe(false);
});

test("repair-check: refuses without --failure-output", async () => {
  const { code, output } = await runCrew(["repair-check"]);
  expect(code).toBe(1);
  expect(output).toMatch(/--failure-output/);
});
