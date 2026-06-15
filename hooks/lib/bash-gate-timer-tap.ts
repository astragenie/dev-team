// Core gate-timer tap for PreToolUse/PostToolUse Bash hooks (FEAT-150).
// No stdin/stdout/process.exit — the entry shims own process I/O.
import {
  type GateHandle,
  startGateTimer,
  endGateTimer
} from "../../scripts/lib/bash-gate-timer.ts";

/** Bounded map of pending gate handles keyed by session+command identity. */
const _gateHandles = new Map<string, GateHandle>();

const MAX_HANDLES = 1000;

/**
 * Record a gate start from a PreToolUse Bash event.
 * Returns the correlation key used to look up the handle later.
 */
export function recordGateStart(sessionId: string, command: string): string | null {
  const handle = startGateTimer(command);
  if (handle === null) return null;
  // Key = sessionId + first 80 chars of command to avoid collision with concurrent calls.
  const key = `${sessionId}::${command.slice(0, 80)}`;
  if (_gateHandles.size >= MAX_HANDLES) {
    // FIFO eviction
    const oldestKey = _gateHandles.keys().next().value;
    if (oldestKey !== undefined) _gateHandles.delete(oldestKey);
  }
  _gateHandles.set(key, handle);
  return key;
}

/**
 * Record a gate end from a PostToolUse Bash event.
 * No-op if no matching start was recorded (unknown gate or evicted).
 */
export function recordGateEnd(sessionId: string, command: string, exitCode: number): void {
  const key = `${sessionId}::${command.slice(0, 80)}`;
  const handle = _gateHandles.get(key);
  if (handle === undefined) return;
  _gateHandles.delete(key);
  endGateTimer(handle, exitCode);
}

/** Parse PreToolUse Bash payload. */
export function parsePreInput(raw: string): { sessionId: string; command: string } | null {
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    if (
      typeof obj["session_id"] === "string" &&
      typeof obj["tool_input"] === "object" &&
      obj["tool_input"] !== null &&
      typeof (obj["tool_input"] as Record<string, unknown>)["command"] === "string"
    ) {
      return {
        sessionId: obj["session_id"] as string,
        command: (obj["tool_input"] as Record<string, unknown>)["command"] as string
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Parse PostToolUse Bash payload. Extracts exit code from tool_response. */
export function parsePostInput(
  raw: string
): { sessionId: string; command: string; exitCode: number } | null {
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    if (
      typeof obj["session_id"] !== "string" ||
      typeof obj["tool_input"] !== "object" ||
      obj["tool_input"] === null ||
      typeof (obj["tool_input"] as Record<string, unknown>)["command"] !== "string"
    ) {
      return null;
    }
    const sessionId = obj["session_id"] as string;
    const command = (obj["tool_input"] as Record<string, unknown>)["command"] as string;
    // tool_response may carry exitCode directly or nested in an object
    let exitCode = 0;
    const resp = obj["tool_response"];
    if (typeof resp === "object" && resp !== null) {
      const ec = (resp as Record<string, unknown>)["exitCode"];
      if (typeof ec === "number") exitCode = ec;
    } else if (typeof resp === "number") {
      exitCode = resp;
    }
    return { sessionId, command, exitCode };
  } catch {
    return null;
  }
}
