import fs from "node:fs/promises";
import path from "node:path";
import { test, expect, beforeAll, afterAll } from "bun:test";
import { runCrew } from "../scripts/crew.ts";
import { makeTempDir } from "./helpers/cli-fixtures.ts";

// ── Fixture setup ──────────────────────────────────────────────────────────
// All tests in this file run under a CREW_PROJECTS_ROOT fixture to avoid
// scanning the user's real ~/.claude/projects directory, ensuring sub-second
// per-test performance.

let fixtureRoot: string;
let savedProjectsRoot: string | undefined;

beforeAll(async () => {
  savedProjectsRoot = process.env.CREW_PROJECTS_ROOT;
  fixtureRoot = await makeTempDir("crew-workflow-fixture-");
  process.env.CREW_PROJECTS_ROOT = fixtureRoot;
});

afterAll(async () => {
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

  await runCrew(["claim", "--repo", repoPath, "--owner", "fullstack-dev", "src/example.ts"]);

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
  expect(wakeUpResult.code, "wake-up should exit with code 0").toBe(0);
  const wakeUp = JSON.parse(wakeUpResult.output);

  expect(wakeUp.summary.memoryPolicy).toBe("bounded-v1");
  expect(wakeUp.summary.activeClaims).toBe(1);
  expect(wakeUp.summary.openApprovals).toBe(1);
  expect(wakeUp.summary.hasActiveWorkflow).toBe(true);
  expect(wakeUp.summary.pendingWorkflowBadges).toEqual(["review_required"]);
  expect(wakeUp.summary.hasDeploymentGuidance).toBe(true);
  expect(wakeUp.summary.repoMemoryFiles >= 1).toBe(true);
  expect(wakeUp.summary.hasRecentRunMemory).toBe(true);
  expect(wakeUp.repoGuidance.deployment.title).toMatch(/Wake-up deployment model/);
  expect(wakeUp.repoGuidance.deployment.discoveryStatus).toBe("repo-derived");
  expect(wakeUp.latestArtifacts.runBrief.title).toMatch(/Wake-up test run/);
  expect(wakeUp.latestArtifacts.validationPlan.title).toMatch(/Wake-up validation plan/);
  expect(wakeUp.latestArtifacts.validationResult.title).toMatch(/Wake-up validation result/);
  expect(wakeUp.latestArtifacts.deploymentCheck.title).toMatch(/Wake-up deployment check/);
  expect(wakeUp.memory.hot.repoGuidance.deployment.title).toMatch(/Wake-up deployment model/);
  expect(
    wakeUp.memory.hot.repoMemory.some((entry: { path: string }) => entry.path.endsWith("CLAUDE.md"))
  ).toBeTruthy();
  expect(wakeUp.memory.hot.latestArtifacts.runBrief.title).toMatch(/Wake-up test run/);
  expect(wakeUp.memory.hot.latestArtifacts.validationPlan.title).toMatch(/Wake-up validation plan/);
  expect(wakeUp.memory.hot.latestArtifacts.deploymentCheck.title).toMatch(
    /Wake-up deployment check/
  );
  expect(wakeUp.memory.warm.validation.title).toMatch(/Wake-up validation result/);
  expect(wakeUp.memory.hot.claims.length).toBe(1);
  expect(wakeUp.memory.hot.openApprovals.length).toBe(1);
  expect(wakeUp.memory.hot.workflow.currentRun.gates.review.status).toBe("required");
  expect(wakeUp.memory.cold.archiveCounts.runs >= 1).toBeTruthy();
  expect(wakeUp.memory.cold.archiveCounts.validations >= 2).toBeTruthy();
  expect(wakeUp.memory.cold.archiveCounts.deployments >= 1).toBeTruthy();
  expect(wakeUp.memory.cold.omittedByDefault).toEqual([
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
  expect(briefResult.code, "brief-me should exit with code 0").toBe(0);
  const brief = JSON.parse(briefResult.output);

  expect(brief.repoPath).toBe(repoPath);
  expect(brief.summary.isGitRepo).toBe(true);
  expect(brief.summary.hasActiveWorkflow).toBe(true);
  expect(brief.summary.pendingWorkflowBadges).toEqual(["review_required"]);
  expect(brief.sections.currentObjective.title).toBe("Brief me test run");
  expect(brief.sections.currentObjective.goal).toBe("Exercise repo briefing");
  expect(brief.sections.recentActivity.git.workingTree.branch).toBe("main");
  expect(brief.sections.recentActivity.git.workingTree.hasChanges).toBe(true);
  expect(brief.sections.recentActivity.git.workingTree.untrackedCount >= 1).toBeTruthy();
  expect(
    brief.sections.recentActivity.git.workingTree.changedPaths.includes("notes.txt")
  ).toBeTruthy();
  expect(brief.sections.recentActivity.latestArtifacts[0].label.length > 0).toBe(true);
  expect(
    brief.sections.recentActivity.repoMemory.some((entry: { path: string }) =>
      entry.path.endsWith("CLAUDE.md")
    )
  ).toBeTruthy();
  expect(
    brief.sections.recentActivity.retrievalGuide.some((entry: { path: string }) =>
      entry.path.endsWith("CLAUDE.md")
    )
  ).toBeTruthy();
  expect(brief.sections.blockedOrMissing.join("\n")).toMatch(
    /Independent review is still required/
  );
  expect(brief.sections.importantReminders.join("\n")).toMatch(/Working tree has/);
  expect(brief.sections.recommendedNextStep).toMatch(/Run independent review next/);
  expect(brief.sections.secondaryOptions.length >= 1).toBeTruthy();
});

test("CLI brief-me is read-only for an uninitialized repo", async () => {
  const repoPath = await makeTempDir("crew-cli-brief-me-readonly-");
  await fs.writeFile(path.join(repoPath, "README.md"), "# Plain repo\n");

  const briefResult = await runCrew(["brief-me", "--repo", repoPath]);
  expect(briefResult.code, "brief-me should exit with code 0").toBe(0);
  const brief = JSON.parse(briefResult.output);

  expect(brief.repoPath).toBe(repoPath);
  await expect(fs.access(path.join(repoPath, ".claude"))).rejects.toThrow();
  expect(brief.sections.recommendedNextStep).toMatch(/\/crew:adopt/);
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
  expect(briefResult.code, "brief-me should exit with code 0").toBe(0);
  const brief = JSON.parse(briefResult.output);

  expect(brief.sections.blockedOrMissing.join("\n")).toMatch(
    /Independent review failed: Missing null guard/
  );
  expect(brief.sections.recommendedNextStep).toMatch(/Address the failed review findings/);
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
  expect(workflowResult.code, "show-workflow-state should exit with code 0").toBe(0);
  let workflow = JSON.parse(workflowResult.output);
  expect(workflow.summary.currentRun.gates.review.status).toBe("required");
  expect(workflow.summary.pendingBadges).toEqual(["review_required"]);
  expect(workflow.summary.missingArtifactWrites).toEqual([]);

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
  expect(workflowResult.code, "show-workflow-state should exit with code 0").toBe(0);
  workflow = JSON.parse(workflowResult.output);
  expect(workflow.summary.currentRun.gates.review.status).toBe("passed");
  expect(workflow.summary.currentRun.gates.validation.status).toBe("expected");
  expect(workflow.summary.pendingBadges).toEqual(["validation_expected"]);
  expect(workflow.summary.missingArtifactWrites).toEqual([]);

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
  expect(workflowResult.code, "show-workflow-state should exit with code 0").toBe(0);
  workflow = JSON.parse(workflowResult.output);
  expect(workflow.summary.currentRun.gates.validation.status).toBe("passed");
  expect(workflow.summary.pendingBadges).toEqual([]);
  expect(workflow.summary.missingArtifactWrites).toEqual(["final_synthesis_missing"]);

  await runCrew(["mark-badge", "--repo", repoPath, "--badge", "dev_deploy_expected"]);

  workflowResult = await runCrew(["show-workflow-state", "--repo", repoPath]);
  expect(workflowResult.code, "show-workflow-state should exit with code 0").toBe(0);
  workflow = JSON.parse(workflowResult.output);
  expect(workflow.summary.currentRun.gates.deployment.dev.status).toBe("expected");
  expect(workflow.summary.pendingBadges).toEqual(["dev_deploy_expected"]);
  expect(workflow.summary.missingArtifactWrites).toEqual([]);

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
  expect(workflowResult.code, "show-workflow-state should exit with code 0").toBe(0);
  workflow = JSON.parse(workflowResult.output);
  expect(workflow.summary.currentRun.gates.deployment.dev.status).toBe("passed");
  expect(workflow.summary.pendingBadges).toEqual([]);
  expect(workflow.summary.missingArtifactWrites).toEqual(["final_synthesis_missing"]);
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
  expect(workflowResult.code, "show-workflow-state should exit with code 0").toBe(0);
  const workflow = JSON.parse(workflowResult.output);
  expect(workflow.summary.pendingBadges).toEqual([]);
  expect(workflow.summary.missingArtifactWrites).toEqual(["review_result_missing"]);

  const briefResult = await runCrew(["brief-me", "--repo", repoPath]);
  expect(briefResult.code, "brief-me should exit with code 0").toBe(0);
  const brief = JSON.parse(briefResult.output);
  expect(brief.sections.blockedOrMissing.join("\n")).toMatch(
    /review artifact write-back is still missing/
  );
  expect(brief.sections.recommendedNextStep).toMatch(/Write the review-result artifact now/);
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
  expect(workflowResult.code, "show-workflow-state should exit with code 0").toBe(0);
  const workflow = JSON.parse(workflowResult.output);
  expect(workflow.summary.pendingBadges).toEqual(["review_required"]);
  expect(workflow.summary.missingArtifactWrites).toEqual([]);

  const briefResult = await runCrew(["brief-me", "--repo", repoPath]);
  expect(briefResult.code, "brief-me should exit with code 0").toBe(0);
  const brief = JSON.parse(briefResult.output);
  expect(brief.sections.blockedOrMissing.join("\n")).toMatch(
    /Independent review is still required/
  );
  expect(brief.sections.recommendedNextStep).toMatch(/Run independent review next/);
});

test("CLI subcommand help works without error", async () => {
  const helpResult = await runCrew(["write-review-result", "--help"]);
  expect(helpResult.code, "help should exit with code 0").toBe(0);
  expect(helpResult.output).toMatch(/write-review-result/);
  expect(helpResult.output).toMatch(/--decision|--verdict/);
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
    expect(installResult.code, "install-global should exit with code 0").toBe(0);
    const result = JSON.parse(installResult.output);

    expect(result.mode).toBe("install-global");
    expect(result.welcome.headline).toMatch(/Crew/);
    expect(result.welcome.commands.includes("/crew:init")).toBeTruthy();
    expect(result.global.hasGlobalMemory).toBe(true);
    expect(result.global.globalMemoryStale).toBe(false);
    expect(result.writes).toEqual([
      "~/.claude/crew/constitution.md",
      "~/.claude/crew/workflow.md",
      "~/.claude/crew/metadata.json",
      "~/.claude/CLAUDE.md"
    ]);

    const repeatResult = await runCrew(["install-global"]);
    expect(repeatResult.code, "install-global repeat should exit with code 0").toBe(0);
    const repeatOutput = JSON.parse(repeatResult.output);
    expect(repeatOutput.writes).toEqual([]);
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

  expect(state.currentRun.gates.blocked.status).toBe("blocked");
  expect(state.currentRun.gates.blocked.note).toBe("Waiting on upstream API spec");
  expect(state.currentRun.gates.blocked.blockedBy).toBe("ART-2025-12-12-spec-q");
});

test("mark-badge escalated_to_lead persists note", async () => {
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
    "escalated_to_lead",
    "--note",
    "Scope ambiguous; need stakeholder sign-off"
  ]);

  const stateFile = path.join(repoPath, ".claude", "state", "crew", "workflow-state.json");
  const stateContent = await fs.readFile(stateFile, "utf8");
  const state = JSON.parse(stateContent);

  expect(state.currentRun.gates.escalation.status).toBe("escalated");
  expect(state.currentRun.gates.escalation.note).toBe("Scope ambiguous; need stakeholder sign-off");
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
  expect(briefResult.code, "brief-me should exit with code 0").toBe(0);
  const brief = JSON.parse(briefResult.output);

  expect(
    (brief.pendingBadges || brief.workflow?.pendingBadges || []).includes("blocked") ||
      JSON.stringify(brief).includes("blocked"),
    "brief-me output should mention blocked"
  ).toBeTruthy();
});

test("brief-me reports routingTableStale=false when file recent or absent", async () => {
  const repoPath = await makeTempDir("crew-cli-routing-fresh-");
  await runCrew(["init", "--repo", repoPath]);

  // file absent
  let briefResult = await runCrew(["brief-me", "--repo", repoPath]);
  expect(briefResult.code, "brief-me should exit with code 0").toBe(0);
  let brief = JSON.parse(briefResult.output);
  let summary = brief.summary || {};
  expect(summary.routingTablePresent).toBe(false);
  expect(summary.routingTableStale).toBe(false);

  // file present + fresh
  await fs.mkdir(path.join(repoPath, "docs"), { recursive: true });
  await fs.writeFile(path.join(repoPath, "docs", "routing-table.md"), "# Routing table\n");

  briefResult = await runCrew(["brief-me", "--repo", repoPath]);
  expect(briefResult.code, "brief-me should exit with code 0").toBe(0);
  brief = JSON.parse(briefResult.output);
  summary = brief.summary || {};
  expect(summary.routingTablePresent).toBe(true);
  expect(summary.routingTableStale).toBe(false);
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
  expect(briefResult.code, "brief-me should exit with code 0").toBe(0);
  const brief = JSON.parse(briefResult.output);
  const summary = brief.summary || {};
  expect(summary.routingTableStale).toBe(true);
  expect(summary.routingTableAgeDays >= 30).toBeTruthy();

  const reminders = brief.sections?.importantReminders || [];
  expect(
    reminders.some((r: string) => r.includes("Routing table") && r.includes("stale")),
    "reminders should mention routing-table staleness"
  ).toBeTruthy();
});
