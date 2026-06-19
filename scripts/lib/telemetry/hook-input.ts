/**
 * Hook input parsers for FEAT-165 SLICE-B.
 *
 * Owns parsing the three hook payload shapes Claude Code emits.
 * NEVER throws — hooks must be silent on malformed stdin.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const PostToolUseHookInputSchema = z
  .object({
    session_id: z.string(),
    tool_name: z.string(),
    tool_input: z.record(z.unknown()),
    tool_response: z.unknown().optional(),
    cwd: z.string().optional()
  })
  .passthrough();

export const StopHookInputSchema = z
  .object({
    session_id: z.string(),
    cwd: z.string().optional(),
    reason: z.string().optional()
  })
  .passthrough();

export const SubagentStopHookInputSchema = z
  .object({
    session_id: z.string(),
    agent_name: z.string().optional(),
    last_assistant_message: z.string().optional(),
    cwd: z.string().optional()
  })
  .passthrough();

// ---------------------------------------------------------------------------
// Inferred types (exported for bridge consumers)
// ---------------------------------------------------------------------------

export type PostToolUseHookInput = z.infer<typeof PostToolUseHookInputSchema>;
export type StopHookInput = z.infer<typeof StopHookInputSchema>;
export type SubagentStopHookInput = z.infer<typeof SubagentStopHookInputSchema>;

// ---------------------------------------------------------------------------
// Parsers — return null on any failure, never throw
// ---------------------------------------------------------------------------

function tryParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function parsePostToolUse(raw: string): PostToolUseHookInput | null {
  const obj = tryParseJson(raw);
  if (obj === null) return null;
  const result = PostToolUseHookInputSchema.safeParse(obj);
  return result.success ? result.data : null;
}

export function parseStop(raw: string): StopHookInput | null {
  const obj = tryParseJson(raw);
  if (obj === null) return null;
  const result = StopHookInputSchema.safeParse(obj);
  return result.success ? result.data : null;
}

export function parseSubagentStop(raw: string): SubagentStopHookInput | null {
  const obj = tryParseJson(raw);
  if (obj === null) return null;
  const result = SubagentStopHookInputSchema.safeParse(obj);
  return result.success ? result.data : null;
}
