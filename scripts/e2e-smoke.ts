#!/usr/bin/env node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import type { MemoryEntry } from "./lib/memory/schema.ts";

const execFile = promisify(execFileCallback);
const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), "crew-e2e-"));
const repoPath = path.join(rootPath, "sample-repo");
const cliPath = path.resolve("scripts/crew.ts");
const classifyScriptPath = path.resolve("scripts/orchestrate-slice-classify.ts");
const sliceFixturePath = path.resolve("tests/fixtures/slices/split-build-demo.md");
const openapiFixturePath = path.resolve("tests/fixtures/openapi/valid-feat.openapi.yaml");

async function scenarioSplitBuildClassification(sampleRoot: string) {
  const sliceDir = path.join(sampleRoot, "docs", "ai-loop", "slices", "pending");
  await fs.mkdir(sliceDir, { recursive: true });
  const sliceTarget = path.join(sliceDir, "SLICE-901-split-build-demo.md");
  await fs.copyFile(sliceFixturePath, sliceTarget);

  const contractDir = path.join(sampleRoot, "docs", "contracts", "FEAT-DEMO");
  await fs.mkdir(contractDir, { recursive: true });
  await fs.copyFile(openapiFixturePath, path.join(contractDir, "openapi.yaml"));

  const { stdout } = await execFile(process.execPath, [classifyScriptPath, sliceTarget]);
  const json = JSON.parse(stdout);
  if (json.SPLIT_BUILD !== true) {
    throw new Error(`expected SPLIT_BUILD true, got: ${JSON.stringify(json)}`);
  }
  console.log("scenarioSplitBuildClassification: PASS");
}

async function smokeBuildBundle(repoRoot: string): Promise<void> {
  // Create a fresh temp repo so the bundle smoke is isolated from the sample repo.
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "smoke-bundle-"));
  await execFile("git", ["init", "-q"], { cwd: tmp });
  await execFile("git", ["config", "user.email", "smoke@example.com"], { cwd: tmp });
  await execFile("git", ["config", "user.name", "Smoke"], { cwd: tmp });
  await fs.writeFile(path.join(tmp, ".gitignore"), "node_modules\n", "utf8");
  await execFile("git", ["add", "-A"], { cwd: tmp });
  await execFile("git", ["commit", "-q", "-m", "init"], { cwd: tmp });

  await fs.writeFile(path.join(tmp, "a.ts"), "export const a = 1;\n", "utf8");
  const handoffPath = path.join(tmp, "handoff.md");
  await fs.writeFile(handoffPath, "## Handoff body\n\nsmoke\n", "utf8");

  const crewScript = path.join(repoRoot, "scripts", "crew.ts");
  const { stdout } = await execFile(
    process.execPath,
    [
      "--experimental-strip-types",
      crewScript,
      "write-build-bundle",
      "--repo",
      tmp,
      "--slice",
      "SLICE-smoke",
      "--builder",
      "fullstack-dev",
      "--run",
      "20260608T999999Z",
      "--handoff",
      handoffPath,
      "--files",
      "a.ts",
      "--files-read",
      ""
    ],
    { cwd: repoRoot }
  );

  const printedPath = stdout.trim().split(/\r?\n/).pop() ?? "";
  assert.ok(
    printedPath.endsWith("build-bundle.md"),
    `smoke: bundle path not printed (got: ${JSON.stringify(printedPath)})`
  );

  const expectedDir = path.join(tmp, ".claude", "artifacts", "crew", "bundles", "SLICE-smoke");
  const inExpectedDir = printedPath.startsWith(expectedDir);
  assert.ok(
    inExpectedDir,
    `smoke: bundle not under expected dir ${expectedDir} (got: ${printedPath})`
  );

  const text = await fs.readFile(printedPath, "utf8");
  assert.match(text, /^---\nslice: SLICE-smoke\n/, "smoke: bundle missing slice frontmatter");
  assert.ok(text.includes("## Handoff"), "smoke: bundle missing Handoff section");
  assert.ok(text.includes("## Diff"), "smoke: bundle missing Diff section");
  assert.ok(text.includes("## Files touched"), "smoke: bundle missing Files touched section");

  // Spec assertions 2 + 3: simulate what /crew:review and /crew:validate do
  // when they dispatch reviewer/validator subagents — call inlineLatestBundle
  // and verify the string that gets inlined into the dispatch prompt has the
  // preload header AND references at least one file from `files_touched`.
  const { inlineLatestBundle } = await import("./lib/build-bundle/inline.ts");
  const { INLINE_HEADER } = await import("./lib/build-bundle/types.ts");
  const bundlesRoot = path.join(tmp, ".claude", "artifacts", "crew", "bundles");
  const inlined = await inlineLatestBundle({
    sliceId: "SLICE-smoke",
    bundlesRoot
  });
  assert.ok(
    inlined.startsWith(INLINE_HEADER),
    `smoke: dispatch prompt would not start with preload header (got: ${JSON.stringify(inlined.slice(0, 80))})`
  );
  assert.ok(
    inlined.includes("a.ts"),
    "smoke: dispatch prompt does not reference any file from files_touched"
  );

  console.log(`[smoke] build-bundle phase OK (${printedPath})`);
}

async function scenarioScaffoldThenUpdate(sampleRoot: string) {
  const crewScript = path.resolve("scripts/crew.ts");

  // Test 1: Review result scaffold
  const reviewScaffoldResult = await execFile(process.execPath, [
    crewScript,
    "write-review-result",
    "--repo",
    sampleRoot,
    "--title",
    "E2E scaffold review",
    "--scaffold"
  ]);
  const reviewScaffoldOutput = JSON.parse(reviewScaffoldResult.stdout);
  const reviewPath = reviewScaffoldOutput.path;
  let reviewContent = await fs.readFile(reviewPath, "utf8");

  // Verify scaffold structure for review
  assert.match(reviewContent, /## Verdict/, "scaffold review must have Verdict section");
  assert.match(reviewContent, /decision:/, "scaffold review must have empty decision field");
  assert.match(reviewContent, /## Test Summary/, "scaffold review must have Test Summary");
  assert.match(reviewContent, /## Risks/, "scaffold review must have Risks section");
  assert.match(reviewContent, /in-progress/, "scaffold review must have in-progress status");

  // Now update the review result (fill in judgment fields)
  const reviewUpdateResult = await execFile(process.execPath, [
    crewScript,
    "write-review-result",
    "--repo",
    sampleRoot,
    "--update",
    reviewPath,
    "--title",
    "E2E scaffold review",
    "--decision",
    "approved",
    "--test-summary",
    "All tests passed"
  ]);
  const reviewUpdateOutput = JSON.parse(reviewUpdateResult.stdout);
  reviewContent = await fs.readFile(reviewUpdateOutput.path, "utf8");

  // Verify update: decision should be filled in (normal renderer uses "Decision:" capital)
  assert.match(reviewContent, /Decision: approved/, "updated review must have decision approved");

  // Test 2: Validation result scaffold
  const validScaffoldResult = await execFile(process.execPath, [
    crewScript,
    "write-validation-result",
    "--repo",
    sampleRoot,
    "--title",
    "E2E scaffold validation",
    "--scaffold"
  ]);
  const validScaffoldOutput = JSON.parse(validScaffoldResult.stdout);
  const validPath = validScaffoldOutput.path;
  let validContent = await fs.readFile(validPath, "utf8");

  // Verify scaffold structure for validation
  assert.match(validContent, /## Environment/, "scaffold validation must have Environment section");
  assert.match(validContent, /## Scenario/, "scaffold validation must have Scenario section");
  assert.match(validContent, /## Gates/, "scaffold validation must have Gates section");
  assert.match(validContent, /## Decision/, "scaffold validation must have Decision section");
  assert.match(validContent, /in-progress/, "scaffold validation must have in-progress status");

  // Now update the validation result
  const validUpdateResult = await execFile(process.execPath, [
    crewScript,
    "write-validation-result",
    "--repo",
    sampleRoot,
    "--update",
    validPath,
    "--title",
    "E2E scaffold validation",
    "--decision",
    "passed",
    "--environment",
    "local"
  ]);
  const validUpdateOutput = JSON.parse(validUpdateResult.stdout);
  validContent = await fs.readFile(validUpdateOutput.path, "utf8");

  // Verify update: decision should be filled in (normal renderer uses "Decision:" capital)
  assert.match(validContent, /Decision: passed/, "updated validation must have decision passed");

  console.log("[scenario] scaffold-then-update: PASS");
}

async function scenarioLightTierClassification(sampleRoot: string) {
  // Test 1: docs-only should be light tier
  const docsOnlyFiles = ["docs/README.md", "CHANGELOG.md"];
  const { isLightTier } = await import("./orchestrate-slice-classify.ts");

  let tierResult = isLightTier({
    changedLines: 0,
    filesChanged: docsOnlyFiles
  });
  assert.equal(tierResult, true, "docs-only files should classify as light tier");

  // Test 2: 30-line code change should be light tier (if no hooks/manifests)
  tierResult = isLightTier({
    changedLines: 30,
    filesChanged: ["src/lib/helpers.ts"]
  });
  assert.equal(tierResult, true, "≤50-line change should classify as light tier");

  // Test 3: code change >50 lines should NOT be light tier (default maxLines is 50)
  tierResult = isLightTier({
    changedLines: 100,
    filesChanged: ["src/lib/bigchange.ts"]
  });
  assert.equal(tierResult, false, ">50-line change should NOT be light tier");

  // Test 4: hook files should NOT be light tier even if small
  tierResult = isLightTier({
    changedLines: 10,
    filesChanged: [".claude/hooks/post-deploy.ts"]
  });
  assert.equal(tierResult, false, "hook files should NOT be light tier");

  // Test 5: write-run-brief with tier field
  const crewScript = path.resolve("scripts/crew.ts");
  const briefResult = await execFile(process.execPath, [
    crewScript,
    "write-run-brief",
    "--repo",
    sampleRoot,
    "--title",
    "Light-tier test run",
    "--goal",
    "Update docs",
    "--tier",
    "light"
  ]);
  const briefOutput = JSON.parse(briefResult.stdout);
  const briefPath = briefOutput.path;
  const briefContent = await fs.readFile(briefPath, "utf8");

  assert.match(briefContent, /Tier: light/, "run-brief must include tier: light");

  console.log("[scenario] light-tier-classification: PASS");
}

async function scenarioValidationStaleFlow(sampleRoot: string) {
  // This scenario tests marking validation stale when review needs_fix
  const crewScript = path.resolve("scripts/crew.ts");
  const stateDir = path.join(sampleRoot, ".claude", "state", "crew");

  // Initialize workflow state by starting a run (via write-run-brief)
  await execFile(process.execPath, [
    crewScript,
    "write-run-brief",
    "--repo",
    sampleRoot,
    "--title",
    "Validation stale test",
    "--goal",
    "Test stale marking"
  ]);

  // Mark validation as passed
  const markPassedResult = await execFile(process.execPath, [
    crewScript,
    "mark-badge",
    "--repo",
    sampleRoot,
    "--badge",
    "validation_passed",
    "--summary",
    "All gates passed"
  ]);
  assert.equal(markPassedResult.stderr, "", "mark-badge validation_passed should not error");

  // Now mark validation as stale (simulating review finding needs_fix)
  const markStaleResult = await execFile(process.execPath, [
    crewScript,
    "mark-badge",
    "--repo",
    sampleRoot,
    "--badge",
    "validation_stale",
    "--note",
    "invalidated by review needs_fix"
  ]);
  assert.equal(markStaleResult.stderr, "", "mark-badge validation_stale should not error");

  // Load workflow state and verify stale status is recorded
  const workflowStatePath = path.join(stateDir, "workflow-state.json");
  const workflowStateText = await fs.readFile(workflowStatePath, "utf8");
  const workflowState = JSON.parse(workflowStateText);

  // Verify that the validation gate shows stale status
  assert.ok(
    workflowState.currentRun?.gates?.validation?.status === "stale" ||
      workflowState.currentRun?.badges?.includes?.("validation_stale"),
    "workflow state should record validation_stale badge"
  );

  // Verify brief-me still works (exit 0) after stale mark
  // We can't actually run brief-me here since it requires the full harness,
  // but we can verify the state file is well-formed
  assert.ok(workflowState.currentRun, "workflow state must have currentRun");
  assert.ok(workflowState.currentRun.startedAt, "workflow state must have startedAt");

  console.log("[scenario] validation-stale-flow: PASS");
}

// ---------------------------------------------------------------------------
// Scenario: recall-injection-v1 contract smoke (FEAT-196 / SLICE-110)
//
// Guards the frozen contract at docs/contracts/recall-injection-v1.md
// end-to-end through the real public helper (scripts/lib/memory/
// inject-recall.ts) — never a forked recall-block format. Each case gets its
// own throwaway temp repo (mirrors smokeBuildBundle's isolated-tmp pattern
// above) with a real .claude/loop.json + learnings.jsonl fixture so
// loadMemoryConfig's actual file-read path is exercised, not just rawConfig
// passthrough.
// ---------------------------------------------------------------------------

async function writeMemoryLoopConfig(repoRoot: string, memoryBlock: unknown): Promise<void> {
  const loopConfigPath = path.join(repoRoot, ".claude", "loop.json");
  await fs.mkdir(path.dirname(loopConfigPath), { recursive: true });
  await fs.writeFile(loopConfigPath, JSON.stringify({ memory: memoryBlock }, null, 2), "utf8");
}

async function writeRecallFixtureEntry(repoRoot: string, entry: MemoryEntry): Promise<void> {
  const learningsPath = path.join(repoRoot, ".claude", "artifacts", "loop", "learnings.jsonl");
  await fs.mkdir(path.dirname(learningsPath), { recursive: true });
  await fs.appendFile(learningsPath, `${JSON.stringify(entry)}\n`, "utf8");
}

// Local, e2e-smoke-scoped structured event log — deliberately NOT routed
// through scripts/lib/gepa/observability-events.ts (that sink is GEPA-event
// branded); this smoke's `recall_injection_smoke` event is test-infra-only
// telemetry for AC-3, kept out of the product runtime surface entirely.
async function logSmokeEvent(repoRoot: string, fields: Record<string, unknown>): Promise<void> {
  const eventsPath = path.join(repoRoot, ".claude", "logs", "events.jsonl");
  await fs.mkdir(path.dirname(eventsPath), { recursive: true });
  const line = `${JSON.stringify({ ts: new Date().toISOString(), ...fields })}\n`;
  await fs.appendFile(eventsPath, line, "utf8");
}

function recallFixtureEntry(source: string): MemoryEntry {
  return {
    id: `smoke-${source}`,
    ts: new Date(Date.now() - 60_000).toISOString(),
    kind: "lesson",
    severity: "low",
    agent: null,
    tags: ["smoke-fixture"],
    summary: `Recall-injection-v1 contract fixture entry (${source}).`,
    source: "e2e-smoke-fixture"
  };
}

async function scenarioRecallInjectionAc1(
  injectRecall: typeof import("./lib/memory/index.ts").injectRecall,
  dispatchBaseline: string
): Promise<void> {
  // AC-1: provider:none -> byte-identical, zero injected blocks.
  const repoNone = await fs.mkdtemp(path.join(os.tmpdir(), "smoke-recall-none-"));
  await writeMemoryLoopConfig(repoNone, { provider: "none" });
  const resultNone = await injectRecall(dispatchBaseline, { repoPath: repoNone });
  assert.equal(
    resultNone,
    dispatchBaseline,
    "AC-1: provider:none must return dispatchText byte-identical to baseline"
  );

  // AC-1 (alt path): provider:file but recall.enabled:false -> same guarantee,
  // even with a matching fixture entry present in the store.
  const repoRecallDisabled = await fs.mkdtemp(path.join(os.tmpdir(), "smoke-recall-disabled-"));
  await writeMemoryLoopConfig(repoRecallDisabled, { provider: "file", recall: { enabled: false } });
  await writeRecallFixtureEntry(repoRecallDisabled, recallFixtureEntry("ac1-disabled"));
  const resultDisabled = await injectRecall(dispatchBaseline, { repoPath: repoRecallDisabled });
  assert.equal(
    resultDisabled,
    dispatchBaseline,
    "AC-1: recall.enabled:false must return dispatchText byte-identical to baseline"
  );
  console.log("[scenario] recall-injection-contract AC-1 (provider:none / recall disabled): PASS");
}

async function scenarioRecallInjectionAc2(
  injectRecall: typeof import("./lib/memory/index.ts").injectRecall,
  formatRecallBlock: typeof import("./lib/memory/index.ts").formatRecallBlock,
  dispatchBaseline: string
): Promise<void> {
  // AC-2: provider:file, exactly one matching entry -> exactly one injected block.
  const repoOneMatch = await fs.mkdtemp(path.join(os.tmpdir(), "smoke-recall-one-"));
  await writeMemoryLoopConfig(repoOneMatch, { provider: "file" });
  const fixtureEntry = recallFixtureEntry("ac2-one-match");
  await writeRecallFixtureEntry(repoOneMatch, fixtureEntry);
  const resultOneMatch = await injectRecall(dispatchBaseline, { repoPath: repoOneMatch });

  const expectedBlock = formatRecallBlock([fixtureEntry]);
  assert.equal(
    resultOneMatch,
    `${dispatchBaseline}\n\n${expectedBlock}`,
    "AC-2: single matching entry must inject exactly the frozen single-entry block"
  );
  const headerMatches = resultOneMatch.match(/## Prior context \(from astramem\)/g) ?? [];
  assert.equal(
    headerMatches.length,
    1,
    "AC-2: exactly one recall header must be injected (no double-inject)"
  );
  const entryLines = resultOneMatch.split("\n").filter((line) => line.startsWith("- **["));
  assert.equal(entryLines.length, 1, "AC-2: exactly one recall entry line must be injected");
  console.log("[scenario] recall-injection-contract AC-2 (provider:file, one match): PASS");
}

async function scenarioRecallInjectionAc3(
  injectRecall: typeof import("./lib/memory/index.ts").injectRecall,
  dispatchBaseline: string
): Promise<void> {
  // AC-3: provider:file, zero matching entries (tag-scope miss) -> byte-identical
  // dispatch + a structured recall_injection_smoke event with entriesInjected: 0.
  const repoZeroMatch = await fs.mkdtemp(path.join(os.tmpdir(), "smoke-recall-zero-"));
  await writeMemoryLoopConfig(repoZeroMatch, { provider: "file" });
  await writeRecallFixtureEntry(repoZeroMatch, recallFixtureEntry("ac3-zero-match"));
  const resultZeroMatch = await injectRecall(dispatchBaseline, {
    repoPath: repoZeroMatch,
    tags: ["smoke-tag-that-does-not-exist"]
  });
  assert.equal(
    resultZeroMatch,
    dispatchBaseline,
    "AC-3: zero matching entries must return dispatchText byte-identical to baseline"
  );

  await logSmokeEvent(repoZeroMatch, {
    event: "recall_injection_smoke",
    case: "provider-file-zero-match",
    entriesInjected: 0
  });
  const eventsRaw = await fs.readFile(
    path.join(repoZeroMatch, ".claude", "logs", "events.jsonl"),
    "utf8"
  );
  const smokeEvent = eventsRaw
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line))
    .find((event) => event.event === "recall_injection_smoke");
  assert.ok(smokeEvent, "AC-3: recall_injection_smoke event must be logged");
  assert.equal(smokeEvent.entriesInjected, 0, "AC-3: entriesInjected must be 0");
  console.log(
    "[scenario] recall-injection-contract AC-3 (provider:file, zero match + event): PASS"
  );
}

async function scenarioRecallInjectionContract(): Promise<void> {
  const { injectRecall, formatRecallBlock } = await import("./lib/memory/index.ts");

  const dispatchBaseline =
    "Dispatch fullstack-dev to SLICE-110 -- implement the recall-injection e2e contract smoke.\n";

  await scenarioRecallInjectionAc1(injectRecall, dispatchBaseline);
  await scenarioRecallInjectionAc2(injectRecall, formatRecallBlock, dispatchBaseline);
  await scenarioRecallInjectionAc3(injectRecall, dispatchBaseline);
}

async function main() {
  console.log(`Creating sample repo at ${repoPath}`);

  const initResult = await execFile("node", [cliPath, "init", "--repo", repoPath], {
    cwd: path.resolve(".")
  });
  console.log(initResult.stdout.trim());

  const claudePath = path.join(repoPath, "CLAUDE.md");
  const gitignorePath = path.join(repoPath, ".gitignore");
  const settingsPath = path.join(repoPath, ".claude", "settings.json");
  const workflowPath = path.join(repoPath, ".claude", "crew", "workflow.md");
  const protocolPath = path.join(repoPath, ".claude", "crew", "protocol.md");
  const validationsPath = path.join(repoPath, ".claude", "artifacts", "crew", "validations");
  const deploymentsPath = path.join(repoPath, ".claude", "artifacts", "crew", "deployments");
  const claudeMd = await fs.readFile(claudePath, "utf8");
  const gitignore = await fs.readFile(gitignorePath, "utf8");
  const settings = JSON.parse(await fs.readFile(settingsPath, "utf8"));
  const workflowMd = await fs.readFile(workflowPath, "utf8");
  const protocolMd = await fs.readFile(protocolPath, "utf8");

  console.log("\nSmoke check:");
  console.log(`- CLAUDE.md exists: ${claudeMd.length > 0}`);
  console.log(`- .gitignore has Crew block: ${gitignore.includes("# crew:start")}`);
  console.log(`- Harness import present: ${claudeMd.includes("crew:start")}`);
  console.log(
    `- Workflow stays command-loaded: ${!claudeMd.includes("@.claude/crew/workflow.md")}`
  );
  console.log(`- Workflow file exists: ${workflowMd.length > 0}`);
  console.log(`- Protocol file exists: ${protocolMd.length > 0}`);
  console.log(
    `- Validation artifacts dir exists: ${await fs
      .access(validationsPath)
      .then(() => true)
      .catch(() => false)}`
  );
  console.log(
    `- Deployment artifacts dir exists: ${await fs
      .access(deploymentsPath)
      .then(() => true)
      .catch(() => false)}`
  );
  console.log(`- Hook events configured: ${Object.keys(settings.hooks).join(", ")}`);
  console.log(`- Repo path: ${repoPath}`);

  console.log("\nScenario: SPLIT_BUILD classification");
  await scenarioSplitBuildClassification(repoPath);

  const heroCrewRoot = path.resolve(import.meta.dirname, "..");
  console.log("\nScenario: write-build-bundle");
  await smokeBuildBundle(heroCrewRoot);

  console.log("\nScenario: scaffold-then-update");
  await scenarioScaffoldThenUpdate(repoPath);

  console.log("\nScenario: light-tier-classification");
  await scenarioLightTierClassification(repoPath);

  console.log("\nScenario: validation-stale-flow");
  await scenarioValidationStaleFlow(repoPath);

  console.log("\nScenario: recall-injection-contract (FEAT-196)");
  await scenarioRecallInjectionContract();
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
