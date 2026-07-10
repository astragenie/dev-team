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

// FEAT-199a: grandfather cutoff is 2026-07-08T00:00:00Z. Fixtures that must
// hard-fail use a post-cutoff timestamp (2026-07-09) so the grandfather gate
// doesn't swallow them; the dedicated grandfather tests below use a
// pre-cutoff timestamp (2026-07-06) to prove old rot is graced instead.

test("validateSyntheses rejects a grade file with '- bullet' placeholder lines", async () => {
  const rotted = FILLED_GRADE.replace(
    "- Real lesson learned here.\n- Another concrete lesson.",
    "- bullet 1\n- bullet 2"
  );
  const dir = await makeGradesDir({ "20260709T000000Z-slice98-grade.md": rotted });
  const result = await validateSyntheses(dir);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0]!, /grade_incomplete/);
  assert.match(result.errors[0]!, /bullet/);
  assert.equal(result.grandfatheredGradeRot.length, 0);
  await fs.rm(dir, { recursive: true, force: true });
});

test("validateSyntheses rejects a grade file with a bare '- bullet' surprises/followups placeholder", async () => {
  const rotted = `${FILLED_GRADE}\n## Surprises\n\n- bullet\n`;
  const dir = await makeGradesDir({ "20260709T000000Z-slice97-grade.md": rotted });
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
  const dir = await makeGradesDir({ "20260709T000000Z-slice96-grade.md": unfilled });
  const result = await validateSyntheses(dir);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0]!, /grade_incomplete/);
  await fs.rm(dir, { recursive: true, force: true });
});

test("validateSyntheses rejects a grade file with an unrendered '<title>' heading", async () => {
  const rotted = FILLED_GRADE.replace("# SLICE-99 — Grade", "# SLICE-99: <title> — Grade");
  const dir = await makeGradesDir({ "20260709T000000Z-slice93-grade.md": rotted });
  const result = await validateSyntheses(dir);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0]!, /grade_incomplete/);
  assert.match(result.errors[0]!, /<title>/);
  await fs.rm(dir, { recursive: true, force: true });
});

test("validateSyntheses rejects a grade file with an unfilled 'DEC-TBD: Short decision title' placeholder", async () => {
  const rotted = `${FILLED_GRADE}\n## Decisions\n\n### DEC-TBD: Short decision title\n\n**Rationale**: Why this decision was made.\n`;
  const dir = await makeGradesDir({ "20260709T000000Z-slice92-grade.md": rotted });
  const result = await validateSyntheses(dir);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0]!, /grade_incomplete/);
  assert.match(result.errors[0]!, /DEC-TBD/);
  await fs.rm(dir, { recursive: true, force: true });
});

test("validateSyntheses does NOT flag a real (id-pending) 'DEC-TBD:' decision with a real title", async () => {
  const real = `${FILLED_GRADE}\n## Decisions\n\n### DEC-TBD: checkJs:false for migrate-first TS adoption\n\n**Rationale**: Real rationale text.\n`;
  const dir = await makeGradesDir({ "20260709T000000Z-slice91-grade.md": real });
  const result = await validateSyntheses(dir);
  assert.equal(result.errors.length, 0);
  await fs.rm(dir, { recursive: true, force: true });
});

test("validateSyntheses rejects a grade file with an unfilled '(narrative)' section", async () => {
  const rotted = `${FILLED_GRADE}\n## What went well\n\n(narrative)\n`;
  const dir = await makeGradesDir({ "20260709T000000Z-slice90-grade.md": rotted });
  const result = await validateSyntheses(dir);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0]!, /grade_incomplete/);
  assert.match(result.errors[0]!, /narrative/);
  await fs.rm(dir, { recursive: true, force: true });
});

test("validateSyntheses does NOT flag '<title>'-shaped prose that isn't the unrendered heading", async () => {
  // Real content referencing a filename pattern like `cost-report-<title>.md`
  // must not trip the heading-placeholder check (regression for the
  // 20260602T142422Z-slice13-grade.md false positive found during FEAT-199a).
  const real = `${FILLED_GRADE}\n\nLegacy \`cost-report-<title>.md\` files continue to parse.\n`;
  const dir = await makeGradesDir({ "20260709T000000Z-slice89-grade.md": real });
  const result = await validateSyntheses(dir);
  assert.equal(result.errors.length, 0);
  await fs.rm(dir, { recursive: true, force: true });
});

test("validateSyntheses ignores non-grade files in the grades directory", async () => {
  const dir = await makeGradesDir({ "README.md": "- bullet\nnot a grade file" });
  const result = await validateSyntheses(dir);
  assert.equal(result.errors.length, 0);
  await fs.rm(dir, { recursive: true, force: true });
});

// ── FEAT-199a: grandfather cutoff for pre-existing grade rot ────────────────

test("validateSyntheses grandfathers rotted grade files dated before the FEAT-199a cutoff", async () => {
  const rotted = FILLED_GRADE.replace(
    "- Real lesson learned here.\n- Another concrete lesson.",
    "- bullet 1\n- bullet 2"
  );
  const dir = await makeGradesDir({ "20260706T000000Z-slice98-grade.md": rotted });
  const result = await validateSyntheses(dir);
  assert.equal(result.errors.length, 0);
  assert.equal(result.grandfatheredGradeRot.length, 1);
  assert.match(result.grandfatheredGradeRot[0]!, /grandfathered/);
  assert.match(result.grandfatheredGradeRot[0]!, /FEAT-199b/);
  await fs.rm(dir, { recursive: true, force: true });
});

test("validateSyntheses hard-fails a rotted grade file dated exactly at the grandfather cutoff", async () => {
  const rotted = FILLED_GRADE.replace(
    "- Real lesson learned here.\n- Another concrete lesson.",
    "- bullet 1\n- bullet 2"
  );
  // Cutoff advanced to 2026-07-09 (FEAT-199b) to cover the slice112/113 Jul-8
  // grade rot; a file AT the cutoff is still held to the full standard.
  const dir = await makeGradesDir({ "20260709T000000Z-slice98-grade.md": rotted });
  const result = await validateSyntheses(dir);
  assert.equal(result.errors.length, 1);
  assert.equal(result.grandfatheredGradeRot.length, 0);
  await fs.rm(dir, { recursive: true, force: true });
});

test("validateSyntheses treats a grade file with no parseable timestamp prefix as new (not grandfathered)", async () => {
  const rotted = FILLED_GRADE.replace(
    "- Real lesson learned here.\n- Another concrete lesson.",
    "- bullet 1\n- bullet 2"
  );
  const dir = await makeGradesDir({ "legacy-slice98-grade.md": rotted });
  const result = await validateSyntheses(dir);
  assert.equal(result.errors.length, 1);
  assert.equal(result.grandfatheredGradeRot.length, 0);
  await fs.rm(dir, { recursive: true, force: true });
});

// ── FEAT-199b: grandfather set for pre-existing final-synthesis rot ──────────

test("validateSyntheses grandfathers a rotted synthesis whose basename is in the frozen set", async () => {
  // slice79-final-synthesis.md is a real pre-existing rotted synthesis, listed
  // in SYNTHESIS_ROT_GRANDFATHER — it must warn, not error.
  const dir = await makeRunsDir({
    "slice79-final-synthesis.md": "# Synthesis\n- Grade missing — incomplete\n"
  });
  const result = await validateSyntheses(dir);
  assert.equal(result.errors.length, 0);
  assert.equal(result.grandfatheredSynth.length, 1);
  assert.match(result.grandfatheredSynth[0]!, /FEAT-199b/);
  await fs.rm(dir, { recursive: true, force: true });
});

test("validateSyntheses still hard-fails a NEW rotted synthesis not in the grandfather set", async () => {
  const dir = await makeRunsDir({
    "feat999-slice999-final-synthesis.md": "# Synthesis\n- Grade missing — incomplete\n"
  });
  const result = await validateSyntheses(dir);
  assert.equal(result.errors.length, 1);
  assert.equal(result.grandfatheredSynth.length, 0);
  assert.match(result.errors[0]!, /Grade missing/);
  await fs.rm(dir, { recursive: true, force: true });
});
