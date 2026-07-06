// incomplete-detector.ts — FEAT-188 S1a AC-4: the `subagent_incomplete`
// detector (a NEW signal — grep-confirmed absent before this change).
//
// Detects a subagent return that shows no recorded outcome: no completion
// artifact reference AND no recognizable terminal status marker (the
// DONE/BLOCKED/HELP/IN-PROGRESS report-contract vocabulary builder agents
// use in their Report contract, e.g. agents/fullstack-dev.md's
// `STATUS ∈ {DONE, BLOCKED, HELP, IN-PROGRESS}`).
//
// This is deliberately factored out as its OWN module — not inlined into
// hooks/lib/check-subagent-return.ts — so issue #162 Fix A (the
// idle-without-terminal-state guard) can import and reuse this exact
// detection logic instead of growing a second, divergent heuristic. #162
// owns the blocking/lockfile enforcement layer on top of this; that
// enforcement work is explicitly out of scope here. This module is
// detection only, and pure (no I/O).
import { hasArtifactPath } from "./check.ts";

const TERMINAL_STATUS_RE = /^(DONE|BLOCKED|HELP|HELP-REQUEST|IN-PROGRESS)\s*:/im;

/** True when `body` declares one of the recognized terminal-status markers. */
export function hasTerminalStatusMarker(body: string): boolean {
  return TERMINAL_STATUS_RE.test(body);
}

export interface IncompleteDetectorInput {
  body: string;
  /**
   * Optional corroborating signal: true when a git-status check on the
   * dispatch cwd found pending changes with no artifact explaining them.
   * Not required for detection — absence of an artifact path AND a
   * terminal status marker is sufficient on its own. Exposed so a richer
   * caller (e.g. #162's guard, which can cheaply check git state) can pass
   * it through without this module needing to shell out itself.
   */
  worktreeDirty?: boolean;
}

/**
 * Returns true when the subagent return shows no terminal state: no
 * completion artifact path AND no terminal status marker.
 */
export function detectSubagentIncomplete(input: IncompleteDetectorInput): boolean {
  const { body } = input;
  if (hasArtifactPath(body)) return false;
  if (hasTerminalStatusMarker(body)) return false;
  return true;
}
