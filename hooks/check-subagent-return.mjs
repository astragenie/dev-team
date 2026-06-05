#!/usr/bin/env node
// PostToolUse hook on Agent. Default-ON; opt-out via CREW_SUBAGENT_INLINE_THRESHOLD=0.
// Emits a soft-warn systemMessage when a subagent return body exceeds the byte
// threshold AND contains no .claude/artifacts/crew/* artifact path. Never blocks.
import fs from "node:fs/promises";
import path from "node:path";
import { parseThreshold, checkSubagentReturn } from "../scripts/lib/subagent-return/check.mjs";
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
      event: `subagent-return:${code}`,
      session_id: sessionId,
      detail
    });
    await fs.appendFile(path.join(dir, "events.jsonl"), line + "\n", "utf8");
  } catch {
    // best-effort
  }
}

/**
 * Extract the subagent return body from a PostToolUse Agent payload.
 * Tries tool_response.content, tool_response.body, then tool_response as string.
 *
 * @param {unknown} toolResponse
 * @returns {string | null}
 */
function extractBody(toolResponse) {
  if (toolResponse === null || toolResponse === undefined) {
    return null;
  }
  if (typeof toolResponse === "string") {
    return toolResponse.length > 0 ? toolResponse : null;
  }
  if (typeof toolResponse === "object") {
    const obj = /** @type {Record<string, unknown>} */ (toolResponse);
    if (typeof obj["content"] === "string") {
      return obj["content"].length > 0 ? obj["content"] : null;
    }
    if (typeof obj["body"] === "string") {
      return obj["body"].length > 0 ? obj["body"] : null;
    }
  }
  return null;
}

/**
 * @param {string} raw
 * @returns {{ session_id: string; cwd: string; tool_name: string; body: string } | null}
 */
function parseInput(raw) {
  try {
    const obj = JSON.parse(raw);
    if (
      typeof obj === "object" &&
      obj !== null &&
      typeof obj.session_id === "string" &&
      typeof obj.cwd === "string" &&
      typeof obj.tool_name === "string"
    ) {
      const body = extractBody(obj.tool_response);
      if (body === null) {
        return null;
      }
      return {
        session_id: obj.session_id,
        cwd: obj.cwd,
        tool_name: obj.tool_name,
        body
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

/**
 * @returns {Promise<void>}
 */
async function main() {
  if (process.env.CREW_SUBAGENT_INLINE_THRESHOLD === "0") {
    process.exit(0);
  }

  const raw = await readStdin();
  const input = parseInput(raw);
  if (input === null) {
    process.exit(0);
  }

  const { session_id, cwd, body } = input;
  const threshold = parseThreshold(process.env.CREW_SUBAGENT_INLINE_THRESHOLD);

  const { warnings } = checkSubagentReturn({ body, threshold });

  if (warnings.length > 0) {
    await logEvent(cwd, "inline-return-warn", session_id, warnings[0]);
    process.stdout.write(
      JSON.stringify({ decision: "approve", systemMessage: warnings.join("\n") })
    );
  }
}

main().catch(async (err) => {
  await logHookError(process.cwd(), "check-subagent-return", err);
  process.exit(0);
});
