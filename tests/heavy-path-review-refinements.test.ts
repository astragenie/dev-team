// tests/heavy-path-review-refinements.test.ts
// FEAT-203 / SLICE-113 — heavy-path review refinements (stack-lens 2nd
// reviewer + parallel-dispatch telemetry).
//
// FEAT-202 / SLICE-112 already made the LOW/MEDIUM default a single
// reviewer (see tests/validation-gate-delegation.test.ts). This slice only
// refines the risk-gated HEAVY path (`RISK_GATE = true`):
//
//   AC-1: the 2nd reviewer is picked by diff-extension dominance
//         (.cs >=60% -> crew:csharp-reviewer; .ts/.tsx >=60% ->
//         crew:typescript-reviewer; otherwise generic crew:reviewer).
//   AC-2: `.claude/loop.json` `reviewers` block activates the loop's
//         already-built reviewer-timing telemetry (`strictParallel`,
//         `serialTimingThresholdMs`).
//   AC-3: `commands/orchestrate-slice.md` states reviewers + verifier
//         MUST be emitted in ONE parallel message on the heavy path.
//
// Runtime-consumer verification (done before writing this suite, not
// assumed): runner-plugin 0.65.0's `src/scripts/lib/grade-telemetry.mts`
// (`computeReviewerSpan`) and `src/scripts/lib/slice-linker/complete-slice.mts`
// (`recordSerialReviewerWarning`, called unconditionally from the slice-close
// ceremony) both read `config.reviewers.serialTimingThresholdMs` and, when a
// slice's reviewer-artifact timestamp span exceeds it, stamp a
// `serial-reviewer-warning` badge + append a grade observation. That path IS
// reachable for a dev-team close (dev-team's `/runner:close` runs the same
// `complete-slice` ceremony via the installed loop plugin) — so
// `serialTimingThresholdMs` is a LIVE config knob, not just documentation.
//
// `reviewers.strictParallel`, by contrast, is declared in the shared
// `preset-schema.mts` `PresetV1["reviewers"]` type (forward-compat schema
// field) but `grep -rn "\.strictParallel" src/scripts` in the 0.65.0 cache
// turns up zero runtime reads — no branch anywhere consumes it yet. This
// suite therefore only asserts `strictParallel`'s *shape* (present, `true`)
// and does NOT claim it gates any current runner-plugin behavior; the prose
// in commands/orchestrate-slice.md states that boundary explicitly instead
// of fabricating a cross-plugin behavior claim. There is no import surface
// for `computeReviewerSpan` / `recordSerialReviewerWarning` inside dev-team
// (they live in runner-plugin, consumed indirectly via the loop plugin's
// `/runner:close`), so this suite does not fabricate a cross-plugin import —
// same boundary discipline as tests/validation-gate-delegation.test.ts.
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

// ── AC-2: .claude/loop.json config shape ────────────────────────────────────

test("loop.json: reviewers.strictParallel is true", async () => {
  const config = (await readJson(".claude/loop.json")) as {
    reviewers?: { strictParallel?: unknown };
  };
  assert.equal(config.reviewers?.strictParallel, true);
});

test("loop.json: reviewers.serialTimingThresholdMs is 90000 (matches runner-plugin default)", async () => {
  const config = (await readJson(".claude/loop.json")) as {
    reviewers?: { serialTimingThresholdMs?: unknown };
  };
  assert.equal(config.reviewers?.serialTimingThresholdMs, 90000);
});

test("loop.json: reviewers.ladder is undisturbed by the telemetry-activation change", async () => {
  const config = (await readJson(".claude/loop.json")) as {
    reviewers?: { ladder?: unknown };
  };
  assert.deepEqual(config.reviewers?.ladder, ["A"]);
});

// ── AC-1: fan-out-review SKILL documents the stack-lens 2nd-reviewer rule ──

test("fan-out-review SKILL: documents the stack-lens 2nd-reviewer selection rule", async () => {
  const text = await readText("skills/workflow/fan-out-review/SKILL.md");
  assert.match(text, /Stack-lens 2nd-reviewer pick/);
  assert.match(text, /`\.cs`[^\n]*≥\s*60%[^\n]*`crew:csharp-reviewer`/);
  assert.match(text, /`\.ts`[^\n]*\/\s*`\.tsx`[^\n]*≥\s*60%[^\n]*`crew:typescript-reviewer`/);
  assert.match(text, /fall back to a generic `crew:reviewer` 2nd lens/);
});

test("fan-out-review SKILL: Done section includes the stack-lens rule check", async () => {
  const text = await readText("skills/workflow/fan-out-review/SKILL.md");
  assert.match(text, /2nd reviewer was picked by stack-lens dominance/);
});

// ── AC-1/AC-3: orchestrate-slice.md documents stack-lens + single-message contract ──

test("orchestrate-slice.md: heavy path states reviewers + verifier are emitted in ONE parallel message", async () => {
  const text = await readText("commands/orchestrate-slice.md");
  assert.match(text, /Single-message contract \(FEAT-203 \/ SLICE-113\)/);
  assert.match(text, /MUST be emitted in that ONE parallel Agent-tool message/);
  assert.match(text, /no message between dispatches/);
  assert.match(text, /no wait-for-one-before-dispatching-the-next/);
});

test("orchestrate-slice.md: heavy path documents the stack-lens 2nd-reviewer rule inline", async () => {
  const text = await readText("commands/orchestrate-slice.md");
  assert.match(text, /Stack-lens 2nd reviewer \(FEAT-203 \/ SLICE-113\)/);
  assert.match(text, /crew:csharp-reviewer/);
  assert.match(text, /crew:typescript-reviewer/);
});

test("orchestrate-slice.md: heavy path documents serial-dispatch telemetry via reviewers.strictParallel", async () => {
  const text = await readText("commands/orchestrate-slice.md");
  assert.match(text, /Parallel-dispatch telemetry \(FEAT-203 \/ SLICE-113\)/);
  assert.match(text, /reviewers\.strictParallel/);
  assert.match(text, /serialTimingThresholdMs/);
  assert.match(text, /serial-reviewer-warning/);
});

test("orchestrate-slice.md: states the strictParallel runtime-consumer boundary honestly", async () => {
  const text = await readText("commands/orchestrate-slice.md");
  // Reviewer-facing honesty check (mirrors the boundary discipline in
  // tests/validation-gate-delegation.test.ts): strictParallel must not be
  // described as gating behavior it does not currently gate.
  assert.match(text, /no runtime consumer branching on it yet/);
});
