// tests/incomplete-detector.test.ts
// FEAT-188 S1a AC-4: pure unit coverage for the shared subagent_incomplete
// detector. Kept as its own file (not folded into subagent-return.test.ts)
// because this module is meant to be imported directly by issue #162 Fix A
// (idle-without-terminal-state guard) — it must stand on its own, decoupled
// from the check-subagent-return hook's wiring.
import test from "node:test";
import assert from "node:assert/strict";
import {
  detectSubagentIncomplete,
  hasTerminalStatusMarker
} from "../scripts/lib/subagent-return/incomplete-detector.ts";

test("hasTerminalStatusMarker: recognizes DONE/BLOCKED/HELP/IN-PROGRESS at line start", () => {
  assert.ok(hasTerminalStatusMarker("DONE: shipped the feature"));
  assert.ok(hasTerminalStatusMarker("BLOCKED: waiting on operator"));
  assert.ok(hasTerminalStatusMarker("HELP: need a specialist"));
  assert.ok(hasTerminalStatusMarker("IN-PROGRESS: still working"));
});

test("hasTerminalStatusMarker: matches mid-body on its own line, not just at index 0", () => {
  assert.ok(hasTerminalStatusMarker("Some preamble.\nDONE: all set.\n"));
});

test("hasTerminalStatusMarker: plain prose without a status marker → false", () => {
  assert.ok(!hasTerminalStatusMarker("Everything looks fine, no issues found."));
});

test("hasTerminalStatusMarker: the word 'done' inside prose (no colon) → false", () => {
  assert.ok(!hasTerminalStatusMarker("I am done reading the file now."));
});

test("detectSubagentIncomplete: no artifact path, no terminal status → true", () => {
  assert.equal(detectSubagentIncomplete({ body: "Here is what I found, no summary line." }), true);
});

test("detectSubagentIncomplete: artifact path present → false regardless of status", () => {
  assert.equal(
    detectSubagentIncomplete({
      body: "See .claude/artifacts/crew/handoffs/foo.md for the handoff."
    }),
    false
  );
});

test("detectSubagentIncomplete: terminal status present, no artifact path → false", () => {
  assert.equal(
    detectSubagentIncomplete({ body: "DONE: task complete, nothing else to note." }),
    false
  );
});

test("detectSubagentIncomplete: both artifact path and terminal status → false", () => {
  assert.equal(
    detectSubagentIncomplete({
      body: "DONE: see .claude/artifacts/crew/handoffs/foo.md"
    }),
    false
  );
});

test("detectSubagentIncomplete: worktreeDirty is accepted but not required for detection", () => {
  assert.equal(detectSubagentIncomplete({ body: "no path, no status", worktreeDirty: true }), true);
  assert.equal(
    detectSubagentIncomplete({ body: "no path, no status", worktreeDirty: false }),
    true
  );
});
