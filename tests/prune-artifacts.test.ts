import { test, expect } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { isOlderThan, validateDays } from "../scripts/prune-artifacts.ts";

const execFile = promisify(execFileCallback);
const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pruneScript = path.join(repoRoot, "scripts", "prune-artifacts.ts");

const DAY_MS = 86_400_000;
const NOW = 1_000_000 * DAY_MS; // arbitrary fixed "now"

// isOlderThan(mtimeMs, nowMs, days) — true when file is beyond threshold

test("isOlderThan: returns true when file is exactly one day older than threshold", () => {
  const mtime = NOW - 91 * DAY_MS; // 91 days old, threshold 90
  expect(isOlderThan(mtime, NOW, 90)).toBe(true);
});

test("isOlderThan: returns false when file is newer than threshold", () => {
  const mtime = NOW - 30 * DAY_MS; // 30 days old, threshold 90
  expect(isOlderThan(mtime, NOW, 90)).toBe(false);
});

test("isOlderThan: returns false when file mtime equals the threshold boundary", () => {
  const mtime = NOW - 90 * DAY_MS; // exactly at the boundary — not older
  expect(isOlderThan(mtime, NOW, 90)).toBe(false);
});

test("isOlderThan: returns true for very old files (mtime = 0)", () => {
  expect(isOlderThan(0, NOW, 90)).toBe(true);
});

test("isOlderThan: returns false when mtime equals nowMs (file from now)", () => {
  expect(isOlderThan(NOW, NOW, 1)).toBe(false);
});

test("isOlderThan: works with threshold of 1 day", () => {
  const mtime = NOW - 2 * DAY_MS; // 2 days old, threshold 1
  expect(isOlderThan(mtime, NOW, 1)).toBe(true);
});

test("isOlderThan: works with large threshold (365 days)", () => {
  const mtime = NOW - 364 * DAY_MS; // 364 days old, threshold 365
  expect(isOlderThan(mtime, NOW, 365)).toBe(false);
});

test("isOlderThan: works with large threshold when file is past it", () => {
  const mtime = NOW - 366 * DAY_MS; // 366 days old, threshold 365
  expect(isOlderThan(mtime, NOW, 365)).toBe(true);
});

// validateDays — float and invalid input rejection
test("validateDays: accepts positive integer", () => {
  expect(validateDays(90)).toBe(null);
});

test("validateDays: rejects float (1.5)", () => {
  expect(validateDays(1.5)).not.toBe(null);
});

test("validateDays: rejects zero", () => {
  expect(validateDays(0)).not.toBe(null);
});

test("validateDays: rejects negative", () => {
  expect(validateDays(-5)).not.toBe(null);
});

test("validateDays: rejects NaN", () => {
  expect(validateDays(NaN)).not.toBe(null);
});

// ---------------------------------------------------------------------------
// --dry-run integration tests (spawns the actual CLI)
// ---------------------------------------------------------------------------

// Helper: create a temp artifacts/crew/<subdir> tree with one old file.
async function setupArtifactsDir(prefix: string): Promise<{ repoDir: string; oldFile: string }> {
  const repoDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  const crewDir = path.join(repoDir, ".claude", "artifacts", "crew", "handoffs");
  await fs.mkdir(crewDir, { recursive: true });
  const oldFile = path.join(crewDir, "old-handoff.md");
  await fs.writeFile(oldFile, "# old handoff\n");
  // Back-date the file by 200 days (well past the 1-day threshold used in tests).
  const oldMtime = new Date(Date.now() - 200 * 86_400_000);
  await fs.utimes(oldFile, oldMtime, oldMtime);
  return { repoDir, oldFile };
}

test("--dry-run: prints would-delete list and does NOT delete the file", async () => {
  const { repoDir, oldFile } = await setupArtifactsDir("prune-dryrun-");

  const { stdout } = await execFile(
    process.execPath,
    [
      "--experimental-strip-types",
      pruneScript,
      "--dry-run",
      "--older-than",
      "1",
      "--repo",
      repoDir
    ],
    { encoding: "utf8" }
  );

  // Should mention the file path
  expect(stdout, "--dry-run output should contain 'would delete'").toMatch(/would delete/);
  expect(stdout, "--dry-run output should list the file name").toMatch(/old-handoff\.md/);
  // Summary line
  expect(stdout, "--dry-run summary should report 1 file").toMatch(/dry-run.*1 file/);

  // File must still exist
  const stat = await fs.stat(oldFile);
  expect(stat.isFile(), "--dry-run must NOT delete the file").toBeTruthy();
});

test("--dry-run: exits 0 even when files are found", async () => {
  const { repoDir } = await setupArtifactsDir("prune-dryrun-exit-");

  const result = await execFile(
    process.execPath,
    [
      "--experimental-strip-types",
      pruneScript,
      "--dry-run",
      "--older-than",
      "1",
      "--repo",
      repoDir
    ],
    { encoding: "utf8" }
  );

  // execFile resolves (does not throw) only when exit code is 0
  expect(result, "process should exit 0 in --dry-run mode").toBeTruthy();
});

test("without --dry-run: actually deletes old files", async () => {
  const { repoDir, oldFile } = await setupArtifactsDir("prune-nodryrun-");

  const { stdout } = await execFile(
    process.execPath,
    ["--experimental-strip-types", pruneScript, "--older-than", "1", "--repo", repoDir],
    { encoding: "utf8" }
  );

  expect(stdout, "destructive run should report 1 deleted file").toMatch(/deleted.*1 file/);

  // File must be gone
  let caughtErr: NodeJS.ErrnoException | undefined;
  try {
    await fs.stat(oldFile);
  } catch (err) {
    caughtErr = err as NodeJS.ErrnoException;
  }
  expect(caughtErr?.code, "file should have been deleted").toBe("ENOENT");
});
