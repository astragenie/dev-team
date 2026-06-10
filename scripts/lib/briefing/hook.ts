import path from "node:path";
import { tailReadJsonl } from "../jsonl.mjs";

// ---------------------------------------------------------------------------
// Exported interfaces
// ---------------------------------------------------------------------------

export interface HookStatus {
  name: string;
  errorCount24h: number;
  status: "green" | "yellow";
}

export interface HookHealth {
  hooks: HookStatus[];
}

// ---------------------------------------------------------------------------
// Exported constants
// ---------------------------------------------------------------------------

const KNOWN_HOOKS = [
  "check-redundant-read",
  "record-read-content",
  "preflight-shell",
  "check-subagent-return"
];
const HOOK_HEALTH_TAIL = 100;
const HOOK_HEALTH_WINDOW_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Exported collector
// ---------------------------------------------------------------------------

export async function collectHookHealth(repoPath: string): Promise<HookHealth> {
  const eventsPath = path.join(repoPath, ".claude", "logs", "events.jsonl");
  const raw = await tailReadJsonl(eventsPath, HOOK_HEALTH_TAIL);
  const cutoff = Date.now() - HOOK_HEALTH_WINDOW_MS;
  const counts = new Map<string, number>();
  for (const e of raw) {
    if (e["type"] !== "hook_error" || typeof e["hook"] !== "string") continue;
    const hookName = e["hook"] as string;
    const tsVal = e["ts"];
    if (typeof tsVal !== "string") continue;
    const ts = new Date(tsVal).getTime();
    if (isNaN(ts) || ts < cutoff) continue;
    counts.set(hookName, (counts.get(hookName) ?? 0) + 1);
  }
  const hooks: HookStatus[] = KNOWN_HOOKS.map((name) => {
    const errorCount24h = counts.get(name) ?? 0;
    return {
      name,
      errorCount24h,
      status: errorCount24h > 0 ? "yellow" : "green"
    };
  });
  return { hooks };
}
