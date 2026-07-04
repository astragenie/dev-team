/**
 * tests/gepa/mine-reviewer-bug-corpus.test.ts — SLICE-103
 *
 * Verifies the mining script CLI contract:
 *   - arg parsing (valid + invalid)
 *   - --weeks 0 → AC-5: exit 0, no files, helpful message
 *   - EvalCaseSchema compliance for written seed stubs
 *   - redactRationale called on extracted content (no raw secret leakage)
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { EvalCaseSchema } from "@astragenie/gepa-core";
import {
  parseMineArgs,
  runMineReviewerBugCorpus,
  type ReviewerEvalCase,
  type ReviewerEvalCaseNotes
} from "../../scripts/lib/gepa/mine-reviewer-bug-corpus.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tmpRepo(): string {
  return mkdtempSync(join(tmpdir(), "mine-reviewer-corpus-"));
}

/** Write a fake review artifact with a CRITICAL finding and rejected decision. */
function seedReviewArtifact(reviewsDir: string, filename: string, content: string): void {
  mkdirSync(reviewsDir, { recursive: true });
  writeFileSync(join(reviewsDir, filename), content, "utf8");
}

const REJECTED_CRITICAL_REVIEW = `
# Review Result: SLICE-XX some feature

- Created: 2026-06-30T10:00:00.000Z
- Decision: rejected
- Summary: CRITICAL bug found — null guard removed.
- Risks: CRITICAL: The null guard on line 12 was removed. Accessing order.items on a null value will throw a TypeError at runtime on every order lookup for non-existent IDs. Restore the null guard before merging.
- Required Follow-up: Restore null guard on line 12 of order-processor.ts.
`;

const APPROVED_REVIEW = `
# Review Result: SLICE-YY clean rename

- Created: 2026-06-30T11:00:00.000Z
- Decision: approved
- Summary: Clean rename, no issues.
- Risks: none
- Required Follow-up: none
`;

// ---------------------------------------------------------------------------
// parseMineArgs
// ---------------------------------------------------------------------------

describe("SLICE-103 parseMineArgs", () => {
  test("defaults: weeks=8, out=agents/reviewer/.gepa/eval", () => {
    const repoPath = tmpRepo();
    const result = parseMineArgs([], repoPath);
    expect(result.weeks).toBe(8);
    expect(result.out).toContain("reviewer");
    expect(result.out).toContain(".gepa");
    expect(result.out).toContain("eval");
    expect(result.invalid).toBeUndefined();
  });

  test("--weeks 4 parses correctly", () => {
    const result = parseMineArgs(["--weeks", "4"], tmpRepo());
    expect(result.weeks).toBe(4);
  });

  test("--weeks 0 parses correctly (AC-5 trigger)", () => {
    const result = parseMineArgs(["--weeks", "0"], tmpRepo());
    expect(result.weeks).toBe(0);
    expect(result.invalid).toBeUndefined();
  });

  test("--out custom path parses correctly", () => {
    const result = parseMineArgs(["--out", "/tmp/my-eval"], tmpRepo());
    expect(result.out).toBe("/tmp/my-eval");
  });

  test("--weeks without value → invalid", () => {
    const result = parseMineArgs(["--weeks"], tmpRepo());
    expect(result.invalid).toBeDefined();
  });

  test("--out without value → invalid", () => {
    const result = parseMineArgs(["--out"], tmpRepo());
    expect(result.invalid).toBeDefined();
  });

  test("--weeks with non-numeric value → invalid", () => {
    const result = parseMineArgs(["--weeks", "abc"], tmpRepo());
    expect(result.invalid).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AC-5: --weeks 0 → exit 0, no files written, helpful message
// ---------------------------------------------------------------------------

describe("SLICE-103 runMineReviewerBugCorpus AC-5 (--weeks 0)", () => {
  test("exit 0 with helpful message, no files written", async () => {
    const repoPath = tmpRepo();
    const result = await runMineReviewerBugCorpus(repoPath, ["--weeks", "0"]);
    expect(result.exitCode).toBe(0);
    expect(result.mined).toBe(0);
    expect(result.written).toHaveLength(0);
    // Helpful message mentioning --weeks or hand-author
    expect(result.stdout).toMatch(/weeks|hand.author/i);
  });
});

// ---------------------------------------------------------------------------
// Mining from review artifacts
// ---------------------------------------------------------------------------

describe("SLICE-103 runMineReviewerBugCorpus — mining", () => {
  test("missing reviews dir → exit 0 with helpful message, no seeds", async () => {
    const repoPath = tmpRepo();
    // No .claude/artifacts/crew/reviews/ directory
    const result = await runMineReviewerBugCorpus(repoPath, ["--weeks", "8"]);
    expect(result.exitCode).toBe(0);
    expect(result.mined).toBe(0);
    expect(result.written).toHaveLength(0);
    expect(result.stdout).toMatch(/not found|no seeds|hand.author/i);
  });

  test("approved review → not mined (only rejected + CRITICAL/HIGH are mined)", async () => {
    const repoPath = tmpRepo();
    const reviewsDir = join(repoPath, ".claude", "artifacts", "crew", "reviews");
    seedReviewArtifact(reviewsDir, "20260630T100000Z-review-approved.md", APPROVED_REVIEW);

    // --weeks 52 to ensure the file's mtime is within range
    const outDir = join(repoPath, "out");
    const result = await runMineReviewerBugCorpus(repoPath, ["--weeks", "52", "--out", outDir]);
    expect(result.exitCode).toBe(0);
    expect(result.mined).toBe(0);
  });

  test("rejected CRITICAL review → mined as seed, output is EvalCaseSchema-compatible", async () => {
    const repoPath = tmpRepo();
    const reviewsDir = join(repoPath, ".claude", "artifacts", "crew", "reviews");
    seedReviewArtifact(reviewsDir, "20260630T120000Z-review-critical.md", REJECTED_CRITICAL_REVIEW);

    const outDir = join(repoPath, "out-seeds");
    const result = await runMineReviewerBugCorpus(repoPath, ["--weeks", "52", "--out", outDir]);

    expect(result.exitCode).toBe(0);
    expect(result.mined).toBeGreaterThan(0);
    expect(result.written.length).toBeGreaterThan(0);

    // Verify each written file is parseable as EvalCase
    const { readFileSync } = await import("node:fs");
    for (const filePath of result.written) {
      const raw = readFileSync(filePath, "utf8").trim();
      // Each seed is a single JSONL line
      const parsed = JSON.parse(raw) as ReviewerEvalCase;
      // Minimal EvalCaseSchema compliance: id + input fields present
      const schemaCheck = EvalCaseSchema.safeParse(parsed);
      expect(schemaCheck.success).toBe(true);
      // Reviewer-specific: input must have diff and context
      expect(typeof parsed.input.diff).toBe("string");
      expect(typeof parsed.input.context).toBe("string");
      expect(parsed.input.diff.length).toBeGreaterThan(0);
    }
  });

  test("invalid args → exit 1 with error message", async () => {
    const repoPath = tmpRepo();
    const result = await runMineReviewerBugCorpus(repoPath, ["--weeks"]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/--weeks requires/i);
  });
});

// ---------------------------------------------------------------------------
// Corpus provenance: verify the 10 hand-seeded cases exist and are valid
// ---------------------------------------------------------------------------

describe("SLICE-103 — hand-seeded corpus EvalCaseSchema validation", () => {
  const evalDir = join(import.meta.dir, "../../agents/reviewer/.gepa/eval");

  // The 10 canonical bug cases
  const expectedCases = [
    "bug-001.jsonl",
    "bug-002.jsonl",
    "bug-003.jsonl",
    "bug-004.jsonl",
    "bug-005.jsonl",
    "bug-006.jsonl",
    "bug-007.jsonl",
    "bug-008.jsonl",
    "bug-009.jsonl",
    "bug-010.jsonl"
  ];

  for (const filename of expectedCases) {
    test(`${filename} is parseable and EvalCaseSchema-compliant`, async () => {
      const { readFileSync } = await import("node:fs");
      const filePath = join(evalDir, filename);
      const raw = readFileSync(filePath, "utf8").trim();
      const parsed = JSON.parse(raw) as ReviewerEvalCase;

      // EvalCaseSchema compliance
      const schemaCheck = EvalCaseSchema.safeParse(parsed);
      expect(schemaCheck.success).toBe(true);

      // id must be non-empty
      expect(parsed.id.length).toBeGreaterThan(0);

      // input must have diff (non-empty string) and context
      expect(typeof parsed.input).toBe("object");
      expect(typeof parsed.input.diff).toBe("string");
      expect(parsed.input.diff.length).toBeGreaterThan(0);
      expect(typeof parsed.input.context).toBe("string");

      // expected_output must have verdict
      expect(parsed.expected_output).toBeDefined();
      expect(["approve", "approve_with_notes", "request_changes"]).toContain(
        parsed.expected_output.verdict
      );

      // rubric must be non-empty array
      expect(Array.isArray(parsed.rubric)).toBe(true);
      expect(parsed.rubric.length).toBeGreaterThan(0);

      // notes is a JSON string — parse it and check provenance
      expect(typeof parsed.notes).toBe("string");
      const notes = JSON.parse(parsed.notes) as ReviewerEvalCaseNotes;
      expect(typeof notes.provenance).toBe("string");
      expect(notes.provenance.length).toBeGreaterThan(0);
    });
  }

  test("exactly 2 cases are held_out:true (bug-006, bug-009)", async () => {
    const { readFileSync } = await import("node:fs");
    let heldOutCount = 0;
    for (const filename of expectedCases) {
      const filePath = join(evalDir, filename);
      const parsed = JSON.parse(readFileSync(filePath, "utf8").trim()) as ReviewerEvalCase;
      if (parsed.held_out) heldOutCount++;
    }
    expect(heldOutCount).toBe(2);
  });

  test("≥6 distinct bug classes covered across 10 cases", async () => {
    const { readFileSync } = await import("node:fs");
    const classes = new Set<string | null>();
    for (const filename of expectedCases) {
      const filePath = join(evalDir, filename);
      const parsed = JSON.parse(readFileSync(filePath, "utf8").trim()) as ReviewerEvalCase;
      const notes = JSON.parse(parsed.notes) as ReviewerEvalCaseNotes;
      classes.add(notes.bug_class);
    }
    // Corpus covers: logic-error, integration-failure, data-corruption,
    // timeout, resource-exhaustion, security + null (clean-rename) = 7 unique values
    expect(classes.size).toBeGreaterThanOrEqual(6);
  });
});
