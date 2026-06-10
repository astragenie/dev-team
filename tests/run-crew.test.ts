import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
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

  assert.equal(result.code, 0);
  assert.match(result.output, /node scripts\/crew\.mjs/);
});

test("runCrew(['unknown-command', '--repo', <tempdir>]) returns code 1 with error message", async () => {
  const runCrew = await importRunCrew();
  const tempDir = await makeTempDir("crew-unknown-cmd-");
  const result = await runCrew(["unknown-command", "--repo", tempDir]);

  assert.equal(result.code, 1);
  assert.equal(result.output, "Unknown command: unknown-command");
});

test("runCrew(['init', '--repo', <tempdir>]) returns code 0 with mode: 'init'", async () => {
  const runCrew = await importRunCrew();
  const rootPath = await makeTempDir("crew-run-init-");
  const repoPath = path.join(rootPath, "app");

  const result = await runCrew(["init", "--repo", repoPath]);

  assert.equal(result.code, 0);
  const parsed = JSON.parse(result.output);
  assert.equal(parsed.mode, "init");
  assert.equal(parsed.audit.hasHarnessLayer, true);
});
