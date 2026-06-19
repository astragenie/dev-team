/**
 * Pure assertion helpers for CapturedTrace. No I/O, no Date.now(), no process.*.
 * All functions operate solely on the immutable CapturedTrace passed in.
 */
import type { CapturedTrace, SubagentDispatchEvent, ToolCallEvent } from "./types.ts";

/**
 * Returns every tool_use event whose `name` exactly matches the argument.
 * Case-sensitive. Returns [] (never throws) when no match is found.
 * @param name Exact tool name (e.g. "Bash", "Write", "Agent").
 */
export function toolCallsOf(trace: CapturedTrace, name: string): ToolCallEvent[] {
  return trace.events.filter((e): e is ToolCallEvent => e.type === "tool_use" && e.name === name);
}

/**
 * Returns true if at least one tool_use matches `name` AND (if provided)
 * `inputMatcher` returns true for that event's input. Designed for fuzzy
 * assertions: `hasToolCall(trace, "Bash", inp => /bun test/.test(String(inp.command ?? "")))`.
 */
export function hasToolCall(
  trace: CapturedTrace,
  name: string,
  inputMatcher?: (input: Record<string, unknown>) => boolean
): boolean {
  return toolCallsOf(trace, name).some((e) => inputMatcher === undefined || inputMatcher(e.input));
}

/**
 * Scans Agent tool_use events; returns the first whose `input.subagent_type`
 * matches `subagentType` (string = exact equality; RegExp = `.test()`).
 * Catches FEAT-162's motivating regression: assert `dispatchedAgent(trace, /^crew:builder/) !== null`.
 * @returns First matching SubagentDispatchEvent, or null.
 */
export function dispatchedAgent(
  trace: CapturedTrace,
  subagentType: string | RegExp
): SubagentDispatchEvent | null {
  for (const e of trace.events) {
    if (e.type !== "tool_use" || e.name !== "Agent") continue;
    const st = String((e.input as Record<string, unknown>).subagent_type ?? "");
    const matched = typeof subagentType === "string" ? st === subagentType : subagentType.test(st);
    if (matched) return e as unknown as SubagentDispatchEvent;
  }
  return null;
}

/**
 * Scans Write/Edit tool_use events; returns the first whose `input.file_path`
 * matches `pathPattern` (string = `.includes()`; RegExp = `.test()`).
 * Used for "did the builder write the handoff?" assertions. Returns null if none.
 */
export function findArtifact(
  trace: CapturedTrace,
  pathPattern: string | RegExp
): ToolCallEvent | null {
  for (const e of trace.events) {
    if (e.type !== "tool_use" || (e.name !== "Write" && e.name !== "Edit")) continue;
    const fp = String(e.input.file_path ?? "");
    const matched =
      typeof pathPattern === "string" ? fp.includes(pathPattern) : pathPattern.test(fp);
    if (matched) return e;
  }
  return null;
}

/**
 * Combines `findArtifact` with a body check. Returns true iff an artifact was
 * found AND its content (`input.content` for Write, `input.new_string` for Edit)
 * matches `bodyPattern` (string = `.includes()`; RegExp = `.test()`).
 */
export function artifactContains(
  trace: CapturedTrace,
  pathPattern: string | RegExp,
  bodyPattern: string | RegExp
): boolean {
  const artifact = findArtifact(trace, pathPattern);
  if (artifact === null) return false;
  const body = String(artifact.input.content ?? artifact.input.new_string ?? "");
  return typeof bodyPattern === "string" ? body.includes(bodyPattern) : bodyPattern.test(body);
}
