// hooks/lib/model-routing-enforce.ts
// Core logic for the PreToolUse Agent-tool model-routing enforcement hook
// (FEAT-194 S2b). No stdin/stdout/process.exit here — the shim
// (hooks/pre-tool-use-model-enforce.ts) owns process I/O, matching the split
// used by hooks/lib/dispatch-timing-pre-tap.ts.
//
// FEAT-194 S2 built `resolveDispatchModel` (scripts/lib/models/resolve-model.ts)
// and wired the interactive command prompts (build.md / fix.md /
// orchestrate-slice.md) to call it and pass `model:` explicitly — but that's
// orchestrator-honored prose, not enforced: nothing stops a dispatcher LLM
// from skipping the step and silently inheriting the session model (usually
// opus) on every builder-tier Agent-tool dispatch. This module is the
// enforcement half: given a PreToolUse Agent-tool payload, decide whether to
// inject the resolved model into tool_input, and build the hook's stdout JSON.
//
// HONEST LIMITATION (read before trusting this as a hard gate): this repo has
// no existing precedent for a PreToolUse hook using
// `hookSpecificOutput.updatedInput` to modify tool_input — every other
// PreToolUse hook here either passes through silently (empty return) or
// returns the older `{decision: "block"|"approve", reason}` shape (see
// pre-push-verifier.ts / check-subagent-return.ts). The
// plugin-dev:hook-development skill documents `updatedInput` as the
// supported PreToolUse mutation channel for exactly this "allow but modify"
// case, so this hook emits it — but that support has NOT been empirically
// exercised in this codebase before landing this slice. The accompanying
// `systemMessage` is a deliberate belt-and-suspenders fallback: if the
// running Claude Code build does not honor `updatedInput` for the Agent
// tool, the message still tells the dispatcher which model to re-dispatch
// with, so the enforcement degrades to a visible warning rather than a
// silent no-op. See the FEAT-194 S2b handoff for the follow-up needed to
// confirm `updatedInput` is actually honored (observe a live dispatch).
import {
  resolveDispatchModel,
  type LoopModelRoutingConfig
} from "../../scripts/lib/models/resolve-model.ts";

/** Builder-tier subagent types (bare name, any "crew:" prefix stripped). */
export const BUILDER_TIER_AGENTS: readonly string[] = Object.freeze([
  "fullstack-dev",
  "backend-dev",
  "frontend-dev",
  "aiplugin-dev",
  "dev-lite"
]);

function normalizeAgentName(subagentType: string): string {
  return subagentType.includes(":") ? (subagentType.split(":").pop() ?? subagentType) : subagentType;
}

export function isBuilderTierAgent(subagentType: string): boolean {
  return BUILDER_TIER_AGENTS.includes(normalizeAgentName(subagentType));
}

export interface ParsedAgentDispatch {
  subagentType: string;
  toolInput: Record<string, unknown>;
}

/**
 * Parse a PreToolUse Agent-tool payload into { subagentType, toolInput }.
 * Returns null for non-Agent events, malformed JSON, or a missing/empty
 * subagent_type — all of which the shim treats as pass-through (allow).
 */
export function parseAgentDispatchInput(raw: string): ParsedAgentDispatch | null {
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    if (typeof obj["tool_name"] !== "string" || obj["tool_name"] !== "Agent") return null;
    const toolInput = obj["tool_input"];
    if (typeof toolInput !== "object" || toolInput === null) return null;
    const ti = toolInput as Record<string, unknown>;
    const subagentType = typeof ti["subagent_type"] === "string" ? ti["subagent_type"] : "";
    if (subagentType === "") return null;
    return { subagentType, toolInput: ti };
  } catch {
    return null;
  }
}

export interface EnforceDecision {
  action: "inject" | "none";
  model?: string;
  updatedInput?: Record<string, unknown>;
}

/**
 * Decide whether to inject a resolved model for this dispatch. Pure by
 * construction (no I/O, no throw path reachable from well-typed input) —
 * the shim additionally wraps its call site in try/catch so a surprising
 * loopConfig shape from disk can never turn into a blocked dispatch
 * (fail-open is a hard requirement for this hook).
 */
export function decideModelEnforcement(
  dispatch: ParsedAgentDispatch,
  loopConfig: LoopModelRoutingConfig | null
): EnforceDecision {
  const { subagentType, toolInput } = dispatch;

  const explicitModel = toolInput["model"];
  if (typeof explicitModel === "string" && explicitModel.length > 0) {
    return { action: "none" }; // never override an explicit choice
  }

  if (!isBuilderTierAgent(subagentType)) {
    return { action: "none" };
  }

  // The "model-routing" feature flag (FEAT-194 S1) has not landed in this
  // repo's FEATURES registry yet. Gate on modelRouting *presence* in
  // .claude/loop.json instead: a repo that hasn't opted into
  // loop.modelRouting gets no opinion injected here, matching its
  // pre-S2b behavior. When S1 lands, wire isEnabled("model-routing", ...)
  // in here alongside this presence check.
  if (!loopConfig?.loop?.modelRouting) {
    return { action: "none" };
  }

  const model = resolveDispatchModel("build", null, loopConfig);
  return { action: "inject", model, updatedInput: { ...toolInput, model } };
}

/**
 * Build the hook's stdout JSON for an "inject" decision, or null for "none"
 * (null means: shim writes nothing, PreToolUse pass-through/allow).
 */
export function buildHookOutput(
  dispatch: ParsedAgentDispatch,
  decision: EnforceDecision
): string | null {
  if (decision.action !== "inject" || decision.model === undefined || decision.updatedInput === undefined) {
    return null;
  }
  return JSON.stringify({
    hookSpecificOutput: {
      permissionDecision: "allow",
      updatedInput: decision.updatedInput
    },
    systemMessage:
      `[crew:model-routing] Builder-tier dispatch "${dispatch.subagentType}" had no explicit ` +
      `model: — injected model: ${decision.model} (FEAT-194 S2b, resolved from ` +
      `.claude/loop.json loop.modelRouting). If this hook runtime does not honor ` +
      `updatedInput for the Agent tool, re-dispatch explicitly with model: ${decision.model}.`
  });
}
