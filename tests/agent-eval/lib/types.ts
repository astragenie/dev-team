/**
 * Type contract for the agent-eval harness. Pure type module — no runtime code.
 * Shapes mirror `claude -p --output-format stream-json`. Locked in SLICE-A
 * so SLICE-B has a known target.
 */

/** A tool_use event in the stream-json output. */
export interface ToolCallEvent {
  type: "tool_use";
  name: string;
  input: Record<string, unknown>;
  id: string;
}

/** An assistant text delta / final message event. */
export interface TextEvent {
  type: "text";
  text: string;
}

/** Sub-shape of ToolCallEvent for Agent-tool dispatches. Used by `dispatchedAgent`. */
export interface SubagentDispatchEvent {
  type: "tool_use";
  name: "Agent";
  input: { subagent_type: string; prompt: string; description?: string };
  id: string;
}

/** Union of event shapes the assertion helpers operate on. */
export type TraceEvent = ToolCallEvent | TextEvent;

/** A captured (or synthetic) agent execution trace. Matches run-claude.ts return shape. */
export interface CapturedTrace {
  events: TraceEvent[];
  finalText: string;
  exitCode: number;
  cwd: string;
}

/**
 * Author-facing fixture contract. `prompt` is passed to `claude -p` in SLICE-B.
 * SLICE-A fixtures load a pre-captured trace instead.
 */
export interface Fixture {
  name: string;
  prompt: string;
  agent?: string;
  timeoutMs?: number;
  setup?: (cwd: string) => Promise<void>;
  expect: (trace: CapturedTrace) => Promise<void> | void;
}
