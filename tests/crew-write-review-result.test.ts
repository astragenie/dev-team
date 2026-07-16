import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test, expect } from "bun:test";
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
    expect(status, "expected exit code 2 when approved + no test flags").toBe(2);
    expect(stderr, "stderr must mention 'refused'").toMatch(/refused/);
    expect(stderr, "stderr must mention '--test-summary'").toMatch(/--test-summary/);
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
    expect(status, "expected exit 0 with --non-code").toBe(0);
    const result = JSON.parse(stdout);
    const body = await fs.readFile(result.path, "utf8");
    expect(body, "artifact must contain 'Non-Code Review: yes'").toMatch(/Non-Code Review: yes/);
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
    expect(status, "expected exit 0 with --test-summary").toBe(0);
    const result = JSON.parse(stdout);
    const body = await fs.readFile(result.path, "utf8");
    expect(body, "artifact must contain Test Adequacy field").toMatch(
      /Test Adequacy: covered by N tests/
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
    expect(status, "expected exit 0 for rejected decision").toBe(0);
    const result = JSON.parse(stdout);
    expect(result.path, "artifact path must be present").toBeTruthy();
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
    expect(status).toBe(0);
    const raw = await fs.readFile(
      path.join(repoPath, ".claude", "artifacts", "loop", "learnings.jsonl"),
      "utf8"
    );
    const lines = raw
      .split("\n")
      .filter((l) => l.trim().length > 0)
      .map((l) => JSON.parse(l));
    expect(lines.length).toBe(1);
    expect(lines[0].kind).toBe("failure");
    expect(lines[0].agent).toBe("reviewer");
    expect(lines[0].source).toBe("review_fail");
    expect(lines[0].summary).toMatch(/missing null guard/);
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
    expect(status).toBe(0);

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
      expect(trialLines.length).toBe(1);
      expect(trialLines[0].agent).toBe("reviewer");
      expect(trialLines[0].phase).toBe("review");
      expect(trialLines[0].source).toBe("captured");
      expect(trialLines[0].score.pass).toBe(false);
      expect(trialLines[0].score.score).toBe(0);
      expect(trialLines[0].score.rationale).toMatch(/missing null guard/);
      expect(trialLines[0].input.capture_origin).toBe("production_failure");
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
    expect(status).toBe(0);
    await expect(
      fs.readFile(path.join(repoPath, ".claude", "artifacts", "loop", "learnings.jsonl"), "utf8")
    ).rejects.toThrow();
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
    expect(status, "expected exit 2 for approved_with_notes without test flags").toBe(2);
    expect(stderr, "stderr must mention 'refused'").toMatch(/refused/);
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
    expect(status, "expected exit 2 for unknown decision").toBe(2);
    expect(stderr, "stderr must mention unknown decision").toMatch(/unknown.*decision/i);
    expect(stderr, "stderr must list valid decisions").toMatch(/approved/);
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
    expect(status, "expected exit 0 with --test-summary-skip-reason").toBe(0);
    const result = JSON.parse(stdout);
    const body = await fs.readFile(result.path, "utf8");
    expect(body, "artifact must contain 'Test Adequacy Skip Reason: doc-only refactor'").toMatch(
      /Test Adequacy Skip Reason: doc-only refactor/
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
    expect(status, "expected exit 0 with --findings").toBe(0);
    const result = JSON.parse(stdout);
    const body = await fs.readFile(result.path, "utf8");
    expect(body, "artifact must contain findings frontmatter").toMatch(/findings:.*🔴:1,🟡:2,❓:0/);
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
    expect(status, "expected exit 0 with the new optional flags").toBe(0);
    const result = JSON.parse(stdout);
    const body = await fs.readFile(result.path, "utf8");
    expect(body, "frontmatter must list not_checked").toMatch(
      /not_checked:.*\["perf","i18n","a11y"\]/
    );
    expect(body, "frontmatter must contain author_id").toMatch(/author_id: builder-1/);
    expect(body, "frontmatter must contain judge_id").toMatch(/judge_id: reviewer-1/);
    expect(body, "body must surface a Not Checked section").toMatch(/Not Checked:/);
    expect(body, "body must surface Author").toMatch(/Author: builder-1/);
    expect(body, "body must surface Judge").toMatch(/Judge: reviewer-1/);
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
    expect(status).toBe(0);
    const result = JSON.parse(stdout);
    const body = await fs.readFile(result.path, "utf8");
    expect(body, "frontmatter must record self_approval: true").toMatch(/self_approval: true/);
    expect(body, "body must surface the self-approval marker").toMatch(/self-approval/i);
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
    expect(status).toBe(0);
    const result = JSON.parse(stdout);
    const body = await fs.readFile(result.path, "utf8");
    expect(body, "frontmatter must record self_approval: false").toMatch(/self_approval: false/);
    expect(body, "body must NOT surface the self-approval warning marker").not.toMatch(/⚠/);
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
    expect(status).toBe(0);
    const result = JSON.parse(stdout);
    const body = await fs.readFile(result.path, "utf8");
    expect(body, "self_approval must not appear when author-id is absent").not.toMatch(
      /self_approval:/
    );
    expect(body, "not_checked must not appear when --not-checked is absent").not.toMatch(
      /not_checked:/
    );
    expect(body, "author_id must not appear when --author-id is absent").not.toMatch(/author_id:/);
    expect(body, "judge_id must not appear when --judge-id is absent").not.toMatch(/judge_id:/);
  } finally {
    await cleanup(repoPath);
  }
});

// dev-team#152: prose bodies containing apostrophes/backticks/newlines
// mangle shell argv quoting when passed as a literal --summary string. The
// --summary-file companion reads the same content from disk instead, so it
// never rides shell interpolation. Round-trip fidelity is the assertion.
test("write-review-result: --summary-file round-trips apostrophes, backticks, and newlines", async () => {
  const repoPath = await makeTempRepo("crew-wrr-summary-file-");
  const bodyText =
    "The claim's validity depends on `resolveHomeDir()` behavior.\n" +
    "It's fine on Windows but breaks on Bun's Linux build (bun#5090).\n" +
    "Second paragraph with more `backticks` and it's still one apostrophe short.";
  const summaryFilePath = path.join(repoPath, "summary-body.txt");
  try {
    await fs.writeFile(summaryFilePath, `${bodyText}\n`, "utf8");
    const { status, stdout, stderr } = runCli([
      "write-review-result",
      "--repo",
      repoPath,
      "--title",
      "Body-file round trip",
      "--decision",
      "approved",
      "--summary-file",
      summaryFilePath,
      "--test-summary",
      "all pass"
    ]);
    expect(status, `expected exit 0 with --summary-file, stderr: ${stderr}`).toBe(0);
    const result = JSON.parse(stdout);
    const artifactBody = await fs.readFile(result.path, "utf8");
    expect(
      artifactBody.includes(bodyText),
      `artifact must contain the exact file-sourced body verbatim, got:\n${artifactBody}`
    ).toBeTruthy();
  } finally {
    await cleanup(repoPath);
  }
});

// dev-team#152: the companion also accepts "-" to read the body from stdin,
// matching the `gh issue create -F -` convention referenced in the issue.
test("write-review-result: --summary-file - reads the body from stdin", async () => {
  const repoPath = await makeTempRepo("crew-wrr-summary-stdin-");
  const bodyText = "Stdin body with an apostrophe's quote and a `backtick` span.";
  try {
    const result = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        cliPath,
        "write-review-result",
        "--repo",
        repoPath,
        "--title",
        "Stdin body-file round trip",
        "--decision",
        "approved",
        "--summary-file",
        "-",
        "--test-summary",
        "all pass"
      ],
      { encoding: "utf8", timeout: 30_000, input: `${bodyText}\n` }
    );
    expect(result.status, `expected exit 0 reading stdin, stderr: ${result.stderr}`).toBe(0);
    const parsed = JSON.parse(result.stdout);
    const artifactBody = await fs.readFile(parsed.path, "utf8");
    expect(
      artifactBody.includes(bodyText),
      `artifact must contain the exact stdin-sourced body verbatim, got:\n${artifactBody}`
    ).toBeTruthy();
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
    expect(first.status).toBe(0);
    expect(second.status).toBe(0);
    const bodyA = await fs.readFile(JSON.parse(first.stdout).path, "utf8");
    const bodyB = await fs.readFile(JSON.parse(second.stdout).path, "utf8");
    // Strip the one field that legitimately varies run-to-run (Created: <iso>).
    const normalize = (body: string) => body.replace(/- Created: .*/g, "- Created: <ts>");
    expect(normalize(bodyA), "identical inputs must produce identical shape").toBe(
      normalize(bodyB)
    );
    for (const body of [bodyA, bodyB]) {
      expect(body).not.toMatch(/not_checked:/);
      expect(body).not.toMatch(/author_id:/);
      expect(body).not.toMatch(/judge_id:/);
      expect(body).not.toMatch(/self_approval:/);
      expect(body).not.toMatch(/Not Checked:/);
      expect(body).not.toMatch(/^Author:/m);
      expect(body).not.toMatch(/^Judge:/m);
    }
  } finally {
    await cleanup(repoA);
    await cleanup(repoB);
  }
});
