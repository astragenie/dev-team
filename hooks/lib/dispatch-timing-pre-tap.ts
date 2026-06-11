// Core pre-tap for dispatch-timing: PreToolUse Agent hook (FEAT-149).
// No stdin/stdout/process.exit — the hooks/pre-tool-use-agent.ts shim owns process I/O.
import fs from "node:fs/promises";
import path from "node:path";
import {
  type DispatchHandle,
  recordDispatchStart,
} from "../../scripts/lib/dispatch-timing.ts";
import { persistDispatchHandle } from "./dispatch-handle-store.ts";

/**
 * Parse a PreToolUse Agent payload into { session_id, subagent_type, description }.
 * Returns null if the payload is malformed or is not an Agent tool event.
 */
export function parseAgentPreInput(
  raw: string
): { session_id: string; subagent_type: string; description: string } | null {
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    if (
      typeof obj["tool_name"] !== "string" ||
      obj["tool_name"] !== "Agent"
    ) {
      return null;
    }
    const toolInput = obj["tool_input"];
    if (typeof toolInput !== "object" || toolInput === null) {
      return null;
    }
    const ti = toolInput as Record<string, unknown>;
    const session_id =
      typeof obj["session_id"] === "string" ? obj["session_id"] : "";
    const subagent_type =
      typeof ti["subagent_type"] === "string" ? ti["subagent_type"] : "unknown";
    const description =
      typeof ti["description"] === "string" ? ti["description"] : "";
    return { session_id, subagent_type, description };
  } catch {
    return null;
  }
}

/**
 * Reads agent frontmatter to discover the model field.
 * Tries agents/<basename>.md then agents/3rdparty/<basename>.md.
 * Falls back to "unknown" on any error or missing match.
 */
export async function lookupAgentModel(subagentType: string): Promise<string> {
  const name = subagentType.includes(":")
    ? subagentType.split(":").pop()!
    : subagentType;
  const candidates = [
    `agents/${name}.md`,
    `agents/3rdparty/${name}.md`,
  ];
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT ?? process.cwd();
  for (const rel of candidates) {
    const abs = path.join(pluginRoot, rel);
    try {
      const content = await fs.readFile(abs, "utf-8");
      const m = content.match(/^model:\s*(\S+)/m);
      if (m) return m[1] ?? "unknown";
    } catch {
      // try next
    }
  }
  return "unknown";
}

/**
 * Read runId + sliceId from .claude/state/crew/workflow-state.json.
 * Returns "unknown" for either if file missing or parse fails.
 */
async function resolveRunContext(
  pluginRoot: string
): Promise<{ runId: string; sliceId: string }> {
  try {
    const statePath = path.join(
      pluginRoot,
      ".claude",
      "state",
      "crew",
      "workflow-state.json"
    );
    const raw = await fs.readFile(statePath, "utf-8");
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const currentRun = obj["currentRun"] as Record<string, unknown> | undefined;
    const runId =
      typeof currentRun?.["runId"] === "string"
        ? currentRun["runId"]
        : "unknown";
    const sliceId =
      typeof currentRun?.["sliceId"] === "string"
        ? currentRun["sliceId"]
        : "unknown";
    return { runId, sliceId };
  } catch {
    return { runId: "unknown", sliceId: "unknown" };
  }
}

/**
 * Called by the entry shim. Parses the PreToolUse Agent event, resolves
 * runId/sliceId + model, fires recordDispatchStart, and registers the handle
 * for later end-tap correlation. Returns null (PreToolUse pass-through).
 *
 * No-ops silently when CREW_DISPATCH_TIMING_LOG === "0".
 */
export async function runDispatchTimingPreTap(
  raw: string,
  env: NodeJS.ProcessEnv
): Promise<null> {
  if (env["CREW_DISPATCH_TIMING_LOG"] === "0") return null;

  const parsed = parseAgentPreInput(raw);
  if (parsed === null) return null;

  const { session_id, subagent_type } = parsed;
  const pluginRoot = env["CLAUDE_PLUGIN_ROOT"] ?? process.cwd();
  const [{ runId, sliceId }, model] = await Promise.all([
    resolveRunContext(pluginRoot),
    lookupAgentModel(subagent_type),
  ]);

  const handle: DispatchHandle = recordDispatchStart({
    runId,
    sliceId,
    agent: subagent_type,
    model,
  });

  await persistDispatchHandle(session_id, handle, pluginRoot);
  return null;
}
