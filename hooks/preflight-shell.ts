#!/usr/bin/env node
// PreToolUse hook on Bash and PowerShell. Env-var gated (default ON). Always exits 0.
import fs from "node:fs/promises";
import path from "node:path";
import { runChecks } from "../scripts/lib/preflight/checks.ts";
import { isEnabled, readCrewConfig } from "../scripts/lib/features-service.ts";
import { logHookError } from "./hook-error.ts";

async function logEvent(repoPath: string, code: string, sessionId: string, detail: string): Promise<void> {
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

function parseInput(raw: string): { session_id: string; tool_name: string; command: string; cwd: string } | null {
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

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  if (process.env.CREW_TOOL_PREFLIGHT === "0") {
    process.stdin.resume();
    return;
  }
  const raw = await readStdin();
  const input = parseInput(raw);
  if (input === null) {
    return;
  }
  const { session_id, tool_name, command, cwd } = input;

  // Gate on feature flag: if "shell-preflight" is disabled, skip preflight checks
  const config = await readCrewConfig(cwd);
  if (!isEnabled("shell-preflight", config)) {
    return;
  }

  let warnings: string[];
  try {
    const result = await runChecks({ toolName: tool_name, command, cwd });
    warnings = result.warnings;
  } catch (err) {
    await logEvent(cwd, "check-error", session_id, String(err));
    process.exit(0);
  }

  if (warnings.length > 0) {
    process.stdout.write(
      JSON.stringify({ decision: "approve", systemMessage: warnings.join("\n") })
    );
  }
}

main().catch(async (err) => {
  await logHookError(process.cwd(), "preflight-shell", err);
  process.exit(0);
});
