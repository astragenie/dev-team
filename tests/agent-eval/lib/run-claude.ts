/**
 * STUB — SLICE-A. Real implementation lands in SLICE-B (FEAT-162).
 * See `.claude/artifacts/loop/backlog/in-progress/FEAT-162.md`
 * §Per-slice decomposition.
 */
import type { CapturedTrace } from "./types.ts";

/**
 * Spawns `claude -p` with stream-json output, accumulates events,
 * and returns a CapturedTrace.
 *
 * @throws {Error} Always — SLICE-B (FEAT-162) will land the live subprocess wrapper.
 */
export async function runClaude(opts: {
  prompt: string;
  cwd: string;
  timeoutMs?: number;
  agent?: string;
}): Promise<CapturedTrace> {
  void opts;
  throw new Error(
    "runClaude not implemented — SLICE-B (FEAT-162) will land the live subprocess wrapper"
  );
}
