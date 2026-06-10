import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { execFile, cliPath, makeTempDir } from "./helpers/cli-fixtures.ts";

test("smoke: claims family (init)", async () => {
  const rootPath = await makeTempDir("crew-smoke-claims-");
  const repoPath = path.join(rootPath, "app");

  const { stdout, stderr } = await execFile("node", [
    "--experimental-strip-types",
    cliPath,
    "init",
    "--repo",
    repoPath
  ]);

  assert.match(stderr, /^(\s*)$/, "stderr should be empty on success");
  const result = JSON.parse(stdout);
  assert.equal(result.mode, "init", "result should have mode=init");
});

test("smoke: approvals family (request-approval)", async () => {
  const rootPath = await makeTempDir("crew-smoke-approvals-");
  const repoPath = path.join(rootPath, "app");

  // Init first
  await execFile("node", ["--experimental-strip-types", cliPath, "init", "--repo", repoPath]);

  const { stdout, stderr } = await execFile("node", [
    "--experimental-strip-types",
    cliPath,
    "request-approval",
    "--repo",
    repoPath,
    "--summary",
    "smoke",
    "--requester",
    "smoke"
  ]);

  assert.match(stderr, /^(\s*)$/, "stderr should be empty on success");
  const result = JSON.parse(stdout);
  assert.ok(result.id, "result should have an id field");
});

test("smoke: artifacts family (write-handoff)", async () => {
  const rootPath = await makeTempDir("crew-smoke-artifacts-");
  const repoPath = path.join(rootPath, "app");

  // Init first
  await execFile("node", ["--experimental-strip-types", cliPath, "init", "--repo", repoPath]);

  const { stdout, stderr } = await execFile("node", [
    "--experimental-strip-types",
    cliPath,
    "write-handoff",
    "--repo",
    repoPath,
    "--title",
    "smoke"
  ]);

  assert.match(stderr, /^(\s*)$/, "stderr should be empty on success");
  const result = JSON.parse(stdout);
  assert.ok(result.path, "result should have path field");
});

test("smoke: synthesis family (write-final-synthesis)", async () => {
  const rootPath = await makeTempDir("crew-smoke-synthesis-");
  const repoPath = path.join(rootPath, "app");
  const tempProjRoot = await makeTempDir("crew-smoke-proj-");

  // Init first
  await execFile("node", ["--experimental-strip-types", cliPath, "init", "--repo", repoPath]);

  const { stdout, stderr } = await execFile(
    "node",
    [
      "--experimental-strip-types",
      cliPath,
      "write-final-synthesis",
      "--repo",
      repoPath,
      "--title",
      "smoke",
      "--external-deltas",
      "none"
    ],
    {
      env: { ...process.env, CREW_PROJECTS_ROOT: tempProjRoot }
    }
  );

  assert.match(stderr, /^(\s*)$/, "stderr should be empty on success");
  const result = JSON.parse(stdout);
  assert.ok(result.path, "result should have path field");
});

test("smoke: cost family (cost-advise)", async () => {
  const rootPath = await makeTempDir("crew-smoke-cost-");
  const repoPath = path.join(rootPath, "app");
  const tempProjRoot = await makeTempDir("crew-smoke-cost-proj-");

  // Init first
  await execFile("node", ["--experimental-strip-types", cliPath, "init", "--repo", repoPath]);

  const { stdout, stderr } = await execFile(
    "node",
    ["--experimental-strip-types", cliPath, "cost-advise", "--repo", repoPath],
    {
      env: { ...process.env, CREW_PROJECTS_ROOT: tempProjRoot }
    }
  );

  assert.match(stderr, /^(\s*)$/, "stderr should be empty on success");
  const result = JSON.parse(stdout);
  assert.ok(result.artifactPath, "result should have artifactPath field");
});
