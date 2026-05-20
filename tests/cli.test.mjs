import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cliPath = path.join(repoRoot, "scripts", "crew.mjs");

async function makeTempDir(prefix) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

test("CLI init creates a harnessed repo", async () => {
  const rootPath = await makeTempDir("engineering-os-cli-init-");
  const repoPath = path.join(rootPath, "app");
  const { stdout } = await execFile("node", [cliPath, "init", "--repo", repoPath]);
  const result = JSON.parse(stdout);

  assert.equal(result.mode, "init");
  assert.equal(result.audit.hasHarnessLayer, true);
  assert.match(result.welcome.headline, /Crew/);
  assert.ok(result.welcome.commands.includes("/crew:brief-me"));

  const claudeMd = await fs.readFile(path.join(repoPath, "CLAUDE.md"), "utf8");
  assert.match(claudeMd, /crew:start/);
});

test("CLI bootstrap preserves existing CLAUDE.md content", async () => {
  const repoPath = await makeTempDir("engineering-os-cli-bootstrap-");
  await fs.writeFile(path.join(repoPath, "CLAUDE.md"), "# Existing\n");

  const { stdout } = await execFile("node", [cliPath, "bootstrap", "--repo", repoPath]);
  const result = JSON.parse(stdout);
  const claudeMd = await fs.readFile(path.join(repoPath, "CLAUDE.md"), "utf8");

  assert.equal(result.mode, "bootstrap");
  assert.match(result.welcome.headline, /Crew/);
  assert.ok(result.welcome.commands.includes("/crew:build"));
  assert.match(claudeMd, /# Existing/);
  assert.match(claudeMd, /crew:start/);
});

test("CLI claim and release manage repo-local claims", async () => {
  const repoPath = await makeTempDir("engineering-os-cli-claims-");
  await execFile("node", [cliPath, "init", "--repo", repoPath]);

  const claimOutput = await execFile("node", [
    cliPath,
    "claim",
    "--repo",
    repoPath,
    "--owner",
    "builder",
    "src/example.ts"
  ]);
  const claimResult = JSON.parse(claimOutput.stdout);
  assert.deepEqual(claimResult.claimed, ["src/example.ts"]);

  const conflictsOutput = await execFile("node", [
    cliPath,
    "show-conflicts",
    "--repo",
    repoPath,
    "--owner",
    "lead-session",
    "src/example.ts"
  ]);
  const conflictsResult = JSON.parse(conflictsOutput.stdout);
  assert.equal(conflictsResult.conflicts.length, 1);
  assert.equal(conflictsResult.conflicts[0].owner, "builder");
  assert.equal(conflictsResult.owned.length, 0);
  assert.equal(conflictsResult.available.length, 0);

  const ownedOutput = await execFile("node", [
    cliPath,
    "show-conflicts",
    "--repo",
    repoPath,
    "--owner",
    "builder",
    "src/example.ts",
    "src/free.ts"
  ]);
  const ownedResult = JSON.parse(ownedOutput.stdout);
  assert.equal(ownedResult.owned.length, 1);
  assert.equal(ownedResult.owned[0].path, "src/example.ts");
  assert.equal(ownedResult.conflicts.length, 0);
  assert.deepEqual(ownedResult.available, [{ path: "src/free.ts" }]);

  const releaseOutput = await execFile("node", [
    cliPath,
    "release",
    "--repo",
    repoPath,
    "src/example.ts"
  ]);
  const releaseResult = JSON.parse(releaseOutput.stdout);
  assert.deepEqual(releaseResult.released, ["src/example.ts"]);
});

test("CLI approval requests can be listed and resolved", async () => {
  const repoPath = await makeTempDir("engineering-os-cli-approvals-");
  await execFile("node", [cliPath, "init", "--repo", repoPath]);

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
  const repoPath = await makeTempDir("engineering-os-cli-artifacts-");
  await execFile("node", [cliPath, "init", "--repo", repoPath]);

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
    "app/templates/create.html"
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
    "approved_with_notes"
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
  const repoPath = await makeTempDir("engineering-os-cli-wakeup-");
  await execFile("node", [cliPath, "init", "--repo", repoPath]);

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
  assert.ok(wakeUpResult.memory.hot.repoMemory.some((entry) => entry.path.endsWith("CLAUDE.md")));
  assert.match(wakeUpResult.memory.hot.latestArtifacts.runBrief.title, /Wake-up test run/);
  assert.match(wakeUpResult.memory.hot.latestArtifacts.validationPlan.title, /Wake-up validation plan/);
  assert.match(wakeUpResult.memory.hot.latestArtifacts.deploymentCheck.title, /Wake-up deployment check/);
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
  const repoPath = await makeTempDir("engineering-os-cli-brief-me-");
  await execFile("node", [cliPath, "init", "--repo", repoPath]);

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
  assert.ok(briefResult.sections.recentActivity.repoMemory.some((entry) => entry.path.endsWith("CLAUDE.md")));
  assert.ok(
    briefResult.sections.recentActivity.retrievalGuide.some((entry) => entry.path.endsWith("CLAUDE.md"))
  );
  assert.match(
    briefResult.sections.blockedOrMissing.join("\n"),
    /Independent review is still required/
  );
  assert.match(
    briefResult.sections.importantReminders.join("\n"),
    /Working tree has/
  );
  assert.match(briefResult.sections.recommendedNextStep, /Run independent review next/);
  assert.ok(briefResult.sections.secondaryOptions.length >= 1);
});

test("CLI brief-me is read-only for an uninitialized repo", async () => {
  const repoPath = await makeTempDir("engineering-os-cli-brief-me-readonly-");
  await fs.writeFile(path.join(repoPath, "README.md"), "# Plain repo\n");

  const briefOutput = await execFile("node", [
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
  const repoPath = await makeTempDir("engineering-os-cli-brief-me-failed-gates-");
  await execFile("node", [cliPath, "init", "--repo", repoPath]);

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
  const repoPath = await makeTempDir("engineering-os-cli-workflow-state-");
  await execFile("node", [cliPath, "init", "--repo", repoPath]);

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
    cliPath,
    "mark-badge",
    "--repo",
    repoPath,
    "--badge",
    "review_required"
  ]);

  let workflowOutput = await execFile("node", [
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
    "approved"
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
  const repoPath = await makeTempDir("engineering-os-cli-missing-artifact-writeback-");
  await execFile("node", [cliPath, "init", "--repo", repoPath]);

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
  assert.match(
    briefResult.sections.recommendedNextStep,
    /Write the review-result artifact now/
  );
});

test("CLI workflow state and brief-me surface missing run briefs after meaningful progress starts", async () => {
  const repoPath = await makeTempDir("engineering-os-cli-run-brief-gap-");
  await execFile("node", [cliPath, "init", "--repo", repoPath]);

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
  assert.match(
    briefResult.sections.recommendedNextStep,
    /Run independent review next/
  );
});

test("CLI blocks final synthesis when workflow badges are still pending", async () => {
  const repoPath = await makeTempDir("engineering-os-cli-gate-enforcement-");
  await execFile("node", [cliPath, "init", "--repo", repoPath]);

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
    cliPath,
    "mark-badge",
    "--repo",
    repoPath,
    "--badge",
    "review_required"
  ]);

  await assert.rejects(
    () => execFile("node", [
      cliPath,
      "write-final-synthesis",
      "--repo",
      repoPath,
      "--title",
      "Blocked final synthesis",
      "--summary",
      "Should not complete while review is pending"
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
    "Review was explicitly skipped with reason"
  ]);
  const finalResult = JSON.parse(finalOutput.stdout);
  const finalBody = await fs.readFile(finalResult.path, "utf8");
  assert.match(finalBody, /Allowed final synthesis/);
});

test("CLI subcommand help works without error", async () => {
  const helpOutput = await execFile("node", [
    cliPath,
    "write-review-result",
    "--help"
  ]);

  assert.match(helpOutput.stdout, /write-review-result/);
  assert.match(helpOutput.stdout, /--verdict/);
});

test("CLI install-global writes managed global memory into HOME", async () => {
  const homePath = await makeTempDir("engineering-os-cli-global-home-");
  const installOutput = await execFile("node", [cliPath, "install-global"], {
    env: { ...process.env, HOME: homePath }
  });
  const result = JSON.parse(installOutput.stdout);

  assert.equal(result.mode, "install-global");
  assert.match(result.welcome.headline, /Crew/);
  assert.ok(result.welcome.commands.includes("/crew:init"));
  assert.equal(result.global.hasGlobalMemory, true);
  assert.equal(result.global.globalMemoryStale, false);
  assert.deepEqual(result.writes, [
    "~/.claude/engineering-os/constitution.md",
    "~/.claude/engineering-os/workflow.md",
    "~/.claude/engineering-os/metadata.json",
    "~/.claude/CLAUDE.md"
  ]);

  const repeatOutput = await execFile("node", [cliPath, "install-global"], {
    env: { ...process.env, HOME: homePath }
  });
  const repeatResult = JSON.parse(repeatOutput.stdout);
  assert.deepEqual(repeatResult.writes, []);
});
