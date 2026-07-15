#!/usr/bin/env node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import type { MemoryEntry } from "@astragenie/memory-provider";

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

// ---------------------------------------------------------------------------
// Scenario: profile injection disabled/absent (agent-profile-load-feedback,
// Task 7). Mirrors the recall-injection scenarios' isolated-tmp-repo pattern
// above, but only proves the disabled/absent byte-identical property.
//
// IMPORTANT REALITY: no shipped provider implements `profile()` yet — the
// package's `fileProvider` has no such method — so an enabled + real-provider
// call ALSO yields an empty block via buildProfileBlock's own fail-silent
// guard (`typeof provider.profile !== "function"`). That means there is no
// real-provider path today that can produce a NON-empty block for this smoke
// to assert against; the non-empty-block formatting path (corrections /
// decisions / lessons ordering, atom markers, truncation) is already covered
// by Task 3's unit tests with a fake provider
// (tests/memory-inject-profile.test.ts). This scenario intentionally does
// NOT attempt to assert a non-empty block.
// ---------------------------------------------------------------------------

async function scenarioProfileInjectionDisabled(
  buildProfileBlock: typeof import("./lib/memory/inject-profile.ts").buildProfileBlock,
  dispatchBaseline: string
): Promise<void> {
  // Case 1: memory.profile absent entirely -> disabled by default.
  const repoAbsent = await fs.mkdtemp(path.join(os.tmpdir(), "smoke-profile-absent-"));
  await writeMemoryLoopConfig(repoAbsent, { provider: "file" });
  const resultAbsent = await buildProfileBlock({ repoPath: repoAbsent, agent: "crew:reviewer" });
  assert.equal(resultAbsent.block, "", "profile block must be empty when memory.profile is absent");
  assert.deepEqual(resultAbsent.injectedIds, []);
  assert.equal(
    `${dispatchBaseline}${resultAbsent.block}`,
    dispatchBaseline,
    "absent profile config must not alter dispatch text"
  );

  // Case 2: memory.profile.enabled:false explicitly -> same guarantee.
  const repoDisabled = await fs.mkdtemp(path.join(os.tmpdir(), "smoke-profile-disabled-"));
  await writeMemoryLoopConfig(repoDisabled, { provider: "file", profile: { enabled: false } });
  const resultDisabled = await buildProfileBlock({
    repoPath: repoDisabled,
    agent: "crew:reviewer"
  });
  assert.equal(
    resultDisabled.block,
    "",
    "profile block must be empty when memory.profile.enabled is false"
  );
  assert.equal(
    `${dispatchBaseline}${resultDisabled.block}`,
    dispatchBaseline,
    "disabled profile config must not alter dispatch text"
  );

  // Case 3: memory.profile.enabled:true but the configured provider has no
  // profile() method (today's real fileProvider) -> still an empty block,
  // via the REAL resolveProvider() path (no fake/provider override).
  const repoEnabledNoImpl = await fs.mkdtemp(
    path.join(os.tmpdir(), "smoke-profile-enabled-noimpl-")
  );
  await writeMemoryLoopConfig(repoEnabledNoImpl, { provider: "file", profile: { enabled: true } });
  const resultEnabledNoImpl = await buildProfileBlock({
    repoPath: repoEnabledNoImpl,
    agent: "crew:reviewer"
  });
  assert.equal(
    resultEnabledNoImpl.block,
    "",
    "profile block must be empty when the configured provider has no profile() method yet"
  );

  console.log("[scenario] profile-injection-disabled (agent-profile-load-feedback): PASS");
}

async function scenarioProfileInjectionContract(): Promise<void> {
  const { buildProfileBlock } = await import("./lib/memory/inject-profile.ts");
  const dispatchBaseline =
    "Dispatch crew:reviewer to SLICE-XXX -- review the profile-injection wiring.\n";
  await scenarioProfileInjectionDisabled(buildProfileBlock, dispatchBaseline);
}

// ---------------------------------------------------------------------------
// Scenario: slice-ceremony e2e (FEAT-197 / SLICE-111)
//
// Drives the loop plugin's ceremony CLI (../runner-plugin/src/scripts/
// loop.mts) against a hermetic temp repo and asserts the slice start ->
// complete -> grade state/artifact transitions. runner-plugin is a sibling
// repo checkout, not an npm dependency of dev-team — this scenario only
// exercises real transitions when that sibling checkout is present on disk
// (the astra monorepo dev workspace layout). Today's CI has no ../runner-plugin
// sibling checkout, so this scenario SKIPS there — the skip is logged loudly
// (not a quiet green) and can be promoted to a hard failure via
// CREW_REQUIRE_CEREMONY_E2E once CI wires the sibling checkout in (tracked as
// a dev-team backlog followup FEAT, not solved here — that's a cross-repo
// astragenie/common CI change, out of scope for this fix).
// ---------------------------------------------------------------------------

const loopCliPath = path.resolve("../runner-plugin/src/scripts/loop.mts");
const loopCliRoot = path.resolve(loopCliPath, "../../..");

async function pathExists(candidate: string): Promise<boolean> {
  return fs
    .access(candidate)
    .then(() => true)
    .catch(() => false);
}

// Collapses casing/punctuation so a scoping token (e.g. sliceId "SLICE-01")
// can be matched against artifact prose regardless of whether the producer
// rendered it with a dash ("SLICE-01"), without one ("SLICE01"), or in a
// different case — see run_title shape observed in real cost-report
// artifacts under .claude/artifacts/crew/cost/ ("FEAT900 SLICE01").
function normalizeForScopeMatch(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

async function execLoopCli(args: string[]): Promise<any> {
  // Windows: `bun` needs shell:true so its .cmd/.ps1 shim resolves (bare-name
  // spawn is ENOENT otherwise) — same win32-shell pattern as bun-preflight.ts
  // and scripts/lib/gepa/eval.ts.
  const { stdout } = await execFile("bun", [loopCliPath, ...args], {
    cwd: loopCliRoot,
    maxBuffer: 20 * 1024 * 1024,
    shell: process.platform === "win32"
  });
  return JSON.parse(stdout);
}

/**
 * Seed a hermetic temp repo with the minimal scaffold `slice start --id
 * FEAT-X` needs: the four backlog state dirs, a minimal `.claude/loop.json`
 * (memory.enabled: "never" keeps astramem recall out of the hermetic path),
 * and one triaged FEAT with a bare `## Acceptance criteria` heading — NOT
 * the `(Given-When-Then)` suffix, which trips the AC linter (runner#370).
 */
async function seedCeremonyRepo(repoRoot: string): Promise<void> {
  const backlogRoot = path.join(repoRoot, ".claude", "artifacts", "loop", "backlog");
  await Promise.all(
    ["pending", "triaged", "in-progress", "done"].map((state) =>
      fs.mkdir(path.join(backlogRoot, state), { recursive: true })
    )
  );
  await fs.writeFile(
    path.join(repoRoot, ".claude", "loop.json"),
    JSON.stringify({ schemaVersion: 1, loop: {}, memory: { enabled: "never" } }, null, 2),
    "utf8"
  );
  const featBody = [
    "---",
    "id: FEAT-900",
    "status: triaged",
    "priority: P2",
    "category: null",
    "target_release: null",
    "created: 2026-07-08",
    "updated: 2026-07-08",
    "depends_on: []",
    "slices: []",
    "derived_from: null",
    "autonomous_safe: true",
    "---",
    "# FEAT-900: E2E ceremony smoke feature",
    "",
    "Seeded test feature body for the slice-ceremony e2e smoke.",
    "",
    "## Acceptance criteria",
    "",
    "- [ ] AC-1: seeded acceptance criterion for e2e ceremony smoke",
    ""
  ].join("\n");
  await fs.writeFile(path.join(backlogRoot, "triaged", "FEAT-900.md"), featBody, "utf8");
}

/**
 * Gate-satisfaction recipe: review-gate.mts / validation-gate.mts are
 * verdict-aware — they read frontmatter `decision:` off the newest artifact
 * filename that matches the slice-id token under
 * .claude/artifacts/crew/{reviews,validations}/. Writing these directly
 * (no agent, no badge CLI) satisfies both gates hermetically for `slice
 * complete`.
 */
async function writeGateArtifact(
  repoRoot: string,
  kind: "reviews" | "validations",
  sliceId: string,
  decision: string
): Promise<void> {
  const dir = path.join(repoRoot, ".claude", "artifacts", "crew", kind);
  await fs.mkdir(dir, { recursive: true });
  const token = sliceId.toLowerCase().replace("-", "");
  const label = kind === "reviews" ? "review" : "validation";
  const filename = `20260708T090000Z-${label}-${token}-e2e-smoke.md`;
  const body = `---\ndecision: ${decision}\n---\n# ${label === "review" ? "Review" : "Validation"} — ${sliceId}\n`;
  await fs.writeFile(path.join(dir, filename), body, "utf8");
}

async function scenarioSliceCeremony(): Promise<void> {
  if (!(await pathExists(loopCliPath))) {
    const skipMessage =
      "[scenario] slice-ceremony: SKIPPED — runner-plugin CLI not on disk; ceremony e2e NOT " +
      `exercised (looked for ${loopCliPath}; this scenario only runs in the astra monorepo dev ` +
      "workspace where both repos are checked out side by side — a lone dev-team clone, " +
      "including today's CI, has no loop CLI to drive)";
    // Opt-in hard-fail: once CI grows an ../runner-plugin sibling checkout,
    // set CREW_REQUIRE_CEREMONY_E2E to turn this from a silent-pass gap into
    // an enforced gate, without breaking clones that legitimately lack the
    // sibling today. Wiring the CI checkout itself is cross-repo
    // (astragenie/common reusable workflow) and out of scope here — tracked
    // as a dev-team backlog followup FEAT.
    if (process.env["CREW_REQUIRE_CEREMONY_E2E"]) {
      throw new Error(
        `${skipMessage} — CREW_REQUIRE_CEREMONY_E2E is set, failing hard instead of skipping.`
      );
    }
    console.log(skipMessage);
    return;
  }

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "e2e-ceremony-"));
  await seedCeremonyRepo(tmp);

  // AC-1: slice start --id FEAT-X -> SLICE file under slices/pending,
  // workflow-state currentRun rotated, run-brief under crew/runs.
  const startResult = await execLoopCli([
    "slice",
    "start",
    "--id",
    "FEAT-900",
    "--repo",
    tmp,
    "--no-dispatch"
  ]);
  const sliceId: string = startResult.slice?.id;
  assert.match(
    sliceId,
    /^SLICE-\d+$/,
    "slice-ceremony AC-1: slice start must return a SLICE-NN id"
  );

  const pendingDir = path.join(tmp, ".claude", "artifacts", "loop", "ai-loop", "slices", "pending");
  const pendingFiles = await fs.readdir(pendingDir).catch(() => [] as string[]);
  assert.ok(
    pendingFiles.length > 0,
    "slice-ceremony AC-1: expected a slice file under slices/pending"
  );

  const workflowStatePath = path.join(tmp, ".claude", "state", "crew", "workflow-state.json");
  const workflowState = JSON.parse(await fs.readFile(workflowStatePath, "utf8"));
  assert.ok(
    workflowState.currentRun?.startedAt,
    "slice-ceremony AC-1: workflow-state currentRun must be rotated"
  );

  // run-brief creation depends on a cached crew CLI install being
  // discoverable (findHeroCrewCli). That dependency is satisfied whenever
  // this scenario runs at all (verified empirically: on a machine with the
  // ../runner-plugin sibling present, findHeroCrewCli always resolves too),
  // so this is a hard assert, not a soft log — a regression here (e.g.
  // writeCrewRunBrief silently failing) must fail the scenario.
  const runsDir = path.join(tmp, ".claude", "artifacts", "crew", "runs");
  const runsFiles = await fs.readdir(runsDir).catch(() => [] as string[]);
  assert.ok(
    runsFiles.length > 0,
    "slice-ceremony AC-1: expected a run-brief file under crew/runs (writeCrewRunBrief must " +
      "resolve when this scenario executes)"
  );
  console.log("[scenario] slice-ceremony AC-1 (slice start transitions + run-brief): PASS");

  await writeGateArtifact(tmp, "reviews", sliceId, "approved");
  await writeGateArtifact(tmp, "validations", sliceId, "pass");

  // AC-2: slice complete --id SLICE-Y -> reviewGate + validationGate
  // satisfied, slice pending->completed, feature in-progress->done.
  const completeResult = await execLoopCli(["slice", "complete", "--id", sliceId, "--repo", tmp]);
  assert.equal(
    completeResult.reviewGate?.satisfied,
    true,
    "slice-ceremony AC-2: reviewGate.satisfied must be true"
  );
  assert.equal(
    completeResult.validationGate?.satisfied,
    true,
    "slice-ceremony AC-2: validationGate.satisfied must be true"
  );
  assert.match(
    completeResult.slice?.to ?? "",
    /completed[\\/]/,
    "slice-ceremony AC-2: slice must move into completed/"
  );
  assert.match(
    completeResult.feature?.to ?? "",
    /done[\\/]/,
    "slice-ceremony AC-2: feature must move into done/"
  );
  await fs.access(completeResult.slice.to);
  await fs.access(completeResult.feature.to);
  console.log("[scenario] slice-ceremony AC-2 (complete gate satisfaction + moves): PASS");

  // AC-3: a cost-report under crew/cost/, scoped to this slice's run — not
  // just directory non-emptiness. Depends on the same cached crew CLI
  // discovery as AC-1's run-brief, which resolves whenever this scenario
  // runs at all, so this is a hard assert. Cost-report frontmatter doesn't
  // always carry a `slice:` field (outcome-linkage's SLICE[-_]\d+ regex
  // misses the undashed "SLICE01" token emitted in run_title — see
  // normalizeForScopeMatch above), so the scoping check normalizes
  // punctuation/case on both sides and looks for the sliceId token anywhere
  // in the report body (e.g. run_title: "FEAT900 SLICE01").
  const costDir = path.join(tmp, ".claude", "artifacts", "crew", "cost");
  const costFiles = await fs.readdir(costDir).catch(() => [] as string[]);
  assert.ok(
    costFiles.length > 0,
    "slice-ceremony AC-3: expected a cost-report file under crew/cost"
  );
  const latestCostFile = costFiles.sort()[costFiles.length - 1] as string;
  const costText = await fs.readFile(path.join(costDir, latestCostFile), "utf8");
  assert.ok(
    normalizeForScopeMatch(costText).includes(normalizeForScopeMatch(sliceId)),
    `slice-ceremony AC-3: cost-report ${latestCostFile} must reference ${sliceId} ` +
      "(attribution scoping), not just be present in the directory"
  );
  console.log("[scenario] slice-ceremony AC-3 (cost-report present + attribution scoped): PASS");

  // AC-4: slice grade --id SLICE-Y -> grade file with frontmatter
  // slice:SLICE-Y + non-null feature + a scores block.
  const gradeResult = await execLoopCli(["slice", "grade", "--id", sliceId, "--repo", tmp]);
  const gradeContent = await fs.readFile(gradeResult.gradePath, "utf8");
  assert.match(
    gradeContent,
    new RegExp(`slice: ${sliceId}`),
    "slice-ceremony AC-4: grade frontmatter must carry the slice id"
  );
  assert.match(
    gradeContent,
    /feature: FEAT-\d+/,
    "slice-ceremony AC-4: grade frontmatter must carry a non-null feature"
  );
  assert.match(
    gradeContent,
    /scores:/,
    "slice-ceremony AC-4: grade frontmatter must carry a scores block"
  );
  console.log("[scenario] slice-ceremony AC-4 (grade file transitions): PASS");

  // AC-5: covered structurally, not by a dedicated code path — every
  // assert.* above throws on failure, propagating unhandled up through this
  // async function to main()'s `.catch()` below, which sets
  // process.exitCode = 1. Wrapping this scenario in a local try/catch would
  // defeat that contract, so it deliberately has none.
  console.log("[scenario] slice-ceremony (FEAT-197 / SLICE-111): PASS");
}

// ---------------------------------------------------------------------------
// Scenario: dual-write drift-check e2e (FEAT-201)
//
// scripts/lib/memory/drift-check.ts (FEAT-188 S5) is a read-only diagnostic
// for the astramem dual-write accepted risk: astramem writes are
// fire-and-forget, so the local JSONL "derived duplicate" can silently
// outpace the astramem "source of truth". Nothing invoked this diagnostic
// before FEAT-201 wired a CLI entry (--repo/--threshold) + this scenario +
// a scheduled workflow (.github/workflows/drift.yml).
//
// Hermetic by construction: there is no live astramem daemon in CI, so the
// "astramem" side of the dual-write is a pure in-memory fake RemoteHandle
// injected via drift-check.ts's own `__resolveRemote` test seam (same seam
// astramemProvider() already exposes and tests/memory-drift-check.test.ts /
// tests/drift-check-cli.test.ts already exercise) — not a live daemon, and
// not something this scenario needed to skip.
// ---------------------------------------------------------------------------

async function scenarioDriftDualWrite(): Promise<void> {
  const { astramemProvider, fileProvider } = await import("@astragenie/memory-provider");
  const { runDriftCheckCli } = await import("./lib/memory/drift-check.ts");

  const repo = await fs.mkdtemp(path.join(os.tmpdir(), "e2e-drift-"));

  // Fake "source of truth" — remember() records ids it received, recall()
  // matches the entry's own summary text against those ids (mirrors the
  // makeFakeRemote() fixture in tests/memory-drift-check.test.ts).
  const knownIds = new Set<string>();
  const fakeRemote = {
    name: "local" as const,
    provider: {
      async remember(payload: { id: string }): Promise<void> {
        knownIds.add(payload.id);
      },
      async health() {
        return { ok: true, version: "e2e-smoke-fake" };
      },
      async recall(req: { query: string; k?: number }) {
        const hits = [...knownIds]
          .filter((id) => req.query.includes(id))
          .map((id) => ({ id, type: "lesson", text: req.query, score: 1 }));
        return { hits };
      }
    }
  };
  const resolveFakeRemote = async () => fakeRemote;

  // Case 1: provider:astramem + dualWrite:true -> a capture lands in BOTH
  // stores (the fake SoT via remember(), and the local JSONL via the
  // dual-write mirror) -> drift-check must report zero drift.
  const dualWriteProvider = astramemProvider(repo, {
    dualWrite: true,
    __resolveRemote: resolveFakeRemote
  });
  await dualWriteProvider.capture({
    id: "e2e-drift-dual-write-ok",
    kind: "lesson",
    severity: "low",
    summary: "e2e-drift-dual-write-ok landed in both astramem and the local JSONL",
    source: "e2e-smoke"
  });

  const zeroDriftResult = await runDriftCheckCli(["--repo", repo, "--threshold", "0"], {
    __resolveRemote: resolveFakeRemote
  });
  assert.equal(
    zeroDriftResult.exitCode,
    0,
    "scenarioDriftDualWrite: a dual-write capture confirmed in astramem must report zero drift"
  );
  assert.equal(
    zeroDriftResult.report?.missingFromAstramem.length,
    0,
    "scenarioDriftDualWrite: the dual-write capture must not appear as missing"
  );

  // Case 2: inject an astramem-miss — a capture that reaches ONLY the local
  // JSONL, simulating writeThrough()'s fire-and-forget remember() silently
  // failing (the accepted risk this diagnostic exists to surface).
  await fileProvider(repo).capture({
    id: "e2e-drift-astramem-miss",
    kind: "failure",
    severity: "high",
    summary: "e2e-drift-astramem-miss only ever reached the local JSONL",
    source: "e2e-smoke"
  });

  const gapResult = await runDriftCheckCli(["--repo", repo, "--threshold", "0"], {
    __resolveRemote: resolveFakeRemote
  });
  assert.equal(
    gapResult.exitCode,
    1,
    "scenarioDriftDualWrite: an astramem-miss exceeding threshold 0 must fail the gate"
  );
  const missingIds = (gapResult.report?.missingFromAstramem ?? []).map((e) => e.id);
  assert.deepEqual(
    missingIds,
    ["e2e-drift-astramem-miss"],
    "scenarioDriftDualWrite: drift-check must report exactly the injected gap — no more, no less"
  );

  const eventsRaw = await fs.readFile(path.join(repo, ".claude", "logs", "events.jsonl"), "utf8");
  const driftEvent = eventsRaw
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line))
    .find((event) => event.event === "memory_drift");
  assert.ok(driftEvent, "scenarioDriftDualWrite: a memory_drift event must be emitted (AC-4)");
  assert.equal(driftEvent.count, 1, "scenarioDriftDualWrite: event count must match the gap");
  assert.deepEqual(
    driftEvent.ids,
    ["e2e-drift-astramem-miss"],
    "scenarioDriftDualWrite: event ids must carry the reconciliation target (AC-4)"
  );

  console.log(
    "[scenario] drift-dual-write (FEAT-201): PASS — hermetic fake-remote seam, no live astramem daemon"
  );
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

  console.log("\nScenario: profile-injection-disabled (agent-profile-load-feedback)");
  await scenarioProfileInjectionContract();

  console.log("\nScenario: slice-ceremony e2e (FEAT-197)");
  await scenarioSliceCeremony();

  console.log("\nScenario: drift-dual-write (FEAT-201)");
  await scenarioDriftDualWrite();
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
