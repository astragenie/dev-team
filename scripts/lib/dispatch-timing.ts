// Dispatch-timing JSONL writer for per-subagent-dispatch wall-clock telemetry (FEAT-149).
// Phase 1 of slice perf 2-3x spec. Pure additive — no behavior change to existing code.
import path from "node:path";
import { append } from "@astragenie/plugin-std/jsonl";

export type DispatchStartMeta = {
  runId: string;
  sliceId: string;
  agent: string;
  model: string;
};

export type DispatchEndMeta = {
  toolCalls: Record<string, number>;
  bashDurationMs: number;
  skillLoadCount: number;
  tokenIn: number;
  tokenOut: number;
};

export type DispatchHandle = DispatchStartMeta & { startMs: number };

export function recordDispatchStart(meta: DispatchStartMeta): DispatchHandle {
  return { ...meta, startMs: Date.now() };
}

export function recordDispatchEnd(handle: DispatchHandle, end: DispatchEndMeta): void {
  const row = {
    runId: handle.runId,
    sliceId: handle.sliceId,
    agent: handle.agent,
    model: handle.model,
    startMs: handle.startMs,
    wallMs: Date.now() - handle.startMs,
    ...end
  };
  const logPath =
    process.env.CREW_DISPATCH_TIMING_LOG ??
    path.join(
      process.env.CLAUDE_PLUGIN_ROOT ?? process.cwd(),
      ".claude",
      "logs",
      "dispatch-timing.jsonl"
    );
  // plugin-std's append() throws TransientError on write failure; this call site is
  // fire-and-forget telemetry that must never throw (matches the previous inline
  // mkdir+appendFile's `.catch(() => undefined)` swallow), so the rejection is caught
  // and dropped identically.
  void append(logPath, row).catch(() => undefined);
}
