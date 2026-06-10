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
  fixtureRoot = await makeTempDir("crew-workflow-fixture-");
  process.env.CREW_PROJECTS_ROOT = fixtureRoot;
});

after(async () => {
  if (savedProjectsRoot === undefined) delete process.env.CREW_PROJECTS_ROOT;
  else process.env.CREW_PROJECTS_ROOT = savedProjectsRoot;
  await fs.rm(fixtureRoot, { recursive: true, force: true });
});

// ── Tests ──────────────────────────────────────────────────────────────────

test("CLI wake-up brief summarizes repo memory and state", async () => {
  const repoPath = await makeTempDir("crew-cli-wakeup-");
  await runCrew(["init", "--repo", repoPath]);

  await runCrew([
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

  await runCrew([
    "mark-badge",
    "--repo",
    repoPath,
    "--badge",
    "review_required",
    "--note",
    "Implementation finished and waiting for independent review"
  ]);

  await runCrew(["claim", "--repo", repoPath, "--owner", "builder", "src/example.ts"]);

  await runCrew([
    "request-approval",
    "--repo",
    repoPath,
    "--summary",
    "Expand scope for wake-up test"
  ]);

  await runCrew([
    "write-validation-plan",
    "--repo",
    repoPath,
    "--title",
    "Wake-up validation plan",
    "--environment",
    "local"
  ]);

  await runCrew([
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

  await runCrew([
    "mark-badge",
    "--repo",
    repoPath,
    "--badge",
    "dev_deploy_expected",
    "--note",
    "Dev deployment evidence still needed"
  ]);

  await runCrew([
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

  await runCrew([
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

  const wakeUpResult = await runCrew(["wake-up", "--repo", repoPath]);
  assert.equal(wakeUpResult.code, 0, "wake-up should exit with code 0");
  const wakeUp = JSON.parse(wakeUpResult.output);

  assert.equal(wakeUp.summary.memoryPolicy, "bounded-v1");
  assert.equal(wakeUp.summary.activeClaims, 1);
  assert.equal(wakeUp.summary.openApprovals, 1);
  assert.equal(wakeUp.summary.hasActiveWorkflow, true);
  assert.deepEqual(wakeUp.summary.pendingWorkflowBadges, ["review_required"]);
  assert.equal(wakeUp.summary.hasDeploymentGuidance, true);
  assert.equal(wakeUp.summary.repoMemoryFiles >= 1, true);
  assert.equal(wakeUp.summary.hasRecentRunMemory, true);
  assert.match(wakeUp.repoGuidance.deployment.title, /Wake-up deployment model/);
  assert.equal(wakeUp.repoGuidance.deployment.discoveryStatus, "repo-derived");
  assert.match(wakeUp.latestArtifacts.runBrief.title, /Wake-up test run/);
  assert.match(wakeUp.latestArtifacts.validationPlan.title, /Wake-up validation plan/);
  assert.match(wakeUp.latestArtifacts.validationResult.title, /Wake-up validation result/);
  assert.match(wakeUp.latestArtifacts.deploymentCheck.title, /Wake-up deployment check/);
  assert.match(wakeUp.memory.hot.repoGuidance.deployment.title, /Wake-up deployment model/);
  assert.ok(
    wakeUp.memory.hot.repoMemory.some((entry: { path: string }) => entry.path.endsWith("CLAUDE.md"))
  );
  assert.match(wakeUp.memory.hot.latestArtifacts.runBrief.title, /Wake-up test run/);
  assert.match(wakeUp.memory.hot.latestArtifacts.validationPlan.title, /Wake-up validation plan/);
  assert.match(wakeUp.memory.hot.latestArtifacts.deploymentCheck.title, /Wake-up deployment check/);
  assert.match(wakeUp.memory.warm.validation.title, /Wake-up validation result/);
  assert.equal(wakeUp.memory.hot.claims.length, 1);
  assert.equal(wakeUp.memory.hot.openApprovals.length, 1);
  assert.equal(wakeUp.memory.hot.workflow.currentRun.gates.review.status, "required");
  assert.ok(wakeUp.memory.cold.archiveCounts.runs >= 1);
  assert.ok(wakeUp.memory.cold.archiveCounts.validations >= 2);
  assert.ok(wakeUp.memory.cold.archiveCounts.deployments >= 1);
  assert.deepEqual(wakeUp.memory.cold.omittedByDefault, [
    "older_artifacts",
    "resolved_approvals",
    "full_event_log",
    "full_history_log"
  ]);
});

test("CLI brief-me synthesizes workflow state, git activity, and next step", async () => {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);

  const repoPath = await makeTempDir("crew-cli-brief-me-");
  await runCrew(["init", "--repo", repoPath]);

  // Initialize actual git repo with a commit
  await execFileAsync("git", ["init", "-b", "main"], { cwd: repoPath });
  await execFileAsync("git", ["config", "user.name", "Crew Test"], { cwd: repoPath });
  await execFileAsync("git", ["config", "user.email", "crew@example.com"], { cwd: repoPath });
  await fs.writeFile(path.join(repoPath, "README.md"), "# Brief Me\n");
  await execFileAsync("git", ["add", "README.md"], { cwd: repoPath });
  await execFileAsync("git", ["-c", "commit.gpgsign=false", "commit", "-m", "docs: add readme"], {
    cwd: repoPath
  });

  await runCrew([
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

  await runCrew([
    "mark-badge",
    "--repo",
    repoPath,
    "--badge",
    "review_required",
    "--note",
    "Implementation changed code and needs review"
  ]);

  await runCrew([
    "request-approval",
    "--repo",
    repoPath,
    "--summary",
    "Approve broadening the brief"
  ]);

  await runCrew([
    "write-deployment-guidance",
    "--repo",
    repoPath,
    "--title",
    "Brief me deployment model",
    "--summary",
    "GitHub Actions builds images and gcloud rolls them out."
  ]);

  await fs.writeFile(path.join(repoPath, "notes.txt"), "untracked\n");

  const briefResult = await runCrew(["brief-me", "--repo", repoPath]);
  assert.equal(briefResult.code, 0, "brief-me should exit with code 0");
  const brief = JSON.parse(briefResult.output);

  assert.equal(brief.repoPath, repoPath);
  assert.equal(brief.summary.isGitRepo, true);
  assert.equal(brief.summary.hasActiveWorkflow, true);
  assert.deepEqual(brief.summary.pendingWorkflowBadges, ["review_required"]);
  assert.equal(brief.sections.currentObjective.title, "Brief me test run");
  assert.equal(brief.sections.currentObjective.goal, "Exercise repo briefing");
  assert.equal(brief.sections.recentActivity.git.workingTree.branch, "main");
  assert.equal(brief.sections.recentActivity.git.workingTree.hasChanges, true);
  assert.ok(brief.sections.recentActivity.git.workingTree.untrackedCount >= 1);
  assert.ok(brief.sections.recentActivity.git.workingTree.changedPaths.includes("notes.txt"));
  assert.equal(brief.sections.recentActivity.latestArtifacts[0].label.length > 0, true);
  assert.ok(
    brief.sections.recentActivity.repoMemory.some((entry: { path: string }) =>
      entry.path.endsWith("CLAUDE.md")
    )
  );
  assert.ok(
    brief.sections.recentActivity.retrievalGuide.some((entry: { path: string }) =>
      entry.path.endsWith("CLAUDE.md")
    )
  );
  assert.match(brief.sections.blockedOrMissing.join("\n"), /Independent review is still required/);
  assert.match(brief.sections.importantReminders.join("\n"), /Working tree has/);
  assert.match(brief.sections.recommendedNextStep, /Run independent review next/);
  assert.ok(brief.sections.secondaryOptions.length >= 1);
});

test("CLI brief-me is read-only for an uninitialized repo", async () => {
  const repoPath = await makeTempDir("crew-cli-brief-me-readonly-");
  await fs.writeFile(path.join(repoPath, "README.md"), "# Plain repo\n");

  const briefResult = await runCrew(["brief-me", "--repo", repoPath]);
  assert.equal(briefResult.code, 0, "brief-me should exit with code 0");
  const brief = JSON.parse(briefResult.output);

  assert.equal(brief.repoPath, repoPath);
  await assert.rejects(fs.access(path.join(repoPath, ".claude")));
  assert.match(brief.sections.recommendedNextStep, /\/crew:adopt/);
});

test("CLI brief-me surfaces failed gates before generic next steps", async () => {
  const repoPath = await makeTempDir("crew-cli-brief-me-failed-gates-");
  await runCrew(["init", "--repo", repoPath]);

  await runCrew([
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

  await runCrew([
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

  const briefResult = await runCrew(["brief-me", "--repo", repoPath]);
  assert.equal(briefResult.code, 0, "brief-me should exit with code 0");
  const brief = JSON.parse(briefResult.output);

  assert.match(
    brief.sections.blockedOrMissing.join("\n"),
    /Independent review failed: Missing null guard/
  );
  assert.match(brief.sections.recommendedNextStep, /Address the failed review findings/);
});

test("CLI workflow state tracks gate badges and artifact progress", async () => {
  const repoPath = await makeTempDir("crew-cli-workflow-state-");
  await runCrew(["init", "--repo", repoPath]);

  await runCrew([
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

  await runCrew(["mark-badge", "--repo", repoPath, "--badge", "review_required"]);

  let workflowResult = await runCrew(["show-workflow-state", "--repo", repoPath]);
  assert.equal(workflowResult.code, 0, "show-workflow-state should exit with code 0");
  let workflow = JSON.parse(workflowResult.output);
  assert.equal(workflow.summary.currentRun.gates.review.status, "required");
  assert.deepEqual(workflow.summary.pendingBadges, ["review_required"]);
  assert.deepEqual(workflow.summary.missingArtifactWrites, []);

  await runCrew([
    "write-review-result",
    "--repo",
    repoPath,
    "--title",
    "Workflow gate review",
    "--decision",
    "approved",
    "--non-code"
  ]);

  await runCrew([
    "write-validation-plan",
    "--repo",
    repoPath,
    "--title",
    "Workflow gate validation plan",
    "--environment",
    "local"
  ]);

  workflowResult = await runCrew(["show-workflow-state", "--repo", repoPath]);
  assert.equal(workflowResult.code, 0, "show-workflow-state should exit with code 0");
  workflow = JSON.parse(workflowResult.output);
  assert.equal(workflow.summary.currentRun.gates.review.status, "passed");
  assert.equal(workflow.summary.currentRun.gates.validation.status, "expected");
  assert.deepEqual(workflow.summary.pendingBadges, ["validation_expected"]);
  assert.deepEqual(workflow.summary.missingArtifactWrites, []);

  await runCrew([
    "write-validation-result",
    "--repo",
    repoPath,
    "--title",
    "Workflow gate validation result",
    "--decision",
    "passed"
  ]);

  workflowResult = await runCrew(["show-workflow-state", "--repo", repoPath]);
  assert.equal(workflowResult.code, 0, "show-workflow-state should exit with code 0");
  workflow = JSON.parse(workflowResult.output);
  assert.equal(workflow.summary.currentRun.gates.validation.status, "passed");
  assert.deepEqual(workflow.summary.pendingBadges, []);
  assert.deepEqual(workflow.summary.missingArtifactWrites, ["final_synthesis_missing"]);

  await runCrew(["mark-badge", "--repo", repoPath, "--badge", "dev_deploy_expected"]);

  workflowResult = await runCrew(["show-workflow-state", "--repo", repoPath]);
  assert.equal(workflowResult.code, 0, "show-workflow-state should exit with code 0");
  workflow = JSON.parse(workflowResult.output);
  assert.equal(workflow.summary.currentRun.gates.deployment.dev.status, "expected");
  assert.deepEqual(workflow.summary.pendingBadges, ["dev_deploy_expected"]);
  assert.deepEqual(workflow.summary.missingArtifactWrites, []);

  await runCrew([
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

  workflowResult = await runCrew(["show-workflow-state", "--repo", repoPath]);
  assert.equal(workflowResult.code, 0, "show-workflow-state should exit with code 0");
  workflow = JSON.parse(workflowResult.output);
  assert.equal(workflow.summary.currentRun.gates.deployment.dev.status, "passed");
  assert.deepEqual(workflow.summary.pendingBadges, []);
  assert.deepEqual(workflow.summary.missingArtifactWrites, ["final_synthesis_missing"]);
});

test("CLI workflow state and brief-me surface missing artifact write-backs after a completed phase", async () => {
  const repoPath = await makeTempDir("crew-cli-missing-artifact-writeback-");
  await runCrew(["init", "--repo", repoPath]);

  await runCrew([
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

  await runCrew([
    "mark-badge",
    "--repo",
    repoPath,
    "--badge",
    "review_passed",
    "--note",
    "Reviewer approved, but artifact was not written yet"
  ]);

  const workflowResult = await runCrew(["show-workflow-state", "--repo", repoPath]);
  assert.equal(workflowResult.code, 0, "show-workflow-state should exit with code 0");
  const workflow = JSON.parse(workflowResult.output);
  assert.deepEqual(workflow.summary.pendingBadges, []);
  assert.deepEqual(workflow.summary.missingArtifactWrites, ["review_result_missing"]);

  const briefResult = await runCrew(["brief-me", "--repo", repoPath]);
  assert.equal(briefResult.code, 0, "brief-me should exit with code 0");
  const brief = JSON.parse(briefResult.output);
  assert.match(
    brief.sections.blockedOrMissing.join("\n"),
    /review artifact write-back is still missing/
  );
  assert.match(brief.sections.recommendedNextStep, /Write the review-result artifact now/);
});

test("CLI workflow state and brief-me surface missing run briefs after meaningful progress starts", async () => {
  const repoPath = await makeTempDir("crew-cli-run-brief-gap-");
  await runCrew(["init", "--repo", repoPath]);

  await runCrew([
    "mark-badge",
    "--repo",
    repoPath,
    "--badge",
    "review_required",
    "--note",
    "Implementation finished and waiting for review"
  ]);

  const workflowResult = await runCrew(["show-workflow-state", "--repo", repoPath]);
  assert.equal(workflowResult.code, 0, "show-workflow-state should exit with code 0");
  const workflow = JSON.parse(workflowResult.output);
  assert.deepEqual(workflow.summary.pendingBadges, ["review_required"]);
  assert.deepEqual(workflow.summary.missingArtifactWrites, []);

  const briefResult = await runCrew(["brief-me", "--repo", repoPath]);
  assert.equal(briefResult.code, 0, "brief-me should exit with code 0");
  const brief = JSON.parse(briefResult.output);
  assert.match(brief.sections.blockedOrMissing.join("\n"), /Independent review is still required/);
  assert.match(brief.sections.recommendedNextStep, /Run independent review next/);
});

test("CLI subcommand help works without error", async () => {
  const helpResult = await runCrew(["write-review-result", "--help"]);
  assert.equal(helpResult.code, 0, "help should exit with code 0");
  assert.match(helpResult.output, /write-review-result/);
  assert.match(helpResult.output, /--decision|--verdict/);
});

test("CLI install-global writes managed global memory into HOME", async () => {
  const homePath = await makeTempDir("crew-cli-global-home-");

  // Save original HOME and USERPROFILE, set to fixture
  const savedHome = process.env.HOME;
  const savedUserProfile = process.env.USERPROFILE;
  try {
    process.env.HOME = homePath;
    process.env.USERPROFILE = homePath;

    const installResult = await runCrew(["install-global"]);
    assert.equal(installResult.code, 0, "install-global should exit with code 0");
    const result = JSON.parse(installResult.output);

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

    const repeatResult = await runCrew(["install-global"]);
    assert.equal(repeatResult.code, 0, "install-global repeat should exit with code 0");
    const repeatOutput = JSON.parse(repeatResult.output);
    assert.deepEqual(repeatOutput.writes, []);
  } finally {
    // Restore original env vars
    if (savedHome !== undefined) process.env.HOME = savedHome;
    else delete process.env.HOME;
    if (savedUserProfile !== undefined) process.env.USERPROFILE = savedUserProfile;
    else delete process.env.USERPROFILE;
  }
});

test("mark-badge blocked persists note + blockedBy", async () => {
  const repoPath = await makeTempDir("crew-cli-badge-blocked-");
  await runCrew(["init", "--repo", repoPath]);
  await runCrew([
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
  await runCrew([
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

  const stateFile = path.join(repoPath, ".claude", "state", "crew", "workflow-state.json");
  const stateContent = await fs.readFile(stateFile, "utf8");
  const state = JSON.parse(stateContent);

  assert.equal(state.currentRun.gates.blocked.status, "blocked");
  assert.equal(state.currentRun.gates.blocked.note, "Waiting on upstream API spec");
  assert.equal(state.currentRun.gates.blocked.blockedBy, "ART-2025-12-12-spec-q");
});

test("mark-badge escalated_to_human persists note", async () => {
  const repoPath = await makeTempDir("crew-cli-badge-escalated-");
  await runCrew(["init", "--repo", repoPath]);
  await runCrew([
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
  await runCrew([
    "mark-badge",
    "--repo",
    repoPath,
    "--badge",
    "escalated_to_human",
    "--note",
    "Scope ambiguous; need stakeholder sign-off"
  ]);

  const stateFile = path.join(repoPath, ".claude", "state", "crew", "workflow-state.json");
  const stateContent = await fs.readFile(stateFile, "utf8");
  const state = JSON.parse(stateContent);

  assert.equal(state.currentRun.gates.escalation.status, "escalated");
  assert.equal(
    state.currentRun.gates.escalation.note,
    "Scope ambiguous; need stakeholder sign-off"
  );
});

test("brief-me surfaces blocked in pending badges", async () => {
  const repoPath = await makeTempDir("crew-cli-brief-blocked-");
  await runCrew(["init", "--repo", repoPath]);
  await runCrew([
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
  await runCrew(["mark-badge", "--repo", repoPath, "--badge", "blocked", "--note", "Reason"]);

  const briefResult = await runCrew(["brief-me", "--repo", repoPath]);
  assert.equal(briefResult.code, 0, "brief-me should exit with code 0");
  const brief = JSON.parse(briefResult.output);

  assert.ok(
    (brief.pendingBadges || brief.workflow?.pendingBadges || []).includes("blocked") ||
      JSON.stringify(brief).includes("blocked"),
    "brief-me output should mention blocked"
  );
});

test("brief-me reports routingTableStale=false when file recent or absent", async () => {
  const repoPath = await makeTempDir("crew-cli-routing-fresh-");
  await runCrew(["init", "--repo", repoPath]);

  // file absent
  let briefResult = await runCrew(["brief-me", "--repo", repoPath]);
  assert.equal(briefResult.code, 0, "brief-me should exit with code 0");
  let brief = JSON.parse(briefResult.output);
  let summary = brief.summary || {};
  assert.equal(summary.routingTablePresent, false);
  assert.equal(summary.routingTableStale, false);

  // file present + fresh
  await fs.mkdir(path.join(repoPath, "docs"), { recursive: true });
  await fs.writeFile(path.join(repoPath, "docs", "routing-table.md"), "# Routing table\n");

  briefResult = await runCrew(["brief-me", "--repo", repoPath]);
  assert.equal(briefResult.code, 0, "brief-me should exit with code 0");
  brief = JSON.parse(briefResult.output);
  summary = brief.summary || {};
  assert.equal(summary.routingTablePresent, true);
  assert.equal(summary.routingTableStale, false);
});

test("brief-me reports routingTableStale=true when mtime > 30 days old", async () => {
  const repoPath = await makeTempDir("crew-cli-routing-stale-");
  await runCrew(["init", "--repo", repoPath]);
  await fs.mkdir(path.join(repoPath, "docs"), { recursive: true });
  const filePath = path.join(repoPath, "docs", "routing-table.md");
  await fs.writeFile(filePath, "# Routing table\n");
  const oldTime = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
  await fs.utimes(filePath, oldTime, oldTime);

  const briefResult = await runCrew(["brief-me", "--repo", repoPath]);
  assert.equal(briefResult.code, 0, "brief-me should exit with code 0");
  const brief = JSON.parse(briefResult.output);
  const summary = brief.summary || {};
  assert.equal(summary.routingTableStale, true);
  assert.ok(summary.routingTableAgeDays >= 30);

  const reminders = brief.sections?.importantReminders || [];
  assert.ok(
    reminders.some((r: string) => r.includes("Routing table") && r.includes("stale")),
    "reminders should mention routing-table staleness"
  );
});
