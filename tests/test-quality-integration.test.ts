/**
 * Integration test for skills/workflow/test-quality/scripts/analyze.ts
 *
 * AC-5: Planted fixtures each produce expected finding shapes from Lens 1 + Lens 2.
 * AC-7: Exactly one stderr line matching TEST-QUALITY pattern when --emit-observability passed.
 */
import { test, expect } from "bun:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const analyzeScript = path.join(
  repoRoot,
  "skills",
  "workflow",
  "test-quality",
  "scripts",
  "analyze.ts"
);
const fixtureDir = path.join(repoRoot, "tests", "fixtures", "test-quality");

/** Run analyze.ts against the fixture directory with observability flag */
function runAnalyze(
  targetDir: string,
  extraArgs: string[] = []
): {
  stdout: string;
  stderr: string;
  exitCode: number;
} {
  // Fixtures are not in git diff, so explicit --bulk overrides the new --changed-only default.
  const result = spawnSync(
    "bun",
    [analyzeScript, "--target", targetDir, "--bulk", "--emit-observability", ...extraArgs],
    { encoding: "utf8" }
  );
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.status ?? -1
  };
}

test("test-quality: fixture A (planted-flaky) — at least 2 HIGH + 1 MEDIUM", () => {
  const result = spawnSync(
    "bun",
    [analyzeScript, "--target", fixtureDir, "--bulk", "--emit-observability"],
    { encoding: "utf8" }
  );
  const stdout: string = result.stdout ?? "";

  // Fixture A: planted-flaky.fixture.ts should produce HIGH findings (sleep + shared state)
  const highLines = stdout
    .split("\n")
    .filter((l) => l.startsWith("[HIGH]") && l.includes("planted-flaky"));
  const mediumLines = stdout
    .split("\n")
    .filter((l) => l.startsWith("[MEDIUM]") && l.includes("planted-flaky"));

  expect(highLines.length).toBeGreaterThanOrEqual(2);
  expect(mediumLines.length).toBeGreaterThanOrEqual(1);
});

test("test-quality: fixture B (planted-no-assert) — exactly 1 HIGH (assertion-free)", () => {
  const result = runAnalyze(fixtureDir);
  const stdout: string = result.stdout;

  const noAssertHighLines = stdout
    .split("\n")
    .filter(
      (l) =>
        l.startsWith("[HIGH]") && l.includes("planted-no-assert") && l.includes("Assertion-free")
    );
  expect(noAssertHighLines.length).toBe(1);
});

test("test-quality: fixture C (planted-tautology) — 1 HIGH (tautology) + 1 MEDIUM (over-mocking)", () => {
  const result = runAnalyze(fixtureDir);
  const stdout: string = result.stdout;

  const tautologyHighLines = stdout
    .split("\n")
    .filter(
      (l) => l.startsWith("[HIGH]") && l.includes("planted-tautology") && l.includes("autological")
    );
  const overMockMediumLines = stdout
    .split("\n")
    .filter(
      (l) =>
        l.startsWith("[MEDIUM]") && l.includes("planted-tautology") && l.includes("ver-mocking")
    );

  expect(tautologyHighLines.length).toBe(1);
  expect(overMockMediumLines.length).toBe(1);
});

test("test-quality: exit code 1 when HIGH findings present", () => {
  const result = runAnalyze(fixtureDir);
  expect(result.exitCode).toBe(1);
});

test("test-quality: exactly one observability line on stderr matching pattern", () => {
  const result = runAnalyze(fixtureDir);
  const stderr: string = result.stderr;
  const obsPattern = /^TEST-QUALITY analyze complete: \d+ findings \(H=\d+ M=\d+ L=0 A=\d+\)$/;
  const obsLines = stderr.split("\n").filter((l) => obsPattern.test(l));
  expect(obsLines.length).toBe(1);
});

test("test-quality: no stderr when --emit-observability is NOT passed", () => {
  // Run without the flag — stderr should be empty for a successful scan
  const result = spawnSync("bun", [analyzeScript, "--target", fixtureDir, "--bulk"], {
    encoding: "utf8"
  });
  const stderr: string = result.stderr ?? "";
  // Only TEST-QUALITY prefixed obs lines would be noise; absence is correct
  const obsLines = stderr.split("\n").filter((l) => l.startsWith("TEST-QUALITY analyze complete:"));
  expect(obsLines.length).toBe(0);
});
