// tests/validate-syntheses.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

async function makeRunsDir(files: Record<string, string>) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "synth-val-"));
  const runsDir = path.join(dir, ".claude", "artifacts", "crew", "runs");
  await fs.mkdir(runsDir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    await fs.writeFile(path.join(runsDir, name), content, "utf8");
  }
  return dir;
}

// FEAT-188 S1a AC-1: grade-file placeholder rejection.
async function makeGradesDir(files: Record<string, string>) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "synth-val-grades-"));
  const gradesDir = path.join(dir, ".claude", "artifacts", "loop", "grades");
  await fs.mkdir(gradesDir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    await fs.writeFile(path.join(gradesDir, name), content, "utf8");
  }
  return dir;
}

const FILLED_GRADE = `---
id: GRADE-SLICE-99
slice: SLICE-99
feature: FEAT-999
scores:
  architecture_quality: 0.85
  reliability: 0.8
  observability: 0.75
  production_readiness: 0.8
  security: 0.8
  test_confidence: 0.82
  product_completeness: 0.9
decisions: []
---
# SLICE-99 — Grade

## Lessons

- Real lesson learned here.
- Another concrete lesson.
`;

import { validateSyntheses } from "../scripts/validate-syntheses.ts";

test("validateSyntheses passes when no synthesis files exist", async () => {
  const dir = await makeRunsDir({});
  const result = await validateSyntheses(dir);
  assert.equal(result.errors.length, 0);
  await fs.rm(dir, { recursive: true, force: true });
});

test("validateSyntheses passes on clean synthesis file", async () => {
  const dir = await makeRunsDir({
    "foo-final-synthesis.md": "# Synthesis\n## Grade\ntest_confidence: 0.85\n"
  });
  const result = await validateSyntheses(dir);
  assert.equal(result.errors.length, 0);
  await fs.rm(dir, { recursive: true, force: true });
});

test("validateSyntheses errors on Grade missing placeholder", async () => {
  const dir = await makeRunsDir({
    "bad-final-synthesis.md": "# Synthesis\n- Grade missing — synthesis is incomplete\n"
  });
  const result = await validateSyntheses(dir);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0]!, /Grade missing/);
  await fs.rm(dir, { recursive: true, force: true });
});

test("validateSyntheses errors on timestamp placeholder", async () => {
  const dir = await makeRunsDir({
    "bad2-final-synthesis.md":
      "# Synthesis\n- Handoff: `.claude/artifacts/crew/handoffs/<timestamp>-complete.md`\n"
  });
  const result = await validateSyntheses(dir);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0]!, /<timestamp>/);
  await fs.rm(dir, { recursive: true, force: true });
});

test("validateSyntheses checks only final-synthesis files not other runs", async () => {
  const dir = await makeRunsDir({
    "2026-run-brief-foo.md": "Grade missing here but not a synthesis",
    "2026-final-synthesis-clean.md": "# OK synthesis\nAll good.\n"
  });
  const result = await validateSyntheses(dir);
  assert.equal(result.errors.length, 0);
  await fs.rm(dir, { recursive: true, force: true });
});

// ── FEAT-188 S1a AC-1: grade-file placeholder rejection ─────────────────────

test("validateSyntheses passes when no grades dir exists", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "synth-val-nograde-"));
  const result = await validateSyntheses(dir);
  assert.equal(result.errors.length, 0);
  await fs.rm(dir, { recursive: true, force: true });
});

test("validateSyntheses passes on a filled-in grade file", async () => {
  const dir = await makeGradesDir({ "20260706T000000Z-slice99-grade.md": FILLED_GRADE });
  const result = await validateSyntheses(dir);
  assert.equal(result.errors.length, 0);
  await fs.rm(dir, { recursive: true, force: true });
});

test("validateSyntheses rejects a grade file with '- bullet' placeholder lines", async () => {
  const rotted = FILLED_GRADE.replace(
    "- Real lesson learned here.\n- Another concrete lesson.",
    "- bullet 1\n- bullet 2"
  );
  const dir = await makeGradesDir({ "20260706T000000Z-slice98-grade.md": rotted });
  const result = await validateSyntheses(dir);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0]!, /grade_incomplete/);
  assert.match(result.errors[0]!, /bullet/);
  await fs.rm(dir, { recursive: true, force: true });
});

test("validateSyntheses rejects a grade file with a bare '- bullet' surprises/followups placeholder", async () => {
  const rotted = `${FILLED_GRADE}\n## Surprises\n\n- bullet\n`;
  const dir = await makeGradesDir({ "20260706T000000Z-slice97-grade.md": rotted });
  const result = await validateSyntheses(dir);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0]!, /grade_incomplete/);
  await fs.rm(dir, { recursive: true, force: true });
});

test("validateSyntheses rejects a grade file whose AC scores are all unfilled (0)", async () => {
  const unfilled = FILLED_GRADE.replace(
    /scores:\n(?:.*\n)+decisions: \[\]/,
    "scores:\n  architecture_quality: 0\n  reliability: 0\n  observability: 0\n  production_readiness: 0\n  security: 0\n  test_confidence: 0\n  product_completeness: 0\ndecisions: []"
  );
  const dir = await makeGradesDir({ "20260706T000000Z-slice96-grade.md": unfilled });
  const result = await validateSyntheses(dir);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0]!, /grade_incomplete/);
  await fs.rm(dir, { recursive: true, force: true });
});

test("validateSyntheses ignores non-grade files in the grades directory", async () => {
  const dir = await makeGradesDir({ "README.md": "- bullet\nnot a grade file" });
  const result = await validateSyntheses(dir);
  assert.equal(result.errors.length, 0);
  await fs.rm(dir, { recursive: true, force: true });
});
