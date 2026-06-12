import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { runCrew } from "../scripts/crew.ts";
import { makeTempDir } from "./helpers/cli-fixtures.ts";

test("CLI artifact writers create markdown artifacts", async () => {
  const repoPath = await makeTempDir("crew-cli-artifacts-");
  const initResult = await runCrew(["init", "--repo", repoPath]);
  assert.equal(initResult.code, 0, "init should exit with code 0");

  const runBriefResult = await runCrew([
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
  assert.equal(runBriefResult.code, 0, "write-run-brief should exit with code 0");
  const runBriefOutput = JSON.parse(runBriefResult.output);
  const runBriefBody = await fs.readFile(runBriefOutput.path, "utf8");
  assert.match(runBriefBody, /# Run Brief: Platform guidance feature/);
  assert.match(runBriefBody, /single-session/);

  const reviewResult = await runCrew([
    "write-review-result",
    "--repo",
    repoPath,
    "--title",
    "Platform guidance review",
    "--decision",
    "approved",
    "--reviewer",
    "inspector",
    "--files",
    "app/templates/create.html",
    "--non-code"
  ]);
  assert.equal(reviewResult.code, 0, "write-review-result should exit with code 0");
  const reviewOutput = JSON.parse(reviewResult.output);
  const reviewBody = await fs.readFile(reviewOutput.path, "utf8");
  assert.match(reviewBody, /# Review Result: Platform guidance review/);
  assert.match(reviewBody, /approved/);

  const reviewAliasResult = await runCrew([
    "write-review-result",
    "--repo",
    repoPath,
    "--title",
    "Platform guidance alias review",
    "--verdict",
    "approved_with_notes",
    "--non-code"
  ]);
  assert.equal(
    reviewAliasResult.code,
    0,
    "write-review-result with --verdict should exit with code 0"
  );
  const reviewAliasOutput = JSON.parse(reviewAliasResult.output);
  const reviewAliasBody = await fs.readFile(reviewAliasOutput.path, "utf8");
  assert.match(reviewAliasBody, /approved_with_notes/);

  const validationPlanResult = await runCrew([
    "write-validation-plan",
    "--repo",
    repoPath,
    "--title",
    "Platform guidance validation plan",
    "--validator",
    "verifier",
    "--environment",
    "local",
    "--goal",
    "Exercise the create flow and collect smoke evidence",
    "--evidence",
    "vite build,playwright smoke"
  ]);
  assert.equal(validationPlanResult.code, 0, "write-validation-plan should exit with code 0");
  const validationPlanOutput = JSON.parse(validationPlanResult.output);
  const validationPlanBody = await fs.readFile(validationPlanOutput.path, "utf8");
  assert.match(validationPlanBody, /# Validation Plan: Platform guidance validation plan/);
  assert.match(validationPlanBody, /Exercise the create flow and collect smoke evidence/);

  const validationResult = await runCrew([
    "write-validation-result",
    "--repo",
    repoPath,
    "--title",
    "Platform guidance validation",
    "--validator",
    "verifier",
    "--environment",
    "local",
    "--decision",
    "passed",
    "--evidence",
    "vite build,playwright smoke",
    "--files",
    "http://localhost:5173,app/templates/create.html"
  ]);
  assert.equal(validationResult.code, 0, "write-validation-result should exit with code 0");
  const validationOutput = JSON.parse(validationResult.output);
  const validationBody = await fs.readFile(validationOutput.path, "utf8");
  assert.match(validationBody, /# Validation Result: Platform guidance validation/);
  assert.match(validationBody, /local/);
  assert.match(validationBody, /passed/);

  const deploymentCheckResult = await runCrew([
    "write-deployment-check",
    "--repo",
    repoPath,
    "--title",
    "Platform guidance dev deploy",
    "--deployer",
    "release-engineer",
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
  assert.equal(deploymentCheckResult.code, 0, "write-deployment-check should exit with code 0");
  const deploymentCheckOutput = JSON.parse(deploymentCheckResult.output);
  const deploymentCheckBody = await fs.readFile(deploymentCheckOutput.path, "utf8");
  assert.match(deploymentCheckBody, /# Deployment Check: Platform guidance dev deploy/);
  assert.match(deploymentCheckBody, /cloud-run:platform-guidance-dev/);
  assert.match(deploymentCheckBody, /https:\/\/platform-guidance-dev\.example\.com/);
  assert.match(deploymentCheckBody, /platform-guidance-dev-00012-abc/);

  await fs.mkdir(path.join(repoPath, ".github", "workflows"), { recursive: true });
  await fs.writeFile(path.join(repoPath, ".github", "workflows", "deploy.yml"), "name: deploy\n");
  await fs.writeFile(path.join(repoPath, "Dockerfile"), "FROM node:20\n");

  const discoverResult = await runCrew(["discover-deployment", "--repo", repoPath]);
  assert.equal(discoverResult.code, 0, "discover-deployment should exit with code 0");
  const discoverOutput = JSON.parse(discoverResult.output);
  assert.ok(discoverOutput.clues.includes(".github/workflows/deploy.yml"));
  assert.ok(discoverOutput.clues.includes("Dockerfile"));

  const guidanceResult = await runCrew([
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
  assert.equal(guidanceResult.code, 0, "write-deployment-guidance should exit with code 0");
  const guidanceOutput = JSON.parse(guidanceResult.output);
  const guidanceBody = await fs.readFile(guidanceOutput.path, "utf8");
  assert.match(guidanceBody, /# Deployment Guidance: Platform guidance deployment model/);
  assert.match(guidanceBody, /- Discovery Status: live-verified/);
  assert.match(guidanceBody, /- Verified From:/);
  assert.match(guidanceBody, /GitHub Actions builds the image/);
  assert.match(guidanceBody, /Cloud Logging service logs/);
  assert.match(guidanceBody, /staging playground service url/);
  assert.match(guidanceBody, /\.github\/workflows\/deploy\.yml/);
});

test("write-* commands embed --feature and --phase in frontmatter", async () => {
  const repoPath = await makeTempDir("crew-cli-feature-phase-");
  const initResult = await runCrew(["init", "--repo", repoPath]);
  assert.equal(initResult.code, 0, "init should exit with code 0");

  // run-brief with feature + phase
  const runBriefResult = await runCrew([
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
  assert.equal(runBriefResult.code, 0, "write-run-brief should exit with code 0");
  const briefPath = JSON.parse(runBriefResult.output).path;
  const briefBody = await fs.readFile(briefPath, "utf8");
  assert.match(briefBody, /^---\nphase: "3"\nfeature: FEAT-021\nstatus: \w+\n---\n/);
  assert.match(briefBody, /# Run Brief: Tagged brief/);

  // review-result without feature/phase emits no frontmatter (backward-compat)
  const reviewResult = await runCrew([
    "write-review-result",
    "--repo",
    repoPath,
    "--title",
    "Bare review",
    "--decision",
    "approved",
    "--non-code"
  ]);
  assert.equal(reviewResult.code, 0, "write-review-result should exit with code 0");
  const reviewPath = JSON.parse(reviewResult.output).path;
  const reviewBody = await fs.readFile(reviewPath, "utf8");
  assert.ok(
    !reviewBody.startsWith("---"),
    "bare review-result has no frontmatter when feature/phase absent"
  );

  // review-result with only feature emits frontmatter without phase line
  const reviewFeatResult = await runCrew([
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
  assert.equal(
    reviewFeatResult.code,
    0,
    "write-review-result with feature should exit with code 0"
  );
  const reviewFeatPath = JSON.parse(reviewFeatResult.output).path;
  const reviewFeatBody = await fs.readFile(reviewFeatPath, "utf8");
  assert.match(reviewFeatBody, /^---\nfeature: FEAT-007\n---\n/);
  assert.ok(!reviewFeatBody.includes("phase:"), "no phase key when phase omitted");
});

test("write-handoff --repo-context appends ## Repo Layout section", async () => {
  const repoPath = await makeTempDir("crew-repo-context-");
  await runCrew(["init", "--repo", repoPath]);
  const result = await runCrew([
    "write-handoff",
    "--repo",
    repoPath,
    "--title",
    "Test handoff",
    "--from",
    "fullstack-dev",
    "--to",
    "lead",
    "--repo-context"
  ]);
  assert.equal(result.code, 0, "write-handoff should exit with code 0");
  const output = JSON.parse(result.output);
  assert.ok(output.path, "should return artifact path");
  const content = await fs.readFile(output.path, "utf8");
  assert.match(content, /## Repo Layout/);
  assert.match(content, /npm scripts:/);
});

test("write-handoff without --repo-context has no ## Repo Layout section", async () => {
  const repoPath = await makeTempDir("crew-no-repo-context-");
  await runCrew(["init", "--repo", repoPath]);
  const result = await runCrew([
    "write-handoff",
    "--repo",
    repoPath,
    "--title",
    "Test handoff plain",
    "--from",
    "fullstack-dev",
    "--to",
    "lead"
  ]);
  assert.equal(result.code, 0, "write-handoff should exit with code 0");
  const output = JSON.parse(result.output);
  const content = await fs.readFile(output.path, "utf8");
  assert.ok(!content.includes("## Repo Layout"), "should not contain Repo Layout without flag");
});

test("write-review-result with --validation-evidence emits frontmatter field and body section", async () => {
  const repoPath = await makeTempDir("crew-validation-evidence-present-");
  await runCrew(["init", "--repo", repoPath]);
  const evidenceText =
    "node --test: 42 pass / 0 fail; npm run lint exit 0; npm run typecheck exit 0 — code-only diff, no user-visible surface";
  const result = await runCrew([
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
  assert.equal(result.code, 0, "write-review-result should exit with code 0");
  const output = JSON.parse(result.output);
  const content = await fs.readFile(output.path, "utf8");
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
  await runCrew(["init", "--repo", repoPath]);
  const result = await runCrew([
    "write-review-result",
    "--repo",
    repoPath,
    "--title",
    "No evidence review",
    "--decision",
    "approved",
    "--non-code"
  ]);
  assert.equal(result.code, 0, "write-review-result should exit with code 0");
  const output = JSON.parse(result.output);
  const content = await fs.readFile(output.path, "utf8");
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
  await runCrew(["init", "--repo", repoPath]);
  const result = await runCrew([
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
  assert.equal(result.code, 0, "write-review-result should exit with code 0");
  const output = JSON.parse(result.output);
  const content = await fs.readFile(output.path, "utf8");
  assert.ok(
    !content.includes("validation_evidence"),
    "artifact should have no validation_evidence field when flag is empty string"
  );
  assert.ok(
    !content.includes("## Validation Evidence"),
    "artifact should have no Validation Evidence section when flag is empty string"
  );
});

test("write-validation-result: --findings persisted in frontmatter", async () => {
  const repoPath = await makeTempDir("crew-wvr-findings-");
  try {
    await runCrew(["init", "--repo", repoPath]);
    const result = await runCrew([
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
    assert.equal(result.code, 0, "write-validation-result should exit with code 0");
    const output = JSON.parse(result.output);
    const body = await fs.readFile(output.path, "utf8");
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
    await runCrew(["init", "--repo", repoPath]);
    const result = await runCrew([
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
    assert.equal(result.code, 0, "write-deployment-check should exit with code 0");
    const output = JSON.parse(result.output);
    const body = await fs.readFile(output.path, "utf8");
    assert.match(
      body,
      /findings:.*healthy:1,degraded:0,down:0/,
      "deployment artifact must contain findings"
    );
  } finally {
    await fs.rm(repoPath, { recursive: true, force: true });
  }
});
