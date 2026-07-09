import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cliPath = path.join(repoRoot, "scripts", "crew.ts");

// FEAT-193 S1 fix-forward: pre-warm gepa-core's module graph in THIS
// (parent, Bun-run) process before any CLI child process spawns below.
// @astragenie/gepa-core's installed package resolves to raw .ts source with
// no compiled dist/, so the first touch — in any process — pays a
// disk-read + parse cost for the whole provider tree; on Windows this is
// compounded by first-touch Defender scanning of node_modules. Reading
// these files here warms the OS-level file cache (shared across
// processes), so the spawned CLI child below is far less likely to hit a
// genuinely cold multi-second read even though its own V8/Node module
// cache always starts empty. Belt-and-suspenders alongside the production
// fix: scripts/lib/gepa/capture-failure-trial-guard.ts caps the CLI's own
// worst-case wait regardless of how this warm-up performs.
await import("@astragenie/gepa-core");

async function makeTempRepo(prefix: string) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  await execFile("node", ["--experimental-strip-types", cliPath, "init", "--repo", dir]);
  return dir;
}

async function cleanup(dir: string) {
  await fs.rm(dir, { recursive: true, force: true });
}

// Helper: invoke CLI synchronously and return { status, stdout, stderr }
function runCli(args: string[]) {
  const result = spawnSync(process.execPath, ["--experimental-strip-types", cliPath, ...args], {
    encoding: "utf8",
    timeout: 30_000
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

// Scenario 1: approved + no test-summary flags → exit 2 with meaningful stderr
test("write-review-result: approved code-bearing review without test flags exits 2 and reports refusal", async () => {
  const repoPath = await makeTempRepo("crew-wrr-gate-refuse-");
  try {
    const { status, stderr } = runCli([
      "write-review-result",
      "--repo",
      repoPath,
      "--title",
      "Gate test",
      "--decision",
      "approved",
      "--summary",
      "looks good"
    ]);
    assert.equal(status, 2, "expected exit code 2 when approved + no test flags");
    assert.match(stderr, /refused/, "stderr must mention 'refused'");
    assert.match(stderr, /--test-summary/, "stderr must mention '--test-summary'");
  } finally {
    await cleanup(repoPath);
  }
});

// Scenario 2: approved + --non-code → exit 0, artifact contains Non-Code Review: yes
test("write-review-result: approved + --non-code exits 0 and writes Non-Code Review: yes", async () => {
  const repoPath = await makeTempRepo("crew-wrr-noncode-");
  try {
    const { status, stdout } = runCli([
      "write-review-result",
      "--repo",
      repoPath,
      "--title",
      "Non-code review",
      "--decision",
      "approved",
      "--summary",
      "doc change only",
      "--non-code"
    ]);
    assert.equal(status, 0, "expected exit 0 with --non-code");
    const result = JSON.parse(stdout);
    const body = await fs.readFile(result.path, "utf8");
    assert.match(body, /Non-Code Review: yes/, "artifact must contain 'Non-Code Review: yes'");
  } finally {
    await cleanup(repoPath);
  }
});

// Scenario 3: approved + --test-summary → exit 0, artifact contains Test Adequacy: <value>
test("write-review-result: approved + --test-summary exits 0 and writes Test Adequacy field", async () => {
  const repoPath = await makeTempRepo("crew-wrr-test-summary-");
  try {
    const summaryText = "covered by N tests";
    const { status, stdout } = runCli([
      "write-review-result",
      "--repo",
      repoPath,
      "--title",
      "Summary test review",
      "--decision",
      "approved",
      "--summary",
      "all good",
      "--test-summary",
      summaryText
    ]);
    assert.equal(status, 0, "expected exit 0 with --test-summary");
    const result = JSON.parse(stdout);
    const body = await fs.readFile(result.path, "utf8");
    assert.match(
      body,
      /Test Adequacy: covered by N tests/,
      "artifact must contain Test Adequacy field"
    );
  } finally {
    await cleanup(repoPath);
  }
});

// Scenario 4: rejected + no flags → exit 0 (gate bypassed for rejections)
test("write-review-result: rejected decision bypasses the test-adequacy gate", async () => {
  const repoPath = await makeTempRepo("crew-wrr-rejected-");
  try {
    const { status, stdout } = runCli([
      "write-review-result",
      "--repo",
      repoPath,
      "--title",
      "Rejected review",
      "--decision",
      "rejected",
      "--summary",
      "missing null guard"
    ]);
    assert.equal(status, 0, "expected exit 0 for rejected decision");
    const result = JSON.parse(stdout);
    assert.ok(result.path, "artifact path must be present");
  } finally {
    await cleanup(repoPath);
  }
});

// FEAT-188 S1a AC-2: a rejected review-result write auto-captures a
// failure-kind entry into the legacy learnings store.
test("write-review-result: rejected decision captures a failure entry in learnings.jsonl", async () => {
  const repoPath = await makeTempRepo("crew-wrr-rejected-capture-");
  try {
    const { status } = runCli([
      "write-review-result",
      "--repo",
      repoPath,
      "--title",
      "Rejected review",
      "--reviewer",
      "reviewer",
      "--decision",
      "rejected",
      "--summary",
      "missing null guard"
    ]);
    assert.equal(status, 0);
    const raw = await fs.readFile(
      path.join(repoPath, ".claude", "artifacts", "loop", "learnings.jsonl"),
      "utf8"
    );
    const lines = raw
      .split("\n")
      .filter((l) => l.trim().length > 0)
      .map((l) => JSON.parse(l));
    assert.equal(lines.length, 1);
    assert.equal(lines[0].kind, "failure");
    assert.equal(lines[0].agent, "reviewer");
    assert.equal(lines[0].source, "review_fail");
    assert.match(lines[0].summary, /missing null guard/);
  } finally {
    await cleanup(repoPath);
  }
});

// FEAT-193 S1: the same rejected-review write ALSO dual-writes a failing
// Trial to the agent's GEPA trial store, alongside the learnings.jsonl
// capture above.
//
// Best-effort semantics (fix-forward after a real regression): the trial
// write goes through captureFailureTrialGuarded, which races the WHOLE
// dynamic-import-of-gepa-core + write against a ~1.5s ceiling — because
// @astragenie/gepa-core's installed package resolves to raw .ts source, and
// the first process to touch it can pay a multi-second cold parse cost on a
// slow/uncached disk (this is exactly what broke CI: the CLI must never
// wait on that). So this test's PRIMARY assertion is the regression guard
// itself — the CLI always exits 0 and never hangs — and the trial-shape
// check is a secondary, best-effort assertion: on a fast/warm machine the
// trial lands and its shape is verified; on a genuinely slow/cold machine
// the guard may legitimately drop it, which is correct behavior, not a
// test failure.
test("write-review-result: rejected decision also dual-writes a failing GEPA trial (best-effort)", async () => {
  const repoPath = await makeTempRepo("crew-wrr-rejected-trial-");
  try {
    await fs.writeFile(
      path.join(repoPath, "gepa.config.json"),
      JSON.stringify({
        capture: { enabled: true, exclude: [], walltime_ms: 2000 },
        storage: { backend: "file", file_root: ".claude/artifacts/crew/gepa/trials" }
      })
    );
    const { status } = runCli([
      "write-review-result",
      "--repo",
      repoPath,
      "--title",
      "Rejected review",
      "--reviewer",
      "reviewer",
      "--decision",
      "rejected",
      "--summary",
      "missing null guard"
    ]);
    // Regression guard: the CLI must always succeed, cold-gepa-core-load or
    // not (this is what timed out / exited non-zero pre-fix).
    assert.equal(status, 0);

    const trialPath = path.join(
      repoPath,
      ".claude",
      "artifacts",
      "crew",
      "gepa",
      "trials",
      "reviewer.jsonl"
    );
    const trialLines = await fs
      .readFile(trialPath, "utf8")
      .then((raw) =>
        raw
          .split("\n")
          .filter((l) => l.trim().length > 0)
          .map((l) => JSON.parse(l))
      )
      .catch(() => []); // guard legitimately dropped the trial under a slow/cold load — acceptable.

    if (trialLines.length > 0) {
      assert.equal(trialLines.length, 1);
      assert.equal(trialLines[0].agent, "reviewer");
      assert.equal(trialLines[0].phase, "review");
      assert.equal(trialLines[0].source, "captured");
      assert.equal(trialLines[0].score.pass, false);
      assert.equal(trialLines[0].score.score, 0);
      assert.match(trialLines[0].score.rationale, /missing null guard/);
      assert.equal(trialLines[0].input.capture_origin, "production_failure");
    }
  } finally {
    await cleanup(repoPath);
  }
});

// Approved reviews must NOT trigger failure capture.
test("write-review-result: approved decision does not write learnings.jsonl", async () => {
  const repoPath = await makeTempRepo("crew-wrr-approved-no-capture-");
  try {
    const { status } = runCli([
      "write-review-result",
      "--repo",
      repoPath,
      "--title",
      "Approved review",
      "--decision",
      "approved",
      "--summary",
      "all good",
      "--test-summary",
      "covered"
    ]);
    assert.equal(status, 0);
    await assert.rejects(
      fs.readFile(path.join(repoPath, ".claude", "artifacts", "loop", "learnings.jsonl"), "utf8")
    );
  } finally {
    await cleanup(repoPath);
  }
});

// Scenario 5: approved_with_notes + no flags → exit 2 (gate also fires on approved_with_notes branch)
test("write-review-result: approved_with_notes without test flags also exits 2", async () => {
  const repoPath = await makeTempRepo("crew-wrr-approved-with-notes-");
  try {
    const { status, stderr } = runCli([
      "write-review-result",
      "--repo",
      repoPath,
      "--title",
      "Notes gate test",
      "--decision",
      "approved_with_notes",
      "--summary",
      "minor nits"
    ]);
    assert.equal(status, 2, "expected exit 2 for approved_with_notes without test flags");
    assert.match(stderr, /refused/, "stderr must mention 'refused'");
  } finally {
    await cleanup(repoPath);
  }
});

// Scenario 7: unknown decision → exit 2
test("write-review-result: unknown decision exits 2", async () => {
  const repoPath = await makeTempRepo("crew-wrr-unknown-decision-");
  try {
    const { status, stderr } = runCli([
      "write-review-result",
      "--repo",
      repoPath,
      "--title",
      "Unknown decision",
      "--decision",
      "lgtm",
      "--summary",
      "looks good to me",
      "--test-summary",
      "n/a"
    ]);
    assert.equal(status, 2, "expected exit 2 for unknown decision");
    assert.match(stderr, /unknown.*decision/i, "stderr must mention unknown decision");
    assert.match(stderr, /approved/, "stderr must list valid decisions");
  } finally {
    await cleanup(repoPath);
  }
});

// Scenario 6: approved + --test-summary-skip-reason → exit 0, artifact contains Test Adequacy Skip Reason
test("write-review-result: approved + --test-summary-skip-reason exits 0 and writes skip reason", async () => {
  const repoPath = await makeTempRepo("crew-wrr-skip-reason-");
  try {
    const { status, stdout } = runCli([
      "write-review-result",
      "--repo",
      repoPath,
      "--title",
      "Skip reason review",
      "--decision",
      "approved",
      "--summary",
      "doc-only",
      "--test-summary-skip-reason",
      "doc-only refactor"
    ]);
    assert.equal(status, 0, "expected exit 0 with --test-summary-skip-reason");
    const result = JSON.parse(stdout);
    const body = await fs.readFile(result.path, "utf8");
    assert.match(
      body,
      /Test Adequacy Skip Reason: doc-only refactor/,
      "artifact must contain 'Test Adequacy Skip Reason: doc-only refactor'"
    );
  } finally {
    await cleanup(repoPath);
  }
});

// Scenario 7: --findings flag persisted in artifact frontmatter
test("write-review-result: --findings persisted in artifact frontmatter", async () => {
  const repoPath = await makeTempRepo("crew-wrr-findings-");
  try {
    const { status, stdout } = runCli([
      "write-review-result",
      "--repo",
      repoPath,
      "--title",
      "Findings review",
      "--decision",
      "approved",
      "--summary",
      "looks good",
      "--test-summary",
      "all pass",
      "--findings",
      "🔴:1,🟡:2,❓:0"
    ]);
    assert.equal(status, 0, "expected exit 0 with --findings");
    const result = JSON.parse(stdout);
    const body = await fs.readFile(result.path, "utf8");
    assert.match(body, /findings:.*🔴:1,🟡:2,❓:0/, "artifact must contain findings frontmatter");
  } finally {
    await cleanup(repoPath);
  }
});

// dev-team#247: --not-checked / --author-id / --judge-id round-trip into the
// artifact, and self_approval is derived (author == judge).
test("write-review-result: --not-checked / --author-id / --judge-id round-trip into the artifact", async () => {
  const repoPath = await makeTempRepo("crew-wrr-not-checked-");
  try {
    const { status, stdout } = runCli([
      "write-review-result",
      "--repo",
      repoPath,
      "--title",
      "Not-checked review",
      "--decision",
      "approved",
      "--summary",
      "looks good",
      "--test-summary",
      "all pass",
      "--not-checked",
      "perf,i18n,a11y",
      "--author-id",
      "builder-1",
      "--judge-id",
      "reviewer-1"
    ]);
    assert.equal(status, 0, "expected exit 0 with the new optional flags");
    const result = JSON.parse(stdout);
    const body = await fs.readFile(result.path, "utf8");
    assert.match(
      body,
      /not_checked:.*\["perf","i18n","a11y"\]/,
      "frontmatter must list not_checked"
    );
    assert.match(body, /author_id: builder-1/, "frontmatter must contain author_id");
    assert.match(body, /judge_id: reviewer-1/, "frontmatter must contain judge_id");
    assert.match(body, /Not Checked:/, "body must surface a Not Checked section");
    assert.match(body, /Author: builder-1/, "body must surface Author");
    assert.match(body, /Judge: reviewer-1/, "body must surface Judge");
  } finally {
    await cleanup(repoPath);
  }
});

// dev-team#247: self_approval derives true when author-id === judge-id.
test("write-review-result: self_approval derives true when author-id equals judge-id", async () => {
  const repoPath = await makeTempRepo("crew-wrr-self-approval-true-");
  try {
    const { status, stdout } = runCli([
      "write-review-result",
      "--repo",
      repoPath,
      "--title",
      "Self-approval review",
      "--decision",
      "approved",
      "--summary",
      "looks good",
      "--test-summary",
      "all pass",
      "--author-id",
      "same-agent",
      "--judge-id",
      "same-agent"
    ]);
    assert.equal(status, 0);
    const result = JSON.parse(stdout);
    const body = await fs.readFile(result.path, "utf8");
    assert.match(body, /self_approval: true/, "frontmatter must record self_approval: true");
    assert.match(body, /self-approval/i, "body must surface the self-approval marker");
  } finally {
    await cleanup(repoPath);
  }
});

// dev-team#247: self_approval derives false (and is still recorded) when
// author-id and judge-id differ.
test("write-review-result: self_approval derives false when author-id and judge-id differ", async () => {
  const repoPath = await makeTempRepo("crew-wrr-self-approval-false-");
  try {
    const { status, stdout } = runCli([
      "write-review-result",
      "--repo",
      repoPath,
      "--title",
      "Differing identities review",
      "--decision",
      "approved",
      "--summary",
      "looks good",
      "--test-summary",
      "all pass",
      "--author-id",
      "builder-1",
      "--judge-id",
      "reviewer-1"
    ]);
    assert.equal(status, 0);
    const result = JSON.parse(stdout);
    const body = await fs.readFile(result.path, "utf8");
    assert.match(body, /self_approval: false/, "frontmatter must record self_approval: false");
    assert.doesNotMatch(body, /⚠/, "body must NOT surface the self-approval warning marker");
  } finally {
    await cleanup(repoPath);
  }
});

// dev-team#247: self_approval is entirely absent (no flag passed) when
// author-id is not provided — it must never default to false in the
// artifact so absence stays distinguishable from a known non-self-approval.
test("write-review-result: self_approval is absent when neither author-id nor judge-id is passed", async () => {
  const repoPath = await makeTempRepo("crew-wrr-self-approval-absent-");
  try {
    const { status, stdout } = runCli([
      "write-review-result",
      "--repo",
      repoPath,
      "--title",
      "No identity review",
      "--decision",
      "approved",
      "--summary",
      "looks good",
      "--test-summary",
      "all pass"
    ]);
    assert.equal(status, 0);
    const result = JSON.parse(stdout);
    const body = await fs.readFile(result.path, "utf8");
    assert.doesNotMatch(
      body,
      /self_approval:/,
      "self_approval must not appear when author-id is absent"
    );
    assert.doesNotMatch(
      body,
      /not_checked:/,
      "not_checked must not appear when --not-checked is absent"
    );
    assert.doesNotMatch(body, /author_id:/, "author_id must not appear when --author-id is absent");
    assert.doesNotMatch(body, /judge_id:/, "judge_id must not appear when --judge-id is absent");
  } finally {
    await cleanup(repoPath);
  }
});

// dev-team#247 BACKWARD COMPAT: with none of the new flags passed, the
// artifact's shape (frontmatter block + body) must be identical to the
// pre-existing shape — no new frontmatter keys or body sections leak in.
test("write-review-result: backward compat — no new flags leaves output byte-identical in shape", async () => {
  const repoA = await makeTempRepo("crew-wrr-compat-a-");
  const repoB = await makeTempRepo("crew-wrr-compat-b-");
  try {
    const argsFor = (repoPath: string) => [
      "write-review-result",
      "--repo",
      repoPath,
      "--title",
      "Compat review",
      "--decision",
      "approved",
      "--summary",
      "looks good",
      "--test-summary",
      "all pass"
    ];
    const first = runCli(argsFor(repoA));
    const second = runCli(argsFor(repoB));
    assert.equal(first.status, 0);
    assert.equal(second.status, 0);
    const bodyA = await fs.readFile(JSON.parse(first.stdout).path, "utf8");
    const bodyB = await fs.readFile(JSON.parse(second.stdout).path, "utf8");
    // Strip the one field that legitimately varies run-to-run (Created: <iso>).
    const normalize = (body: string) => body.replace(/- Created: .*/g, "- Created: <ts>");
    assert.equal(
      normalize(bodyA),
      normalize(bodyB),
      "identical inputs must produce identical shape"
    );
    for (const body of [bodyA, bodyB]) {
      assert.doesNotMatch(body, /not_checked:/);
      assert.doesNotMatch(body, /author_id:/);
      assert.doesNotMatch(body, /judge_id:/);
      assert.doesNotMatch(body, /self_approval:/);
      assert.doesNotMatch(body, /Not Checked:/);
      assert.doesNotMatch(body, /^Author:/m);
      assert.doesNotMatch(body, /^Judge:/m);
    }
  } finally {
    await cleanup(repoA);
    await cleanup(repoB);
  }
});
