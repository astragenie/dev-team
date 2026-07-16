// tests/incomplete-detector.test.ts
// FEAT-188 S1a AC-4: pure unit coverage for the shared subagent_incomplete
// detector. Kept as its own file (not folded into subagent-return.test.ts)
// because this module is meant to be imported directly by issue #162 Fix A
// (idle-without-terminal-state guard) — it must stand on its own, decoupled
// from the check-subagent-return hook's wiring.
import { test, expect } from "bun:test";
import {
  detectSubagentIncomplete,
  hasTerminalStatusMarker
} from "../scripts/lib/subagent-return/incomplete-detector.ts";

test("hasTerminalStatusMarker: recognizes DONE/BLOCKED/HELP/IN-PROGRESS at line start", () => {
  expect(hasTerminalStatusMarker("DONE: shipped the feature")).toBeTruthy();
  expect(hasTerminalStatusMarker("BLOCKED: waiting on operator")).toBeTruthy();
  expect(hasTerminalStatusMarker("HELP: need a specialist")).toBeTruthy();
  expect(hasTerminalStatusMarker("IN-PROGRESS: still working")).toBeTruthy();
});

test("hasTerminalStatusMarker: matches mid-body on its own line, not just at index 0", () => {
  expect(hasTerminalStatusMarker("Some preamble.\nDONE: all set.\n")).toBeTruthy();
});

test("hasTerminalStatusMarker: plain prose without a status marker → false", () => {
  expect(!hasTerminalStatusMarker("Everything looks fine, no issues found.")).toBeTruthy();
});

test("hasTerminalStatusMarker: the word 'done' inside prose (no colon) → false", () => {
  expect(!hasTerminalStatusMarker("I am done reading the file now.")).toBeTruthy();
});

test("detectSubagentIncomplete: no artifact path, no terminal status → true", () => {
  expect(detectSubagentIncomplete({ body: "Here is what I found, no summary line." })).toBe(true);
});

test("detectSubagentIncomplete: artifact path present → false regardless of status", () => {
  expect(
    detectSubagentIncomplete({
      body: "See .claude/artifacts/crew/handoffs/foo.md for the handoff."
    })
  ).toBe(false);
});

test("detectSubagentIncomplete: terminal status present, no artifact path → false", () => {
  expect(detectSubagentIncomplete({ body: "DONE: task complete, nothing else to note." })).toBe(
    false
  );
});

test("detectSubagentIncomplete: both artifact path and terminal status → false", () => {
  expect(
    detectSubagentIncomplete({
      body: "DONE: see .claude/artifacts/crew/handoffs/foo.md"
    })
  ).toBe(false);
});

test("detectSubagentIncomplete: worktreeDirty is accepted but not required for detection", () => {
  expect(detectSubagentIncomplete({ body: "no path, no status", worktreeDirty: true })).toBe(true);
  expect(detectSubagentIncomplete({ body: "no path, no status", worktreeDirty: false })).toBe(true);
});
