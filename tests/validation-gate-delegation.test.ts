// tests/validation-gate-delegation.test.ts
// FEAT-202 / SLICE-112 — lean review gate for /crew:orchestrate-slice.
//
// The actual gate resolver (`deriveValidationGate`, which honors
// `loop.validation.satisfiedByReview` and requires `reviewGate.satisfied &&
// !reviewGate.unproven`) lives in runner-plugin
// (`src/scripts/lib/validation-gate.mts`), not in this repo — dev-team
// consumes it indirectly via the loop plugin's `/runner:close` ceremony.
// There is no import surface for that function inside dev-team (confirmed:
// `grep -rn "deriveValidationGate|satisfiedByReview|review-badge" tests/
// scripts/` turns up nothing pre-slice), so this suite does NOT fabricate a
// cross-plugin import. Instead it asserts at the level dev-team owns:
//
//   1. the committed `.claude/loop.json` config shape that the gate reads
//      (`reviewers.ladder: ["A"]`, `loop.validation.satisfiedByReview: true`)
//   2. the prose contract in `skills/workflow/validator-gate/SKILL.md` and
//      `commands/orchestrate-slice.md` that documents the delegation and the
//      risk-gated exceptions
//
// If runner-plugin ever ships a dev-team-consumable export for
// deriveValidationGate, this suite should be extended to also exercise the
// `satisfied: true` (evidenced review-badge) and `unproven` (no satisfy)
// cases directly against that function.
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

async function readJson(relPath: string): Promise<unknown> {
  const text = await fs.readFile(path.join(repoRoot, relPath), "utf8");
  return JSON.parse(text);
}

async function readText(relPath: string): Promise<string> {
  return fs.readFile(path.join(repoRoot, relPath), "utf8");
}

// ── AC-1: .claude/loop.json config shape ────────────────────────────────────

test('loop.json: reviewers.ladder is the single-reviewer default ["A"]', async () => {
  const config = (await readJson(".claude/loop.json")) as {
    reviewers?: { ladder?: unknown };
  };
  assert.deepEqual(config.reviewers?.ladder, ["A"]);
});

test("loop.json: loop.validation.satisfiedByReview is true", async () => {
  const config = (await readJson(".claude/loop.json")) as {
    loop?: { validation?: { satisfiedByReview?: unknown } };
  };
  assert.equal(config.loop?.validation?.satisfiedByReview, true);
});

test("loop.json: loop.modelRouting is disabled — agent frontmatter governs dispatch models", async () => {
  const config = (await readJson(".claude/loop.json")) as {
    loop?: { modelRouting?: Record<string, unknown> };
  };
  assert.deepEqual(config.loop?.modelRouting, { enabled: false });
});

// ── AC-5: validator-gate SKILL documents the satisfiedByReview delegation ──

test("validator-gate SKILL: documents the satisfiedByReview default delegation path", async () => {
  const text = await readText("skills/workflow/validator-gate/SKILL.md");
  assert.match(text, /satisfiedByReview/);
  assert.match(text, /do not dispatch `crew:verifier`/i);
});

test("validator-gate SKILL: documents the risk-gated exception that still dispatches crew:verifier", async () => {
  const text = await readText("skills/workflow/validator-gate/SKILL.md");
  assert.match(text, /risk: high/i);
  assert.match(text, /concern:security/);
  assert.match(text, /concern:performance/);
  assert.match(text, /SPLIT_BUILD = true/);
});

test("validator-gate SKILL: no longer asserts the old always-dispatch-no-skip absolute", async () => {
  const text = await readText("skills/workflow/validator-gate/SKILL.md");
  assert.doesNotMatch(text, /Always dispatch `crew:verifier` on any code-bearing slice/i);
  assert.doesNotMatch(text, /No skip path: a code-only diff still needs the verifier/i);
});

// ── AC-3/AC-2: commands/orchestrate-slice.md gates the heavy path on risk ──

test("orchestrate-slice.md: RISK_GATE is computed from risk/tags/SPLIT_BUILD before dispatch", async () => {
  const text = await readText("commands/orchestrate-slice.md");
  assert.match(text, /Compute `RISK_GATE`/);
  assert.match(text, /risk: high/i);
  assert.match(text, /concern:security/);
  assert.match(text, /concern:performance/);
  assert.match(text, /SPLIT_BUILD = true/);
});

test("orchestrate-slice.md: RISK_GATE=false dispatches exactly one reviewer and no dedicated verifier", async () => {
  const text = await readText("commands/orchestrate-slice.md");
  assert.match(text, /`RISK_GATE = false`.*dispatch exactly \*\*one\*\* `crew:reviewer`/s);
  assert.match(text, /Do \*\*not\*\* dispatch a dedicated `crew:verifier`/);
});

test("orchestrate-slice.md: RISK_GATE=true still fires the heavy 2nd-reviewer/verifier path", async () => {
  const text = await readText("commands/orchestrate-slice.md");
  assert.match(text, /`RISK_GATE = true`.*dispatch the heavy path/s);
  assert.match(text, /fan-out-review\/SKILL\.md.*AND\/OR a dedicated `crew:verifier`/s);
});

test("orchestrate-slice.md: full-suite ownership is documented as CI (test.yml), not dropped", async () => {
  const text = await readText("commands/orchestrate-slice.md");
  // CI (`.github/workflows/test.yml`) is the actual full-suite runner.
  assert.match(text, /\.github\/workflows\/test\.yml/);
  // Honest boundary (reviewer MEDIUM finding): the pre-push hook only checks
  // for a PASS artifact behind a default-off flag — it does NOT run the suite.
  // The prose must not overclaim that pre-push runs the full suite.
  assert.match(text, /pre-push-verifier/);
  assert.match(text, /only checks for a PASS artifact/i);
});
