// hooks/lib/dispatch-size-estimate.ts
// Core logic for the PreToolUse Agent-tool dispatch-size gate (A3). No
// stdin/stdout/process.exit here — the shim (hooks/pre-tool-use-dispatch-size.ts)
// owns process I/O, matching the shim/lib split used by
// hooks/lib/model-routing-enforce.ts and hooks/lib/dispatch-timing-pre-tap.ts.
//
// Context: 8 agent deaths, every one from an oversized dispatch — 5 at the
// end-of-task token ceiling (168k-264k tokens), 2 early from unbounded read
// fan-out on an over-broad "review everything" prompt (~60k tokens). Work
// survived every time; the report did not (same incident that motivates
// report-to-pr and the SubagentStop liveness check — see
// .claude/artifacts/crew/designs/2026-07-12-reviewchannel-and-dispatch-gate.md
// Blocker 2, which this file implements verbatim; do not relitigate the
// design here).
//
// HONEST LIMITATION — read before trusting the constants below: the per-tier
// BASE values, PER_FILE_TOKENS, and WIDE_SCOPE_PENALTY are DESIGNED, not
// calibrated against real dispatch history. dev-team already records actual
// per-dispatch tokenIn/tokenOut (scripts/lib/dispatch-timing.ts, FEAT-149),
// but that JSONL lives at .claude/logs/dispatch-timing.jsonl — machine-local
// and gitignored — and this checkout has none (fresh worktree, no prior
// hook-runtime history to join against). There is no historical data in this
// repo to fit coefficients to right now. Per the design doc's own framing,
// calibration is a WARN-PHASE activity: this hook logs
// {subagentType, estimatedTokens, promptLength, fileMentions, wideScope} to
// .claude/logs/events.jsonl on every Agent dispatch (not just over-threshold
// ones, so false negatives are also visible), which a future pass joins
// against dispatch-timing.jsonl's actual tokenIn+tokenOut for the same
// dispatch before flipping the `dispatch-size-gate` feature flag from warn to
// block. Treat DISPATCH_SIZE_THRESHOLD and the BASE tiers as a defensible
// starting point (headroom below runner's shipped TOKEN_SPLIT_THRESHOLD =
// 200_000), not a fitted model.
import fs from "node:fs/promises";
import path from "node:path";
import { isEnabled, readCrewConfig } from "../../scripts/lib/features-service.ts";

export interface ParsedDispatchSizeInput {
  cwd: string;
  subagentType: string;
  prompt: string;
  /** Correlation keys for joining the calibration log to dispatch-timing.jsonl. Empty string when absent. */
  sessionId: string;
  toolUseId: string;
}

/** Bare agent name (namespace prefix like "crew:" stripped), lowercased. */
function normalizeAgentName(subagentType: string): string {
  const bare = subagentType.includes(":")
    ? (subagentType.split(":").pop() ?? subagentType)
    : subagentType;
  return bare.toLowerCase();
}

const LIGHT_TIER = new Set(["investigator", "dev-lite", "reviewer-lite"]);
const MID_TIER = new Set(["researcher", "reviewer", "architect"]);
const BUILDER_TIER = new Set(["fullstack-dev", "backend-dev", "frontend-dev", "aiplugin-dev"]);

const BASE_LIGHT = 15_000;
const BASE_MID = 30_000;
const BASE_BUILDER = 35_000;
const BASE_DEFAULT = 25_000;

/** Per-tier base token cost, mirroring the tiers already used by BUILDER_TIER_AGENTS
 *  (hooks/lib/model-routing-enforce.ts) plus the lighter locator/reviewer tiers. */
export function baseTokensForTier(subagentType: string): number {
  const name = normalizeAgentName(subagentType);
  if (LIGHT_TIER.has(name)) return BASE_LIGHT;
  if (MID_TIER.has(name)) return BASE_MID;
  if (BUILDER_TIER.has(name)) return BASE_BUILDER;
  return BASE_DEFAULT;
}

export const PER_FILE_TOKENS = 3_000;
export const WIDE_SCOPE_PENALTY = 40_000;

// File-path-like tokens: word/dot/slash/dash chars ending in a short extension.
const FILE_MENTION_RE = /\b[\w.\-/]+\.\w{1,5}\b/g;
// Bare directory mentions this repo actually uses as dispatch-scope words.
const DIR_MENTION_RE = /\b(?:commands|agents|skills|hooks|scripts|tests|docs)\//g;

export function fileMentionCount(prompt: string): number {
  const fileMatches = prompt.match(FILE_MENTION_RE) ?? [];
  const dirMatches = prompt.match(DIR_MENTION_RE) ?? [];
  return fileMatches.length + dirMatches.length;
}

// Tuned to the incident: the two early-death dispatches (~60k tokens each,
// "oversized review task") were over-broad prompts of exactly this shape.
const WIDE_SCOPE_RE =
  /\b(all|every|entire|whole|comprehensive)\b.{0,20}\b(files|repo|codebase|directories?)\b/i;

export function hasWideScopeMarker(prompt: string): boolean {
  return WIDE_SCOPE_RE.test(prompt);
}

// Deliberate headroom below the user's hard 200k cap (matches runner's shipped
// TOKEN_SPLIT_THRESHOLD = 200_000) — this estimator is coarse, and a false
// negative near the boundary is worse than a 25% safety margin.
export const DISPATCH_SIZE_THRESHOLD = 150_000;
export const DISPATCH_SIZE_FEATURE = "dispatch-size-gate";

export interface DispatchSizeEstimate {
  subagentType: string;
  promptLength: number;
  fileMentions: number;
  wideScope: boolean;
  estimatedTokens: number;
  overThreshold: boolean;
}

export function estimateDispatchSize(input: {
  subagentType: string;
  prompt: string;
}): DispatchSizeEstimate {
  const { subagentType, prompt } = input;
  const base = baseTokensForTier(subagentType);
  const mentions = fileMentionCount(prompt);
  const wideScope = hasWideScopeMarker(prompt);
  const estimatedTokens = base + mentions * PER_FILE_TOKENS + (wideScope ? WIDE_SCOPE_PENALTY : 0);
  return {
    subagentType,
    promptLength: prompt.length,
    fileMentions: mentions,
    wideScope,
    estimatedTokens,
    overThreshold: estimatedTokens > DISPATCH_SIZE_THRESHOLD
  };
}

/**
 * Parse a PreToolUse Agent-tool payload into { cwd, subagentType, prompt }.
 * Returns null for non-Agent events, malformed JSON, or a missing/empty
 * subagent_type — all of which the caller treats as pass-through (allow),
 * matching hooks/lib/model-routing-enforce.ts's parseAgentDispatchInput shape.
 */
export function parseAgentDispatchSizeInput(raw: string): ParsedDispatchSizeInput | null {
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    if (typeof obj["tool_name"] !== "string" || obj["tool_name"] !== "Agent") return null;
    const toolInput = obj["tool_input"];
    if (typeof toolInput !== "object" || toolInput === null) return null;
    const ti = toolInput as Record<string, unknown>;
    const subagentType = typeof ti["subagent_type"] === "string" ? ti["subagent_type"] : "";
    if (subagentType === "") return null;
    const prompt = typeof ti["prompt"] === "string" ? ti["prompt"] : "";
    const cwd = typeof obj["cwd"] === "string" ? obj["cwd"] : process.cwd();
    // Correlation keys for the later calibration join against dispatch-timing.jsonl
    // (which records real tokenIn/tokenOut per dispatch). WITHOUT these, the join can
    // only match on name + nearest-timestamp — ambiguous under concurrent same-tier
    // dispatches, which this repo's parallel-worktree workflow produces routinely.
    // The estimator's constants are designed, not fitted; this key is what makes the
    // warn-phase actually convertible into a calibrated block-phase. Availability
    // confirmed by the sibling hook lib/dispatch-timing-pre-tap.ts, which extracts
    // session_id from this identical PreToolUse/Agent payload.
    const sessionId = typeof obj["session_id"] === "string" ? obj["session_id"] : "";
    const toolUseId = typeof obj["tool_use_id"] === "string" ? obj["tool_use_id"] : "";
    return { cwd, subagentType, prompt, sessionId, toolUseId };
  } catch {
    return null;
  }
}

export type DispatchSizeAction = "none" | "warn" | "block";

export interface DispatchSizeDecision {
  action: DispatchSizeAction;
  estimate: DispatchSizeEstimate;
}

/**
 * Decide the gate action. `blockMode` is the resolved `dispatch-size-gate`
 * feature flag: false (default, warn-phase bake) never escalates past a
 * systemMessage nudge; true (post-bake) hard-blocks. Under-threshold
 * dispatches are always "none" regardless of mode.
 */
export function decideDispatchSizeAction(
  estimate: DispatchSizeEstimate,
  blockMode: boolean
): DispatchSizeDecision {
  if (!estimate.overThreshold) return { action: "none", estimate };
  return { action: blockMode ? "block" : "warn", estimate };
}

/**
 * Build the hook's stdout JSON. "none" → null (shim writes nothing,
 * PreToolUse pass-through/allow). "warn" reuses the buildHookOutput shape
 * precedent (hooks/lib/model-routing-enforce.ts:128-147 —
 * hookSpecificOutput.permissionDecision:"allow" + systemMessage). "block"
 * reuses the one existing PreToolUse hard-block precedent in this codebase
 * (hooks/pre-push-verifier.ts's {decision:"block", reason} shape) — this
 * hook does not invent a third JSON convention.
 */
export function buildDispatchSizeOutput(decision: DispatchSizeDecision): string | null {
  if (decision.action === "none") return null;

  const { estimate } = decision;
  const scopeNote = estimate.wideScope ? " + wide-scope marker" : "";
  const reason =
    `[crew:dispatch-size-gate] "${estimate.subagentType}" dispatch estimated at ` +
    `~${estimate.estimatedTokens.toLocaleString()} tokens (tier base + ${estimate.fileMentions} ` +
    `file/dir mention(s)${scopeNote}), over the ${DISPATCH_SIZE_THRESHOLD.toLocaleString()}-token ` +
    `warn line. 8 agents have died from oversized dispatches — 5 at the end-of-task ceiling ` +
    `(168k-264k tokens), 2 from unbounded read fan-out on an over-broad prompt (~60k tokens). ` +
    `Split this dispatch into narrower, sequential sub-dispatches before proceeding (A3, ` +
    `.claude/artifacts/crew/designs/2026-07-12-reviewchannel-and-dispatch-gate.md Blocker 2).`;

  if (decision.action === "warn") {
    return JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "allow"
      },
      systemMessage: reason
    });
  }

  // block
  return JSON.stringify({ decision: "block", reason });
}

/**
 * Append one calibration row to .claude/logs/events.jsonl — every Agent
 * dispatch this hook sees, not just over-threshold ones, so a future
 * calibration pass can also see false negatives (dispatches that died but
 * weren't flagged), not only false positives. Best-effort: a write failure
 * must never surface to the caller or affect the gate decision.
 */
async function logDispatchSizeEstimate(
  cwd: string,
  estimate: DispatchSizeEstimate,
  action: DispatchSizeAction,
  correlation: { sessionId: string; toolUseId: string }
): Promise<void> {
  try {
    const dir = path.join(cwd, ".claude", "logs");
    await fs.mkdir(dir, { recursive: true });
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      event: "dispatch-size-gate",
      action,
      // Join keys → dispatch-timing.jsonl's real tokenIn/tokenOut. Without these the
      // calibration pass could only match name + nearest-timestamp, which is ambiguous
      // under the concurrent same-tier dispatches this repo runs routinely.
      sessionId: correlation.sessionId,
      toolUseId: correlation.toolUseId,
      subagentType: estimate.subagentType,
      estimatedTokens: estimate.estimatedTokens,
      promptLength: estimate.promptLength,
      fileMentions: estimate.fileMentions,
      wideScope: estimate.wideScope
    });
    await fs.appendFile(path.join(dir, "events.jsonl"), line + "\n", "utf8");
  } catch {
    // best-effort — logging must never block the dispatch
  }
}

/**
 * Full orchestration: parse -> read feature flag -> estimate -> decide ->
 * log -> build output. Exported as one function (mirroring
 * hooks/lib/check-builder-terminal-state.ts's runCheckBuilderTerminalStateHook
 * shape) so the shim stays a thin stdin/stdout wrapper and tests can drive
 * the whole flow without spawning a process.
 *
 * Fail-open by construction: parse failure returns null immediately: any
 * failure downstream (crew.json read, estimate, log) is caught and also
 * returns null — a legitimate dispatch is never blocked by this hook's own
 * error.
 */
export async function runDispatchSizeGateHook(raw: string): Promise<string | null> {
  const dispatch = parseAgentDispatchSizeInput(raw);
  if (dispatch === null) return null; // not an Agent dispatch, or malformed — pass through

  try {
    const crewConfig = await readCrewConfig(dispatch.cwd);
    const blockMode = isEnabled(DISPATCH_SIZE_FEATURE, crewConfig);
    const estimate = estimateDispatchSize(dispatch);
    const decision = decideDispatchSizeAction(estimate, blockMode);
    await logDispatchSizeEstimate(dispatch.cwd, estimate, decision.action, {
      sessionId: dispatch.sessionId,
      toolUseId: dispatch.toolUseId
    });
    return buildDispatchSizeOutput(decision);
  } catch {
    // Fail-open: a config-read/estimate/log failure must never block a
    // legitimate dispatch.
    return null;
  }
}
