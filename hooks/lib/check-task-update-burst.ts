// FEAT-155: PreToolUse hook on TaskUpdate. Detects bursts of >=3 consecutive
// TaskUpdate calls (without intervening tools in the same time window) and logs
// a warning row in .claude/logs/task-update-bursts.jsonl.
//
// Non-blocking telemetry only — never returns a veto. The agent prompt rule
// ("Never run >=3 TaskUpdate calls back-to-back without intervening work")
// does the actual gating; this hook captures evidence for cost-advise.
//
// Approximation: a >=30 s gap between TaskUpdate hook fires resets the burst
// counter. This matches the cost-advisor "5 tool calls" baseline and avoids
// the cost of a global PreToolUse counter that would fire on every tool.
import fs from "node:fs/promises";
import path from "node:path";
import { isEnabled, readCrewConfig } from "../../scripts/lib/features-service.ts";

const BURST_THRESHOLD = 3;
const BURST_RESET_WINDOW_MS = 30_000;

interface BurstState {
  session_id: string;
  last_call_at: string;
  consecutive_count: number;
}

function statePath(repoPath: string, sessionId: string): string {
  return path.join(repoPath, ".claude", "state", "task-update-burst", `${sessionId}.json`);
}

function parseInput(raw: string): { session_id: string; cwd: string } | null {
  try {
    const obj = JSON.parse(raw);
    if (
      typeof obj === "object" &&
      obj !== null &&
      typeof obj.session_id === "string" &&
      typeof obj.cwd === "string"
    ) {
      return { session_id: obj.session_id, cwd: obj.cwd };
    }
    return null;
  } catch {
    return null;
  }
}

async function loadBurstState(
  repoPath: string,
  sessionId: string,
  nowIso: string
): Promise<BurstState> {
  const file = statePath(repoPath, sessionId);
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as Record<string, unknown>).session_id === "string" &&
      typeof (parsed as Record<string, unknown>).last_call_at === "string" &&
      typeof (parsed as Record<string, unknown>).consecutive_count === "number"
    ) {
      return parsed as BurstState;
    }
  } catch {
    // first call this session — fall through to fresh state
  }
  return { session_id: sessionId, last_call_at: nowIso, consecutive_count: 0 };
}

async function saveBurstState(repoPath: string, state: BurstState): Promise<void> {
  const file = statePath(repoPath, state.session_id);
  const dir = path.dirname(file);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(file, JSON.stringify(state, null, 2), "utf8");
}

async function logBurst(
  repoPath: string,
  sessionId: string,
  count: number,
  nowIso: string
): Promise<void> {
  try {
    const dir = path.join(repoPath, ".claude", "logs");
    await fs.mkdir(dir, { recursive: true });
    const line = JSON.stringify({
      ts: nowIso,
      event: "task-update-burst",
      session_id: sessionId,
      consecutive_count: count
    });
    await fs.appendFile(path.join(dir, "task-update-bursts.jsonl"), line + "\n", "utf8");
  } catch {
    // best-effort
  }
}

export async function runCheckTaskUpdateBurstHook(raw: string): Promise<string | null> {
  const input = parseInput(raw);
  if (input === null) return null;
  const { session_id, cwd } = input;
  const config = await readCrewConfig(cwd);
  if (!isEnabled("cost-hygiene", config)) return null;
  const nowIso = new Date().toISOString();
  const state = await loadBurstState(cwd, session_id, nowIso);
  const elapsed = Date.parse(nowIso) - Date.parse(state.last_call_at);
  if (elapsed > BURST_RESET_WINDOW_MS || elapsed < 0) {
    // window reset — first call of a new potential burst
    state.consecutive_count = 1;
  } else {
    state.consecutive_count += 1;
  }
  state.last_call_at = nowIso;
  if (state.consecutive_count >= BURST_THRESHOLD) {
    await logBurst(cwd, session_id, state.consecutive_count, nowIso);
  }
  await saveBurstState(cwd, state);
  return null;
}
