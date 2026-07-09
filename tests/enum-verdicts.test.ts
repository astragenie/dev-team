// P1.3 — enum verdict frontmatter + fail-open badge fix.
// Covers: writer rejects invalid enum, needs_fix normalizes to rejected,
// skipped without skip_reason throws, handler throws on unknown verdict
// (not just the CLI refusal), approved_with_notes -> review_passed, legacy
// artifacts (no verdict) keep the old default-pass behavior, and the Zod
// schemas round-trip real writer output.
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";
import { runCrew } from "../scripts/crew.ts";
import { registerWorkflowArtifact } from "../scripts/lib/workflow-state.ts";
import type { ArtifactRef } from "../scripts/lib/workflow-state.ts";
import {
  normalizeReviewDecision,
  normalizeValidationDecision,
  ReviewArtifactSchema,
  ValidationArtifactSchema
} from "../scripts/lib/schemas.ts";
import { parseFrontmatterBlock } from "../scripts/lib/briefing/collect-cost-parser.ts";
import { makeTempDir, loadState, cliPath } from "./helpers/cli-fixtures.ts";

// process.exit(2) refusal paths must run out-of-process — calling them via the
// in-process runCrew() would kill the test runner itself (same reason
// tests/crew-write-review-result.test.ts uses spawnSync for its exit-2 cases).
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

async function cleanup(dir: string) {
  await fs.rm(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// normalize* helpers
// ---------------------------------------------------------------------------

test("normalizeReviewDecision: needs_fix normalizes to rejected (aliasOf recorded)", () => {
  const result = normalizeReviewDecision("needs_fix");
  assert.deepEqual(result, { canonical: "rejected", aliasOf: "needs_fix" });
});

// FIX-0: architect-reviewer.md emits approved_with_conditions / needs_revision,
// neither of which was in REVIEW_DECISION_ALIASES — every non-approved
// architect-reviewer verdict hit the unrecognized-value branch and exit(2)'d
// before anything was written. Widen the alias map, not the canonical enum.
test("normalizeReviewDecision: approved_with_conditions normalizes to approved_with_notes (aliasOf recorded)", () => {
  const result = normalizeReviewDecision("approved_with_conditions");
  assert.deepEqual(result, {
    canonical: "approved_with_notes",
    aliasOf: "approved_with_conditions"
  });
});

test("normalizeReviewDecision: needs_revision normalizes to rejected (aliasOf recorded)", () => {
  const result = normalizeReviewDecision("needs_revision");
  assert.deepEqual(result, { canonical: "rejected", aliasOf: "needs_revision" });
});

test("normalizeReviewDecision: canonical values pass through with no aliasOf", () => {
  for (const value of ["approved", "approved_with_notes", "rejected"] as const) {
    const result = normalizeReviewDecision(value);
    assert.deepEqual(result, { canonical: value });
  }
});

test("normalizeReviewDecision: unrecognized value returns null (fail closed, not open)", () => {
  assert.equal(normalizeReviewDecision("lgtm"), null);
  assert.equal(normalizeReviewDecision(undefined), null);
  assert.equal(normalizeReviewDecision(""), null);
});

test("normalizeValidationDecision: legacy passed/passed_with_notes/failed normalize to canonical", () => {
  assert.deepEqual(normalizeValidationDecision("passed"), { canonical: "pass", aliasOf: "passed" });
  assert.deepEqual(normalizeValidationDecision("passed_with_notes"), {
    canonical: "pass",
    aliasOf: "passed_with_notes"
  });
  assert.deepEqual(normalizeValidationDecision("failed"), { canonical: "fail", aliasOf: "failed" });
});

test("normalizeValidationDecision: unrecognized value returns null", () => {
  assert.equal(normalizeValidationDecision("banana"), null);
});

// ---------------------------------------------------------------------------
// write-review-result CLI
// ---------------------------------------------------------------------------

test("write-review-result: needs_fix input is accepted, normalized to rejected in frontmatter, and fails the review gate", async () => {
  const repoPath = await makeTempDir("enum-verdicts-needs-fix-");
  try {
    const { status, stdout } = runCli([
      "write-review-result",
      "--repo",
      repoPath,
      "--title",
      "Needs fix review",
      "--decision",
      "needs_fix",
      "--summary",
      "missing null guard"
    ]);
    assert.equal(status, 0, "needs_fix must be accepted, not refused");
    const result = JSON.parse(stdout);
    const body = await fs.readFile(result.path, "utf8");
    // Canonical value lands in frontmatter; the alias is documented in code,
    // not necessarily preserved in the artifact (needs_fix has no pre-P1.3
    // callers, so there's no back-compat body-prose burden here).
    assert.match(body, /^decision: rejected$/m, "frontmatter must carry the canonical value");

    const state = await loadState(repoPath);
    assert.equal(
      state.currentRun.gates.review.status,
      "failed",
      "needs_fix must fail the review gate exactly like rejected"
    );
  } finally {
    await cleanup(repoPath);
  }
});

test("write-review-result: approved_with_notes (with test-summary) writes canonical frontmatter and passes the review gate", async () => {
  const repoPath = await makeTempDir("enum-verdicts-awn-");
  try {
    const { status, stdout } = runCli([
      "write-review-result",
      "--repo",
      repoPath,
      "--title",
      "Minor nits",
      "--decision",
      "approved_with_notes",
      "--summary",
      "minor nits only",
      "--test-summary",
      "covered"
    ]);
    assert.equal(status, 0);
    const result = JSON.parse(stdout);
    const body = await fs.readFile(result.path, "utf8");
    assert.match(body, /^decision: approved_with_notes$/m);

    const state = await loadState(repoPath);
    assert.equal(state.currentRun.gates.review.status, "passed");
  } finally {
    await cleanup(repoPath);
  }
});

test("write-review-result: approved_with_conditions (architect-reviewer.md verdict) is accepted and normalized to approved_with_notes in frontmatter", async () => {
  const repoPath = await makeTempDir("enum-verdicts-awc-");
  try {
    const { status, stdout } = runCli([
      "write-review-result",
      "--repo",
      repoPath,
      "--title",
      "Architecture review with conditions",
      "--decision",
      "approved_with_conditions",
      "--summary",
      "acceptable pending follow-up",
      "--test-summary",
      "covered"
    ]);
    assert.equal(status, 0, "approved_with_conditions must be accepted, not refused");
    const result = JSON.parse(stdout);
    const body = await fs.readFile(result.path, "utf8");
    assert.match(
      body,
      /^decision: approved_with_notes$/m,
      "frontmatter must carry the canonical value"
    );

    const state = await loadState(repoPath);
    assert.equal(state.currentRun.gates.review.status, "passed");
  } finally {
    await cleanup(repoPath);
  }
});

test("write-review-result: needs_revision (architect-reviewer.md verdict) is accepted, normalized to rejected in frontmatter, and fails the review gate", async () => {
  const repoPath = await makeTempDir("enum-verdicts-needs-revision-");
  try {
    const { status, stdout } = runCli([
      "write-review-result",
      "--repo",
      repoPath,
      "--title",
      "Architecture review needs revision",
      "--decision",
      "needs_revision",
      "--summary",
      "service boundary unclear"
    ]);
    assert.equal(status, 0, "needs_revision must be accepted, not refused");
    const result = JSON.parse(stdout);
    const body = await fs.readFile(result.path, "utf8");
    assert.match(body, /^decision: rejected$/m, "frontmatter must carry the canonical value");

    const state = await loadState(repoPath);
    assert.equal(
      state.currentRun.gates.review.status,
      "failed",
      "needs_revision must fail the review gate exactly like rejected"
    );
  } finally {
    await cleanup(repoPath);
  }
});

test("write-review-result: unrecognized decision (not an alias) still exits 2", async () => {
  const repoPath = await makeTempDir("enum-verdicts-bogus-review-");
  try {
    const { status, stderr } = runCli([
      "write-review-result",
      "--repo",
      repoPath,
      "--title",
      "Bogus",
      "--decision",
      "lgtm",
      "--summary",
      "x"
    ]);
    assert.equal(status, 2);
    assert.match(stderr, /unknown decision/i);
  } finally {
    await cleanup(repoPath);
  }
});

// ---------------------------------------------------------------------------
// write-validation-result CLI
// ---------------------------------------------------------------------------

test("write-validation-result: legacy 'passed_with_notes' normalizes to canonical 'pass' in frontmatter but keeps raw body prose", async () => {
  const repoPath = await makeTempDir("enum-verdicts-legacy-validation-");
  try {
    const { status, stdout } = runCli([
      "write-validation-result",
      "--repo",
      repoPath,
      "--title",
      "Legacy decision",
      "--decision",
      "passed_with_notes",
      "--summary",
      "all good"
    ]);
    assert.equal(status, 0);
    const result = JSON.parse(stdout);
    const body = await fs.readFile(result.path, "utf8");
    assert.match(
      body,
      /^decision: pass$/m,
      "frontmatter carries the canonical value, not the legacy alias"
    );
    assert.match(
      body,
      /Decision: passed_with_notes/,
      "body prose keeps the raw legacy value for back-compat"
    );

    const state = await loadState(repoPath);
    assert.equal(state.currentRun.gates.validation.status, "passed");
  } finally {
    await cleanup(repoPath);
  }
});

test("write-validation-result: skipped without --skip-reason is refused (exit 2)", async () => {
  const repoPath = await makeTempDir("enum-verdicts-skip-no-reason-");
  try {
    const { status, stderr } = runCli([
      "write-validation-result",
      "--repo",
      repoPath,
      "--title",
      "Skip without reason",
      "--decision",
      "skipped",
      "--summary",
      "env unavailable"
    ]);
    assert.equal(status, 2);
    assert.match(stderr, /skip_reason/);
  } finally {
    await cleanup(repoPath);
  }
});

test("write-validation-result: skipped with --skip-reason succeeds, sets validation_skipped, and records the reason", async () => {
  const repoPath = await makeTempDir("enum-verdicts-skipped-");
  try {
    const { status, stdout } = runCli([
      "write-validation-result",
      "--repo",
      repoPath,
      "--title",
      "Skip with reason",
      "--decision",
      "skipped",
      "--skip-reason",
      "staging environment unavailable"
    ]);
    assert.equal(status, 0);
    const result = JSON.parse(stdout);
    const body = await fs.readFile(result.path, "utf8");
    assert.match(body, /^decision: skipped$/m);
    assert.match(body, /^skip_reason: "staging environment unavailable"$/m);

    const state = await loadState(repoPath);
    assert.equal(state.currentRun.gates.validation.status, "skipped");
    assert.match(state.currentRun.gates.validation.note, /staging environment unavailable/);
  } finally {
    await cleanup(repoPath);
  }
});

test("write-validation-result: unrecognized decision exits 2", async () => {
  const repoPath = await makeTempDir("enum-verdicts-bogus-validation-");
  try {
    const { status, stderr } = runCli([
      "write-validation-result",
      "--repo",
      repoPath,
      "--title",
      "Bogus",
      "--decision",
      "banana"
    ]);
    assert.equal(status, 2);
    assert.match(stderr, /unknown decision/i);
  } finally {
    await cleanup(repoPath);
  }
});

// FEAT-188 S1a AC-2: a "fail" validation-result write auto-captures a
// failure-kind entry into the legacy learnings store.
test("write-validation-result: fail decision captures a failure entry in learnings.jsonl", async () => {
  const repoPath = await makeTempDir("enum-verdicts-fail-capture-");
  try {
    const { status } = runCli([
      "write-validation-result",
      "--repo",
      repoPath,
      "--title",
      "Failed validation",
      "--validator",
      "verifier",
      "--decision",
      "fail",
      "--summary",
      "build broke on clean checkout"
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
    assert.equal(lines[0].agent, "verifier");
    assert.equal(lines[0].source, "validation_fail");
    assert.match(lines[0].summary, /build broke on clean checkout/);
  } finally {
    await cleanup(repoPath);
  }
});

// "pass" must NOT trigger failure capture.
test("write-validation-result: pass decision does not write learnings.jsonl", async () => {
  const repoPath = await makeTempDir("enum-verdicts-pass-no-capture-");
  try {
    const { status } = runCli([
      "write-validation-result",
      "--repo",
      repoPath,
      "--title",
      "Passed validation",
      "--decision",
      "pass",
      "--summary",
      "all good"
    ]);
    assert.equal(status, 0);
    await assert.rejects(
      fs.readFile(path.join(repoPath, ".claude", "artifacts", "loop", "learnings.jsonl"), "utf8")
    );
  } finally {
    await cleanup(repoPath);
  }
});

// ---------------------------------------------------------------------------
// workflow-state handler: throws on unknown verdict, not just CLI-level
// ---------------------------------------------------------------------------

test("registerWorkflowArtifact: unrecognized review verdict throws instead of failing open to review_passed", async () => {
  const repoPath = await makeTempDir("enum-verdicts-handler-review-");
  try {
    const artifact: ArtifactRef = { kind: "review-result", path: "fake-path.md", title: "t" };
    await assert.rejects(
      () => registerWorkflowArtifact(repoPath, artifact, { verdict: "lgtm", summary: "bad" }),
      /unrecognized review verdict/
    );
  } finally {
    await cleanup(repoPath);
  }
});

test("registerWorkflowArtifact: unrecognized validation verdict throws instead of failing open to validation_passed", async () => {
  const repoPath = await makeTempDir("enum-verdicts-handler-validation-");
  try {
    const artifact: ArtifactRef = { kind: "validation-result", path: "fake-path.md", title: "t" };
    await assert.rejects(
      () => registerWorkflowArtifact(repoPath, artifact, { verdict: "kinda", summary: "bad" }),
      /unrecognized validation verdict/
    );
  } finally {
    await cleanup(repoPath);
  }
});

test("registerWorkflowArtifact: absent verdict (legacy artifact / caller never set --decision) preserves the old default-pass behavior", async () => {
  const repoPath = await makeTempDir("enum-verdicts-legacy-absent-");
  try {
    const artifact: ArtifactRef = { kind: "review-result", path: "fake-path.md", title: "t" };
    // No `verdict` field at all — must NOT throw, must default to review_passed
    // exactly like it did before P1.3 (this is the documented back-compat path).
    const run = await registerWorkflowArtifact(repoPath, artifact, {
      summary: "no decision given"
    });
    assert.equal(run?.gates.review?.status, "passed");
  } finally {
    await cleanup(repoPath);
  }
});

// ---------------------------------------------------------------------------
// Zod schemas round-trip real writer output
// ---------------------------------------------------------------------------

test("ReviewArtifactSchema / ValidationArtifactSchema round-trip write-review-result / write-validation-result output", async () => {
  const repoPath = await makeTempDir("enum-verdicts-schema-roundtrip-");
  try {
    const reviewResult = await runCrew([
      "write-review-result",
      "--repo",
      repoPath,
      "--title",
      "Schema round-trip review",
      "--decision",
      "approved",
      "--summary",
      "looks good",
      "--test-summary",
      "all pass",
      "--feature",
      "FEAT-999",
      "--slice",
      "SLICE-1"
    ]);
    assert.equal(reviewResult.code, 0);
    const reviewPath = JSON.parse(reviewResult.output).path;
    const reviewBody = await fs.readFile(reviewPath, "utf8");
    const reviewFm = parseFrontmatterBlock(reviewBody);
    assert.equal(ReviewArtifactSchema.safeParse(reviewFm).success, true);

    const validationResult = await runCrew([
      "write-validation-result",
      "--repo",
      repoPath,
      "--title",
      "Schema round-trip validation",
      "--decision",
      "skipped",
      "--skip-reason",
      "no staging slot",
      "--feature",
      "FEAT-999"
    ]);
    assert.equal(validationResult.code, 0);
    const validationPath = JSON.parse(validationResult.output).path;
    const validationBody = await fs.readFile(validationPath, "utf8");
    const validationFm = parseFrontmatterBlock(validationBody);
    // parseFrontmatterBlock doesn't JSON-unescape quoted values; skip_reason
    // is JSON.stringify'd in the artifact so it round-trips as a quoted,
    // still-non-empty string — sufficient for the schema's truthiness check.
    assert.equal(ValidationArtifactSchema.safeParse(validationFm).success, true);

    // And the schema still catches the invalid case: skipped with no skip_reason.
    const invalid = ValidationArtifactSchema.safeParse({ decision: "skipped" });
    assert.equal(invalid.success, false);
  } finally {
    await cleanup(repoPath);
  }
});
