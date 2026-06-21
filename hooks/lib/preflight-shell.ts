// Core flow for the preflight-shell hook. No stdin/stdout/process.exit — the
// hooks/preflight-shell.ts shim owns process I/O.
import fs from "node:fs/promises";
import path from "node:path";
import { runChecks } from "../../scripts/lib/preflight/checks.ts";
import { isEnabled, readCrewConfig } from "../../scripts/lib/features-service.ts";

async function logEvent(
  repoPath: string,
  code: string,
  sessionId: string,
  detail: string
): Promise<void> {
  try {
    const dir = path.join(repoPath, ".claude", "logs");
    await fs.mkdir(dir, { recursive: true });
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      event: `preflight-shell:${code}`,
      session_id: sessionId,
      detail
    });
    await fs.appendFile(path.join(dir, "events.jsonl"), line + "\n", "utf8");
  } catch {
    // best-effort
  }
}

function parseInput(
  raw: string
): { session_id: string; tool_name: string; command: string; cwd: string } | null {
  try {
    const obj = JSON.parse(raw);
    if (
      typeof obj === "object" &&
      obj !== null &&
      typeof obj.session_id === "string" &&
      typeof obj.cwd === "string" &&
      typeof obj.tool_name === "string" &&
      typeof obj.tool_input === "object" &&
      obj.tool_input !== null &&
      typeof obj.tool_input.command === "string"
    ) {
      return {
        session_id: obj.session_id,
        tool_name: obj.tool_name,
        command: obj.tool_input.command,
        cwd: obj.cwd
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function runPreflightShellHook(raw: string): Promise<string | null> {
  const input = parseInput(raw);
  if (input === null) return null;
  const { session_id, tool_name, command, cwd } = input;
  const config = await readCrewConfig(cwd);
  if (!isEnabled("shell-preflight", config)) return null;
  let warnings: string[];
  try {
    const result = await runChecks({ toolName: tool_name, command, cwd });
    warnings = result.warnings;
  } catch (err) {
    await logEvent(cwd, "check-error", session_id, String(err));
    return null;
  }
  if (warnings.length > 0) {
    return JSON.stringify({ decision: "approve", systemMessage: warnings.join("\n") });
  }
  return null;
}
