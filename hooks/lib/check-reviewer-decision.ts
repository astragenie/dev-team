// Core flow for the check-reviewer-decision hook (dev-team#199). No
// stdin/stdout/process.exit — hooks/check-reviewer-decision.ts owns process
// I/O, mirroring the hooks/lib/check-subagent-return.ts split.
//
// Problem: parallel reviewer fan-out (crew:reviewer + crew:typescript-reviewer
// etc, dispatched in one Agent-tool message) sometimes has one reviewer go
// idle without ever delivering findings or a decision — the dispatcher's
// step-9 gate ("after both reviewer artifacts land") then stalls until an
// operator notices and sends a manual SendMessage nudge. This hook is the
// SubagentStop-side guard half of the mitigation (see also the dispatcher
// watchdog note added to commands/fix.md, build.md, review.md).
//
// SCOPE / HONEST LIMITATION: SubagentStop's `last_assistant_message` field is
// the only signal this hook can inspect — there is no reliable way at this
// event to read the full transcript or force a re-prompt with new content
// beyond the block/reason contract. When the runtime does not populate
// `last_assistant_message` (older Claude Code builds, or an event shape this
// hook doesn't recognise), this guard fails open (silent pass-through) rather
// than guessing — a reviewer that goes idle with a message this hook can't
// see is NOT caught here; that residual gap is exactly what the dispatcher
// watchdog note (commands/fix.md / build.md / review.md) exists to cover.
import fs from "node:fs/promises";
import path from "node:path";
import { hasArtifactPath } from "../../scripts/lib/subagent-return/check.ts";
import { isEnabled, readCrewConfig } from "../../scripts/lib/features-service.ts";

/** Reviewer-tier subagent types (bare name, any "<plugin>:" namespace prefix stripped). */
export const REVIEWER_TIER_AGENTS: readonly string[] = Object.freeze([
  "reviewer",
  "reviewer-lite",
  "typescript-reviewer",
  "csharp-reviewer",
  "architect-reviewer"
]);

// Matches SubagentStop's `agent_name` shape observed in
// tests/fixtures/telemetry/subagent-stop.json (e.g. "crew:builder") — same
// "<namespace>:<bare-name>" convention hooks/lib/model-routing-enforce.ts
// already normalizes for the PreToolUse Agent-tool's subagent_type field.
function normalizeAgentName(agentName: string): string {
  return agentName.includes(":") ? (agentName.split(":").pop() ?? agentName) : agentName;
}

export function isReviewerTierAgent(agentName: string): boolean {
  return REVIEWER_TIER_AGENTS.includes(normalizeAgentName(agentName));
}

// Every reviewer-tier agent prompt drives `write-review-result --decision
// <approved|approved_with_notes|rejected>` (agents/reviewer.md,
// reviewer-lite.md, typescript-reviewer.md, csharp-reviewer.md,
// architect-reviewer.md all share this CLI contract) — accept the value in
// either order since "approved" is a strict prefix of "approved_with_notes"
// and \b already prevents a false match there (underscore is a word char).
const DECISION_LINE_RE = /decision\s*[:=]\s*["'`]?(approved_with_notes|approved|rejected)\b/i;

/** True when `message` states an explicit `decision: <value>` line. */
export function hasDecisionLine(message: string): boolean {
  return DECISION_LINE_RE.test(message);
}

/**
 * True when the reviewer's final message shows a delivered outcome: either a
 * literal decision line, or a review-result artifact path (the reviewer
 * Report contract's actual completion signal — "artifact path + 1-3 sentence
 * headline", not necessarily the literal word "decision"). Reuses
 * hasArtifactPath rather than duplicating the reviews-subdir regex.
 */
export function hasDeliveredDecision(message: string): boolean {
  return hasDecisionLine(message) || hasArtifactPath(message);
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
      event: `reviewer-decision-guard:${code}`,
      session_id: sessionId,
      detail
    });
    await fs.appendFile(path.join(dir, "events.jsonl"), line + "\n", "utf8");
  } catch {
    // best-effort
  }
}

export async function runCheckReviewerDecisionHook(raw: string): Promise<string | null> {
  const input = parseInput(raw);
  if (input === null) return null;
  const { session_id, cwd, agent_name, message, stop_hook_active } = input;

  // Loop safety: Claude Code re-fires SubagentStop with stop_hook_active=true
  // when a PRIOR block from a Stop/SubagentStop hook already forced this
  // transcript to continue once. Blocking again here would hang the reviewer
  // in a stop/resume loop instead of ever reaching the dispatcher — pass
  // through and let the dispatcher-level watchdog (commands/fix.md,
  // build.md, review.md) take over from there.
  if (stop_hook_active) return null;

  if (agent_name === null || !isReviewerTierAgent(agent_name)) return null;

  const config = await readCrewConfig(cwd);
  if (!isEnabled("reviewer-decision-guard", config)) return null;

  if (message === null) {
    // Documented residual gap — see module header. Fail open: never guess.
    await logEvent(
      cwd,
      "no-message",
      session_id,
      `reviewer "${agent_name}" stopped with no last_assistant_message available to inspect`
    );
    return null;
  }

  if (hasDeliveredDecision(message)) return null;

  const reason =
    `[crew:reviewer-decision-guard] "${agent_name}" is going idle without a delivered decision. ` +
    `Emit a "decision: approved|approved_with_notes|rejected" line (or finish writing the ` +
    `.claude/artifacts/crew/reviews/*.md review-result and return its path) before ending your turn. ` +
    `(dev-team#199 — an idle reviewer with no decision stalls the parallel fan-out gate.)`;

  await logEvent(cwd, "blocked-no-decision", session_id, reason);

  return JSON.stringify({ decision: "block", reason });
}
