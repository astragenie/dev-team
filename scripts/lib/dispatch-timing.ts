// Dispatch-timing JSONL writer for per-subagent-dispatch wall-clock telemetry (FEAT-149).
// Phase 1 of slice perf 2-3x spec. Pure additive — no behavior change to existing code.
import { promises as fs } from "node:fs";
import path from "node:path";

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
  void fs
    .mkdir(path.dirname(logPath), { recursive: true })
    .then(() => fs.appendFile(logPath, JSON.stringify(row) + "\n", "utf-8"))
    .catch(() => undefined);
}
