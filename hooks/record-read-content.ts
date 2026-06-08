#!/usr/bin/env node
// PostToolUse hook on Read. Default-on; opt out with CREW_COST_HYGIENE=0. Always exits 0.
import fs from "node:fs/promises";
import path from "node:path";
import {
  type SessionState,
  loadSession,
  saveSession,
  recordReadContent,
  evictLRU
} from "../scripts/lib/cost-hygiene/state.ts";
import { logHookError } from "./hook-error.ts";

async function logEvent(repoPath: string, code: string, sessionId: string, detail: string): Promise<void> {
  try {
    const dir = path.join(repoPath, ".claude", "logs");
    await fs.mkdir(dir, { recursive: true });
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      event: `cost-hygiene:${code}`,
      session_id: sessionId,
      detail
    });
    await fs.appendFile(path.join(dir, "events.jsonl"), line + "\n", "utf8");
  } catch {
    // best-effort
  }
}

function parseInput(raw: string): { session_id: string; file_path: string; content: string; cwd: string } | null {
  try {
    const obj = JSON.parse(raw);
    if (
      typeof obj === "object" &&
      obj !== null &&
      typeof obj.session_id === "string" &&
      typeof obj.cwd === "string" &&
      typeof obj.tool_input === "object" &&
      obj.tool_input !== null &&
      typeof obj.tool_input.file_path === "string" &&
      typeof obj.tool_response === "object" &&
      obj.tool_response !== null &&
      typeof obj.tool_response.content === "string"
    ) {
      return {
        session_id: obj.session_id,
        file_path: obj.tool_input.file_path,
        content: obj.tool_response.content,
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

async function loadState(
  cwd: string,
  sessionId: string,
  onError: (msg: string) => Promise<void>
): Promise<SessionState | null> {
  try {
    return await loadSession(cwd, sessionId);
  } catch (err) {
    await onError(String(err));
    return null;
  }
}

async function main(): Promise<void> {
  if (process.env.CREW_COST_HYGIENE === "0") {
    process.exit(0);
  }
  const raw = await readStdin();
  const input = parseInput(raw);
  if (input === null) {
    process.exit(0);
  }
  const { session_id, file_path, content, cwd } = input;
  const absPath = path.resolve(cwd, file_path);

  const state = await loadState(cwd, session_id, (msg) =>
    logEvent(cwd, "state-load-fail", session_id, msg)
  );
  if (state === null) {
    process.exit(0);
  }

  const updated = evictLRU(recordReadContent(state, absPath, content), absPath);

  try {
    await saveSession(cwd, session_id, updated);
  } catch (err) {
    await logEvent(cwd, "state-write-fail", session_id, String(err));
  }
}

main().catch(async (err) => {
  await logHookError(process.cwd(), "record-read-content", err);
  process.exit(0);
});
