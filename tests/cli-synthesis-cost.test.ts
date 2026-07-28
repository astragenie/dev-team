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

afterAll(async () => {
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
  expect(rejectResult.code, "should reject when review_required is pending").not.toBe(0);
  expect(rejectResult.output).toMatch(/pending: review_required/);

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
  expect(allowResult.code, "should allow when review is skipped with reason").toBe(0);
  const finalResult = JSON.parse(allowResult.output);
  const finalBody = await fs.readFile(finalResult.path, "utf8");
  expect(finalBody).toMatch(/Allowed final synthesis/);
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
  expect(result.code, "should reject when --external-deltas is missing").not.toBe(0);
  expect(result.output).toMatch(/requires --external-deltas/);
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
  expect(result.code, "should succeed with --external-deltas none").toBe(0);
  const parsed = JSON.parse(result.output);
  const body = await fs.readFile(parsed.path, "utf8");
  expect(body).toMatch(/External Deltas/);
  expect(body).toMatch(/none/);
});

test("final-synthesis blocked when escalated_to_lead set; --force overrides", async () => {
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
    "escalated_to_lead",
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
  expect(blockResult.code, "should reject when escalated_to_lead").not.toBe(0);
  expect(blockResult.output).toMatch(/escalated_to_lead|pending|escalated to lead/i);

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
  expect(forceResult.code, "should allow with --force flag").toBe(0);
  const result = JSON.parse(forceResult.output);
  expect(result.path).toBeTruthy();
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
  expect(adviseResult.code, "cost-advise should succeed").toBe(0);
  const adviseOutput = JSON.parse(adviseResult.output);
  expect(adviseOutput.artifactPath).toBeTruthy();
  expect(
    path.basename(adviseOutput.artifactPath),
    "cost-advise filename includes the --title slug"
  ).toMatch(/-cost-advise-phase3-feat021-slice36\.md$/);
  const body = await fs.readFile(adviseOutput.artifactPath, "utf8");
  expect(body, "cost-advise body starts with phase/feature frontmatter").toMatch(
    /^---\nphase: "3"\nfeature: FEAT-021\n---\n/
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
  expect(result.code, "cost-slice should succeed").toBe(0);
  const costResult = JSON.parse(result.output);
  const body = await fs.readFile(costResult.path, "utf8");
  expect(body).toMatch(/\nfeature: FEAT-100\n/);
  expect(body).toMatch(/\nphase: "beta"\n/);
});

// ── FEAT-151: Per-dispatch breakdown section ──────────────────────────────

test("cost-slice renders ## Per-dispatch breakdown when dispatch log has matching rows", async () => {
  const repoPath = await makeTempDir("crew-cli-dispatch-breakdown-");
  const dispatchLog = path.join(repoPath, "dispatch-timing.jsonl");
  const bashLog = path.join(repoPath, "bash-gates.jsonl");

  // Seed dispatch-timing log with two dispatches for a fixed runId
  const dispatchRows = [
    {
      runId: "test-run-001",
      sliceId: "SLICE-99",
      agent: "crew:fullstack-dev",
      model: "claude-sonnet-4-5",
      wallMs: 5000,
      tokenIn: 10000,
      tokenOut: 2000,
      toolCalls: { Read: 3, Edit: 1, Bash: 2 },
      bashDurationMs: 500,
      skillLoadCount: 2
    },
    {
      runId: "test-run-001",
      sliceId: "SLICE-99",
      agent: "crew:reviewer",
      model: "claude-sonnet-4-5",
      wallMs: 8000,
      tokenIn: 8000,
      tokenOut: 1500,
      toolCalls: { Read: 5 },
      bashDurationMs: 0,
      skillLoadCount: 1
    }
  ];
  // Seed bash-gates log
  const bashRows = [
    { gate: "typecheck", durationMs: 6000, exitCode: 0 },
    { gate: "lint", durationMs: 3000, exitCode: 0 }
  ];

  await fs.writeFile(
    dispatchLog,
    dispatchRows.map((r) => JSON.stringify(r)).join("\n") + "\n",
    "utf-8"
  );
  await fs.writeFile(bashLog, bashRows.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf-8");

  await runCrew(["init", "--repo", repoPath]);

  const savedDispatchLog = process.env["CREW_DISPATCH_TIMING_LOG"];
  const savedBashLog = process.env["CREW_BASH_GATE_LOG"];
  process.env["CREW_DISPATCH_TIMING_LOG"] = dispatchLog;
  process.env["CREW_BASH_GATE_LOG"] = bashLog;

  try {
    const result = await runCrew([
      "cost-slice",
      "--repo",
      repoPath,
      "--started-at",
      "2026-05-22T00:00:00Z",
      "--completed-at",
      "2026-05-22T00:05:00Z",
      "--run-title",
      "dispatch-breakdown-test"
    ]);
    expect(result.code, "cost-slice should succeed").toBe(0);
    const costResult = JSON.parse(result.output);
    const body = await fs.readFile(costResult.path, "utf8");
    expect(body, "should include dispatch section header").toMatch(/## Per-dispatch breakdown/);
    expect(body, "should include the slower dispatch (crew:reviewer)").toMatch(/crew:reviewer/);
    expect(body, "should show total wall-clock (5000 + 8000)").toMatch(/13000ms/);
    expect(body, "should include bash gate breakdown").toMatch(/typecheck/);
    expect(body, "dispatch table should include Skills column header").toMatch(/\| Skills \|/);
    expect(
      body,
      "dispatch table should include non-zero skill-count value (skillLoadCount=2)"
    ).toMatch(/\| 2 \|/);
  } finally {
    if (savedDispatchLog === undefined) delete process.env["CREW_DISPATCH_TIMING_LOG"];
    else process.env["CREW_DISPATCH_TIMING_LOG"] = savedDispatchLog;
    if (savedBashLog === undefined) delete process.env["CREW_BASH_GATE_LOG"];
    else process.env["CREW_BASH_GATE_LOG"] = savedBashLog;
  }
});
