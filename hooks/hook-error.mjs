// hooks/hook-error.mjs
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Append a structured hook_error event to .claude/logs/events.jsonl.
 * Never throws — best-effort only.
 * @param {string} repoPath
 * @param {string} hookName
 * @param {unknown} error
 */
export async function logHookError(repoPath, hookName, error) {
  try {
    const dir = path.join(repoPath, ".claude", "logs");
    await fs.mkdir(dir, { recursive: true });
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      type: "hook_error",
      hook: hookName,
      error: String(error)
    });
    await fs.appendFile(path.join(dir, "events.jsonl"), line + "\n", "utf8");
  } catch {
    // give up silently — hook must not block Claude
  }
}
