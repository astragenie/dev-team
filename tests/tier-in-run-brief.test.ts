import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cliPath = path.join(repoRoot, "scripts", "crew.ts");

async function makeTempRepo(prefix: string) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  await execFile("node", ["--experimental-strip-types", cliPath, "init", "--repo", dir]);
  return dir;
}

async function cleanup(dir: string) {
  await fs.rm(dir, { recursive: true, force: true });
}

function runCli(args: string[]) {
  const result = spawnSync(process.execPath, ["--experimental-strip-types", cliPath, ...args], {
    encoding: "utf8",
    timeout: 30_000
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

// Test 1: run-brief with --tier full
test("write-run-brief --tier full renders tier field", async () => {
  const repoPath = await makeTempRepo("run-brief-tier-full-");
  try {
    const { status, stdout } = runCli([
      "write-run-brief",
      "--repo",
      repoPath,
      "--title",
      "Full tier run",
      "--tier",
      "full"
    ]);
    assert.equal(status, 0, "expected exit 0");
    const result = JSON.parse(stdout);
    const body = await fs.readFile(result.path, "utf8");
    assert.match(body, /Tier: full/, "artifact must contain 'Tier: full'");
  } finally {
    await cleanup(repoPath);
  }
});

// Test 2: run-brief with --tier light
test("write-run-brief --tier light renders tier field", async () => {
  const repoPath = await makeTempRepo("run-brief-tier-light-");
  try {
    const { status, stdout } = runCli([
      "write-run-brief",
      "--repo",
      repoPath,
      "--title",
      "Light tier run",
      "--tier",
      "light"
    ]);
    assert.equal(status, 0, "expected exit 0");
    const result = JSON.parse(stdout);
    const body = await fs.readFile(result.path, "utf8");
    assert.match(body, /Tier: light/, "artifact must contain 'Tier: light'");
  } finally {
    await cleanup(repoPath);
  }
});

// Test 3: run-brief without --tier defaults to "full"
test("write-run-brief without --tier defaults to 'full'", async () => {
  const repoPath = await makeTempRepo("run-brief-tier-default-");
  try {
    const { status, stdout } = runCli([
      "write-run-brief",
      "--repo",
      repoPath,
      "--title",
      "Default tier run"
    ]);
    assert.equal(status, 0, "expected exit 0");
    const result = JSON.parse(stdout);
    const body = await fs.readFile(result.path, "utf8");
    assert.match(body, /Tier: full/, "artifact should default to 'Tier: full' when not specified");
  } finally {
    await cleanup(repoPath);
  }
});
