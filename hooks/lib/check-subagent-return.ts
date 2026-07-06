// Core flow for the check-subagent-return hook. No stdin/stdout/process.exit — the
// hooks/check-subagent-return.ts shim owns process I/O.
import fs from "node:fs/promises";
import path from "node:path";
import { checkSubagentReturn } from "../../scripts/lib/subagent-return/check.ts";
import { detectSubagentIncomplete } from "../../scripts/lib/subagent-return/incomplete-detector.ts";
import { isEnabled, readCrewConfig } from "../../scripts/lib/features-service.ts";
// TELEMETRY: dispatch-timing tap (FEAT-149)
import { recordDispatchEnd } from "../../scripts/lib/dispatch-timing.ts";
import { loadAndDeleteDispatchHandle } from "./dispatch-handle-store.ts";
// FEAT-188 S1a AC-3/AC-4: capture repair — tee failures into the legacy
// learnings store. Fire-and-forget; never throws into this hook's path.
import { captureFailureLearning } from "../../scripts/lib/memory/capture-learning.ts";

// FEAT-193 S1: dual-write sibling — also tee failures into the GEPA trial
// store. This hook has no reliable agent identity (PostToolUse on the Task
// tool carries no subagent_type field), so trials land under agent "unknown"
// and phase "build" (the default for non-phase-specific signals, matching
// adapt-artifact.ts's KIND_TO_PHASE mapping for run-brief/handoff/final-synthesis).
//
// Imported dynamically (not a static top-level import) — @astragenie/gepa-core's
// installed package points main/exports at raw .ts source, and this hook is
// invoked via plain `node --experimental-strip-types` (not bun), which refuses
// to strip types for anything under node_modules. A static import would crash
// module load for the WHOLE hook; a dynamic import inside try/catch degrades
// to a silent no-op instead, matching scripts/lib/artifacts/write.ts's
// fireCaptureTeeSilent pattern for the exact same hazard.
async function fireFailureTrialSilent(
  repoPath: string,
  entry: { rationale: string; source: string }
): Promise<void> {
  try {
    const { captureFailureTrial } = await import("../../scripts/lib/gepa/capture-failure-trial.ts");
    await captureFailureTrial(repoPath, {
      agent: "unknown",
      phase: "build",
      rationale: entry.rationale,
      input: { source: entry.source }
    });
  } catch {
    // never propagate
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

// Read the first non-empty string at `key` on a record, or null.
function nonEmptyStringField(obj: Record<string, unknown>, key: string): string | null {
  const value = obj[key];
  if (typeof value !== "string") return null;
  return value.length > 0 ? value : null;
}

function extractBody(toolResponse: unknown): string | null {
  if (toolResponse === null || toolResponse === undefined) return null;
  if (typeof toolResponse === "string") {
    return toolResponse.length > 0 ? toolResponse : null;
  }
  if (typeof toolResponse !== "object") return null;
  const obj = toolResponse as Record<string, unknown>;
  return nonEmptyStringField(obj, "content") ?? nonEmptyStringField(obj, "body");
}

function parseInput(
  raw: string
): { session_id: string; cwd: string; tool_name: string; body: string } | null {
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

const DEFAULT_INLINE_THRESHOLD_BYTES = 512;

function readConfigThreshold(config: unknown): number | undefined {
  if (!config || typeof config !== "object") return undefined;
  const features = (config as Record<string, unknown>).features;
  if (!features || typeof features !== "object") return undefined;
  const feat = (features as Record<string, unknown>)["subagent-inline-warn"];
  if (!feat || typeof feat !== "object") return undefined;
  const value = (feat as Record<string, unknown>).threshold;
  return typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : undefined;
}

export async function runCheckSubagentReturnHook(raw: string): Promise<string | null> {
  const input = parseInput(raw);
  if (input === null) return null;
  const { session_id, cwd, body } = input;
  const config = await readCrewConfig(cwd);
  if (!isEnabled("subagent-inline-warn", config)) return null;
  const threshold = readConfigThreshold(config) ?? DEFAULT_INLINE_THRESHOLD_BYTES;
  const { warnings } = checkSubagentReturn({ body, threshold });

  // TELEMETRY: dispatch-timing tap (FEAT-149)
  // Hooks run in separate Bun processes, so the start↔end handle must cross
  // process boundaries via the filesystem store rather than the in-memory Map
  // (which is per-process and dies with the PreToolUse process).
  const handle = await loadAndDeleteDispatchHandle(session_id);
  if (handle !== null) {
    // Parse coarse usage metrics from subagent return body.
    // Looks for: <usage>total_tokens: N tool_uses: M duration_ms: D</usage>
    // MVP: tokenIn = total_tokens, tokenOut = 0 (true split deferred to upstream API integration).
    const usageMetrics = parseUsageMetrics(body);
    recordDispatchEnd(handle, {
      toolCalls: usageMetrics.toolUses > 0 ? { Total: usageMetrics.toolUses } : {},
      bashDurationMs: 0,
      skillLoadCount: 0,
      tokenIn: usageMetrics.totalTokens,
      tokenOut: 0
    });
  }

  if (warnings.length > 0) {
    const warning = warnings[0] ?? "";
    await logEvent(cwd, "inline-return-warn", session_id, warning);
    // AC-3: capture onto the EXISTING inline-return-warn signal.
    await captureFailureLearning(cwd, {
      severity: "medium",
      summary: warning,
      tags: ["inline-return-warn"],
      source: "inline-return-warn"
    });
    // FEAT-193 S1: dual-write — same signal, also a failing GEPA trial.
    await fireFailureTrialSilent(cwd, { rationale: warning, source: "inline-return-warn" });

    // AC-4: subagent_incomplete — a NEW signal, strictly narrower than the
    // warn above (also requires no terminal status marker). See
    // scripts/lib/subagent-return/incomplete-detector.ts for the shared
    // detector (built once for #162 Fix A to reuse, not duplicate).
    if (detectSubagentIncomplete({ body })) {
      const detail = "oversized pathless return with no terminal status marker";
      await logEvent(cwd, "subagent-incomplete", session_id, detail);
      await captureFailureLearning(cwd, {
        severity: "medium",
        summary: detail,
        tags: ["subagent-incomplete"],
        source: "subagent-incomplete"
      });
      // FEAT-193 S1: dual-write for the subagent-incomplete signal too.
      await fireFailureTrialSilent(cwd, { rationale: detail, source: "subagent-incomplete" });
    }

    return JSON.stringify({ decision: "approve", systemMessage: warnings.join("\n") });
  }
  return null;
}
