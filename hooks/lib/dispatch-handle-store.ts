// Filesystem-backed dispatch handle store for Pre↔Post hook correlation.
//
// PreToolUse Agent runs in a fresh Bun process, registers a handle, then exits.
// PostToolUse / SubagentStop runs in a DIFFERENT fresh Bun process. In-memory
// Maps don't survive across processes, so we persist each handle to a small JSON
// file keyed by session_id under `.claude/state/crew/dispatch-timing/`. SubagentStop
// reads + deletes the file when consuming the handle.
import fs from "node:fs/promises";
import path from "node:path";
import { type DispatchHandle } from "../../scripts/lib/dispatch-timing.ts";

function storeDir(pluginRoot: string): string {
  return path.join(
    pluginRoot,
    ".claude",
    "state",
    "crew",
    "dispatch-timing"
  );
}

function storePath(pluginRoot: string, sessionId: string): string {
  const safe = sessionId.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
  return path.join(storeDir(pluginRoot), `${safe}.json`);
}

/**
 * Write a handle to disk for later cross-process correlation. Fire-and-forget
 * caller-side; this function awaits the write so callers know when it's durable.
 */
export async function persistDispatchHandle(
  sessionId: string,
  handle: DispatchHandle,
  pluginRoot: string = process.env["CLAUDE_PLUGIN_ROOT"] ?? process.cwd()
): Promise<void> {
  if (sessionId === "") return;
  const file = storePath(pluginRoot, sessionId);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(handle) + "\n", "utf-8");
}

/**
 * Load a handle from disk and delete the file. Returns null if no handle exists
 * for this session_id (PreToolUse never fired or already consumed).
 */
export async function loadAndDeleteDispatchHandle(
  sessionId: string,
  pluginRoot: string = process.env["CLAUDE_PLUGIN_ROOT"] ?? process.cwd()
): Promise<DispatchHandle | null> {
  if (sessionId === "") return null;
  const file = storePath(pluginRoot, sessionId);
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf-8");
  } catch {
    return null;
  }
  try {
    await fs.unlink(file);
  } catch {
    // best-effort delete
  }
  try {
    return JSON.parse(raw.trim()) as DispatchHandle;
  } catch {
    return null;
  }
}
