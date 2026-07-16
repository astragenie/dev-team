import fs from "node:fs/promises";
import path from "node:path";
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

// Slice B (lead -> dispatcher wire rename): scripts/lib/approvals.ts's
// role-classification default flipped from "lead" to "dispatcher".

test("request-approval defaults a non-user-kind approver to 'dispatcher'", async () => {
  const repoPath = await makeTempDir("crew-cli-approvals-default-");
  await runCrew(["init", "--repo", repoPath]);

  const requestResult = await runCrew([
    "request-approval",
    "--repo",
    repoPath,
    "--kind",
    "scope_change",
    "--summary",
    "Non-destructive scope change",
    "--requester",
    "fullstack-dev"
  ]);
  assert.equal(requestResult.code, 0, "request-approval should exit with code 0");
  const requestOutput = JSON.parse(requestResult.output);
  assert.equal(requestOutput.approver, "dispatcher");
});

test("show-approvals --approver dispatcher matches a legacy 'lead' approver record (dual-read alias)", async () => {
  const repoPath = await makeTempDir("crew-cli-approvals-alias-");
  await runCrew(["init", "--repo", repoPath]);

  // Seed a pre-rename approval record directly — simulates an approval
  // requested before the lead->dispatcher wire rename shipped, when
  // defaultApprover() still returned "lead".
  const approvalsPath = path.join(repoPath, ".claude", "state", "crew", "approvals.jsonl");
  await fs.mkdir(path.dirname(approvalsPath), { recursive: true });
  await fs.appendFile(
    approvalsPath,
    `${JSON.stringify({
      timestamp: new Date().toISOString(),
      event: "approval_requested",
      id: "apr_legacy1",
      kind: "scope_change",
      severity: "medium",
      summary: "Legacy pre-rename approval",
      reason: "",
      requester: "lead-session",
      approver: "lead"
    })}\n`
  );

  const dispatcherFilterResult = await runCrew([
    "show-approvals",
    "--repo",
    repoPath,
    "--approver",
    "dispatcher"
  ]);
  assert.equal(dispatcherFilterResult.code, 0, "show-approvals should exit with code 0");
  const dispatcherFilterOutput = JSON.parse(dispatcherFilterResult.output);
  assert.equal(dispatcherFilterOutput.approvals.length, 1);
  assert.equal(dispatcherFilterOutput.approvals[0].id, "apr_legacy1");

  // The reverse direction also holds: filtering by the legacy name still
  // matches a post-rename "dispatcher" record.
  const legacyFilterResult = await runCrew([
    "request-approval",
    "--repo",
    repoPath,
    "--kind",
    "scope_change",
    "--summary",
    "Post-rename approval",
    "--requester",
    "fullstack-dev"
  ]);
  assert.equal(legacyFilterResult.code, 0);
  const leadFilterResult = await runCrew([
    "show-approvals",
    "--repo",
    repoPath,
    "--approver",
    "lead"
  ]);
  assert.equal(leadFilterResult.code, 0);
  const leadFilterOutput = JSON.parse(leadFilterResult.output);
  assert.equal(
    leadFilterOutput.approvals.length,
    2,
    "legacy 'lead' filter should match both records"
  );
});
