#!/usr/bin/env node
// PostToolUse hook on Agent. Default-ON; opt-out via CREW_SUBAGENT_INLINE_THRESHOLD=0.
// Emits a soft-warn systemMessage when a subagent return body exceeds the byte
// threshold AND contains no .claude/artifacts/crew/* artifact path. Never blocks.
import fs from "node:fs/promises";
import path from "node:path";
import { parseThreshold, checkSubagentReturn } from "../scripts/lib/subagent-return/check.ts";
import { isEnabled, readCrewConfig } from "../scripts/lib/features-service.ts";
import { logHookError } from "./hook-error.ts";

async function logEvent(repoPath: string, code: string, sessionId: string, detail: string): Promise<void> {
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

function extractBody(toolResponse: unknown): string | null {
  if (toolResponse === null || toolResponse === undefined) {
    return null;
  }
  if (typeof toolResponse === "string") {
    return toolResponse.length > 0 ? toolResponse : null;
  }
  if (typeof toolResponse === "object") {
    const obj = toolResponse as Record<string, unknown>;
    if (typeof obj["content"] === "string") {
      return obj["content"].length > 0 ? obj["content"] : null;
    }
    if (typeof obj["body"] === "string") {
      return obj["body"].length > 0 ? obj["body"] : null;
    }
  }
  return null;
}

function parseInput(raw: string): { session_id: string; cwd: string; tool_name: string; body: string } | null {
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

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  if (process.env.CREW_SUBAGENT_INLINE_THRESHOLD === "0") {
    process.stdin.resume();
    return;
  }

  const raw = await readStdin();
  const input = parseInput(raw);
  if (input === null) {
    return;
  }

  const { session_id, cwd, body } = input;

  // Gate on feature flag: if "subagent-inline-warn" is disabled, skip emitting warning
  const config = await readCrewConfig(cwd);
  if (!isEnabled("subagent-inline-warn", config)) {
    return;
  }

  const threshold = parseThreshold(process.env.CREW_SUBAGENT_INLINE_THRESHOLD);

  const { warnings } = checkSubagentReturn({ body, threshold });

  if (warnings.length > 0) {
    await logEvent(cwd, "inline-return-warn", session_id, warnings[0] ?? "");
    process.stdout.write(
      JSON.stringify({ decision: "approve", systemMessage: warnings.join("\n") })
    );
  }
}

main().catch(async (err) => {
  await logHookError(process.cwd(), "check-subagent-return", err);
  process.exit(0);
});
