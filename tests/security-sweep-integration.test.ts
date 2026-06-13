/**
 * Integration test for skills/domain/security-sweep/scripts/scan.ts
 *
 * AC-5: Planted-secret fixture caught with [CRITICAL] finding at file:1
 * AC-6: Exactly one stderr line matching SECURITY-SWEEP scan complete pattern
 */

import { test, expect } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { execSync, spawnSync } from "node:child_process";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const scanScript = path.join(repoRoot, "skills", "domain", "security-sweep", "scripts", "scan.ts");
const fixtureSource = path.join(
  repoRoot,
  "tests",
  "fixtures",
  "security-sweep",
  "planted-secret.txt"
);

async function makeGitRepo(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "security-sweep-test-"));
  execSync("git init -q", { cwd: root });
  execSync('git config user.email "test@example.com"', { cwd: root });
  execSync('git config user.name "Test"', { cwd: root });
  // Create an initial commit so HEAD~1 / HEAD are both valid refs
  await fs.writeFile(path.join(root, "README.md"), "initial\n", "utf8");
  execSync("git add -A && git commit -q -m initial", { cwd: root });
  return root;
}

test("security-sweep: planted AWS key fixture is caught as [CRITICAL] finding at line 1", async () => {
  const repo = await makeGitRepo();

  // Stage the planted-secret fixture in the temp repo
  const fixtureDest = path.join(repo, "tests", "fixtures", "security-sweep", "planted-secret.txt");
  await fs.mkdir(path.dirname(fixtureDest), { recursive: true });
  await fs.copyFile(fixtureSource, fixtureDest);

  // Commit the file so git diff HEAD~1..HEAD shows it as changed
  execSync('git add -A && git commit -q -m "add planted secret"', { cwd: repo });

  // Run the scan script targeting the temp repo, diff-base=HEAD~1
  const result = spawnSync("bun", [scanScript, "--diff-base", "HEAD~1", "--target", repo], {
    cwd: repo,
    encoding: "utf8"
  });

  const stdout: string = result.stdout ?? "";
  const stderr: string = result.stderr ?? "";
  const exitCode: number = result.status ?? -1;

  // AC-5: stdout must contain exactly one [CRITICAL] finding referencing the fixture path at line 1
  const criticalLines = stdout.split("\n").filter((l) => l.startsWith("[CRITICAL]"));
  expect(criticalLines.length).toBe(1);

  const criticalLine = criticalLines[0] ?? "";
  expect(criticalLine.includes("planted-secret.txt:1")).toBeTruthy();

  // AC-6: stderr must contain exactly one SECURITY-SWEEP scan complete line
  const obsPattern = /^SECURITY-SWEEP scan complete: \d+ findings \(C=\d+ H=\d+ M=\d+ L=\d+\)$/;
  const obsLines = stderr.split("\n").filter((l) => obsPattern.test(l));
  expect(obsLines.length).toBe(1);

  // The observability line must report C=1 (one CRITICAL)
  const obsLine = obsLines[0] ?? "";
  expect(obsLine.includes("C=1")).toBeTruthy();

  // Exit code must be 1 (CRITICAL findings present)
  expect(exitCode).toBe(1);

  // Clean up
  await fs.rm(repo, { recursive: true, force: true });
});

test("security-sweep: clean repo emits zero findings with exit code 0", async () => {
  const repo = await makeGitRepo();

  // Add a benign file with no secrets
  await fs.writeFile(path.join(repo, "safe.ts"), "export const greeting = 'hello';\n", "utf8");
  execSync('git add -A && git commit -q -m "add safe file"', { cwd: repo });

  const result = spawnSync("bun", [scanScript, "--diff-base", "HEAD~1", "--target", repo], {
    cwd: repo,
    encoding: "utf8"
  });

  const stderr: string = result.stderr ?? "";
  const exitCode: number = result.status ?? -1;

  // Observability line must be present even on clean scan
  const obsPattern = /^SECURITY-SWEEP scan complete: \d+ findings \(C=\d+ H=\d+ M=\d+ L=\d+\)$/;
  const obsLines = stderr.split("\n").filter((l) => obsPattern.test(l));
  expect(obsLines.length).toBe(1);

  expect(exitCode).toBe(0);

  await fs.rm(repo, { recursive: true, force: true });
});
