#!/usr/bin/env node
// PreToolUse hook on Bash and PowerShell. Env-var gated (default ON). Always exits 0.
import fs from "node:fs/promises";
import path from "node:path";
import { runChecks } from "../scripts/lib/preflight/checks.mjs";
import { logHookError } from "./hook-error.mjs";

/**
 * @param {string} repoPath
 * @param {string} code
 * @param {string} sessionId
 * @param {string} detail
 * @returns {Promise<void>}
 */
async function logEvent(repoPath, code, sessionId, detail) {
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

/**
 * @param {string} raw
 * @returns {{ session_id: string, tool_name: string, command: string, cwd: string } | null}
 */
function parseInput(raw) {
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

/**
 * @returns {Promise<string>}
 */
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  if (process.env.CREW_TOOL_PREFLIGHT === "0") {
    process.exit(0);
  }
  const raw = await readStdin();
  const input = parseInput(raw);
  if (input === null) {
    process.exit(0);
  }
  const { session_id, tool_name, command, cwd } = input;

  let warnings;
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
