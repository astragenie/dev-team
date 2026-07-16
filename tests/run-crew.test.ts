import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test, expect } from "bun:test";
// Lazy-import runCrew to ensure it's available after implementation
async function importRunCrew() {
  const { runCrew } = await import("../scripts/crew.ts");
  return runCrew;
}

async function makeTempDir(prefix: string) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

test("runCrew(['help']) returns code 0 with usage text", async () => {
  const runCrew = await importRunCrew();
  const result = await runCrew(["help"]);

  expect(result.code).toBe(0);
  expect(result.output).toMatch(/node scripts\/crew\.mjs/);
});

test("runCrew(['unknown-command', '--repo', <tempdir>]) returns code 1 with error message", async () => {
  const runCrew = await importRunCrew();
  const tempDir = await makeTempDir("crew-unknown-cmd-");
  const result = await runCrew(["unknown-command", "--repo", tempDir]);

  expect(result.code).toBe(1);
  expect(result.output).toBe("Unknown command: unknown-command");
});

test("runCrew(['init', '--repo', <tempdir>]) returns code 0 with mode: 'init'", async () => {
  const runCrew = await importRunCrew();
  const rootPath = await makeTempDir("crew-run-init-");
  const repoPath = path.join(rootPath, "app");

  const result = await runCrew(["init", "--repo", repoPath]);

  expect(result.code).toBe(0);
  const parsed = JSON.parse(result.output);
  expect(parsed.mode).toBe("init");
  expect(parsed.audit.hasHarnessLayer).toBe(true);
});
