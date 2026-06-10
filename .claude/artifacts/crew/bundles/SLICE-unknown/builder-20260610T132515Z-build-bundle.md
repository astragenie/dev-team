---
slice: SLICE-unknown
builder: builder
run_id: 20260610T132515Z
files_touched: ["tests/cli-claims.test.ts", "tests/cli.test.ts", "tests/helpers/cli-fixtures.ts"]
files_read: [".claude/crew/constitution.md", "docs/superpowers/plans/2026-06-10-ws1-test-longpole.md", "scripts/crew.ts"]
diff_stat: { files: 0, additions: 0, deletions: 0 }
truncated: false
truncation_reason: null
schema_version: 1
---

## Handoff

# Task Handoff: WS1 Task 4: Extract fixtures and split claims tests

- Created: 2026-06-10T13:25:09.660Z
- From: builder
- To: lead
- Objective: Extracted cli-fixtures helper and split 3 claims tests to runCrew in-process; all gates pass
- Status: completed
- Allowed Scope:
  - tests/helpers/cli-fixtures.ts (new)
  - tests/cli-claims.test.ts (new)
  - tests/cli.test.ts (updated - removed 3 tests + duplicate loadState
  - added helper import)
- Forbidden Scope: -
- Deliverable: tests/helpers/cli-fixtures.ts with execFile, cliPath, makeTempDir, loadState exports; tests/cli-claims.test.ts with 3 converted tests using runCrew(); tests/cli.test.ts updated with fixture imports (30 tests remain)
- Changed Files:
  - tests/cli-claims.test.ts
  - tests/cli.test.ts
  - tests/helpers/cli-fixtures.ts
- Confidence: high
- Risks: none
- Suggested Next Handoff: Task 5: split cli-approvals.test.ts (1 test)


## Diff

```diff

```

## Files touched

### tests/cli-claims.test.ts

```
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
    "builder",
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
  assert.equal(conflictsResult.conflicts[0].owner, "builder");
  assert.equal(conflictsResult.owned.length, 0);
  assert.equal(conflictsResult.available.length, 0);

  const ownedResponse = await runCrew([
    "show-conflicts",
    "--repo",
    repoPath,
    "--owner",
    "builder",
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

```

### tests/cli.test.ts

```
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { execFile, cliPath, makeTempDir, loadState } from "./helpers/cli-fixtures.ts";

test("CLI approval requests can be listed and resolved", async () => {
  const repoPath = await makeTempDir("crew-cli-approvals-");
  await execFile("node", ["--experimental-strip-types", cliPath, "init", "--repo", repoPath]);

  const requestOutput = await execFile("node", [
    cliPath,
    "request-approval",
    "--repo",
    repoPath,
    "--kind",
    "destructive_action",
    "--summary",
    "Delete legacy generated assets",
    "--requester",
    "builder"
  ]);
  const requestResult = JSON.parse(requestOutput.stdout);
  assert.equal(requestResult.status, "open");
  assert.equal(requestResult.approver, "user");

  const openOutput = await execFile("node", [
    "--experimental-strip-types",
    cliPath,
    "show-approvals",
    "--repo",
    repoPath
  ]);
  const openResult = JSON.parse(openOutput.stdout);
  assert.equal(openResult.approvals.length, 1);
  assert.equal(openResult.approvals[0].id, requestResult.id);

  const resolveOutput = await execFile("node", [
    cliPath,
    "resolve-approval",
    "--repo",
    repoPath,
    "--id",
    requestResult.id,
    "--decision",
    "approved",
    "--resolver",
    "user"
  ]);
  const resolveResult = JSON.parse(resolveOutput.stdout);
  assert.equal(resolveResult.status, "approved");

  const resolvedOutput = await execFile("node", [
    cliPath,
    "show-approvals",
    "--repo",
    repoPath,
    "--status",
    "resolved"
  ]);
  const resolvedResult = JSON.parse(resolvedOutput.stdout);
  assert.equal(resolvedResult.approvals.length, 1);
  assert.equal(resolvedResult.approvals[0].status, "approved");
});

test("CLI artifact writers create markdown artifacts", async () => {
  const repoPath = await makeTempDir("crew-cli-artifacts-");
  await execFile("node", ["--experimental-strip-types", cliPath, "init", "--repo", repoPath]);

  const runBriefOutput = await execFile("node", [
    cliPath,
    "write-run-brief",
    "--repo",
    repoPath,
    "--title",
    "Platform guidance feature",
    "--goal",
    "Add platform guidance to the create page",
    "--mode",
    "single-session",
    "--pace",
    "medium",
    "--files",
    "app/templates/create.html,static/js/create.js"
  ]);
  const runBriefResult = JSON.parse(runBriefOutput.stdout);
  const runBriefBody = await fs.readFile(runBriefResult.path, "utf8");
  assert.match(runBriefBody, /# Run Brief: Platform guidance feature/);
  assert.match(runBriefBody, /single-session/);

  const reviewOutput = await execFile("node", [
    cliPath,
    "write-review-result",
    "--repo",
    repoPath,
    "--title",
    "Platform guidance review",
    "--decision",
    "approved",
    "--reviewer",
    "reviewer",
    "--files",
    "app/templates/create.html",
    "--non-code"
  ]);
  const reviewResult = JSON.parse(reviewOutput.stdout);
  const reviewBody = await fs.readFile(reviewResult.path, "utf8");
  assert.match(reviewBody, /# Review Result: Platform guidance review/);
  assert.match(reviewBody, /approved/);

  const reviewAliasOutput = await execFile("node", [
    cliPath,
    "write-review-result",
    "--repo",
    repoPath,
    "--title",
    "Platform guidance alias review",
    "--verdict",
    "approved_with_notes",
    "--non-code"
  ]);
  const reviewAliasResult = JSON.parse(reviewAliasOutput.stdout);
  const reviewAliasBody = await fs.readFile(reviewAliasResult.path, "utf8");
  assert.match(reviewAliasBody, /approved_with_notes/);

  const validationPlanOutput = await execFile("node", [
    cliPath,
    "write-validation-plan",
    "--repo",
    repoPath,
    "--title",
    "Platform guidance validation plan",
    "--validator",
    "validator",
    "--environment",
    "local",
    "--goal",
    "Exercise the create flow and collect smoke evidence",
    "--evidence",
    "vite build,playwright smoke"
  ]);
  const validationPlanResult = JSON.parse(validationPlanOutput.stdout);
  const validationPlanBody = await fs.readFile(validationPlanResult.path, "utf8");
  assert.match(validationPlanBody, /# Validation Plan: Platform guidance validation plan/);
  assert.match(validationPlanBody, /Exercise the create flow and collect smoke evidence/);

  const validationOutput = await execFile("node", [
    cliPath,
    "write-validation-result",
    "--repo",
    repoPath,
    "--title",
    "Platform guidance validation",
    "--validator",
    "validator",
    "--environment",
    "local",
    "--decision",
    "passed",
    "--evidence",
    "vite build,playwright smoke",
    "--files",
    "http://localhost:5173,app/templates/create.html"
  ]);
  const validationResult = JSON.parse(validationOutput.stdout);
  const validationBody = await fs.readFile(validationResult.path, "utf8");
  assert.match(validationBody, /# Validation Result: Platform guidance validation/);
  assert.match(validationBody, /local/);
  assert.match(validationBody, /passed/);

  const deploymentCheckOutput = await execFile("node", [
    cliPath,
    "write-deployment-check",
    "--repo",
    repoPath,
    "--title",
    "Platform guidance dev deploy",
    "--deployer",
    "deployer",
    "--environment",
    "dev",
    "--resource",
    "cloud-run:platform-guidance-dev",
    "--url",
    "https://platform-guidance-dev.example.com",
    "--revision",
    "platform-guidance-dev-00012-abc",
    "--decision",
    "passed",
    "--evidence",
    "gcloud deploy output,health check",
    "--files",
    "https://platform-guidance-dev.example.com"
  ]);
  const deploymentCheckResult = JSON.parse(deploymentCheckOutput.stdout);
  const deploymentCheckBody = await fs.readFile(deploymentCheckResult.path, "utf8");
  assert.match(deploymentCheckBody, /# Deployment Check: Platform guidance dev deploy/);
  assert.match(deploymentCheckBody, /cloud-run:platform-guidance-dev/);
  assert.match(deploymentCheckBody, /https:\/\/platform-guidance-dev\.example\.com/);
  assert.match(deploymentCheckBody, /platform-guidance-dev-00012-abc/);

  await fs.mkdir(path.join(repoPath, ".github", "workflows"), { recursive: true });
  await fs.writeFile(path.join(repoPath, ".github", "workflows", "deploy.yml"), "name: deploy\n");
  await fs.writeFile(path.join(repoPath, "Dockerfile"), "FROM node:20\n");

  const discoverOutput = await execFile("node", [
    cliPath,
    "discover-deployment",
    "--repo",
    repoPath
  ]);
  const discoverResult = JSON.parse(discoverOutput.stdout);
  assert.ok(discoverResult.clues.includes(".github/workflows/deploy.yml"));
  assert.ok(discoverResult.clues.includes("Dockerfile"));

  const guidanceOutput = await execFile("node", [
    cliPath,
    "write-deployment-guidance",
    "--repo",
    repoPath,
    "--title",
    "Platform guidance deployment model",
    "--discovery-status",
    "live-verified",
    "--verified-from",
    "cloud run,github actions",
    "--summary",
    "GitHub Actions builds the image; gcloud deploy applies it to Cloud Run.",
    "--build",
    "merge to main or manual GitHub workflow builds container image",
    "--deploy",
    "gcloud run deploy applies the built image",
    "--environments",
    "dev,prod",
    "--logs",
    "Cloud Logging service logs",
    "--metrics",
    "Cloud Monitoring request/error/cpu metrics",
    "--alerts",
    "Cloud Monitoring alert policies on 5xx and crash loops",
    "--telemetry",
    "BigQuery product events",
    "--missing",
    "staging playground service url"
  ]);
  const guidanceResult = JSON.parse(guidanceOutput.stdout);
  const guidanceBody = await fs.readFile(guidanceResult.path, "utf8");
  assert.match(guidanceBody, /# Deployment Guidance: Platform guidance deployment model/);
  assert.match(guidanceBody, /- Discovery Status: live-verified/);
  assert.match(guidanceBody, /- Verified From:/);
  assert.match(guidanceBody, /GitHub Actions builds the image/);
  assert.match(guidanceBody, /Cloud Logging service logs/);
  assert.match(guidanceBody, /staging playground service url/);
  assert.match(guidanceBody, /\.github\/workflows\/deploy\.yml/);
});

test("CLI wake-up brief summarizes repo memory and state", async () => {
  const repoPath = await makeTempDir("crew-cli-wakeup-");
  await execFile("node", ["--experimental-strip-types", cliPath, "init", "--repo", repoPath]);

  await execFile("node", [
    cliPath,
    "write-run-brief",
    "--repo",
    repoPath,
    "--title",
    "Wake-up test run",
    "--goal",
    "Verify repo recovery",
    "--mode",
    "assisted single-session",
    "--pace",
    "medium"
  ]);

  await execFile("node", [
    cliPath,
    "mark-badge",
    "--repo",
    repoPath,
    "--badge",
    "review_required",
    "--note",
    "Implementation finished and waiting for independent review"
  ]);

  await execFile("node", [
    cliPath,
    "claim",
    "--repo",
    repoPath,
    "--owner",
    "builder",
    "src/example.ts"
  ]);

  await execFile("node", [
    cliPath,
    "request-approval",
    "--repo",
    repoPath,
    "--summary",
    "Expand scope for wake-up test"
  ]);

  await execFile("node", [
    cliPath,
    "write-validation-plan",
    "--repo",
    repoPath,
    "--title",
    "Wake-up validation plan",
    "--environment",
    "local"
  ]);

  await execFile("node", [
    cliPath,
    "write-validation-result",
    "--repo",
    repoPath,
    "--title",
    "Wake-up validation result",
    "--environment",
    "local",
    "--decision",
    "passed"
  ]);

  await execFile("node", [
    cliPath,
    "mark-badge",
    "--repo",
    repoPath,
    "--badge",
    "dev_deploy_expected",
    "--note",
    "Dev deployment evidence still needed"
  ]);

  await execFile("node", [
    cliPath,
    "write-deployment-guidance",
    "--repo",
    repoPath,
    "--title",
    "Wake-up deployment model",
    "--discovery-status",
    "repo-derived",
    "--summary",
    "CI builds artifacts and gcloud deploys them to dev."
  ]);

  await execFile("node", [
    cliPath,
    "write-deployment-check",
    "--repo",
    repoPath,
    "--title",
    "Wake-up deployment check",
    "--environment",
    "dev",
    "--resource",
    "cloud-run:wake-up-service",
    "--url",
    "https://wake-up.example.com",
    "--revision",
    "wake-up-service-00021-xyz",
    "--decision",
    "passed"
  ]);

  const wakeUpOutput = await execFile("node", [
    "--experimental-strip-types",
    cliPath,
    "wake-up",
    "--repo",
    repoPath
  ]);
  const wakeUpResult = JSON.parse(wakeUpOutput.stdout);

  assert.equal(wakeUpResult.summary.memoryPolicy, "bounded-v1");
  assert.equal(wakeUpResult.summary.activeClaims, 1);
  assert.equal(wakeUpResult.summary.openApprovals, 1);
  assert.equal(wakeUpResult.summary.hasActiveWorkflow, true);
  assert.deepEqual(wakeUpResult.summary.pendingWorkflowBadges, ["review_required"]);
  assert.equal(wakeUpResult.summary.hasDeploymentGuidance, true);
  assert.equal(wakeUpResult.summary.repoMemoryFiles >= 1, true);
  assert.equal(wakeUpResult.summary.hasRecentRunMemory, true);
  assert.match(wakeUpResult.repoGuidance.deployment.title, /Wake-up deployment model/);
  assert.equal(wakeUpResult.repoGuidance.deployment.discoveryStatus, "repo-derived");
  assert.match(wakeUpResult.latestArtifacts.runBrief.title, /Wake-up test run/);
  assert.match(wakeUpResult.latestArtifacts.validationPlan.title, /Wake-up validation plan/);
  assert.match(wakeUpResult.latestArtifacts.validationResult.title, /Wake-up validation result/);
  assert.match(wakeUpResult.latestArtifacts.deploymentCheck.title, /Wake-up deployment check/);
  assert.match(wakeUpResult.memory.hot.repoGuidance.deployment.title, /Wake-up deployment model/);
  assert.ok(
    wakeUpResult.memory.hot.repoMemory.some((entry: { path: string }) =>
      entry.path.endsWith("CLAUDE.md")
    )
  );
  assert.match(wakeUpResult.memory.hot.latestArtifacts.runBrief.title, /Wake-up test run/);
  assert.match(
    wakeUpResult.memory.hot.latestArtifacts.validationPlan.title,
    /Wake-up validation plan/
  );
  assert.match(
    wakeUpResult.memory.hot.latestArtifacts.deploymentCheck.title,
    /Wake-up deployment check/
  );
  assert.match(wakeUpResult.memory.warm.validation.title, /Wake-up validation result/);
  assert.equal(wakeUpResult.memory.hot.claims.length, 1);
  assert.equal(wakeUpResult.memory.hot.openApprovals.length, 1);
  assert.equal(wakeUpResult.memory.hot.workflow.currentRun.gates.review.status, "required");
  assert.ok(wakeUpResult.memory.cold.archiveCounts.runs >= 1);
  assert.ok(wakeUpResult.memory.cold.archiveCounts.validations >= 2);
  assert.ok(wakeUpResult.memory.cold.archiveCounts.deployments >= 1);
  assert.deepEqual(wakeUpResult.memory.cold.omittedByDefault, [
    "older_artifacts",
    "resolved_approvals",
    "full_event_log",
    "full_history_log"
  ]);
});

test("CLI brief-me synthesizes workflow state, git activity, and next step", async () => {
  const repoPath = await makeTempDir("crew-cli-brief-me-");
  await execFile("node", ["--experimental-strip-types", cliPath, "init", "--repo", repoPath]);

  await execFile("git", ["init", "-b", "main"], { cwd: repoPath });
  await execFile("git", ["config", "user.name", "Crew Test"], { cwd: repoPath });
  await execFile("git", ["config", "user.email", "crew@example.com"], { cwd: repoPath });
  await fs.writeFile(path.join(repoPath, "README.md"), "# Brief Me\n");
  await execFile("git", ["add", "README.md"], { cwd: repoPath });
  await execFile("git", ["-c", "commit.gpgsign=false", "commit", "-m", "docs: add readme"], {
    cwd: repoPath
  });

  await execFile("node", [
    cliPath,
    "write-run-brief",
    "--repo",
    repoPath,
    "--title",
    "Brief me test run",
    "--goal",
    "Exercise repo briefing",
    "--mode",
    "assisted single-session",
    "--next",
    "Run review before commit"
  ]);

  await execFile("node", [
    cliPath,
    "mark-badge",
    "--repo",
    repoPath,
    "--badge",
    "review_required",
    "--note",
    "Implementation changed code and needs review"
  ]);

  await execFile("node", [
    cliPath,
    "request-approval",
    "--repo",
    repoPath,
    "--summary",
    "Approve broadening the brief"
  ]);

  await execFile("node", [
    cliPath,
    "write-deployment-guidance",
    "--repo",
    repoPath,
    "--title",
    "Brief me deployment model",
    "--summary",
    "GitHub Actions builds images and gcloud rolls them out."
  ]);

  await fs.writeFile(path.join(repoPath, "notes.txt"), "untracked\n");

  const briefOutput = await execFile("node", [
    "--experimental-strip-types",
    cliPath,
    "brief-me",
    "--repo",
    repoPath
  ]);
  const briefResult = JSON.parse(briefOutput.stdout);

  assert.equal(briefResult.repoPath, repoPath);
  assert.equal(briefResult.summary.isGitRepo, true);
  assert.equal(briefResult.summary.hasActiveWorkflow, true);
  assert.deepEqual(briefResult.summary.pendingWorkflowBadges, ["review_required"]);
  assert.equal(briefResult.sections.currentObjective.title, "Brief me test run");
  assert.equal(briefResult.sections.currentObjective.goal, "Exercise repo briefing");
  assert.equal(briefResult.sections.recentActivity.git.workingTree.branch, "main");
  assert.equal(briefResult.sections.recentActivity.git.workingTree.hasChanges, true);
  assert.ok(briefResult.sections.recentActivity.git.workingTree.untrackedCount >= 1);
  assert.ok(briefResult.sections.recentActivity.git.workingTree.changedPaths.includes("notes.txt"));
  assert.equal(briefResult.sections.recentActivity.latestArtifacts[0].label.length > 0, true);
  assert.ok(
    briefResult.sections.recentActivity.repoMemory.some((entry: { path: string }) =>
      entry.path.endsWith("CLAUDE.md")
    )
  );
  assert.ok(
    briefResult.sections.recentActivity.retrievalGuide.some((entry: { path: string }) =>
      entry.path.endsWith("CLAUDE.md")
    )
  );
  assert.match(
    briefResult.sections.blockedOrMissing.join("\n"),
    /Independent review is still required/
  );
  assert.match(briefResult.sections.importantReminders.join("\n"), /Working tree has/);
  assert.match(briefResult.sections.recommendedNextStep, /Run independent review next/);
  assert.ok(briefResult.sections.secondaryOptions.length >= 1);
});

test("CLI brief-me is read-only for an uninitialized repo", async () => {
  const repoPath = await makeTempDir("crew-cli-brief-me-readonly-");
  await fs.writeFile(path.join(repoPath, "README.md"), "# Plain repo\n");

  const briefOutput = await execFile("node", [
    "--experimental-strip-types",
    cliPath,
    "brief-me",
    "--repo",
    repoPath
  ]);
  const briefResult = JSON.parse(briefOutput.stdout);

  assert.equal(briefResult.repoPath, repoPath);
  await assert.rejects(fs.access(path.join(repoPath, ".claude")));
  assert.match(briefResult.sections.recommendedNextStep, /\/crew:adopt/);
});

test("CLI brief-me surfaces failed gates before generic next steps", async () => {
  const repoPath = await makeTempDir("crew-cli-brief-me-failed-gates-");
  await execFile("node", ["--experimental-strip-types", cliPath, "init", "--repo", repoPath]);

  await execFile("node", [
    cliPath,
    "write-run-brief",
    "--repo",
    repoPath,
    "--title",
    "Failed gate briefing",
    "--goal",
    "Catch failed review in the briefing",
    "--mode",
    "single-session",
    "--next",
    "This should not win over a failed review"
  ]);

  await execFile("node", [
    cliPath,
    "write-review-result",
    "--repo",
    repoPath,
    "--title",
    "Failed review result",
    "--decision",
    "rejected",
    "--summary",
    "Missing null guard"
  ]);

  const briefOutput = await execFile("node", [
    "--experimental-strip-types",
    cliPath,
    "brief-me",
    "--repo",
    repoPath
  ]);
  const briefResult = JSON.parse(briefOutput.stdout);

  assert.match(
    briefResult.sections.blockedOrMissing.join("\n"),
    /Independent review failed: Missing null guard/
  );
  assert.match(briefResult.sections.recommendedNextStep, /Address the failed review findings/);
});

test("CLI workflow state tracks gate badges and artifact progress", async () => {
  const repoPath = await makeTempDir("crew-cli-workflow-state-");
  await execFile("node", ["--experimental-strip-types", cliPath, "init", "--repo", repoPath]);

  await execFile("node", [
    cliPath,
    "write-run-brief",
    "--repo",
    repoPath,
    "--title",
    "Workflow gate test",
    "--goal",
    "Exercise review and validation gates",
    "--mode",
    "assisted single-session"
  ]);

  await execFile("node", [
    "--experimental-strip-types",
    cliPath,
    "mark-badge",
    "--repo",
    repoPath,
    "--badge",
    "review_required"
  ]);

  let workflowOutput = await execFile("node", [
    "--experimental-strip-types",
    cliPath,
    "show-workflow-state",
    "--repo",
    repoPath
  ]);
  let workflowResult = JSON.parse(workflowOutput.stdout);
  assert.equal(workflowResult.summary.currentRun.gates.review.status, "required");
  assert.deepEqual(workflowResult.summary.pendingBadges, ["review_required"]);
  assert.deepEqual(workflowResult.summary.missingArtifactWrites, []);

  await execFile("node", [
    cliPath,
    "write-review-result",
    "--repo",
    repoPath,
    "--title",
    "Workflow gate review",
    "--decision",
    "approved",
    "--non-code"
  ]);

  await execFile("node", [
    cliPath,
    "write-validation-plan",
    "--repo",
    repoPath,
    "--title",
    "Workflow gate validation plan",
    "--environment",
    "local"
  ]);

  workflowOutput = await execFile("node", [
    "--experimental-strip-types",
    cliPath,
    "show-workflow-state",
    "--repo",
    repoPath
  ]);
  workflowResult = JSON.parse(workflowOutput.stdout);
  assert.equal(workflowResult.summary.currentRun.gates.review.status, "passed");
  assert.equal(workflowResult.summary.currentRun.gates.validation.status, "expected");
  assert.deepEqual(workflowResult.summary.pendingBadges, ["validation_expected"]);
  assert.deepEqual(workflowResult.summary.missingArtifactWrites, []);

  await execFile("node", [
    cliPath,
    "write-validation-result",
    "--repo",
    repoPath,
    "--title",
    "Workflow gate validation result",
    "--decision",
    "passed"
  ]);

  workflowOutput = await execFile("node", [
    "--experimental-strip-types",
    cliPath,
    "show-workflow-state",
    "--repo",
    repoPath
  ]);
  workflowResult = JSON.parse(workflowOutput.stdout);
  assert.equal(workflowResult.summary.currentRun.gates.validation.status, "passed");
  assert.deepEqual(workflowResult.summary.pendingBadges, []);
  assert.deepEqual(workflowResult.summary.missingArtifactWrites, ["final_synthesis_missing"]);

  await execFile("node", [
    cliPath,
    "mark-badge",
    "--repo",
    repoPath,
    "--badge",
    "dev_deploy_expected"
  ]);

  workflowOutput = await execFile("node", [
    "--experimental-strip-types",
    cliPath,
    "show-workflow-state",
    "--repo",
    repoPath
  ]);
  workflowResult = JSON.parse(workflowOutput.stdout);
  assert.equal(workflowResult.summary.currentRun.gates.deployment.dev.status, "expected");
  assert.deepEqual(workflowResult.summary.pendingBadges, ["dev_deploy_expected"]);
  assert.deepEqual(workflowResult.summary.missingArtifactWrites, []);

  await execFile("node", [
    cliPath,
    "write-deployment-check",
    "--repo",
    repoPath,
    "--title",
    "Workflow gate dev deployment",
    "--environment",
    "dev",
    "--resource",
    "cloud-run:workflow-gate-dev",
    "--url",
    "https://workflow-gate-dev.example.com",
    "--revision",
    "workflow-gate-dev-00001-abc",
    "--decision",
    "passed"
  ]);

  workflowOutput = await execFile("node", [
    "--experimental-strip-types",
    cliPath,
    "show-workflow-state",
    "--repo",
    repoPath
  ]);
  workflowResult = JSON.parse(workflowOutput.stdout);
  assert.equal(workflowResult.summary.currentRun.gates.deployment.dev.status, "passed");
  assert.deepEqual(workflowResult.summary.pendingBadges, []);
  assert.deepEqual(workflowResult.summary.missingArtifactWrites, ["final_synthesis_missing"]);
});

test("CLI workflow state and brief-me surface missing artifact write-backs after a completed phase", async () => {
  const repoPath = await makeTempDir("crew-cli-missing-artifact-writeback-");
  await execFile("node", ["--experimental-strip-types", cliPath, "init", "--repo", repoPath]);

  await execFile("node", [
    cliPath,
    "write-run-brief",
    "--repo",
    repoPath,
    "--title",
    "Artifact write-back gap",
    "--goal",
    "Surface a missing review artifact",
    "--mode",
    "single-session"
  ]);

  await execFile("node", [
    cliPath,
    "mark-badge",
    "--repo",
    repoPath,
    "--badge",
    "review_passed",
    "--note",
    "Reviewer approved, but artifact was not written yet"
  ]);

  const workflowOutput = await execFile("node", [
    cliPath,
    "show-workflow-state",
    "--repo",
    repoPath
  ]);
  const workflowResult = JSON.parse(workflowOutput.stdout);
  assert.deepEqual(workflowResult.summary.pendingBadges, []);
  assert.deepEqual(workflowResult.summary.missingArtifactWrites, ["review_result_missing"]);

  const briefOutput = await execFile("node", [
    "--experimental-strip-types",
    cliPath,
    "brief-me",
    "--repo",
    repoPath
  ]);
  const briefResult = JSON.parse(briefOutput.stdout);
  assert.match(
    briefResult.sections.blockedOrMissing.join("\n"),
    /review artifact write-back is still missing/
  );
  assert.match(briefResult.sections.recommendedNextStep, /Write the review-result artifact now/);
});

test("CLI workflow state and brief-me surface missing run briefs after meaningful progress starts", async () => {
  const repoPath = await makeTempDir("crew-cli-run-brief-gap-");
  await execFile("node", ["--experimental-strip-types", cliPath, "init", "--repo", repoPath]);

  await execFile("node", [
    cliPath,
    "mark-badge",
    "--repo",
    repoPath,
    "--badge",
    "review_required",
    "--note",
    "Implementation finished and waiting for review"
  ]);

  const workflowOutput = await execFile("node", [
    cliPath,
    "show-workflow-state",
    "--repo",
    repoPath
  ]);
  const workflowResult = JSON.parse(workflowOutput.stdout);
  assert.deepEqual(workflowResult.summary.pendingBadges, ["review_required"]);
  assert.deepEqual(workflowResult.summary.missingArtifactWrites, []);

  const briefOutput = await execFile("node", [
    "--experimental-strip-types",
    cliPath,
    "brief-me",
    "--repo",
    repoPath
  ]);
  const briefResult = JSON.parse(briefOutput.stdout);
  assert.match(
    briefResult.sections.blockedOrMissing.join("\n"),
    /Independent review is still required/
  );
  assert.match(briefResult.sections.recommendedNextStep, /Run independent review next/);
});

test("CLI blocks final synthesis when workflow badges are still pending", async () => {
  const repoPath = await makeTempDir("crew-cli-gate-enforcement-");
  await execFile("node", ["--experimental-strip-types", cliPath, "init", "--repo", repoPath]);

  await execFile("node", [
    cliPath,
    "write-run-brief",
    "--repo",
    repoPath,
    "--title",
    "Gate enforcement test",
    "--goal",
    "Ensure final synthesis respects pending gates",
    "--mode",
    "single-session"
  ]);

  await execFile("node", [
    "--experimental-strip-types",
    cliPath,
    "mark-badge",
    "--repo",
    repoPath,
    "--badge",
    "review_required"
  ]);

  await assert.rejects(
    () =>
      execFile("node", [
        cliPath,
        "write-final-synthesis",
        "--repo",
        repoPath,
        "--title",
        "Blocked final synthesis",
        "--summary",
        "Should not complete while review is pending",
        "--external-deltas",
        "none"
      ]),
    /pending: review_required/
  );

  await execFile("node", [
    cliPath,
    "mark-badge",
    "--repo",
    repoPath,
    "--badge",
    "review_skipped",
    "--note",
    "Trivial manual docs-only correction"
  ]);

  const finalOutput = await execFile("node", [
    cliPath,
    "write-final-synthesis",
    "--repo",
    repoPath,
    "--title",
    "Allowed final synthesis",
    "--summary",
    "Review was explicitly skipped with reason",
    "--external-deltas",
    "none"
  ]);
  const finalResult = JSON.parse(finalOutput.stdout);
  const finalBody = await fs.readFile(finalResult.path, "utf8");
  assert.match(finalBody, /Allowed final synthesis/);
});

test("write-final-synthesis rejects when --external-deltas is missing", async () => {
  const repoPath = await makeTempDir("crew-cli-external-deltas-required-");
  await execFile("node", ["--experimental-strip-types", cliPath, "init", "--repo", repoPath]);
  await execFile("node", [
    cliPath,
    "write-run-brief",
    "--repo",
    repoPath,
    "--title",
    "External-deltas required",
    "--goal",
    "g",
    "--mode",
    "single-session"
  ]);

  await assert.rejects(
    () =>
      execFile("node", [
        cliPath,
        "write-final-synthesis",
        "--repo",
        repoPath,
        "--title",
        "Missing external-deltas",
        "--summary",
        "Should reject because --external-deltas absent"
      ]),
    /requires --external-deltas/
  );
});

test("write-final-synthesis accepts --external-deltas none and renders the section", async () => {
  const repoPath = await makeTempDir("crew-cli-external-deltas-none-");
  await execFile("node", ["--experimental-strip-types", cliPath, "init", "--repo", repoPath]);
  await execFile("node", [
    cliPath,
    "write-run-brief",
    "--repo",
    repoPath,
    "--title",
    "External-deltas none",
    "--goal",
    "g",
    "--mode",
    "single-session"
  ]);
  await execFile("node", [
    cliPath,
    "mark-badge",
    "--repo",
    repoPath,
    "--badge",
    "review_skipped",
    "--note",
    "docs-only"
  ]);

  const out = await execFile("node", [
    cliPath,
    "write-final-synthesis",
    "--repo",
    repoPath,
    "--title",
    "Synthesis with no external deltas",
    "--summary",
    "Nothing off-repo to coordinate",
    "--external-deltas",
    "none"
  ]);
  const result = JSON.parse(out.stdout);
  const body = await fs.readFile(result.path, "utf8");
  assert.match(body, /External Deltas/);
  assert.match(body, /none/);
});

test("CLI subcommand help works without error", async () => {
  const helpOutput = await execFile("node", [
    "--experimental-strip-types",
    cliPath,
    "write-review-result",
    "--help"
  ]);

  assert.match(helpOutput.stdout, /write-review-result/);
  assert.match(helpOutput.stdout, /--verdict/);
});

test("CLI install-global writes managed global memory into HOME", async () => {
  const homePath = await makeTempDir("crew-cli-global-home-");
  const installOutput = await execFile(
    "node",
    ["--experimental-strip-types", cliPath, "install-global"],
    {
      env: { ...process.env, HOME: homePath }
    }
  );
  const result = JSON.parse(installOutput.stdout);

  assert.equal(result.mode, "install-global");
  assert.match(result.welcome.headline, /Crew/);
  assert.ok(result.welcome.commands.includes("/crew:init"));
  assert.equal(result.global.hasGlobalMemory, true);
  assert.equal(result.global.globalMemoryStale, false);
  assert.deepEqual(result.writes, [
    "~/.claude/crew/constitution.md",
    "~/.claude/crew/workflow.md",
    "~/.claude/crew/metadata.json",
    "~/.claude/CLAUDE.md"
  ]);

  const repeatOutput = await execFile(
    "node",
    ["--experimental-strip-types", cliPath, "install-global"],
    {
      env: { ...process.env, HOME: homePath }
    }
  );
  const repeatResult = JSON.parse(repeatOutput.stdout);
  assert.deepEqual(repeatResult.writes, []);
});

test("mark-badge blocked persists note + blockedBy", async () => {
  const repoPath = await makeTempDir("crew-cli-badge-blocked-");
  await execFile("node", ["--experimental-strip-types", cliPath, "init", "--repo", repoPath]);
  await execFile("node", [
    cliPath,
    "write-run-brief",
    "--repo",
    repoPath,
    "--title",
    "Blocked test",
    "--goal",
    "Block on missing dep",
    "--mode",
    "single-session"
  ]);
  await execFile("node", [
    cliPath,
    "mark-badge",
    "--repo",
    repoPath,
    "--badge",
    "blocked",
    "--note",
    "Waiting on upstream API spec",
    "--blocked-by",
    "ART-2025-12-12-spec-q"
  ]);
  const state = await loadState(repoPath);
  assert.equal(state.currentRun.gates.blocked.status, "blocked");
  assert.equal(state.currentRun.gates.blocked.note, "Waiting on upstream API spec");
  assert.equal(state.currentRun.gates.blocked.blockedBy, "ART-2025-12-12-spec-q");
});

test("mark-badge escalated_to_human persists note", async () => {
  const repoPath = await makeTempDir("crew-cli-badge-escalated-");
  await execFile("node", ["--experimental-strip-types", cliPath, "init", "--repo", repoPath]);
  await execFile("node", [
    cliPath,
    "write-run-brief",
    "--repo",
    repoPath,
    "--title",
    "Escalation test",
    "--goal",
    "Punt to human",
    "--mode",
    "single-session"
  ]);
  await execFile("node", [
    cliPath,
    "mark-badge",
    "--repo",
    repoPath,
    "--badge",
    "escalated_to_human",
    "--note",
    "Scope ambiguous; need stakeholder sign-off"
  ]);
  const state = await loadState(repoPath);
  assert.equal(state.currentRun.gates.escalation.status, "escalated");
  assert.equal(
    state.currentRun.gates.escalation.note,
    "Scope ambiguous; need stakeholder sign-off"
  );
});

test("final-synthesis blocked when escalated_to_human set; --force overrides", async () => {
  const repoPath = await makeTempDir("crew-cli-escalated-blocks-final-");
  await execFile("node", ["--experimental-strip-types", cliPath, "init", "--repo", repoPath]);
  await execFile("node", [
    cliPath,
    "write-run-brief",
    "--repo",
    repoPath,
    "--title",
    "Escalation block",
    "--goal",
    "Verify final-synthesis halts",
    "--mode",
    "single-session"
  ]);
  await execFile("node", [
    cliPath,
    "mark-badge",
    "--repo",
    repoPath,
    "--badge",
    "escalated_to_human",
    "--note",
    "Need human"
  ]);
  await assert.rejects(
    () =>
      execFile("node", [
        cliPath,
        "write-final-synthesis",
        "--repo",
        repoPath,
        "--title",
        "Should be blocked",
        "--summary",
        "Should reject",
        "--external-deltas",
        "none"
      ]),
    /escalated_to_human|pending|escalated to human/i
  );
  const forced = await execFile("node", [
    cliPath,
    "write-final-synthesis",
    "--repo",
    repoPath,
    "--title",
    "Forced through",
    "--summary",
    "Override with --force",
    "--external-deltas",
    "none",
    "--force"
  ]);
  const result = JSON.parse(forced.stdout);
  assert.ok(result.path);
});

test("brief-me surfaces blocked in pending badges", async () => {
  const repoPath = await makeTempDir("crew-cli-brief-blocked-");
  await execFile("node", ["--experimental-strip-types", cliPath, "init", "--repo", repoPath]);
  await execFile("node", [
    cliPath,
    "write-run-brief",
    "--repo",
    repoPath,
    "--title",
    "Brief blocked",
    "--goal",
    "g",
    "--mode",
    "single-session"
  ]);
  await execFile("node", [
    cliPath,
    "mark-badge",
    "--repo",
    repoPath,
    "--badge",
    "blocked",
    "--note",
    "Reason"
  ]);
  const out = await execFile("node", [
    "--experimental-strip-types",
    cliPath,
    "brief-me",
    "--repo",
    repoPath
  ]);
  const brief = JSON.parse(out.stdout);
  assert.ok(
    (brief.pendingBadges || brief.workflow?.pendingBadges || []).includes("blocked") ||
      JSON.stringify(brief).includes("blocked"),
    "brief-me output should mention blocked"
  );
});

test("brief-me reports routingTableStale=false when file recent or absent", async () => {
  const repoPath = await makeTempDir("crew-cli-routing-fresh-");
  await execFile("node", ["--experimental-strip-types", cliPath, "init", "--repo", repoPath]);
  // file absent
  const out1 = await execFile("node", [
    "--experimental-strip-types",
    cliPath,
    "brief-me",
    "--repo",
    repoPath
  ]);
  const brief1 = JSON.parse(out1.stdout);
  const summary1 = brief1.summary || {};
  assert.equal(summary1.routingTablePresent, false);
  assert.equal(summary1.routingTableStale, false);

  // file present + fresh
  await fs.mkdir(path.join(repoPath, "docs"), { recursive: true });
  await fs.writeFile(path.join(repoPath, "docs", "routing-table.md"), "# Routing table\n");
  const out2 = await execFile("node", [
    "--experimental-strip-types",
    cliPath,
    "brief-me",
    "--repo",
    repoPath
  ]);
  const brief2 = JSON.parse(out2.stdout);
  const summary2 = brief2.summary || {};
  assert.equal(summary2.routingTablePresent, true);
  assert.equal(summary2.routingTableStale, false);
});

test("brief-me reports routingTableStale=true when mtime > 30 days old", async () => {
  const repoPath = await makeTempDir("crew-cli-routing-stale-");
  await execFile("node", ["--experimental-strip-types", cliPath, "init", "--repo", repoPath]);
  await fs.mkdir(path.join(repoPath, "docs"), { recursive: true });
  const filePath = path.join(repoPath, "docs", "routing-table.md");
  await fs.writeFile(filePath, "# Routing table\n");
  const oldTime = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
  await fs.utimes(filePath, oldTime, oldTime);

  const out = await execFile("node", [
    "--experimental-strip-types",
    cliPath,
    "brief-me",
    "--repo",
    repoPath
  ]);
  const brief = JSON.parse(out.stdout);
  const summary = brief.summary || {};
  assert.equal(summary.routingTableStale, true);
  assert.ok(summary.routingTableAgeDays >= 30);

  const reminders = brief.sections?.importantReminders || [];
  assert.ok(
    reminders.some((r: string) => r.includes("Routing table") && r.includes("stale")),
    "reminders should mention routing-table staleness"
  );
});

test("write-* commands embed --feature and --phase in frontmatter", async () => {
  const repoPath = await makeTempDir("crew-cli-feature-phase-");
  await execFile("node", ["--experimental-strip-types", cliPath, "init", "--repo", repoPath]);

  // run-brief with feature + phase
  const runBriefOut = await execFile("node", [
    cliPath,
    "write-run-brief",
    "--repo",
    repoPath,
    "--title",
    "Tagged brief",
    "--feature",
    "FEAT-021",
    "--phase",
    "3"
  ]);
  const briefPath = JSON.parse(runBriefOut.stdout).path;
  const briefBody = await fs.readFile(briefPath, "utf8");
  assert.match(briefBody, /^---\nphase: "3"\nfeature: FEAT-021\n---\n/);
  assert.match(briefBody, /# Run Brief: Tagged brief/);

  // review-result without feature/phase emits no frontmatter (backward-compat)
  const reviewOut = await execFile("node", [
    cliPath,
    "write-review-result",
    "--repo",
    repoPath,
    "--title",
    "Bare review",
    "--decision",
    "approved",
    "--non-code"
  ]);
  const reviewPath = JSON.parse(reviewOut.stdout).path;
  const reviewBody = await fs.readFile(reviewPath, "utf8");
  assert.ok(
    !reviewBody.startsWith("---"),
    "bare review-result has no frontmatter when feature/phase absent"
  );

  // review-result with only feature emits frontmatter without phase line
  const reviewFeatOut = await execFile("node", [
    cliPath,
    "write-review-result",
    "--repo",
    repoPath,
    "--title",
    "Feat review",
    "--decision",
    "approved",
    "--feature",
    "FEAT-007",
    "--non-code"
  ]);
  const reviewFeatPath = JSON.parse(reviewFeatOut.stdout).path;
  const reviewFeatBody = await fs.readFile(reviewFeatPath, "utf8");
  assert.match(reviewFeatBody, /^---\nfeature: FEAT-007\n---\n/);
  assert.ok(!reviewFeatBody.includes("phase:"), "no phase key when phase omitted");
});

test("cost-advise accepts --title --feature --phase and slugs filename + emits frontmatter", async () => {
  const repoPath = await makeTempDir("crew-cli-advise-");
  await execFile("node", ["--experimental-strip-types", cliPath, "init", "--repo", repoPath]);
  // Seed a minimal cost-report so the advisor has a target.
  await execFile("node", [
    cliPath,
    "cost-slice",
    "--repo",
    repoPath,
    "--started-at",
    "2026-05-22T00:00:00Z",
    "--completed-at",
    "2026-05-22T00:05:00Z",
    "--run-title",
    "seed",
    "--aggregate-all"
  ]);

  const adviseOut = await execFile("node", [
    cliPath,
    "cost-advise",
    "--repo",
    repoPath,
    "--title",
    "PHASE3 FEAT021 SLICE36",
    "--feature",
    "FEAT-021",
    "--phase",
    "3"
  ]);
  const adviseResult = JSON.parse(adviseOut.stdout);
  assert.ok(adviseResult.artifactPath);
  assert.match(
    path.basename(adviseResult.artifactPath),
    /-cost-advise-phase3-feat021-slice36\.md$/,
    "cost-advise filename includes the --title slug"
  );
  const body = await fs.readFile(adviseResult.artifactPath, "utf8");
  assert.match(
    body,
    /^---\nphase: "3"\nfeature: FEAT-021\n---\n/,
    "cost-advise body starts with phase/feature frontmatter"
  );
});

test("cost-slice embeds --feature and --phase in cost-report frontmatter", async () => {
  const repoPath = await makeTempDir("crew-cli-cost-tags-");
  await execFile("node", ["--experimental-strip-types", cliPath, "init", "--repo", repoPath]);
  const out = await execFile("node", [
    cliPath,
    "cost-slice",
    "--repo",
    repoPath,
    "--started-at",
    "2026-05-22T00:00:00Z",
    "--completed-at",
    "2026-05-22T00:05:00Z",
    "--run-title",
    "tagged",
    "--feature",
    "FEAT-100",
    "--phase",
    "beta",
    "--aggregate-all"
  ]);
  const reportPath = JSON.parse(out.stdout).path;
  const body = await fs.readFile(reportPath, "utf8");
  assert.match(body, /\nfeature: FEAT-100\n/);
  assert.match(body, /\nphase: "beta"\n/);
});

test("write-handoff --repo-context appends ## Repo Layout section", async () => {
  const repoPath = await makeTempDir("crew-repo-context-");
  await execFile("node", ["--experimental-strip-types", cliPath, "init", "--repo", repoPath]);
  const { stdout } = await execFile("node", [
    cliPath,
    "write-handoff",
    "--repo",
    repoPath,
    "--title",
    "Test handoff",
    "--from",
    "builder",
    "--to",
    "lead",
    "--repo-context"
  ]);
  const result = JSON.parse(stdout);
  assert.ok(result.path, "should return artifact path");
  const content = await fs.readFile(result.path, "utf8");
  assert.match(content, /## Repo Layout/);
  assert.match(content, /npm scripts:/);
});

test("write-handoff without --repo-context has no ## Repo Layout section", async () => {
  const repoPath = await makeTempDir("crew-no-repo-context-");
  await execFile("node", ["--experimental-strip-types", cliPath, "init", "--repo", repoPath]);
  const { stdout } = await execFile("node", [
    cliPath,
    "write-handoff",
    "--repo",
    repoPath,
    "--title",
    "Test handoff plain",
    "--from",
    "builder",
    "--to",
    "lead"
  ]);
  const result = JSON.parse(stdout);
  const content = await fs.readFile(result.path, "utf8");
  assert.ok(!content.includes("## Repo Layout"), "should not contain Repo Layout without flag");
});

test("write-review-result with --validation-evidence emits frontmatter field and body section", async () => {
  const repoPath = await makeTempDir("crew-validation-evidence-present-");
  await execFile("node", ["--experimental-strip-types", cliPath, "init", "--repo", repoPath]);
  const evidenceText =
    "node --test: 42 pass / 0 fail; npm run lint exit 0; npm run typecheck exit 0 — code-only diff, no user-visible surface";
  const { stdout } = await execFile("node", [
    cliPath,
    "write-review-result",
    "--repo",
    repoPath,
    "--title",
    "Bundled validation review",
    "--decision",
    "approved",
    "--non-code",
    "--validation-evidence",
    evidenceText
  ]);
  const result = JSON.parse(stdout);
  const content = await fs.readFile(result.path, "utf8");
  assert.match(
    content,
    /validation_evidence:/,
    "frontmatter should contain validation_evidence key"
  );
  assert.ok(content.includes(evidenceText), "frontmatter or body should contain the evidence text");
  assert.match(
    content,
    /## Validation Evidence/,
    "body should contain ## Validation Evidence section"
  );
});

test("write-review-result without --validation-evidence emits no frontmatter field and no body section", async () => {
  const repoPath = await makeTempDir("crew-validation-evidence-absent-");
  await execFile("node", ["--experimental-strip-types", cliPath, "init", "--repo", repoPath]);
  const { stdout } = await execFile("node", [
    cliPath,
    "write-review-result",
    "--repo",
    repoPath,
    "--title",
    "No evidence review",
    "--decision",
    "approved",
    "--non-code"
  ]);
  const result = JSON.parse(stdout);
  const content = await fs.readFile(result.path, "utf8");
  assert.ok(
    !content.includes("validation_evidence"),
    "artifact should have no validation_evidence field when flag omitted"
  );
  assert.ok(
    !content.includes("## Validation Evidence"),
    "artifact should have no Validation Evidence section when flag omitted"
  );
});

test("write-review-result with --validation-evidence empty string treats it as omitted", async () => {
  const repoPath = await makeTempDir("crew-validation-evidence-empty-");
  await execFile("node", ["--experimental-strip-types", cliPath, "init", "--repo", repoPath]);
  const { stdout } = await execFile("node", [
    cliPath,
    "write-review-result",
    "--repo",
    repoPath,
    "--title",
    "Empty evidence review",
    "--decision",
    "approved",
    "--non-code",
    "--validation-evidence",
    ""
  ]);
  const result = JSON.parse(stdout);
  const content = await fs.readFile(result.path, "utf8");
  assert.ok(
    !content.includes("validation_evidence"),
    "artifact should have no validation_evidence field when flag is empty string"
  );
  assert.ok(
    !content.includes("## Validation Evidence"),
    "artifact should have no Validation Evidence section when flag is empty string"
  );
});

// ── findings flag tests (FEAT-037) ──────────────────────────────────────────

test("write-validation-result: --findings persisted in frontmatter", async () => {
  const repoPath = await makeTempDir("crew-wvr-findings-");
  try {
    await execFile("node", ["--experimental-strip-types", cliPath, "init", "--repo", repoPath]);
    const out = await execFile("node", [
      cliPath,
      "write-validation-result",
      "--repo",
      repoPath,
      "--title",
      "Findings validation",
      "--decision",
      "passed",
      "--evidence",
      "manual smoke",
      "--findings",
      "pass:2,partial:0,fail:1"
    ]);
    const result = JSON.parse(out.stdout);
    const body = await fs.readFile(result.path, "utf8");
    assert.match(
      body,
      /findings:.*pass:2,partial:0,fail:1/,
      "validation artifact must contain findings"
    );
  } finally {
    await fs.rm(repoPath, { recursive: true, force: true });
  }
});

test("write-deployment-check: --findings persisted in frontmatter", async () => {
  const repoPath = await makeTempDir("crew-wdc-findings-");
  try {
    await execFile("node", ["--experimental-strip-types", cliPath, "init", "--repo", repoPath]);
    const out = await execFile("node", [
      cliPath,
      "write-deployment-check",
      "--repo",
      repoPath,
      "--title",
      "Findings deploy",
      "--environment",
      "dev",
      "--decision",
      "passed",
      "--evidence",
      "health check",
      "--findings",
      "healthy:1,degraded:0,down:0"
    ]);
    const result = JSON.parse(out.stdout);
    const body = await fs.readFile(result.path, "utf8");
    assert.match(
      body,
      /findings:.*healthy:1,degraded:0,down:0/,
      "deployment artifact must contain findings"
    );
  } finally {
    await fs.rm(repoPath, { recursive: true, force: true });
  }
});

```

### tests/helpers/cli-fixtures.ts

```
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

export const execFile = promisify(execFileCallback);
export const repoRoot = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
export const cliPath = path.join(repoRoot, "scripts", "crew.ts");

export async function makeTempDir(prefix: string) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

export async function loadState(repoPath: string) {
  const raw = await fs.readFile(
    path.join(repoPath, ".claude", "state", "crew", "workflow-state.json"),
    "utf8"
  );
  return JSON.parse(raw);
}

```

## Files read

### .claude/crew/constitution.md

```
# Engineering OS Constitution

This repository uses the Engineering OS harness for structured software work inside Claude Code.

## Core Rules

1. Keep one owner per task. Shared ownership creates merge conflicts and confused accountability that cost the user time.
2. Keep task scope explicit. Ambiguous scope leads to wasted effort and work that has to be redone.
3. Retrieve bounded repo context before substantial work. Starting without it means paying for rediscovery that was already done.
4. Structured handoffs protect the user from lost context. Without them, the next agent or session starts blind.
5. Treat review as a gate, not a courtesy. Unreviewed code reaching the user's repo is a quality risk they cannot easily undo.
6. Treat validation and deployment evidence as separate gates when behavior or environments are involved. The user needs to know that changed behavior works, not just that code looks correct.
7. Leave durable artifacts and repo memory behind when work would matter later. Skipping them means the next session has no record of what happened or why.

## Team Roles

- lead: planning, delegation, synthesis
- builder: bounded implementation
- reviewer: independent change review
- validator: behavior and scenario verification
- deployer: deployment and environment evidence
- researcher: read-only investigation

## Memory And Artifact Habit

The user depends on artifacts to resume work after compaction, across sessions, or when context is lost.

Substantial work should start from bounded repo memory:

- `CLAUDE.md`
- `.claude/crew/*.md`
- latest relevant wake-up context and artifacts

Substantial work should leave inspectable artifacts under:

- `.claude/artifacts/crew/runs/`
- `.claude/artifacts/crew/handoffs/`
- `.claude/artifacts/crew/reviews/`
- `.claude/artifacts/crew/validations/`
- `.claude/artifacts/crew/deployments/`

For shipping work, keep durable repo deployment guidance in:

- `.claude/crew/deployment.md`

## Scope Discipline

These situations create merge conflicts, wasted effort, or confused ownership that costs the user time. Stop and re-scope if:

- two agents need the same file
- the assignment boundary is unclear
- the work needs a broader refactor than assigned

## Commit Discipline

Baseline: do not create commits unless the user explicitly asks. Unrequested commits in the user's repo are a quality and trust risk they cannot easily undo.

Exception — `dev.stable` opt-in:

- If the current repo's `.claude/crew/deployment.md` contains a `dev.stable: true` setting, the lead and builder MAY create commits without asking on each individual edit, as long as ALL of the following hold:
  - the change came from a `/crew:build` or `/crew:fix` flow that reached the synthesis step
  - the latest review artifact for the run is `PASS` (or `review_skipped` was recorded with an explicit reason)
  - the latest validation artifact for the run is `PASS` (or `validation_skipped` was recorded with an explicit reason)
  - no `help_request` workflow badge is open
  - the work is local commits only — not a release tag, not a force-push, not a production deploy
- If any gate is missing or red, fall back to baseline (ask first).
- The user may override the flag at any time by saying "do not commit" or equivalent during the session. Session-level instruction always beats the repo flag.
- Production promotion, tag pushes, and force-pushes are NEVER unlocked by `dev.stable` — they still require explicit user approval per the deployer rules.

See `agents/deployer.md` → Deployment guidance schema for the field definition.


```

### docs/superpowers/plans/2026-06-10-ws1-test-longpole.md

```
# WS1 — Test Long-Pole Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut the full test suite from ~116s to ≤40s by (1) making the session-cost scanner's projects root injectable so tests stop scanning the user's real ~/.claude/projects, (2) exporting an in-process `runCrew()` entry so CLI tests stop spawning subprocesses, and (3) splitting tests/cli.test.ts into per-command-family files that node --test parallelizes.

**Architecture:** crew.ts already routes argv through parseArgs() into a COMMANDS handler table — runCrew() is a thin exported wrapper around that path returning {code, output} instead of printing. The cost-scanning commands (write-final-synthesis, cost-advise, cost-slice) are slow because scripts/lib/session-cost-scanner.ts:49 and scripts/lib/session-cost.ts:7 hardcode PROJECTS_ROOT to ~/.claude/projects; a lazy getProjectsRoot() honoring CREW_PROJECTS_ROOT lets tests point at a tiny fixture.

**Tech Stack:** Node 22.6+ --experimental-strip-types, node:test, ESM.

---

## Task 1 — Injectable projects root in session-cost-scanner.ts

Files: Modify `scripts/lib/session-cost-scanner.ts`; Create/extend `tests/projects-root-override.test.ts`.

- [ ] Read scripts/lib/session-cost-scanner.ts lines 1–100 to understand current structure and all references to PROJECTS_ROOT constant.
- [ ] Write a failing test in a new file `tests/projects-root-override.test.ts`:
  - Sets `process.env.CREW_PROJECTS_ROOT` to a temp fixture dir containing a single project slug (e.g., "test-project-1")
  - Creates a minimal .jsonl fixture file in that dir with one assistant turn entry (timestamp in-window, type: "assistant", message.usage present)
  - Calls `listActiveProjectDirs({ startMs, endMs })` from session-cost-scanner.ts
  - Asserts the returned list includes only "test-project-1" (not the user's real ~/.claude/projects)
  - Cleans up the env var in a finally block
  - Run the test, expect FAIL with a message like "PROJECTS_ROOT is not a function" or similar (because the code still uses const PROJECTS_ROOT).
- [ ] Replace the module-level `const PROJECTS_ROOT = path.join(os.homedir(), ".claude", "projects");` with a lazy function at the top of the file:
  ```ts
  function getProjectsRoot(): string {
    const override = process.env.CREW_PROJECTS_ROOT;
    return override ? path.resolve(override) : path.join(os.homedir(), ".claude", "projects");
  }
  ```
- [ ] Update all references to `PROJECTS_ROOT` within the file to call `getProjectsRoot()` instead:
  - Line ~68: `return entries.filter((e) => e.isDirectory()).map((e) => e.name);` inside listProjectDirEntries() uses `const dir = path.join(PROJECTS_ROOT, slug);` → change to `getProjectsRoot()`
  - Line ~118: `const dir = path.join(PROJECTS_ROOT, slug);` inside listActiveProjectDirs() → change to `getProjectsRoot()`
  - Any other references (verify by grepping for PROJECTS_ROOT in the file after the const is removed)
- [ ] Run the test: `npm test -- tests/projects-root-override.test.ts`, expect PASS.
- [ ] Commit: `git add scripts/lib/session-cost-scanner.ts tests/projects-root-override.test.ts && git commit -m "chore(session-cost-scanner): make projects root injectable via CREW_PROJECTS_ROOT env var"`

## Task 2 — Injectable projects root in session-cost.ts

Files: Modify `scripts/lib/session-cost.ts`.

- [ ] Read scripts/lib/session-cost.ts lines 1–100; identify all uses of the `const PROJECTS_ROOT = path.join(os.homedir(), ".claude", "projects");` at line 7.
- [ ] Replace the module-level const with the same lazy function:
  ```ts
  function getProjectsRoot(): string {
    const override = process.env.CREW_PROJECTS_ROOT;
    return override ? path.resolve(override) : path.join(os.homedir(), ".claude", "projects");
  }
  ```
- [ ] Update all references:
  - Line ~49: `const dir = path.join(PROJECTS_ROOT, slug);` inside listProjectSessions() → `getProjectsRoot()`
  - Line ~103: `const dir = path.join(PROJECTS_ROOT, slug);` inside autoDetectSourceProject() → `getProjectsRoot()`
  - Line ~121: `const dir = path.join(PROJECTS_ROOT, slug);` inside listActiveProjectDirs() → `getProjectsRoot()`
  - Verify no other references remain by grepping.
- [ ] Run `npm test` to ensure no regressions; expect all tests to pass.
- [ ] Commit: `git add scripts/lib/session-cost.ts && git commit -m "chore(session-cost): make projects root injectable via CREW_PROJECTS_ROOT env var"`

## Task 3 — In-process runCrew() entry point

Files: Modify `scripts/crew.ts`; Create `tests/run-crew.test.ts`.

- [ ] Read the full scripts/crew.ts to understand main() flow (lines 815–841).
- [ ] Extract the command dispatch logic into a new exported async function at the top level (before main()):
  ```ts
  export async function runCrew(argv: string[]): Promise<{ code: number; output: string }> {
    try {
      const { command, helpTarget, flags, positionals } = parseArgs(argv);
      const repoPath = path.resolve(normalizeMsysPath(flags.repo));
      if (command === "help") return { code: 0, output: usage(helpTarget) };
      const handler = (COMMANDS as Record<string, (ctx: CommandContext) => Promise<unknown>>)[command];
      if (!handler) return { code: 1, output: `Unknown command: ${command}` };
      const result = await handler({ repoPath, flags, positionals });
      return { code: 0, output: typeof result === "string" ? result : JSON.stringify(result, null, 2) };
    } catch (error) {
      return { code: 1, output: (error as Error).message };
    }
  }
  ```
- [ ] Update main() to use runCrew() and exit appropriately:
  ```ts
  async function main() {
    const { code, output } = await runCrew(process.argv.slice(2));
    if (code === 0) {
      console.log(output);
    } else {
      console.error(output);
      process.exitCode = 1;
    }
  }
  ```
- [ ] Guard the invocation of main() so importing crew.ts from tests does NOT execute it automatically:
  ```ts
  import { pathToFileURL } from "node:url";
  const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
  if (isDirectRun) {
    void main();
  }
  ```
- [ ] Create `tests/run-crew.test.ts` with three tests:
  - Test 1: `runCrew(["help"])` returns `{ code: 0, output: "..." }` where output contains "Usage:" and "init".
  - Test 2: `runCrew(["unknown-command"])` returns `{ code: 1, output: "Unknown command: unknown-command" }`.
  - Test 3: Happy path with a real command: init a temp repo and verify `{ code: 0, output: JSON.parse(...) }` contains `mode: "init"`.
- [ ] Run the tests: `npm test -- tests/run-crew.test.ts`, expect all 3 PASS.
- [ ] Run `npm test` to ensure no regressions in the full suite.
- [ ] Commit: `git add scripts/crew.ts tests/run-crew.test.ts && git commit -m "feat(crew): export in-process runCrew() entry point for test efficiency"`

## Task 4 — Extract cli-fixtures.ts, then split tests/cli.test.ts into cli-claims.test.ts

Files: Create `tests/helpers/cli-fixtures.ts`; Create `tests/cli-claims.test.ts`; Modify `tests/cli.test.ts` (remove moved tests).

- [ ] Read tests/cli.test.ts lines 1–16 to extract the shared helper functions and constants (`execFile`, `cliPath`, `makeTempDir`, `loadState`).
- [ ] Create `tests/helpers/cli-fixtures.ts` and export all four helpers:
  ```ts
  import fs from "node:fs/promises";
  import os from "node:os";
  import path from "node:path";
  import { execFile as execFileCallback } from "node:child_process";
  import { fileURLToPath } from "node:url";
  import { promisify } from "node:util";

  export const execFile = promisify(execFileCallback);
  export const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  export const cliPath = path.join(repoRoot, "scripts", "crew.ts");

  export async function makeTempDir(prefix: string) {
    return fs.mkdtemp(path.join(os.tmpdir(), prefix));
  }

  export async function loadState(repoPath: string) {
    const raw = await fs.readFile(
      path.join(repoPath, ".claude", "state", "crew", "workflow-state.json"),
      "utf8"
    );
    return JSON.parse(raw);
  }
  ```
- [ ] Update tests/cli.test.ts: remove the helper definitions (lines 10–16 for the functions, keep only imports at the top); add a single import line: `import { execFile, cliPath, makeTempDir, loadState } from "./helpers/cli-fixtures.ts";`
- [ ] Run `npm test -- tests/cli.test.ts` (should still pass; validates the transition).
- [ ] Proceed to identify and move tests in the "claims" family:

  - "CLI init creates a harnessed repo" (lines 7–26)
  - "CLI bootstrap preserves existing CLAUDE.md content" (lines 28–47)
  - "CLI claim and release manage repo-local claims" (lines 49–105)
  - Related setup: init via execFile in these tests
- [ ] Create `tests/cli-claims.test.ts` with the same imports as cli.test.ts but:
  - Import `runCrew` from `scripts/crew.ts` (new export from Task 3)
  - Import `execFile, cliPath, makeTempDir, loadState` from `tests/helpers/cli-fixtures.ts`
- [ ] Convert the first test ("CLI init creates a harnessed repo") as a full example:
  ```ts
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
  ```
  (The key change: `await runCrew([...])` returns `{ code, output }` instead of the subprocess `{ stdout }`. Parse output directly.)
- [ ] Apply the same mechanical conversion to the remaining two tests in the claims family (bootstrap, claim+release). Show the full converted code for the claim+release test as the second example.
- [ ] Remove these three tests from tests/cli.test.ts.
- [ ] Run `npm test -- tests/cli-claims.test.ts`, expect 3 PASS.
- [ ] Run `npm test` to ensure the full suite still passes and no fixtures are broken.
- [ ] Commit: `git add tests/cli-claims.test.ts tests/cli.test.ts && git commit -m "test(cli-claims): split claims family from cli.test.ts, convert to runCrew() in-process calls"`

## Task 5 — Split tests/cli.test.ts into cli-approvals.test.ts

Files: Create `tests/cli-approvals.test.ts`; Modify `tests/cli.test.ts`.

- [ ] Identify the approvals family test in cli.test.ts:
  - "CLI approval requests can be listed and resolved" (lines 107–164)
- [ ] Create `tests/cli-approvals.test.ts` with the same boilerplate as cli-claims.test.ts.
- [ ] Convert the test using the runCrew() pattern from Task 4 (same mechanical conversion):
  - Where the old test calls `execFile("node", [cliPath, "request-approval", ...])`, call `await runCrew(["request-approval", ...])` instead.
  - Where the old code parses `stdout`, parse `output` directly.
- [ ] Remove the test from tests/cli.test.ts.
- [ ] Run `npm test -- tests/cli-approvals.test.ts`, expect 1 PASS.
- [ ] Commit: `git add tests/cli-approvals.test.ts tests/cli.test.ts && git commit -m "test(cli-approvals): split approvals family from cli.test.ts, convert to runCrew()"`

## Task 6 — Split tests/cli.test.ts into cli-artifacts.test.ts (write-* commands)

Files: Create `tests/cli-artifacts.test.ts`; Modify `tests/cli.test.ts`.

- [ ] Identify the artifacts family tests in cli.test.ts (excluding synthesis-cost family):
  - "CLI artifact writers create markdown artifacts" (lines 166–355) — this is the main one
  - "write-* commands embed --feature and --phase in frontmatter" (lines 1354–1413)
  - "write-handoff --repo-context appends ## Repo Layout section" (lines 1486–1507)
  - "write-handoff without --repo-context has no ## Repo Layout section" (lines 1509–1527)
  - "write-review-result with --validation-evidence emits frontmatter field and body section" (lines 1529–1560)
  - "write-review-result without --validation-evidence emits no frontmatter field and no body section" (lines 1562–1586)
  - "write-review-result with --validation-evidence empty string treats it as omitted" (lines 1588–1615)
  - "write-validation-result: --findings persisted in frontmatter" (lines 1618–1646)
  - "write-deployment-check: --findings persisted in frontmatter" (lines 1648–end of file, ~1677)
- [ ] Create `tests/cli-artifacts.test.ts` with boilerplate from earlier tasks.
- [ ] Convert the main "CLI artifact writers create markdown artifacts" test (the largest; lines 166–355) as the shown example. Show the full before/after for at least the first 3 write-* command calls in that test.
- [ ] For the remaining 7 tests, note that they follow the same mechanical conversion pattern; describe as "same mechanical conversion (show one example in cli-artifacts.test.ts)".
- [ ] Remove all 8 tests from tests/cli.test.ts (excluding the 2 write-final-synthesis tests that belong in Task 7).
- [ ] Run `npm test -- tests/cli-artifacts.test.ts`, expect 8 PASS.
- [ ] Commit: `git add tests/cli-artifacts.test.ts tests/cli.test.ts && git commit -m "test(cli-artifacts): split write-* artifact commands from cli.test.ts, convert to runCrew()"`

## Task 7 — Split tests/cli.test.ts into cli-synthesis-cost.test.ts (write-final-synthesis, cost-advise, cost-slice)

Files: Create `tests/cli-synthesis-cost.test.ts`; Modify `tests/cli.test.ts`.

**CRITICAL: This task must set CREW_PROJECTS_ROOT to a tiny fixture so cost-scanning commands don't scan the user's real ~/.claude/projects.**

- [ ] Identify the synthesis/cost family tests in cli.test.ts (all 6):
  - "write-final-synthesis rejects when --external-deltas is missing" (lines 1019–1049)
  - "write-final-synthesis accepts --external-deltas none and renders the section" (lines 1051–1093)
  - "CLI blocks final synthesis when workflow badges are still pending" (lines 947–1017)
  - "final-synthesis blocked when escalated_to_human set; --force overrides" (lines 1215–1271)
  - "cost-advise accepts --title --feature --phase and slugs filename + emits frontmatter" (lines 1434–1477)
  - "cost-slice embeds --feature and --phase in cost-report frontmatter" (lines 1479–1503)
- [ ] Create `tests/cli-synthesis-cost.test.ts` with:
  - Standard boilerplate imports from earlier tasks
  - A before() hook that sets `process.env.CREW_PROJECTS_ROOT` to a temp fixture directory
  - An after() hook that deletes the directory and unsets the env var
  - Inside the fixture setup, create a minimal project session structure:
    ```ts
    const fixtureRoot = await makeTempDir("crew-cost-tests-");
    const projectSlug = "test-project-cost";
    const projectDir = path.join(fixtureRoot, projectSlug);
    await fs.mkdir(projectDir, { recursive: true });
    // Create a minimal .jsonl file with one assistant turn:
    const sessionFile = path.join(projectDir, "session.jsonl");
    await fs.writeFile(sessionFile, JSON.stringify({
      type: "assistant",
      timestamp: "2026-05-22T00:01:00Z",
      message: { usage: { input_tokens: 100, output_tokens: 50 } }
    }) + "\n");
    process.env.CREW_PROJECTS_ROOT = fixtureRoot;
    ```
- [ ] Convert all 6 synthesis/cost tests using runCrew():
  - The two write-final-synthesis tests ("rejects when...", "accepts --external-deltas...") that block on missing --external-deltas and render the section
  - "CLI blocks final synthesis when workflow badges are still pending"
  - "final-synthesis blocked when escalated_to_human set; --force overrides"
  - "cost-advise accepts..." test: replace execFile subprocess calls with runCrew() calls
  - "cost-slice embeds..." test: same conversion
  - Show the full before/after for the cost-advise test as an example.
- [ ] Remove all 6 tests from tests/cli.test.ts.
- [ ] Run `npm test -- tests/cli-synthesis-cost.test.ts`, expect 6 PASS with CREW_PROJECTS_ROOT honored.
- [ ] Verify cost-scanning does NOT access ~/.claude/projects by checking the test logs or adding a debug assertion.
- [ ] Commit: `git add tests/cli-synthesis-cost.test.ts tests/cli.test.ts && git commit -m "test(cli-synthesis-cost): split cost commands from cli.test.ts, set CREW_PROJECTS_ROOT fixture, convert to runCrew()"`

## Task 7b — Split tests/cli.test.ts into cli-workflow.test.ts

Files: Create `tests/cli-workflow.test.ts`; Modify `tests/cli.test.ts`.

- [ ] Identify the workflow family tests in cli.test.ts (13 tests):
  - "CLI wake-up brief summarizes repo memory and state" (lines 368–535)
  - "CLI brief-me synthesizes workflow state, git activity, and next step" (lines 537–635)
  - "CLI brief-me is read-only for an uninitialized repo" (lines 637–653)
  - "CLI brief-me surfaces failed gates before generic next steps" (lines 655–701)
  - "CLI workflow state tracks gate badges and artifact progress" (lines 703–852)
  - "CLI workflow state and brief-me surface missing artifact write-backs after a completed phase" (lines 854–905)
  - "CLI workflow state and brief-me surface missing run briefs after meaningful progress starts" (lines 907–945)
  - "CLI subcommand help works without error" (lines 1095–1105)
  - "CLI install-global writes managed global memory into HOME" (lines 1107–1139)
  - "mark-badge blocked persists note + blockedBy" (lines 1149–1180)
  - "mark-badge escalated_to_human persists note" (lines 1182–1213)
  - "brief-me surfaces blocked in pending badges" (lines 1273–1311)
  - "brief-me reports routingTableStale=false when file recent or absent" (lines 1313–1343)
  - "brief-me reports routingTableStale=true when mtime > 30 days old" (lines 1345–1371)
- [ ] Create `tests/cli-workflow.test.ts` with boilerplate from earlier tasks (imports from helpers/cli-fixtures.ts).
- [ ] Convert all 13 workflow tests using the runCrew() pattern from Task 4. Show one full example (e.g., brief-me test) in the plan.
- [ ] **Caveat for install-global test:** it currently injects HOME via subprocess env in execFile options. When converting in-process, set and restore `process.env.HOME` (and `process.env.USERPROFILE` on Windows) around the runCrew call. If that proves fragile with async state leakage, keep this single test in cli-smoke.test.ts as a sixth spawn and document in the commit message.
- [ ] Remove all 13 workflow tests from tests/cli.test.ts.
- [ ] Run `npm test -- tests/cli-workflow.test.ts`, expect 13 PASS (or 12 PASS + 1 skipped if install-global remains in smoke).
- [ ] Commit: `git add tests/cli-workflow.test.ts tests/cli.test.ts && git commit -m "test(cli-workflow): split workflow family from cli.test.ts, convert to runCrew()"`

## Task 8 — Create cli-smoke.test.ts (exactly 5 real spawn smokes, one per family)

Files: Create `tests/cli-smoke.test.ts`; Modify `tests/cli.test.ts`.

- [ ] Create `tests/cli-smoke.test.ts` with imports including `execFile, cliPath, makeTempDir` from cli-fixtures.ts.
- [ ] Write exactly 5 tests, one per command family, each spawning one real subprocess (execFile):
  - **Smoke 1 — claims**: spawn `node --experimental-strip-types crew.ts init --repo <temp>`, assert exit code 0 and output JSON contains `mode: "init"`
  - **Smoke 2 — approvals**: spawn `node crew.ts request-approval --repo <temp> --summary "test"`, assert exit code 0 and output JSON has `id` field
  - **Smoke 3 — artifacts**: spawn `node crew.ts write-handoff --repo <temp> --title "test" --from builder`, assert exit code 0 and output JSON has `path` field
  - **Smoke 4 — synthesis**: spawn `node crew.ts write-final-synthesis --repo <temp> --title "test" --external-deltas none`, assert exit code 0 and output JSON has `path` field
  - **Smoke 5 — cost**: spawn `node crew.ts cost-advise --repo <temp>`, assert exit code 0 and output JSON has `artifactPath` or similar field
  - Each test should verify stdout is clean (not garbled), JSON-parseable, and the process exits cleanly with code 0.
- [ ] Remove any remaining execFile calls from tests/cli.test.ts (except the 5 smokes you just wrote).
- [ ] Run `npm test -- tests/cli-smoke.test.ts`, expect 5 PASS.
- [ ] Commit: `git add tests/cli-smoke.test.ts tests/cli.test.ts && git commit -m "test(cli-smoke): add 5 process-level spawn smokes (one per command family) for regression coverage"`

## Task 9 — Delete the now-empty tests/cli.test.ts

Files: Delete `tests/cli.test.ts`.

- [ ] Verify that all tests have been moved to the split files:
  - cli-claims.test.ts: 3 tests
  - cli-approvals.test.ts: 1 test
  - cli-artifacts.test.ts: 8 tests (excluding 2 write-final-synthesis moved to Task 7)
  - cli-synthesis-cost.test.ts: 6 tests (2 write-final-synthesis + 2 gate enforcement + 2 cost commands)
  - cli-workflow.test.ts: 13 tests (wake-up, brief-me variants, state tracking, mark-badge variants, routing-table checks)
  - cli-smoke.test.ts: 5 tests (one per family: claims, approvals, artifacts, synthesis, cost)
  - run-crew.test.ts: 3 tests (new)
  - projects-root-override.test.ts: 1 test (new)
  - **Total original cli.test.ts: 3 + 1 + 8 + 6 + 13 = 31 tests; 2 additional tests (help, install-global) move to cli-workflow = 33 tests**
- [ ] Ensure no test remains in tests/cli.test.ts by reading it (should be very few or empty).
- [ ] Delete the file: `rm tests/cli.test.ts`
- [ ] Run `npm test` and verify all 573 tests pass (no regression).
- [ ] Commit: `git add -A && git commit -m "test(cli): delete original cli.test.ts (fully migrated to split per-family files)"`

## Task 10 — Timing verification + AC check

Files: None (verification only).

- [ ] Run `npm test` with a PowerShell timer to measure wall-clock time:
  ```powershell
  $result = Measure-Command { npm test }
  Write-Host "Test suite completed in $($result.TotalSeconds) seconds"
  ```
  Expected: ≤40 seconds (interim node-only target).
- [ ] Verify the last 10 lines of test output show 573+ tests passing:
  ```bash
  npm test 2>&1 | tail -20
  ```
  Expected output like: `✔ ... passes` and `tests ... ok`
- [ ] Run the AC-WS1 verification command from the spec (grep for execFile in spawns):
  ```bash
  grep -rn "execFile.*crew.ts" tests/ | grep -v "smoke\|spawn" | wc -l
  ```
  Expected: 0 (no subprocess spawns in main assertions).
- [ ] Verify per-command test files exist:
  ```bash
  ls tests/cli-*.test.ts 2>&1
  ```
  Expected: at least 5 files (claims, approvals, artifacts, synthesis-cost, smoke) + the new run-crew.test.ts + projects-root-override.test.ts.
- [ ] Record the timing numbers in the final commit message.
- [ ] Commit: `git add --allow-empty && git commit -m "chore(perf): WS1 test suite speedup complete — 116s → <40s (measured: XXs on node 22.6); 573 tests pass, zero subprocess spawns in core assertions, per-family files parallelized"`

---

## Notes & Deviations

**Deliberate Addition:** Task 1–2 (injectable projects root via CREW_PROJECTS_ROOT) are NOT in the original WS1 spec but are a required prerequisite for Task 7 (cost-scanning tests). They are included because the spec's AC-WS1-2 requires "zero subprocess execFile calls remain in core test assertions," and cost-slice/cost-advise commands would otherwise spend 15–20s scanning the user's real ~/.claude/projects dir during test runs. This addition is essential for meeting the ≤40s timing target.

**Test Count:** The original cli.test.ts contains 33 tests. After splitting:
- cli-claims.test.ts: 3 tests
- cli-approvals.test.ts: 1 test
- cli-artifacts.test.ts: 8 tests
- cli-synthesis-cost.test.ts: 6 tests
- cli-workflow.test.ts: 13 tests
- cli-smoke.test.ts: 5 tests
- run-crew.test.ts: 3 tests (new)
- projects-root-override.test.ts: 1 test (new)
- **Total: 3 + 1 + 8 + 6 + 13 + 5 + 3 + 1 = 40 tests covering all 33 original tests plus 7 new tests**

**AC Alignment:**
- **AC-WS1-1:** ✅ runCrew() exported, returns `{ code, output }`, happy-path code 0.
- **AC-WS1-2:** ✅ grep for execFile shows 0 in main assertions (only 5 spawn smokes remain).
- **AC-WS1-3:** ✅ Files split into 5 families; node --test parallelizes across cores; measured ≤40s.
- **AC-WS1-4:** ✅ 5 smoke tests (one per family) check exit codes, stdout hygiene, no hangs.

---

## Appendix: Key Code Examples

### Example 1 — getProjectsRoot() pattern (Tasks 1–2)
```ts
// OLD (hardcoded):
const PROJECTS_ROOT = path.join(os.homedir(), ".claude", "projects");

// NEW (injectable):
function getProjectsRoot(): string {
  const override = process.env.CREW_PROJECTS_ROOT;
  return override ? path.resolve(override) : path.join(os.homedir(), ".claude", "projects");
}

// Then replace all PROJECTS_ROOT with getProjectsRoot()
const dir = path.join(getProjectsRoot(), slug);
```

### Example 2 — runCrew() entry point (Task 3)
```ts
export async function runCrew(argv: string[]): Promise<{ code: number; output: string }> {
  try {
    const { command, helpTarget, flags, positionals } = parseArgs(argv);
    const repoPath = path.resolve(normalizeMsysPath(flags.repo));
    if (command === "help") return { code: 0, output: usage(helpTarget) };
    const handler = (COMMANDS as Record<string, (ctx: CommandContext) => Promise<unknown>>)[command];
    if (!handler) return { code: 1, output: `Unknown command: ${command}` };
    const result = await handler({ repoPath, flags, positionals });
    return { code: 0, output: typeof result === "string" ? result : JSON.stringify(result, null, 2) };
  } catch (error) {
    return { code: 1, output: (error as Error).message };
  }
}
```

### Example 3 — CLI test conversion (Tasks 4–7)
```ts
// OLD (subprocess):
const { stdout } = await execFile("node", [
  "--experimental-strip-types",
  cliPath,
  "init",
  "--repo",
  repoPath
]);
const result = JSON.parse(stdout);

// NEW (in-process):
const { code, output } = await runCrew(["init", "--repo", repoPath]);
assert.equal(code, 0, "init should exit with code 0");
const result = JSON.parse(output);
```

### Example 4 — Cost test fixture setup (Task 7)
```ts
import test from "node:test";

let fixtureRoot: string;

test("cost-scanning tests", async (t) => {
  await t.test("setup fixture", async () => {
    fixtureRoot = await makeTempDir("crew-cost-tests-");
    const projectDir = path.join(fixtureRoot, "test-project-cost");
    await fs.mkdir(projectDir, { recursive: true });
    await fs.writeFile(
      path.join(projectDir, "session.jsonl"),
      JSON.stringify({
        type: "assistant",
        timestamp: "2026-05-22T00:01:00Z",
        message: { usage: { input_tokens: 100, output_tokens: 50 } }
      }) + "\n"
    );
    process.env.CREW_PROJECTS_ROOT = fixtureRoot;
  });

  await t.test("cost-advise ...", async () => {
    // test body using runCrew()
  });

  await t.test("cleanup", async () => {
    delete process.env.CREW_PROJECTS_ROOT;
    await fs.rm(fixtureRoot, { recursive: true });
  });
});
```

---

**Execution checklist:**
- [ ] All tasks completed with checkbox steps marked done
- [ ] No placeholders remain in code examples
- [ ] Type signatures match exactly (runCrew returns `{ code: number; output: string }`)
- [ ] All file paths are absolute and verified to exist (e.g., scripts/crew.ts, scripts/lib/session-cost-scanner.ts)
- [ ] Commit messages are descriptive and follow the repo's style
- [ ] Final npm test produces ≤40s wall-clock time
- [ ] All 573 tests pass (or a documented subset if some were consolidated)

```

### scripts/crew.ts

```
#!/usr/bin/env node

import path from "node:path";
import { pathToFileURL } from "node:url";
import { maybeEmitCostReport } from "./lib/cost-hygiene/emit-cost-report.ts";
import { costSliceHandler } from "./lib/cost-hygiene/cost-slice-handler.ts";
import { normalizeMsysPath } from "./lib/fs-utils.ts";

// Flag schema. Each entry maps a CLI flag to the flags-object key and the
// arity (whether it consumes a value). Aliases (e.g. `--verdict` → `decision`)
// are supported by giving two entries the same target key. parseArgs() drives
// off this table instead of a 350-line if-chain.
//
// Keep entries alphabetized within each arity group for diffability.
const FLAG_SPEC = {
  // Boolean flags (no value).
  "--allow-existing": { key: "allowExisting", boolean: true },
  "--help": { key: "help", boolean: true },
  "-h": { key: "help", boolean: true },
  "--force": { key: "force", boolean: true },
  "--aggregate-all": { key: "aggregateAll", boolean: true },
  "--no-self": { key: "noSelf", boolean: true },
  "--non-code": { key: "nonCode", boolean: true },
  "--repo-context": { key: "repoContext", boolean: true },
  // Value-consuming flags.
  "--alerts": { key: "alerts" },
  "--approver": { key: "approver" },
  "--badge": { key: "badge" },
  "--blocked-by": { key: "blockedBy" },
  "--build": { key: "build" },
  "--builder": { key: "builder" },
  "--clues": { key: "clues" },
  "--commit-pattern": { key: "commitPattern" },
  "--completed-at": { key: "completedAt" },
  "--confidence": { key: "confidence" },
  "--decision": { key: "decision" },
  "--deliverable": { key: "deliverable" },
  "--deploy": { key: "deploy" },
  "--deployer": { key: "deployer" },
  "--discovery-status": { key: "discoveryStatus" },
  "--environment": { key: "environment" },
  "--environments": { key: "environments" },
  "--evidence": { key: "evidence" },
  "--external-deltas": { key: "externalDeltas" },
  "--extra-root": { key: "extraRoot" },
  "--feat": { key: "feat" },
  "--feature": { key: "feature" },
  "--files": { key: "files" },
  "--files-read": { key: "filesRead" },
  "--findings": { key: "findings" },
  "--from": { key: "from" },
  "--goal": { key: "goal" },
  "--handoff": { key: "handoff" },
  "--id": { key: "id" },
  "--kind": { key: "kind" },
  "--logs": { key: "logs" },
  "--metrics": { key: "metrics" },
  "--missing": { key: "missing" },
  "--mode": { key: "mode" },
  "--next": { key: "next" },
  "--note": { key: "note" },
  "--out-of-scope": { key: "outOfScope" },
  "--owner": { key: "owner" },
  "--pace": { key: "pace" },
  "--phase": { key: "phase" },
  "--preset": { key: "preset" },
  "--reason": { key: "reason" },
  "--refresh-when": { key: "refreshWhen" },
  "--repo": { key: "repo" },
  "--requester": { key: "requester" },
  "--resolver": { key: "resolver" },
  "--resource": { key: "resource" },
  "--revision": { key: "revision" },
  "--reviewer": { key: "reviewer" },
  "--reviewer-label": { key: "reviewerLabel" },
  "--risks": { key: "risks" },
  "--run": { key: "run" },
  "--run-steps": { key: "runSteps" },
  "--run-title": { key: "runTitle" },
  "--source-project": { key: "sourceProject" },
  "--scope": { key: "scope" },
  "--severity": { key: "severity" },
  "--slice": { key: "slice" },
  "--started-at": { key: "startedAt" },
  "--status": { key: "status" },
  "--summary": { key: "summary" },
  "--telemetry": { key: "telemetry" },
  "--test-summary": { key: "testSummary" },
  "--test-summary-skip-reason": { key: "testSummarySkipReason" },
  "--title": { key: "title" },
  "--to": { key: "to" },
  "--trigger-filename": { key: "triggerFilename" },
  "--update": { key: "updatePath" },
  "--url": { key: "url" },
  "--validation-evidence": { key: "validationEvidence" },
  "--validator": { key: "validator" },
  "--verdict": { key: "decision" }, // alias of --decision
  "--verified-from": { key: "verifiedFrom" }
} as const;

type FlagSpecValues = (typeof FLAG_SPEC)[keyof typeof FLAG_SPEC];
type FlagKey = Exclude<FlagSpecValues["key"], "repo">;
type Flags = {
  [K in FlagKey]: Extract<FlagSpecValues, { key: K }> extends { boolean: true }
    ? boolean
    : string | null;
} & { repo: string } & { [key: string]: string | boolean | null };

function parseArgs(argv: string[]) {
  const [command, ...rest] = argv;
  const flags: Flags = {
    repo: process.cwd(),
    allowExisting: false,
    help: false,
    force: false,
    owner: null,
    requester: null,
    approver: null,
    resolver: null,
    kind: null,
    severity: null,
    summary: null,
    reason: null,
    note: null,
    status: "open",
    id: null,
    decision: null,
    title: null,
    goal: null,
    mode: null,
    pace: null,
    scope: null,
    outOfScope: null,
    files: null,
    evidence: null,
    externalDeltas: null,
    risks: null,
    runSteps: null,
    next: null,
    from: null,
    to: null,
    deliverable: null,
    confidence: null,
    reviewer: null,
    validator: null,
    deployer: null,
    environment: null,
    build: null,
    deploy: null,
    environments: null,
    logs: null,
    metrics: null,
    alerts: null,
    telemetry: null,
    clues: null,
    discoveryStatus: null,
    verifiedFrom: null,
    missing: null,
    refreshWhen: null,
    resource: null,
    url: null,
    revision: null,
    badge: null,
    preset: null,
    commitPattern: null,
    triggerFilename: null,
    reviewerLabel: null,
    startedAt: null,
    completedAt: null,
    runTitle: null,
    sourceProject: null,
    blockedBy: null,
    feature: null,
    nonCode: false,
    noSelf: false,
    aggregateAll: false,
    repoContext: false,
    extraRoot: null,
    phase: null,
    testSummary: null,
    testSummarySkipReason: null,
    findings: null,
    validationEvidence: null,
    builder: null,
    feat: null,
    filesRead: null,
    handoff: null,
    run: null,
    slice: null,
    updatePath: null
  };
  const positionals = [];

  for (let index = 0; index < rest.length; index += 1) {
    // noUncheckedIndexedAccess: guard the index even though the loop bound guarantees it
    const value = rest[index];
    if (value === undefined) continue;
    if (value === "--") {
      for (let tail = index + 1; tail < rest.length; tail += 1) {
        const tailVal = rest[tail];
        if (tailVal !== undefined) positionals.push(tailVal);
      }
      break;
    }
    const spec = (FLAG_SPEC as Record<string, { key: string; boolean?: boolean }>)[value];
    if (spec) {
      if (spec.boolean) {
        (flags as Record<string, string | boolean | null>)[spec.key] = true;
      } else {
        const nextVal = rest[index + 1] ?? null;
        (flags as Record<string, string | boolean | null>)[spec.key] = nextVal;
        index += 1;
      }
      continue;
    }
    if (value.startsWith("--")) {
      throw new Error(`Unknown argument: ${value}`);
    }
    positionals.push(value);
  }

  if (!command || command === "--help" || command === "-h") {
    return { command: "help", helpTarget: null, flags, positionals };
  }
  if (flags.help) {
    return { command: "help", helpTarget: command, flags, positionals };
  }
  return { command, helpTarget: null, flags, positionals };
}

function usage(target: string | null = null) {
  const subcommands = {
    "install-global": "  node scripts/crew.mjs install-global",
    audit: "  node scripts/crew.mjs audit --repo <path>",
    bootstrap: "  node scripts/crew.mjs bootstrap --repo <path>",
    init: "  node scripts/crew.mjs init --repo <path> [--allow-existing]",
    claim: "  node scripts/crew.mjs claim --repo <path> [--owner <name>] <files...>",
    release: "  node scripts/crew.mjs release --repo <path> [--owner <name>] [files...]",
    "show-claims": "  node scripts/crew.mjs show-claims --repo <path>",
    "show-conflicts":
      "  node scripts/crew.mjs show-conflicts --repo <path> [--owner <name>] [files...]",
    "request-approval":
      "  node scripts/crew.mjs request-approval --repo <path> --summary <text> [--kind <kind>] [--severity <level>] [--requester <name>] [--approver <name>] [--reason <text>]",
    "show-approvals":
      "  node scripts/crew.mjs show-approvals --repo <path> [--status open|resolved|all] [--approver <name>]",
    "resolve-approval":
      "  node scripts/crew.mjs resolve-approval --repo <path> --id <approval-id> --decision approved|rejected|canceled [--resolver <name>] [--note <text>]",
    "wake-up": "  node scripts/crew.mjs wake-up --repo <path>",
    "brief-me": "  node scripts/crew.mjs brief-me --repo <path>",
    "scope-estimate":
      "  node scripts/crew.mjs scope-estimate --files <path:lines[:eslintDisable],...>",
    "discover-deployment": "  node scripts/crew.mjs discover-deployment --repo <path>",
    "write-deployment-guidance":
      "  node scripts/crew.mjs write-deployment-guidance --repo <path> --title <text> [--discovery-status repo-derived|partial|live-verified] [--verified-from <a,b>] [--missing <a,b>] [--summary <text>] [--build <text>] [--deploy <text>]",
    "show-workflow-state": "  node scripts/crew.mjs show-workflow-state --repo <path>",
    "mark-badge":
      "  node scripts/crew.mjs mark-badge --repo <path> --badge review_required|review_passed|review_failed|review_skipped|validation_expected|validation_passed|validation_failed|validation_skipped|dev_deploy_expected|dev_checked|dev_failed|dev_skipped|prod_deploy_expected|prod_checked|prod_failed|prod_skipped|blocked|escalated_to_human [--note <text>] [--blocked-by <artifact-id>]",
    "write-run-brief":
      "  node scripts/crew.mjs write-run-brief --repo <path> --title <text> [--goal <text>] [--mode <mode>] [--pace <pace>]",
    "write-build-bundle":
      "  node scripts/crew.ts write-build-bundle --repo <path> --slice <SLICE-NN> --builder <builder|builder-be|builder-fe> --run <YYYYMMDDTHHMMSSZ> --handoff <path> [--feat <FEAT-NNN>] [--files <a,b>] [--files-read <c,d>]",
    "write-handoff":
      "  node scripts/crew.mjs write-handoff --repo <path> --title <text> [--from <role>] [--to <role>] [--files <a,b>]",
    "write-review-result":
      "  node scripts/crew.mjs write-review-result --repo <path> --title <text> [--reviewer <role>] [--decision <decision>] [--verdict <decision>]",
    "write-validation-plan":
      "  node scripts/crew.mjs write-validation-plan --repo <path> --title <text> [--validator <role>] [--environment <name>]",
    "write-validation-result":
      "  node scripts/crew.mjs write-validation-result --repo <path> --title <text> [--validator <role>] [--environment <name>] [--decision <decision>]",
    "write-deployment-check":
      "  node scripts/crew.mjs write-deployment-check --repo <path> --title <text> [--deployer <role>] [--environment dev|prod] [--resource <name>] [--url <service-url>] [--revision <id>] [--decision <decision>]",
    "write-final-synthesis":
      "  node scripts/crew.mjs write-final-synthesis --repo <path> --title <text> --external-deltas <text|none> [--summary <text>] [--run-steps <a,b>] [--files <a,b>] [--force]",
    "cost-slice":
      "  node scripts/crew.mjs cost-slice --repo <path> [--started-at <iso>] [--completed-at <iso>] [--run-title <text>] [--source-project <slug>] [--aggregate-all]",
    "cost-advise": "  node scripts/crew.mjs cost-advise --repo <path>"
  };

  const subcommandsMap = subcommands as Record<string, string | undefined>;
  if (target && subcommandsMap[target]) {
    return ["Engineering OS installer", "", "Usage:", subcommandsMap[target]].join("\n");
  }

  return ["Engineering OS installer", "", "Usage:", ...Object.values(subcommands)].join("\n");
}

// Slug source priority: explicit --title → advisor target slice → advisor
// target runTitle → fallback "advise". --title lets the loop side pass the
// enriched FEAT/PHASE/SLICE tag so cost-advise filenames match the rest of
// the artifact surface.
function buildCostAdviseSlug(title: string | null, advisor: Record<string, unknown> | null) {
  const t = advisor?.["target"] as { sliceId?: string; runTitle?: string } | null | undefined;
  const source = title || t?.sliceId || t?.runTitle || "advise";
  return source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// Optional YAML frontmatter block; "" when both feature + phase absent so
// existing output stays byte-identical for legacy callers.
function buildOptionalFrontmatter(feature: string | null, phase: string | null) {
  const lines = [];
  if (phase !== null && phase !== undefined && String(phase).length > 0) {
    lines.push(`phase: ${JSON.stringify(String(phase))}`);
  }
  if (feature) lines.push(`feature: ${feature}`);
  if (lines.length === 0) return "";
  return ["---", ...lines, "---", ""].join("\n");
}

async function writeCostAdviseArtifact(
  repoPath: string,
  md: string,
  advisor: Record<string, unknown> | null,
  options: { title?: string | null; feature?: string | null; phase?: string | null } = {}
) {
  const fs = await import("node:fs/promises");
  const pathMod = await import("node:path");
  const { title = null, feature = null, phase = null } = options;
  const dir = pathMod.join(repoPath, ".claude", "artifacts", "crew", "cost-insights");
  await fs.mkdir(dir, { recursive: true });
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
  const slug = buildCostAdviseSlug(title, advisor);
  const fm = buildOptionalFrontmatter(feature, phase);
  const file = pathMod.join(dir, `${stamp}-cost-advise-${slug}.md`);
  await fs.writeFile(file, fm + md + "\n");
  return file;
}

// Auto-emit a cost-report artifact when a run window is available. Designed
// to be called immediately after write-final-synthesis. Failures here are
// non-fatal: they return null so the synthesis result still surfaces.
// Best-effort cost-advise emit. Returns a description object on success,
// `{ error }` on failure. Extracted from maybeEmitCostReport to keep its
// cyclomatic complexity under the eslint cap.
async function emitCostAdvise(
  repoPath: string,
  { title, feature, phase }: { title: string | null; feature: string | null; phase: string | null }
) {
  try {
    const { buildCostAdvisor, renderCostAdvisorMarkdown } = await import("./lib/cost-advisor.ts");
    const advisor = await buildCostAdvisor(repoPath, { limit: 10 });
    const md = renderCostAdvisorMarkdown(advisor);
    const advisePath = await writeCostAdviseArtifact(
      repoPath,
      md,
      advisor as unknown as Record<string, unknown>,
      {
        title,
        feature,
        phase
      }
    );
    return {
      path: advisePath,
      recommendations: advisor.recommendations?.length || 0,
      aggregateFlags: advisor.aggregateFlags?.length || 0
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: message };
  }
}

interface CommandContext {
  repoPath: string;
  flags: Flags;
  positionals: string[];
}

// Command registry. Each entry is `(ctx) => Promise<result>` where
// `ctx = { repoPath, flags, positionals }`. main() dispatches by name; the
// table replaces a 240-line else-if chain. Adding a command = one entry.
const COMMANDS = {
  "install-global": async () => {
    const { installGlobal } = await import("./lib/installer.ts");
    return installGlobal();
  },
  audit: async ({ repoPath }: CommandContext) => {
    const { auditRepo } = await import("./lib/installer.ts");
    return auditRepo(repoPath);
  },
  bootstrap: async ({ repoPath }: CommandContext) => {
    const { bootstrapRepo } = await import("./lib/installer.ts");
    const result = await bootstrapRepo(repoPath);
    if (!result.ok) {
      console.error(`Repository path does not exist: ${repoPath}`);
      process.exit(1);
    }
    return result.value;
  },
  init: async ({ repoPath, flags }: CommandContext) => {
    const { initRepo } = await import("./lib/installer.ts");
    return initRepo(repoPath, { allowExisting: flags.allowExisting });
  },

  claim: async ({ repoPath, flags, positionals }: CommandContext) => {
    const { claimFiles } = await import("./lib/claims.ts");
    const result = await claimFiles(repoPath, positionals, {
      owner: flags.owner || "lead-session"
    });
    if (!result.ok) {
      console.error(result.error.message);
      process.exit(1);
    }
    return result.value;
  },
  release: async ({ repoPath, flags, positionals }: CommandContext) => {
    const { releaseFiles } = await import("./lib/claims.ts");
    const result = await releaseFiles(
      repoPath,
      positionals,
      flags.owner !== null ? { owner: flags.owner } : {}
    );
    if (!result.ok) {
      console.error(result.error.message);
      process.exit(1);
    }
    return result.value;
  },
  "show-claims": async ({ repoPath }: CommandContext) => {
    const { listClaims } = await import("./lib/claims.ts");
    return { claims: await listClaims(repoPath) };
  },
  "show-conflicts": async ({ repoPath, flags, positionals }: CommandContext) => {
    const { inspectClaims } = await import("./lib/claims.ts");
    return inspectClaims(repoPath, positionals, { owner: flags.owner || "lead-session" });
  },

  "request-approval": async ({ repoPath, flags, positionals }: CommandContext) => {
    const { requestApproval } = await import("./lib/approvals.ts");
    return requestApproval(repoPath, {
      requester: flags.requester || "lead-session",
      approver: flags.approver ?? undefined,
      kind: flags.kind || "scope_change",
      severity: flags.severity || "medium",
      summary: flags.summary || positionals.join(" ") || "Approval requested",
      reason: flags.reason || ""
    });
  },
  "show-approvals": async ({ repoPath, flags }: CommandContext) => {
    const { listApprovals } = await import("./lib/approvals.ts");
    return {
      approvals: await listApprovals(repoPath, {
        status: flags.status ?? undefined,
        approver: flags.approver
      })
    };
  },
  "resolve-approval": async ({ repoPath, flags }: CommandContext) => {
    const { resolveApproval } = await import("./lib/approvals.ts");
    const result = await resolveApproval(repoPath, {
      id: flags.id ?? undefined,
      decision: flags.decision ?? undefined,
      resolver: flags.resolver || "lead-session",
      note: flags.note || ""
    });
    if (!result.ok) {
      console.error(result.error.message);
      process.exit(1);
    }
    return result.value;
  },

  "wake-up": async ({ repoPath }: CommandContext) => {
    const { buildWakeUpBrief } = await import("./lib/wakeup.mjs");
    return buildWakeUpBrief(repoPath);
  },
  "brief-me": async ({ repoPath }: CommandContext) => {
    const { buildBriefingReport } = await import("./lib/briefing.ts");
    return buildBriefingReport(repoPath);
  },
  "scope-estimate": async ({ flags, positionals }: CommandContext) => {
    const { estimateScope } = await import("./lib/scope-estimate.ts");
    const rawFiles = (flags.files || positionals.join(",") || "").split(",").filter(Boolean);
    const files = rawFiles.map((entry) => {
      const [p, linesStr, eslintDisableStr] = entry.split(":");
      return {
        path: p || "",
        lines: parseInt(linesStr ?? "0", 10) || 0,
        eslintDisable: eslintDisableStr === "true"
      };
    });
    return estimateScope({ files });
  },
  fleet: async ({ repoPath, flags }: CommandContext) => {
    const { buildFleetReport } = await import("./lib/fleet.ts");
    return buildFleetReport(repoPath, {
      extraRoots: flags.extraRoot ? [flags.extraRoot] : [],
      includeSelf: !flags.noSelf
    });
  },
  "discover-deployment": async ({ repoPath }: CommandContext) => {
    const { discoverDeploymentClues } = await import("./lib/deployment-guidance/read.ts");
    return discoverDeploymentClues(repoPath);
  },
  "write-deployment-guidance": async ({ repoPath, flags, positionals }: CommandContext) => {
    const { writeDeploymentGuidance } = await import("./lib/deployment-guidance/write.ts");
    const r = await writeDeploymentGuidance(repoPath, {
      title: flags.title || positionals.join(" ") || "Repo Deployment Model",
      owner: flags.owner || "lead-session",
      summary: flags.summary ?? undefined,
      build: flags.build ?? undefined,
      deploy: flags.deploy ?? undefined,
      environments: flags.environments ?? undefined,
      logs: flags.logs ?? undefined,
      metrics: flags.metrics ?? undefined,
      alerts: flags.alerts ?? undefined,
      telemetry: flags.telemetry ?? undefined,
      clues: flags.clues ?? undefined,
      discoveryStatus: flags.discoveryStatus ?? undefined,
      verifiedFrom: flags.verifiedFrom ?? undefined,
      missing: flags.missing ?? undefined,
      refreshWhen: flags.refreshWhen ?? undefined,
      next: flags.next ?? undefined
    });
    if (!r.ok) throw r.error;
    return r.value;
  },

  "show-workflow-state": async ({ repoPath }: CommandContext) => {
    const { loadWorkflowState, summarizeWorkflowState } = await import("./lib/workflow-state.ts");
    const workflowState = await loadWorkflowState(repoPath);
    return { workflowState, summary: summarizeWorkflowState(workflowState) };
  },
  "mark-badge": async ({ repoPath, flags }: CommandContext) => {
    const { markWorkflowBadge } = await import("./lib/workflow-state.ts");
    const result = await markWorkflowBadge(repoPath, {
      badge: flags.badge ?? undefined,
      note: flags.note || flags.reason || "",
      blockedBy: flags.blockedBy,
      title: flags.title ?? undefined,
      goal: flags.goal ?? undefined,
      mode: flags.mode ?? undefined,
      next: flags.next ?? undefined
    });
    if (!result.ok) {
      console.error(result.error.message);
      process.exit(1);
    }
    return { badge: flags.badge, currentRun: result.value };
  },

  "write-run-brief": async ({ repoPath, flags, positionals }: CommandContext) => {
    const { writeArtifact } = await import("./lib/artifacts/write.ts");
    const r = await writeArtifact(repoPath, "run-brief", {
      title: flags.title || positionals.join(" ") || "Run Brief",
      goal: flags.goal ?? undefined,
      mode: flags.mode ?? undefined,
      pace: flags.pace ?? undefined,
      owner: flags.owner || "lead-session",
      status: flags.status === "open" ? "active" : (flags.status ?? undefined),
      summary: flags.summary ?? undefined,
      scope: flags.scope ?? undefined,
      outOfScope: flags.outOfScope ?? undefined,
      files: flags.files ?? undefined,
      next: flags.next ?? undefined,
      feature: flags.feature ?? undefined,
      phase: flags.phase ?? undefined
    });
    if (!r.ok) throw r.error;
    return r.value;
  },
  "write-build-bundle": async ({ repoPath, flags }: CommandContext) => {
    const { assembleBuildBundle } = await import("./lib/build-bundle/assemble.ts");
    const fs = await import("node:fs/promises");

    const slice = flags.slice ?? "unknown";
    const builder = flags.builder;
    const run = flags.run;
    const handoffPath = flags.handoff;

    if (!builder || !run || !handoffPath) {
      process.stderr.write(
        "[crew] write-build-bundle refused: --builder, --run, and --handoff are required.\n"
      );
      process.exit(2);
    }
    const validBuilders = new Set(["builder", "builder-be", "builder-fe"]);
    if (!validBuilders.has(builder)) {
      process.stderr.write(
        `[crew] write-build-bundle refused: --builder must be one of ${[...validBuilders].join(", ")}.\n`
      );
      process.exit(2);
    }

    const handoffBody = await fs.readFile(handoffPath, "utf8");
    const filesTouched = (flags.files ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const filesRead = (flags.filesRead ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const result = await assembleBuildBundle({
      repoPath,
      sliceId: slice,
      builderName: builder as "builder" | "builder-be" | "builder-fe",
      runId: run,
      ...(flags.feat !== null ? { feat: flags.feat } : {}),
      handoffBody,
      filesTouched,
      filesRead
    });
    return result.path;
  },
  "write-handoff": async ({ repoPath, flags, positionals }: CommandContext) => {
    const { writeArtifact } = await import("./lib/artifacts/write.ts");
    // Only pass status if it's not the default "open" value from parseArgs
    // (the default "open" is for issue creation, not for artifacts)
    const statusValue = flags.status !== "open" ? (flags.status ?? undefined) : undefined;
    const r = await writeArtifact(repoPath, "handoff", {
      title: flags.title || positionals.join(" ") || "Task Handoff",
      from: flags.from || flags.owner || "lead-session",
      to: flags.to ?? undefined,
      goal: flags.goal ?? undefined,
      summary: flags.summary ?? undefined,
      status: statusValue,
      scope: flags.scope ?? undefined,
      outOfScope: flags.outOfScope ?? undefined,
      deliverable: flags.deliverable ?? undefined,
      files: flags.files ?? undefined,
      confidence: flags.confidence ?? undefined,
      risks: flags.risks ?? undefined,
      next: flags.next ?? undefined,
      feature: flags.feature ?? undefined,
      phase: flags.phase ?? undefined,
      repoContext: flags.repoContext,
      updatePath: flags.updatePath ?? undefined
    });
    if (!r.ok) throw r.error;
    return r.value;
  },
  "write-review-result": async ({ repoPath, flags, positionals }: CommandContext) => {
    const decision = flags.decision;
    const VALID_DECISIONS = new Set(["approved", "approved_with_notes", "rejected"]);
    if (decision && !VALID_DECISIONS.has(decision)) {
      process.stderr.write(
        `[crew] write-review-result refused: unknown decision "${decision}". Valid values: approved, approved_with_notes, rejected.\n`
      );
      process.exit(2);
    }
    const isApproved = decision === "approved" || decision === "approved_with_notes";
    const isCodeBearing = !flags.nonCode;
    if (isApproved && isCodeBearing && !flags.testSummary && !flags.testSummarySkipReason) {
      process.stderr.write(
        "[crew] write-review-result refused: --test-summary or --test-summary-skip-reason is required for approved code-bearing reviews. " +
          "Pass --non-code if the diff is doc-only.\n"
      );
      process.exit(2);
    }
    const { writeArtifact } = await import("./lib/artifacts/write.ts");
    // Only pass status if it's not the default "open" value from parseArgs
    const statusValue = flags.status !== "open" ? (flags.status ?? undefined) : undefined;
    const r = await writeArtifact(repoPath, "review-result", {
      title: flags.title || positionals.join(" ") || "Review Result",
      reviewer: flags.reviewer || flags.owner || "reviewer",
      decision: decision ?? undefined,
      status: statusValue,
      summary: flags.summary ?? undefined,
      evidence: flags.evidence ?? undefined,
      files: flags.files ?? undefined,
      risks: flags.risks ?? undefined,
      next: flags.next ?? undefined,
      feature: flags.feature ?? undefined,
      phase: flags.phase ?? undefined,
      testSummary: flags.testSummary ?? undefined,
      testSummarySkipReason: flags.testSummarySkipReason ?? undefined,
      validationEvidence: flags.validationEvidence ?? undefined,
      nonCode: flags.nonCode ?? undefined,
      findings: flags.findings ?? null,
      updatePath: flags.updatePath ?? undefined
    });
    if (!r.ok) throw r.error;
    return r.value;
  },
  "write-validation-plan": async ({ repoPath, flags, positionals }: CommandContext) => {
    const { writeArtifact } = await import("./lib/artifacts/write.ts");
    const r = await writeArtifact(repoPath, "validation-plan", {
      title: flags.title || positionals.join(" ") || "Validation Plan",
      validator: flags.validator || flags.owner || "validator",
      owner: flags.owner || "lead-session",
      environment: flags.environment ?? undefined,
      goal: flags.goal ?? undefined,
      summary: flags.summary ?? undefined,
      scope: flags.scope ?? undefined,
      outOfScope: flags.outOfScope ?? undefined,
      evidence: flags.evidence ?? undefined,
      next: flags.next ?? undefined,
      feature: flags.feature ?? undefined,
      phase: flags.phase ?? undefined
    });
    if (!r.ok) throw r.error;
    return r.value;
  },
  "write-validation-result": async ({ repoPath, flags, positionals }: CommandContext) => {
    const { writeArtifact } = await import("./lib/artifacts/write.ts");
    // Only pass status if it's not the default "open" value from parseArgs
    const statusValue = flags.status !== "open" ? (flags.status ?? undefined) : undefined;
    const r = await writeArtifact(repoPath, "validation-result", {
      title: flags.title || positionals.join(" ") || "Validation Result",
      validator: flags.validator || flags.owner || "validator",
      environment: flags.environment ?? undefined,
      decision: flags.decision ?? undefined,
      status: statusValue,
      goal: flags.goal ?? undefined,
      summary: flags.summary ?? undefined,
      evidence: flags.evidence ?? undefined,
      files: flags.files ?? undefined,
      risks: flags.risks ?? undefined,
      next: flags.next ?? undefined,
      feature: flags.feature ?? undefined,
      phase: flags.phase ?? undefined,
      findings: flags.findings ?? null,
      updatePath: flags.updatePath ?? undefined
    });
    if (!r.ok) throw r.error;
    return r.value;
  },
  "write-deployment-check": async ({ repoPath, flags, positionals }: CommandContext) => {
    const { writeArtifact } = await import("./lib/artifacts/write.ts");
    const r = await writeArtifact(repoPath, "deployment-check", {
      title: flags.title || positionals.join(" ") || "Deployment Check",
      deployer: flags.deployer || flags.owner || "deployer",
      environment: flags.environment ?? undefined,
      resource: flags.resource ?? undefined,
      url: flags.url ?? undefined,
      revision: flags.revision ?? undefined,
      decision: flags.decision ?? undefined,
      goal: flags.goal ?? undefined,
      summary: flags.summary ?? undefined,
      evidence: flags.evidence ?? undefined,
      files: flags.files ?? undefined,
      risks: flags.risks ?? undefined,
      next: flags.next ?? undefined,
      feature: flags.feature ?? undefined,
      phase: flags.phase ?? undefined,
      findings: flags.findings ?? null
    });
    if (!r.ok) throw r.error;
    return r.value;
  },
  "write-final-synthesis": async ({ repoPath, flags, positionals }: CommandContext) => {
    if (flags.externalDeltas === null || flags.externalDeltas === undefined) {
      throw new Error(
        "write-final-synthesis requires --external-deltas. " +
          "Enumerate sibling-config changes the synthesis depends on " +
          "(env var renames, terraform/helm updates, sibling-repo PRs, feature flags, DB migrations, IAM). " +
          "Pass --external-deltas none explicitly if there are none. " +
          "A silent default is how renamed env vars silently fall back to old defaults in prod."
      );
    }
    const { writeArtifact } = await import("./lib/artifacts/write.ts");
    const synthResult = await writeArtifact(repoPath, "final-synthesis", {
      title: flags.title || positionals.join(" ") || "Final Synthesis",
      owner: flags.owner || "lead-session",
      status: flags.status === "open" ? "completed" : (flags.status ?? undefined),
      summary: flags.summary ?? undefined,
      files: flags.files ?? undefined,
      evidence: flags.evidence ?? undefined,
      externalDeltas: flags.externalDeltas ?? undefined,
      runSteps: flags.runSteps ?? undefined,
      risks: flags.risks ?? undefined,
      next: flags.next ?? undefined,
      force: flags.force ?? undefined,
      feature: flags.feature ?? undefined,
      phase: flags.phase ?? undefined
    });
    if (!synthResult.ok) throw synthResult.error;
    const synthesis = synthResult.value;
    const costArtifact = await maybeEmitCostReport(
      repoPath,
      {
        runTitle: flags.title || positionals.join(" ") || null,
        feature: flags.feature,
        phase: flags.phase
      },
      emitCostAdvise
    );
    return costArtifact ? { ...synthesis, costReport: costArtifact } : synthesis;
  },

  "cost-advise": async ({ repoPath, flags }: CommandContext) => {
    const { buildCostAdvisor, renderCostAdvisorMarkdown } = await import("./lib/cost-advisor.ts");
    const advisor = await buildCostAdvisor(repoPath, { limit: 10 });
    const md = renderCostAdvisorMarkdown(advisor);
    const writePath = await writeCostAdviseArtifact(
      repoPath,
      md,
      advisor as unknown as Record<string, unknown>,
      {
        title: flags.title,
        feature: flags.feature,
        phase: flags.phase
      }
    );
    return {
      target: advisor.target?.sliceId || advisor.target?.runTitle || null,
      recommendations: advisor.recommendations,
      aggregateFlags: advisor.aggregateFlags || [],
      baseline: advisor.baseline,
      reportsAnalyzed: advisor.reports.length,
      artifactPath: writePath
    };
  },
  "cost-slice": ({ repoPath, flags }: CommandContext) => costSliceHandler({ repoPath, flags })
};

export async function runCrew(argv: string[]): Promise<{ code: number; output: string }> {
  try {
    const { command, helpTarget, flags, positionals } = parseArgs(argv);
    const repoPath = path.resolve(normalizeMsysPath(flags.repo));

    if (command === "help") {
      return { code: 0, output: usage(helpTarget) };
    }

    const handler = (COMMANDS as Record<string, (ctx: CommandContext) => Promise<unknown>>)[
      command
    ];
    if (!handler) {
      return { code: 1, output: `Unknown command: ${command}` };
    }

    const result = await handler({ repoPath, flags, positionals });
    // String results are printed as-is (e.g. file paths); everything else is JSON.
    const output = typeof result === "string" ? result : JSON.stringify(result, null, 2);
    return { code: 0, output };
  } catch (error) {
    return { code: 1, output: (error as Error).message };
  }
}

async function main() {
  const { code, output } = await runCrew(process.argv.slice(2));
  if (code === 0) {
    console.log(output);
  } else {
    console.error(output);
    process.exitCode = 1;
  }
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isDirectRun) {
  void main();
}

```
