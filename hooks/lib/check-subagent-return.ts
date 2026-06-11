// Core flow for the check-subagent-return hook. No stdin/stdout/process.exit — the
// hooks/check-subagent-return.ts shim owns process I/O.
import fs from "node:fs/promises";
import path from "node:path";
import { parseThreshold, checkSubagentReturn } from "../../scripts/lib/subagent-return/check.ts";
import { isEnabled, readCrewConfig } from "../../scripts/lib/features-service.ts";
// TELEMETRY: dispatch-timing tap (FEAT-149)
import {
  type DispatchHandle,
  recordDispatchEnd,
} from "../../scripts/lib/dispatch-timing.ts";

/** Module-level map for start↔end correlation once upstream start sites are wired. */
const _dispatchHandles = new Map<string, DispatchHandle>();

/** Register a dispatch start handle for later end correlation (called by upstream start sites). */
export function registerDispatchHandle(taskId: string, handle: DispatchHandle): void {
  _dispatchHandles.set(taskId, handle);
}

function hasHandle(taskId: string): boolean {
  return _dispatchHandles.has(taskId);
}

async function logEvent(repoPath: string, code: string, sessionId: string, detail: string): Promise<void> {
  try {
    const dir = path.join(repoPath, ".claude", "logs");
    await fs.mkdir(dir, { recursive: true });
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      event: `subagent-return:${code}`,
      session_id: sessionId,
      detail
    });
    await fs.appendFile(path.join(dir, "events.jsonl"), line + "\n", "utf8");
  } catch {
    // best-effort
  }
}

function extractBody(toolResponse: unknown): string | null {
  if (toolResponse === null || toolResponse === undefined) {
    return null;
  }
  if (typeof toolResponse === "string") {
    return toolResponse.length > 0 ? toolResponse : null;
  }
  if (typeof toolResponse === "object") {
    const obj = toolResponse as Record<string, unknown>;
    if (typeof obj["content"] === "string") {
      return obj["content"].length > 0 ? obj["content"] : null;
    }
    if (typeof obj["body"] === "string") {
      return obj["body"].length > 0 ? obj["body"] : null;
    }
  }
  return null;
}

function parseInput(raw: string): { session_id: string; cwd: string; tool_name: string; body: string } | null {
  try {
    const obj = JSON.parse(raw);
    if (
      typeof obj === "object" &&
      obj !== null &&
      typeof obj.session_id === "string" &&
      typeof obj.cwd === "string" &&
      typeof obj.tool_name === "string"
    ) {
      const body = extractBody(obj.tool_response);
      if (body === null) {
        return null;
      }
      return {
        session_id: obj.session_id,
        cwd: obj.cwd,
        tool_name: obj.tool_name,
        body
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function runCheckSubagentReturnHook(raw: string, env: NodeJS.ProcessEnv): Promise<string | null> {
  if (env.CREW_SUBAGENT_INLINE_THRESHOLD === "0") return null;
  const input = parseInput(raw);
  if (input === null) return null;
  const { session_id, cwd, body } = input;
  const config = await readCrewConfig(cwd);
  if (!isEnabled("subagent-inline-warn", config)) return null;
  const threshold = parseThreshold(env.CREW_SUBAGENT_INLINE_THRESHOLD);
  const { warnings } = checkSubagentReturn({ body, threshold });

  // TELEMETRY: dispatch-timing tap (FEAT-149)
  // Fire-and-forget end recording when a correlated start handle exists.
  // No start sites are wired yet — this guard ensures no-op until they are.
  if (env.CREW_DISPATCH_TIMING_LOG !== undefined || hasHandle(session_id)) {
    const handle = _dispatchHandles.get(session_id);
    if (handle !== undefined) {
      _dispatchHandles.delete(session_id);
      recordDispatchEnd(handle, {
        toolCalls: {},
        bashDurationMs: 0,
        skillLoadCount: 0,
        tokenIn: 0,
        tokenOut: 0,
      });
    }
  }

  if (warnings.length > 0) {
    await logEvent(cwd, "inline-return-warn", session_id, warnings[0] ?? "");
    return JSON.stringify({ decision: "approve", systemMessage: warnings.join("\n") });
  }
  return null;
}
