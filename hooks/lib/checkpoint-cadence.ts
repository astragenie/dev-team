// dev-team#174: PostToolUse child-side checkpoint cadence.
//
// Builder subagents die mid-job at ~65-85 tool calls / ~18-22 min, truncating
// mid-thought with no handoff and uncommitted WIP. This hook fires inside the
// builder's OWN session on every tool call, counts calls since the last
// checkpoint, and every N calls (default 20) injects a systemMessage nudge
// telling the builder to write a resume scaffold. Enforced context injection,
// not a hope-they-comply prompt line (the advisory prompt caps in
// agents/*.md are unenforced — that is the failure mode this closes).
//
// Deliberately cheap + self-contained: pure state-file read/write, ZERO
// dynamic imports of gepa-core (the #360 capture-guard chain pays a ~1.5s cold
// import; this hook fires on EVERY tool call and must stay near-zero cost, and
// must not double-count the death signal #360 already captures parent-side).
//
// Risk mitigation (false triggers on read-heavy phases): the counter only
// starts after the first Edit/Write/MultiEdit in the session — a pure
// investigation phase never produces an empty/no-op checkpoint nudge.
import fs from "node:fs/promises";
import path from "node:path";
import { isEnabled, readCrewConfig } from "../../scripts/lib/features-service.ts";

const DEFAULT_CHECKPOINT_EVERY = 20;
const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit"]);

interface CadenceState {
  session_id: string;
  editing_started: boolean;
  count_since_checkpoint: number;
}

function statePath(repoPath: string, sessionId: string): string {
  return path.join(repoPath, ".claude", "state", "checkpoint-cadence", `${sessionId}.json`);
}

function parseInput(raw: string): { session_id: string; cwd: string; tool_name: string } | null {
  try {
    const obj = JSON.parse(raw);
    if (
      typeof obj === "object" &&
      obj !== null &&
      typeof obj.session_id === "string" &&
      typeof obj.cwd === "string"
    ) {
      return {
        session_id: obj.session_id,
        cwd: obj.cwd,
        tool_name: typeof obj.tool_name === "string" ? obj.tool_name : ""
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function loadState(repoPath: string, sessionId: string): Promise<CadenceState> {
  const file = statePath(repoPath, sessionId);
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(file, "utf8"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as Record<string, unknown>).session_id === "string" &&
      typeof (parsed as Record<string, unknown>).editing_started === "boolean" &&
      typeof (parsed as Record<string, unknown>).count_since_checkpoint === "number"
    ) {
      return parsed as CadenceState;
    }
  } catch {
    // first call this session — fresh state
  }
  return { session_id: sessionId, editing_started: false, count_since_checkpoint: 0 };
}

async function saveState(repoPath: string, state: CadenceState): Promise<void> {
  const file = statePath(repoPath, state.session_id);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(state, null, 2), "utf8");
}

function readConfigThreshold(config: unknown): number | null {
  if (typeof config !== "object" || config === null) return null;
  const features = (config as Record<string, unknown>).features;
  if (typeof features !== "object" || features === null) return null;
  const feat = (features as Record<string, unknown>)["checkpoint-cadence"];
  if (typeof feat !== "object" || feat === null) return null;
  const value = (feat as Record<string, unknown>).threshold;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function resolveThreshold(config: unknown): number {
  const env = process.env["CREW_CHECKPOINT_CADENCE_N"];
  if (env !== undefined) {
    const n = Number.parseInt(env, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return readConfigThreshold(config) ?? DEFAULT_CHECKPOINT_EVERY;
}

function checkpointMessage(sliceHint: string): string {
  return [
    `[checkpoint] You have made many tool calls since your last checkpoint.`,
    `Builder subagents can be cut off mid-job with no handoff. If you have`,
    `uncommitted work, checkpoint NOW so a resume loses nothing:`,
    `1. Commit any completed sub-task (if the slice permits autonomous commits).`,
    `2. Write/overwrite .claude/state/crew/checkpoint-${sliceHint}.md with:`,
    `   \`git status --short\` + \`git diff --stat\`, your current sub-task,`,
    `   and your next intended step. This is a resume scaffold, NOT a handoff`,
    `   artifact — do not invoke write-handoff.`
  ].join("\n");
}

/**
 * Returns a hook-output JSON string ({decision:"approve", systemMessage}) when a
 * checkpoint nudge should fire, else null. Mirrors check-subagent-return's
 * top-level systemMessage shape (no hookSpecificOutput — avoids the dev-team#176
 * hookEventName trap). Never throws.
 */
export async function runCheckpointCadenceHook(raw: string): Promise<string | null> {
  const input = parseInput(raw);
  if (input === null) return null;
  const { session_id, cwd, tool_name } = input;
  const config = await readCrewConfig(cwd);
  if (!isEnabled("checkpoint-cadence", config)) return null;

  const state = await loadState(cwd, session_id);
  if (EDIT_TOOLS.has(tool_name)) state.editing_started = true;

  // Read-heavy pre-edit phase: don't count, don't nudge (risk 1 mitigation).
  if (!state.editing_started) {
    await saveState(cwd, state);
    return null;
  }

  state.count_since_checkpoint += 1;
  const threshold = resolveThreshold(config);
  if (state.count_since_checkpoint >= threshold) {
    state.count_since_checkpoint = 0;
    await saveState(cwd, state);
    return JSON.stringify({
      decision: "approve",
      systemMessage: checkpointMessage(session_id.slice(0, 12))
    });
  }
  await saveState(cwd, state);
  return null;
}
