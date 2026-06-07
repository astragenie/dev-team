// hooks/hook-error.ts
import fs from "node:fs/promises";
import path from "node:path";

export async function logHookError(repoPath: string, hookName: string, error: unknown): Promise<void> {
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
