import test from "node:test";
import assert from "node:assert/strict";
import { runCrew } from "../scripts/crew.ts";
import { makeTempDir } from "./helpers/cli-fixtures.ts";

test("CLI approval requests can be listed and resolved", async () => {
  const repoPath = await makeTempDir("crew-cli-approvals-");
  const initResult = await runCrew(["init", "--repo", repoPath]);
  assert.equal(initResult.code, 0, "init should exit with code 0");

  const requestResult = await runCrew([
    "request-approval",
    "--repo",
    repoPath,
    "--kind",
    "destructive_action",
    "--summary",
    "Delete legacy generated assets",
    "--requester",
    "fullstack-dev"
  ]);
  assert.equal(requestResult.code, 0, "request-approval should exit with code 0");
  const requestOutput = JSON.parse(requestResult.output);
  assert.equal(requestOutput.status, "open");
  assert.equal(requestOutput.approver, "user");

  const openResult = await runCrew(["show-approvals", "--repo", repoPath]);
  assert.equal(openResult.code, 0, "show-approvals should exit with code 0");
  const openOutput = JSON.parse(openResult.output);
  assert.equal(openOutput.approvals.length, 1);
  assert.equal(openOutput.approvals[0].id, requestOutput.id);

  const resolveResult = await runCrew([
    "resolve-approval",
    "--repo",
    repoPath,
    "--id",
    requestOutput.id,
    "--decision",
    "approved",
    "--resolver",
    "user"
  ]);
  assert.equal(resolveResult.code, 0, "resolve-approval should exit with code 0");
  const resolveOutput = JSON.parse(resolveResult.output);
  assert.equal(resolveOutput.status, "approved");

  const resolvedResult = await runCrew([
    "show-approvals",
    "--repo",
    repoPath,
    "--status",
    "resolved"
  ]);
  assert.equal(resolvedResult.code, 0, "show-approvals with --status should exit with code 0");
  const resolvedOutput = JSON.parse(resolvedResult.output);
  assert.equal(resolvedOutput.approvals.length, 1);
  assert.equal(resolvedOutput.approvals[0].status, "approved");
});
