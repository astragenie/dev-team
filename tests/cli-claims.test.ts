import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { runCrew } from "../scripts/crew.ts";
import { makeTempDir } from "./helpers/cli-fixtures.ts";

test("CLI init creates a harnessed repo", async () => {
  const rootPath = await makeTempDir("crew-cli-init-");
  const repoPath = path.join(rootPath, "app");
  const { code, output } = await runCrew(["init", "--repo", repoPath]);
  assert.equal(code, 0, "init should exit with code 0");
  const result = JSON.parse(output);

  assert.equal(result.mode, "init");
  assert.equal(result.audit.hasHarnessLayer, true);
  assert.match(result.welcome.headline, /Crew/);
  assert.ok(result.welcome.commands.includes("/crew:brief-me"));

  const claudeMd = await fs.readFile(path.join(repoPath, "CLAUDE.md"), "utf8");
  assert.match(claudeMd, /crew:start/);
});

test("CLI bootstrap preserves existing CLAUDE.md content", async () => {
  const repoPath = await makeTempDir("crew-cli-bootstrap-");
  await fs.writeFile(path.join(repoPath, "CLAUDE.md"), "# Existing\n");

  const { code, output } = await runCrew(["bootstrap", "--repo", repoPath]);
  assert.equal(code, 0, "bootstrap should exit with code 0");
  const result = JSON.parse(output);
  const claudeMd = await fs.readFile(path.join(repoPath, "CLAUDE.md"), "utf8");

  assert.equal(result.mode, "bootstrap");
  assert.match(result.welcome.headline, /Crew/);
  assert.ok(result.welcome.commands.includes("/crew:build"));
  assert.match(claudeMd, /# Existing/);
  assert.match(claudeMd, /crew:start/);
});

test("CLI claim and release manage repo-local claims", async () => {
  const repoPath = await makeTempDir("crew-cli-claims-");
  await runCrew(["init", "--repo", repoPath]);

  const claimResponse = await runCrew([
    "claim",
    "--repo",
    repoPath,
    "--owner",
    "fullstack-dev",
    "src/example.ts"
  ]);
  assert.equal(claimResponse.code, 0, "claim should exit with code 0");
  const claimResult = JSON.parse(claimResponse.output);
  assert.deepEqual(claimResult.claimed, ["src/example.ts"]);

  const conflictsResponse = await runCrew([
    "show-conflicts",
    "--repo",
    repoPath,
    "--owner",
    "lead-session",
    "src/example.ts"
  ]);
  assert.equal(conflictsResponse.code, 0, "show-conflicts should exit with code 0");
  const conflictsResult = JSON.parse(conflictsResponse.output);
  assert.equal(conflictsResult.conflicts.length, 1);
  assert.equal(conflictsResult.conflicts[0].owner, "fullstack-dev");
  assert.equal(conflictsResult.owned.length, 0);
  assert.equal(conflictsResult.available.length, 0);

  const ownedResponse = await runCrew([
    "show-conflicts",
    "--repo",
    repoPath,
    "--owner",
    "fullstack-dev",
    "src/example.ts",
    "src/free.ts"
  ]);
  assert.equal(ownedResponse.code, 0, "show-conflicts should exit with code 0");
  const ownedResult = JSON.parse(ownedResponse.output);
  assert.equal(ownedResult.owned.length, 1);
  assert.equal(ownedResult.owned[0].path, "src/example.ts");
  assert.equal(ownedResult.conflicts.length, 0);
  assert.deepEqual(ownedResult.available, [{ path: "src/free.ts" }]);

  const releaseResponse = await runCrew(["release", "--repo", repoPath, "src/example.ts"]);
  assert.equal(releaseResponse.code, 0, "release should exit with code 0");
  const releaseResult = JSON.parse(releaseResponse.output);
  assert.deepEqual(releaseResult.released, ["src/example.ts"]);
});
