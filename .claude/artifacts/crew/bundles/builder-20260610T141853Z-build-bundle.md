---
slice: 
builder: builder
run_id: 20260610T141853Z
files_touched: ["tests/cli-synthesis-cost.test.ts", "tests/cli.test.ts"]
files_read: ["scripts/crew.ts", "scripts/lib/session-cost-scanner.ts", "tests/helpers/cli-fixtures.ts"]
diff_stat: { files: 0, additions: 0, deletions: 0 }
truncated: false
truncation_reason: null
schema_version: 1
---

## Handoff

# Task Handoff: WS1 Task 7: Split synthesis-cost tests to fixture-based in-process suite

- Created: 2026-06-10T14:18:29.977Z
- From: builder
- To: lead
- Objective: Converted six long-pole synthesis/cost tests from subprocess-based execFile to in-process runCrew under CREW_PROJECTS_ROOT fixture.
- Status: completed
- Allowed Scope:
  - tests/cli-synthesis-cost.test.ts (new)
  - tests/cli.test.ts (6 tests removed)
- Forbidden Scope: -
- Deliverable: New test file with 6 in-process tests + shared fixture; 6 tests removed from original cli.test.ts
- Changed Files:
  - tests/cli-synthesis-cost.test.ts
  - tests/cli.test.ts
- Confidence: high
- Risks: none
- Suggested Next Handoff: SLICE-88: WS1 T7b (cli-workflow.test.ts)


## Diff

```diff

```

## Files touched

### tests/cli-synthesis-cost.test.ts

```
import fs from "node:fs/promises";
import path from "node:path";
import { before, after } from "node:test";
import test from "node:test";
import assert from "node:assert/strict";
import { runCrew } from "../scripts/crew.ts";
import { makeTempDir } from "./helpers/cli-fixtures.ts";

// ── Fixture setup ──────────────────────────────────────────────────────────
// All tests in this file run under a CREW_PROJECTS_ROOT fixture to avoid
// scanning the user's real ~/.claude/projects directory, ensuring sub-second
// per-test performance.

let fixtureRoot: string;
let savedProjectsRoot: string | undefined;

before(async () => {
  savedProjectsRoot = process.env.CREW_PROJECTS_ROOT;
  fixtureRoot = await makeTempDir("crew-cost-fixture-");
  // Create a minimal fixture project with a session.jsonl that the cost scanner will find
  const projectDir = path.join(fixtureRoot, "test-project-cost");
  await fs.mkdir(projectDir, { recursive: true });
  // Seed a minimal session.jsonl with the structure the scanner expects:
  // type, timestamp, message.usage
  const sessionEntry = {
    type: "assistant",
    timestamp: new Date().toISOString(),
    message: {
      usage: {
        input_tokens: 100,
        output_tokens: 50
      }
    }
  };
  await fs.writeFile(path.join(projectDir, "session.jsonl"), JSON.stringify(sessionEntry) + "\n");
  process.env.CREW_PROJECTS_ROOT = fixtureRoot;
});

after(async () => {
  if (savedProjectsRoot === undefined) delete process.env.CREW_PROJECTS_ROOT;
  else process.env.CREW_PROJECTS_ROOT = savedProjectsRoot;
  await fs.rm(fixtureRoot, { recursive: true, force: true });
});

// ── Tests ──────────────────────────────────────────────────────────────────

test("CLI blocks final synthesis when workflow badges are still pending", async () => {
  const repoPath = await makeTempDir("crew-cli-gate-enforcement-");
  await runCrew(["init", "--repo", repoPath]);

  await runCrew([
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

  await runCrew(["mark-badge", "--repo", repoPath, "--badge", "review_required"]);

  const rejectResult = await runCrew([
    "write-final-synthesis",
    "--repo",
    repoPath,
    "--title",
    "Blocked final synthesis",
    "--summary",
    "Should not complete while review is pending",
    "--external-deltas",
    "none"
  ]);
  assert.notEqual(rejectResult.code, 0, "should reject when review_required is pending");
  assert.match(rejectResult.output, /pending: review_required/);

  await runCrew([
    "mark-badge",
    "--repo",
    repoPath,
    "--badge",
    "review_skipped",
    "--note",
    "Trivial manual docs-only correction"
  ]);

  const allowResult = await runCrew([
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
  assert.equal(allowResult.code, 0, "should allow when review is skipped with reason");
  const finalResult = JSON.parse(allowResult.output);
  const finalBody = await fs.readFile(finalResult.path, "utf8");
  assert.match(finalBody, /Allowed final synthesis/);
});

test("write-final-synthesis rejects when --external-deltas is missing", async () => {
  const repoPath = await makeTempDir("crew-cli-external-deltas-required-");
  await runCrew(["init", "--repo", repoPath]);
  await runCrew([
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

  const result = await runCrew([
    "write-final-synthesis",
    "--repo",
    repoPath,
    "--title",
    "Missing external-deltas",
    "--summary",
    "Should reject because --external-deltas absent"
  ]);
  assert.notEqual(result.code, 0, "should reject when --external-deltas is missing");
  assert.match(result.output, /requires --external-deltas/);
});

test("write-final-synthesis accepts --external-deltas none and renders the section", async () => {
  const repoPath = await makeTempDir("crew-cli-external-deltas-none-");
  await runCrew(["init", "--repo", repoPath]);
  await runCrew([
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
  await runCrew([
    "mark-badge",
    "--repo",
    repoPath,
    "--badge",
    "review_skipped",
    "--note",
    "docs-only"
  ]);

  const result = await runCrew([
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
  assert.equal(result.code, 0, "should succeed with --external-deltas none");
  const parsed = JSON.parse(result.output);
  const body = await fs.readFile(parsed.path, "utf8");
  assert.match(body, /External Deltas/);
  assert.match(body, /none/);
});

test("final-synthesis blocked when escalated_to_human set; --force overrides", async () => {
  const repoPath = await makeTempDir("crew-cli-escalated-blocks-final-");
  await runCrew(["init", "--repo", repoPath]);
  await runCrew([
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
  await runCrew([
    "mark-badge",
    "--repo",
    repoPath,
    "--badge",
    "escalated_to_human",
    "--note",
    "Need human"
  ]);
  const blockResult = await runCrew([
    "write-final-synthesis",
    "--repo",
    repoPath,
    "--title",
    "Should be blocked",
    "--summary",
    "Should reject",
    "--external-deltas",
    "none"
  ]);
  assert.notEqual(blockResult.code, 0, "should reject when escalated_to_human");
  assert.match(blockResult.output, /escalated_to_human|pending|escalated to human/i);

  const forceResult = await runCrew([
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
  assert.equal(forceResult.code, 0, "should allow with --force flag");
  const result = JSON.parse(forceResult.output);
  assert.ok(result.path);
});

test("cost-advise accepts --title --feature --phase and slugs filename + emits frontmatter", async () => {
  const repoPath = await makeTempDir("crew-cli-advise-");
  await runCrew(["init", "--repo", repoPath]);
  // Seed a minimal cost-report so the advisor has a target.
  await runCrew([
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

  const adviseResult = await runCrew([
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
  assert.equal(adviseResult.code, 0, "cost-advise should succeed");
  const adviseOutput = JSON.parse(adviseResult.output);
  assert.ok(adviseOutput.artifactPath);
  assert.match(
    path.basename(adviseOutput.artifactPath),
    /-cost-advise-phase3-feat021-slice36\.md$/,
    "cost-advise filename includes the --title slug"
  );
  const body = await fs.readFile(adviseOutput.artifactPath, "utf8");
  assert.match(
    body,
    /^---\nphase: "3"\nfeature: FEAT-021\n---\n/,
    "cost-advise body starts with phase/feature frontmatter"
  );
});

test("cost-slice embeds --feature and --phase in cost-report frontmatter", async () => {
  const repoPath = await makeTempDir("crew-cli-cost-tags-");
  await runCrew(["init", "--repo", repoPath]);
  const result = await runCrew([
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
  assert.equal(result.code, 0, "cost-slice should succeed");
  const costResult = JSON.parse(result.output);
  const body = await fs.readFile(costResult.path, "utf8");
  assert.match(body, /\nfeature: FEAT-100\n/);
  assert.match(body, /\nphase: "beta"\n/);
});

```

### tests/cli.test.ts

```
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { execFile, cliPath, makeTempDir, loadState } from "./helpers/cli-fixtures.ts";

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

// ── findings flag tests (FEAT-037) ──────────────────────────────────────────

```

## Files read

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

### scripts/lib/session-cost-scanner.ts

```
// Session scanning helpers extracted from session-cost.mjs.
// I/O layer — pure computation lives in ./session-cost-scanner/compute.ts.

import readline from "node:readline";
import { createReadStream } from "node:fs";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";

import {
  emptyTotals,
  handleAssistantTurn,
  handleUserTurn
} from "./session-cost-scanner/compute.ts";

import type {
  ScanCtx,
  JsonlLine,
  CachePrimeEntry,
  SourceEntry
} from "./session-cost-scanner/compute.ts";

export type {
  CachePrimeEntry,
  Counters,
  Flags,
  CachePrimeState,
  SourceEntry,
  ScanCtx,
  JsonlLine
} from "./session-cost-scanner/compute.ts";

export {
  addTotals,
  percentile,
  approxSize,
  inspectContent,
  recordTokenUsage,
  recordToolUse,
  attributeCachePrime,
  isSyntheticModel,
  handleAssistantTurn,
  handleUserTurn,
  tokensFromUsage,
  TOOL_COUNTERS,
  SYNTHETIC_MODEL_PREFIXES
} from "./session-cost-scanner/compute.ts";

export function getProjectsRoot(): string {
  const override = process.env.CREW_PROJECTS_ROOT;
  return override ? path.resolve(override) : path.join(os.homedir(), ".claude", "projects");
}

export async function* readJsonlLines(file: string): AsyncGenerator<JsonlLine> {
  const stream = createReadStream(file, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    try {
      yield JSON.parse(line) as JsonlLine;
    } catch {
      // skip malformed lines
    }
  }
}

// Iterates project dir subdirectories. Filters non-dir entries up-front.
async function listProjectDirEntries(): Promise<string[]> {
  try {
    const entries = await fs.readdir(getProjectsRoot(), { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

// Lists .jsonl files in a single project dir, or empty array on any error.
async function listJsonlInDir(dir: string): Promise<string[]> {
  try {
    return (await fs.readdir(dir)).filter((f) => f.endsWith(".jsonl"));
  } catch {
    return [];
  }
}

// Counts assistant turns with billable usage inside [startMs, endMs] across
// every .jsonl file in `dir`.
async function countInWindowAssistantTurns(
  dir: string,
  startMs: number,
  endMs: number
): Promise<number> {
  const files = await listJsonlInDir(dir);
  let count = 0;
  for (const f of files) {
    const full = path.join(dir, f);
    for await (const obj of readJsonlLines(full)) {
      if (obj?.type !== "assistant") continue;
      const tsMs = obj.timestamp ? Date.parse(obj.timestamp) : NaN;
      if (Number.isNaN(tsMs) || tsMs < startMs || tsMs > endMs) continue;
      if (!obj?.message?.usage) continue;
      count += 1;
    }
  }
  return count;
}

// Build a list of project dirs that have at least one in-window assistant
// turn. Used by aggregateAll mode to scope summation to relevant dirs only
// (skips unrelated ambient sessions).
export async function listActiveProjectDirs({
  startMs,
  endMs
}: {
  startMs: number;
  endMs: number;
}): Promise<Array<{ slug: string; dir: string }>> {
  const slugs = await listProjectDirEntries();
  const active: Array<{ slug: string; dir: string }> = [];
  for (const slug of slugs) {
    const dir = path.join(getProjectsRoot(), slug);
    const count = await countInWindowAssistantTurns(dir, startMs, endMs);
    if (count > 0) active.push({ slug, dir });
  }
  return active;
}

export interface ResolveScanSourcesInput {
  aggregateAll: boolean;
  sourceProject: string | null;
  autoDetect: boolean;
  repoPath: string;
  startedAt: string;
  endIso: string;
  startMs: number;
  endMs: number;
  slugifyRepoPath: (p: string) => string;
  listProjectSessions: (repoPath: string, slug: string | null) => Promise<string[]>;
  autoDetectSourceProject: (opts: {
    startedAt: string;
    completedAt: string;
  }) => Promise<string | null>;
}

export interface ResolveScanSourcesResult {
  sessionsBySource: Map<string, string[]>;
  effectiveSlug: string;
  autoDetected: boolean;
}

// Decides which `~/.claude/projects/<slug>/` directories to scan.
// Three modes:
//   - aggregateAll: every project dir with in-window activity.
//   - explicit sourceProject: scan only that dir.
//   - default: scan the repo-derived dir; if empty + autoDetect enabled,
//     fall back to the busiest in-window project.
export async function resolveScanSources({
  aggregateAll,
  sourceProject,
  autoDetect,
  repoPath,
  startedAt,
  endIso,
  startMs,
  endMs,
  slugifyRepoPath,
  listProjectSessions,
  autoDetectSourceProject
}: ResolveScanSourcesInput): Promise<ResolveScanSourcesResult> {
  const sessionsBySource = new Map<string, string[]>();
  let effectiveSlug = sourceProject || slugifyRepoPath(repoPath);
  let autoDetected = false;

  if (aggregateAll) {
    const active = await listActiveProjectDirs({ startMs, endMs });
    for (const { slug, dir } of active) {
      const files = (await fs.readdir(dir))
        .filter((f) => f.endsWith(".jsonl"))
        .map((f) => path.join(dir, f));
      sessionsBySource.set(slug, files);
    }
    return { sessionsBySource, effectiveSlug: "aggregate", autoDetected };
  }

  let initialFiles = await listProjectSessions(repoPath, effectiveSlug);
  if (!sourceProject && autoDetect) {
    const hasActivity = await sessionsHaveInWindowAssistantTurns(initialFiles, startMs, endMs);
    if (!hasActivity) {
      const detected = await autoDetectSourceProject({ startedAt, completedAt: endIso });
      if (detected && detected !== effectiveSlug) {
        effectiveSlug = detected;
        initialFiles = await listProjectSessions(repoPath, effectiveSlug);
        autoDetected = true;
      }
    }
  }
  sessionsBySource.set(effectiveSlug, initialFiles);
  return { sessionsBySource, effectiveSlug, autoDetected };
}

// True iff any .jsonl session file has at least one assistant turn with
// usage data inside [startMs, endMs]. Short-circuits as soon as one match
// is found.
export async function sessionsHaveInWindowAssistantTurns(
  files: string[],
  startMs: number,
  endMs: number
): Promise<boolean> {
  for (const file of files) {
    for await (const obj of readJsonlLines(file)) {
      if (obj?.type !== "assistant") continue;
      const tsMs = obj.timestamp ? Date.parse(obj.timestamp) : NaN;
      if (Number.isNaN(tsMs) || tsMs < startMs || tsMs > endMs) continue;
      if (!obj?.message?.usage) continue;
      return true;
    }
  }
  return false;
}

export interface ScanSessionsInput {
  sessions: string[];
  fileToSlug: Map<string, string>;
  startMs: number;
  endMs: number;
}

export interface ScanSessionsResult {
  totals: Record<string, number>;
  byModel: Record<
    string,
    { tokens: Record<string, number>; usd: number; messages: number; pricedAs?: string }
  >;
  messagesCounted: number;
  sessionsScanned: number;
  toolUseCounts: Record<string, number>;
  toolFailureCounts: Record<string, number>;
  toolResultSizes: number[];
  filesRead: Record<string, number>;
  compactionCount: number;
  userMsgCount: number;
  userMsgTotalLen: number;
  skillInvocations: number;
  subagentDispatches: number;
  turnsBeforeFirstTool: number;
  perSourceState: Map<
    string,
    {
      messages: number;
      tokens: Record<string, number>;
      modelTokens: Record<string, Record<string, number>>;
      touched: boolean;
    }
  >;
  toolCachePrime: Record<string, CachePrimeEntry>;
}

// Scans every .jsonl session file, accumulating token usage, tool stats,
// conversation-shape counters, and per-source attribution.
// eslint-disable-next-line max-lines-per-function
export async function scanSessions({
  sessions,
  fileToSlug,
  startMs,
  endMs
}: ScanSessionsInput): Promise<ScanSessionsResult> {
  const totals = emptyTotals();
  const byModel: Record<
    string,
    { tokens: Record<string, number>; usd: number; messages: number; pricedAs?: string }
  > = {};
  const toolUseCounts: Record<string, number> = {};
  const toolFailureCounts: Record<string, number> = {};
  const toolResultSizes: number[] = [];
  const filesRead: Record<string, number> = {};
  const toolNameById = new Map<string, string>();
  const perSourceState = new Map<
    string,
    {
      messages: number;
      tokens: Record<string, number>;
      modelTokens: Record<string, Record<string, number>>;
      touched: boolean;
    }
  >();
  const counters = {
    messagesCounted: 0,
    sessionsScanned: 0,
    compactionCount: 0,
    userMsgCount: 0,
    userMsgTotalLen: 0,
    skillInvocations: 0,
    subagentDispatches: 0,
    turnsBeforeFirstTool: 0
  };
  const flags = { sawFirstTool: false };
  const toolCachePrime: Record<string, CachePrimeEntry> = {};
  const cachePrimeState = {
    pendingToolUses: [] as Array<{ id: string; name: string }>,
    pendingResultSizes: {} as Record<string, number>
  };

  const ensureSource = (slug: string): SourceEntry => {
    if (!perSourceState.has(slug)) {
      perSourceState.set(slug, {
        messages: 0,
        tokens: emptyTotals(),
        modelTokens: {},
        touched: false
      });
    }
    return perSourceState.get(slug)!;
  };

  const ctx: ScanCtx = {
    totals,
    byModel,
    toolUseCounts,
    toolFailureCounts,
    toolResultSizes,
    filesRead,
    toolNameById,
    counters,
    flags,
    ensureSource,
    toolCachePrime,
    cachePrimeState
  };

  for (const file of sessions) {
    let touched = false;
    for await (const obj of readJsonlLines(file)) {
      const ts = obj?.timestamp;
      const tsMs = ts ? Date.parse(ts) : NaN;
      if (Number.isNaN(tsMs) || tsMs < startMs || tsMs > endMs) continue;

      if (obj?.type === "assistant") {
        touched = handleAssistantTurn(obj, file, fileToSlug, ctx) || touched;
        continue;
      }
      if (obj?.type === "user") {
        handleUserTurn(obj, ctx);
      }
    }
    if (touched) counters.sessionsScanned += 1;
  }

  return {
    totals,
    byModel,
    messagesCounted: counters.messagesCounted,
    sessionsScanned: counters.sessionsScanned,
    toolUseCounts,
    toolFailureCounts,
    toolResultSizes,
    filesRead,
    compactionCount: counters.compactionCount,
    userMsgCount: counters.userMsgCount,
    userMsgTotalLen: counters.userMsgTotalLen,
    skillInvocations: counters.skillInvocations,
    subagentDispatches: counters.subagentDispatches,
    turnsBeforeFirstTool: counters.turnsBeforeFirstTool,
    perSourceState,
    toolCachePrime
  };
}

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
