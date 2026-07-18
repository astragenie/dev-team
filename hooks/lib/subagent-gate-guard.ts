// Core flow for the subagent-gate-guard hook (dev-team#257 piece 1). No
// stdin/stdout/process.exit — hooks/subagent-gate-guard.ts owns process I/O,
// mirroring the hooks/lib/check-reviewer-decision.ts and
// hooks/lib/check-builder-terminal-state.ts SubagentStop split this hook is
// structurally copied from.
//
// Problem: a builder-tier subagent can report a DONE-shaped terminal state
// (satisfying check-builder-terminal-state.ts's guard) while the run's
// review or validation gate is already recorded as "failed" in
// .claude/state/crew/workflow-state.json — i.e. it claims success past a
// gate the dispatcher already knows is red. This guard is the "cannot
// report done past a failing gate" half: on SubagentStop for an in-scope
// builder-tier agent, if the current run's review or validation gate status
// is "failed" AND the agent's last message does not honestly acknowledge
// that (a BLOCKED:/HELP:/HELP-REQUEST: marker), block the stop and echo the
// gate reason.
//
// SCOPE / HONEST LIMITATION: same residual gap as check-reviewer-decision.ts
// and check-builder-terminal-state.ts — SubagentStop's `last_assistant_message`
// is the only signal available at this event; when the runtime doesn't
// populate it, or workflow-state.json doesn't exist / doesn't parse, this
// guard fails open (log + pass) rather than guessing.
//
// Warn-first rollout: config.features["gate-guard"].enabled must be
// explicitly true (see hooks/lib/warn-first-flag.ts) to escalate from warn
// (systemMessage, never blocks the stop) to block (decision:"block").
// Default is warn, matching the git-gate-block / dispatch-size-gate
// precedent for a freshly-landed enforcement gate.
import fs from "node:fs/promises";
import path from "node:path";
import { isBuilderTierAgent } from "./model-routing-enforce.ts";
import { loadWorkflowState, type WorkflowRun } from "../../scripts/lib/workflow-state.ts";
import { readCrewConfig } from "../../scripts/lib/features-service.ts";
import { resolveBlockMode } from "./warn-first-flag.ts";

export const GATE_GUARD_FEATURE = "gate-guard";

// A builder claiming BLOCKED/HELP is being honest about not being done —
// never block that; forcing completion would convert a legitimate stop into
// a stuck loop, same guardrail check-builder-terminal-state.ts applies to
// its own STATUS-line vocabulary.
const HONEST_NOT_DONE_RE = /^(BLOCKED|HELP|HELP-REQUEST)\s*:/im;

export function hasHonestNotDoneMarker(message: string): boolean {
  return HONEST_NOT_DONE_RE.test(message);
}

export interface RedGateInfo {
  red: boolean;
  gate: "review" | "validation" | null;
  status: string | null;
}

/** True gate-red is review or validation resolved as "failed" on the current run. */
export function detectRedGate(run: WorkflowRun | null): RedGateInfo {
  if (run?.gates?.review?.status === "failed") {
    return { red: true, gate: "review", status: "failed" };
  }
  if (run?.gates?.validation?.status === "failed") {
    return { red: true, gate: "validation", status: "failed" };
  }
  return { red: false, gate: null, status: null };
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
      event: `gate-guard:${code}`,
      session_id: sessionId,
      detail
    });
    await fs.appendFile(path.join(dir, "events.jsonl"), line + "\n", "utf8");
  } catch {
    // best-effort
  }
}

export async function runSubagentGateGuardHook(raw: string): Promise<string | null> {
  const input = parseInput(raw);
  if (input === null) return null;
  const { session_id, cwd, agent_name, message, stop_hook_active } = input;

  // Loop safety: same one-retry re-entry guard as the sibling SubagentStop
  // guards — blocking again on stop_hook_active=true would hang the builder
  // in a stop/resume loop instead of ever reaching the dispatcher.
  if (stop_hook_active) return null;

  if (agent_name === null || !isBuilderTierAgent(agent_name)) return null;

  try {
    const state = await loadWorkflowState(cwd, { createIfMissing: false });
    const gateInfo = detectRedGate(state.currentRun);
    if (!gateInfo.red) return null;

    if (message === null) {
      // Documented residual gap — see module header. Fail open: never guess.
      await logEvent(
        cwd,
        "no-message",
        session_id,
        `builder "${agent_name}" stopped with a red ${gateInfo.gate} gate but no ` +
          `last_assistant_message available to check for an honest BLOCKED/HELP report`
      );
      return null;
    }

    if (hasHonestNotDoneMarker(message)) return null;

    const config = await readCrewConfig(cwd);
    const blockMode = resolveBlockMode(config, GATE_GUARD_FEATURE);

    const reason =
      `[crew:gate-guard] "${agent_name}" is going idle while this run's ${gateInfo.gate} gate ` +
      `is "${gateInfo.status}". A builder cannot report completion past a failing gate — either ` +
      `fix the issue the gate flagged and let the gate re-resolve, or report ` +
      `"BLOCKED: <what the ${gateInfo.gate} gate flagged>" instead of a DONE-shaped message. ` +
      `(dev-team#257 — gate-guard.)`;

    await logEvent(cwd, blockMode ? "blocked-red-gate" : "warned-red-gate", session_id, reason);

    if (!blockMode) {
      // Warn-only: never blocks the stop, just surfaces the gate reason.
      return JSON.stringify({ systemMessage: reason });
    }
    return JSON.stringify({ decision: "block", reason });
  } catch (err) {
    // Fail-open: a workflow-state read/parse failure (missing file, malformed
    // JSON, unexpected shape) must never block a legitimate subagent stop.
    await logEvent(cwd, "internal-error", session_id, String(err));
    return null;
  }
}
