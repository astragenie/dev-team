/**
 * tests/gepa/eval-cmd.test.ts — SLICE-98
 *
 * Covers CLI parsing + bad-arg handling for runGepaEvalCmd. The lock+spawn
 * path is exercised in tests/gepa/run-with-lock.test.ts; here we keep the
 * focus on user-facing CLI contract (exit codes, messages).
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEvalArgs, runGepaEvalCmd } from "../../scripts/lib/gepa/eval.ts";

function tmpRepo(): string {
  return mkdtempSync(join(tmpdir(), "gepa-eval-cmd-"));
}

describe("SLICE-98 — parseEvalArgs", () => {
  test("bare agent → agent set, defaults preserved", () => {
    expect(parseEvalArgs(["fullstack-dev"])).toEqual({
      agent: "fullstack-dev",
      live: false,
      validate: false
    });
  });

  test("--live flips live boolean", () => {
    expect(parseEvalArgs(["inspector", "--live"]).live).toBe(true);
  });

  test("--validate flips validate boolean", () => {
    expect(parseEvalArgs(["inspector", "--validate"]).validate).toBe(true);
  });

  test("--judge consumes value", () => {
    const parsed = parseEvalArgs(["verifier", "--judge", "groq"]);
    expect(parsed.judge).toBe("groq");
  });

  test("--judge without value → invalid", () => {
    const parsed = parseEvalArgs(["verifier", "--judge"]);
    expect(parsed.invalid).toBeDefined();
  });

  test("--judge followed by another flag → invalid (not consumed as value)", () => {
    const parsed = parseEvalArgs(["verifier", "--judge", "--live"]);
    expect(parsed.invalid).toBeDefined();
  });

  test("--split consumes value", () => {
    const parsed = parseEvalArgs(["verifier", "--split", "16/4"]);
    expect(parsed.split).toBe("16/4");
  });

  test("agent + multiple flags", () => {
    const parsed = parseEvalArgs([
      "fullstack-dev",
      "--live",
      "--judge",
      "groq",
      "--validate",
      "--split",
      "16/4"
    ]);
    expect(parsed).toEqual({
      agent: "fullstack-dev",
      live: true,
      validate: true,
      judge: "groq",
      split: "16/4"
    });
  });
});

describe("SLICE-98 — runGepaEvalCmd error paths", () => {
  test("no agent → exit 2 with usage", async () => {
    const result = await runGepaEvalCmd(tmpRepo(), []);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("usage:");
  });

  test("--judge with no value → exit 2", async () => {
    const result = await runGepaEvalCmd(tmpRepo(), ["fullstack-dev", "--judge"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("--judge requires a value");
  });

  test("--split with no value → exit 2", async () => {
    const result = await runGepaEvalCmd(tmpRepo(), ["fullstack-dev", "--split"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("--split requires N/M");
  });
});
