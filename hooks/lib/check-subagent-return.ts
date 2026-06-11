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

const MAX_HANDLES = 1000;

/** Register a dispatch start handle for later end correlation (called by upstream start sites). */
export function registerDispatchHandle(taskId: string, handle: DispatchHandle): void {
  if (_dispatchHandles.size >= MAX_HANDLES) {
    const oldestKey = _dispatchHandles.keys().next().value;
    if (oldestKey !== undefined) _dispatchHandles.delete(oldestKey);
  }
  _dispatchHandles.set(taskId, handle);
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

/**
 * Parse coarse usage metrics from a subagent return body.
 * Looks for: <usage>total_tokens: N tool_uses: M duration_ms: D</usage>
 * Returns zeros for any field not found. MVP approximation — true token splits
 * (tokenIn vs tokenOut) are deferred to upstream API integration.
 */
export function parseUsageMetrics(body: string): {
  totalTokens: number;
  toolUses: number;
  durationMs: number;
} {
  const result = { totalTokens: 0, toolUses: 0, durationMs: 0 };
  const usageMatch = body.match(/<usage>([\s\S]*?)<\/usage>/);
  if (usageMatch === null) return result;
  const block = usageMatch[1] ?? "";
  const tokensMatch = block.match(/total_tokens:\s*(\d+)/);
  if (tokensMatch) result.totalTokens = parseInt(tokensMatch[1]!, 10);
  const toolUsesMatch = block.match(/tool_uses:\s*(\d+)/);
  if (toolUsesMatch) result.toolUses = parseInt(toolUsesMatch[1]!, 10);
  const durationMatch = block.match(/duration_ms:\s*(\d+)/);
  if (durationMatch) result.durationMs = parseInt(durationMatch[1]!, 10);
  return result;
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
  const handle = _dispatchHandles.get(session_id);
  if (handle !== undefined) {
    _dispatchHandles.delete(session_id);
    // Parse coarse usage metrics from subagent return body.
    // Looks for: <usage>total_tokens: N tool_uses: M duration_ms: D</usage>
    // MVP: tokenIn = total_tokens, tokenOut = 0 (true split deferred to upstream API integration).
    const usageMetrics = parseUsageMetrics(body);
    recordDispatchEnd(handle, {
      toolCalls: usageMetrics.toolUses > 0 ? { Total: usageMetrics.toolUses } : {},
      bashDurationMs: 0,
      skillLoadCount: 0,
      tokenIn: usageMetrics.totalTokens,
      tokenOut: 0,
    });
  }

  if (warnings.length > 0) {
    await logEvent(cwd, "inline-return-warn", session_id, warnings[0] ?? "");
    return JSON.stringify({ decision: "approve", systemMessage: warnings.join("\n") });
  }
  return null;
}
