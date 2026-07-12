// Core flow for the check-builder-terminal-state hook (dev-team#187, #174 —
// Wave 3 Guard 1, "deliver-before-die"). No stdin/stdout/process.exit here —
// hooks/check-builder-terminal-state.ts owns process I/O, mirroring the
// hooks/lib/check-reviewer-decision.ts split this hook is structurally
// copied from (dev-team#199's proven SubagentStop pattern).
//
// Problem: a builder-tier subagent (fullstack-dev, backend-dev, frontend-dev,
// aiplugin-dev, dev-lite) can go idle mid-report — including AFTER all the
// risky work (commit, push, gh pr create) already landed — and clip the one
// sentence that tells the dispatcher it's safe to trust the result (the
// `STATUS ∈ {DONE, BLOCKED, HELP, IN-PROGRESS}` Report-contract line). This
// hook is the SubagentStop-side guard: it blocks once, directing the agent to
// either finish its STATUS: line (cheap) or commit WIP and report
// `STATUS: BLOCKED — <reason>` (blocked is itself a valid terminal state and
// must NOT be blocked here — forcing completion would convert a legitimate
// stop into a stuck loop).
//
// SCOPE / HONEST LIMITATION: same residual gap as check-reviewer-decision.ts
// — SubagentStop's `last_assistant_message` is the only signal available at
// this event. When the runtime doesn't populate it, this guard fails open
// (log + pass) rather than guessing.
import fs from "node:fs/promises";
import path from "node:path";
import {
  hasTerminalStatusMarker,
  detectSubagentIncomplete
} from "../../scripts/lib/subagent-return/incomplete-detector.ts";
import { hasArtifactPath } from "../../scripts/lib/subagent-return/check.ts";
import { isBuilderTierAgent } from "./model-routing-enforce.ts";
import { isEnabled, readCrewConfig } from "../../scripts/lib/features-service.ts";

/**
 * True when the builder's final message shows a delivered terminal state:
 * either a recognized STATUS: marker (DONE/BLOCKED/HELP/IN-PROGRESS) or a
 * completion-artifact path. Equivalent to `!detectSubagentIncomplete(...)` —
 * expressed as its own named predicate so the block-vs-pass branch below
 * reads directly, without re-deriving the negation at each call site.
 */
export function hasDeliveredTerminalState(message: string): boolean {
  return !detectSubagentIncomplete({ body: message });
}

interface ParsedInput {
  session_id: string;
  cwd: string;
  agent_name: string | null;
  message: string | null;
  stop_hook_active: boolean;
}

function parseInput(raw: string): ParsedInput | null {
  try {
    const obj = JSON.parse(raw);
    if (typeof obj !== "object" || obj === null || typeof obj.session_id !== "string") {
      return null;
    }
    const cwd = typeof obj.cwd === "string" ? obj.cwd : process.cwd();
    const agent_name =
      typeof obj.agent_name === "string" && obj.agent_name.length > 0 ? obj.agent_name : null;
    const message =
      typeof obj.last_assistant_message === "string" && obj.last_assistant_message.length > 0
        ? obj.last_assistant_message
        : null;
    const stop_hook_active = obj.stop_hook_active === true;
    return { session_id: obj.session_id, cwd, agent_name, message, stop_hook_active };
  } catch {
    return null;
  }
}

async function logEvent(
  repoPath: string,
  code: string,
  sessionId: string,
  detail: string
): Promise<void> {
  try {
    const dir = path.join(repoPath, ".claude", "logs");
    await fs.mkdir(dir, { recursive: true });
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      event: `builder-terminal-state-guard:${code}`,
      session_id: sessionId,
      detail
    });
    await fs.appendFile(path.join(dir, "events.jsonl"), line + "\n", "utf8");
  } catch {
    // best-effort
  }
}

export async function runCheckBuilderTerminalStateHook(raw: string): Promise<string | null> {
  const input = parseInput(raw);
  if (input === null) return null;
  const { session_id, cwd, agent_name, message, stop_hook_active } = input;

  // Loop safety: Claude Code re-fires SubagentStop with stop_hook_active=true
  // when a PRIOR block from a Stop/SubagentStop hook already forced this
  // transcript to continue once. Blocking again here would hang the builder
  // in a stop/resume loop instead of ever reaching the dispatcher — pass
  // through after one retry.
  if (stop_hook_active) return null;

  if (agent_name === null || !isBuilderTierAgent(agent_name)) return null;

  const config = await readCrewConfig(cwd);
  if (!isEnabled("builder-terminal-state-guard", config)) return null;

  if (message === null) {
    // Documented residual gap — see module header. Fail open: never guess.
    await logEvent(
      cwd,
      "no-message",
      session_id,
      `builder "${agent_name}" stopped with no last_assistant_message available to inspect`
    );
    return null;
  }

  if (hasDeliveredTerminalState(message)) return null;

  const reason =
    `[crew:builder-terminal-state-guard] "${agent_name}" is going idle without a delivered ` +
    `terminal state. Emit a "DONE: ...", "BLOCKED: ...", "HELP: ...", or "IN-PROGRESS: ..." ` +
    `line (the Report contract's STATUS ∈ {DONE, BLOCKED, HELP, IN-PROGRESS} marker), or if ` +
    `work is unfinished, commit WIP and report "BLOCKED: <what's left>" before ending your ` +
    `turn. (dev-team#187 #174 — a builder that clips its report before the STATUS line leaves ` +
    `the dispatcher unable to tell whether the result is safe to trust.)`;

  await logEvent(cwd, "blocked-no-terminal-state", session_id, reason);

  return JSON.stringify({ decision: "block", reason });
}

// Re-exported for callers/tests that want the raw marker/artifact predicates
// without re-importing from two different modules.
export { hasTerminalStatusMarker, hasArtifactPath };
