#!/usr/bin/env node
// PreToolUse hook on Read. Default-on; opt out with CREW_COST_HYGIENE=0. Always exits 0.
import fs from "node:fs/promises";
import path from "node:path";
import {
  type SessionState,
  loadSession,
  saveSession,
  recordRead,
  evictLRU
} from "../scripts/lib/cost-hygiene/state.ts";
import { decide } from "../scripts/lib/cost-hygiene/decide.ts";
import { isEnabled, readCrewConfig } from "../scripts/lib/features-service.ts";
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

function parseInput(raw: string): { session_id: string; file_path: string; cwd: string } | null {
  try {
    const obj = JSON.parse(raw);
    if (
      typeof obj === "object" &&
      obj !== null &&
      typeof obj.session_id === "string" &&
      typeof obj.cwd === "string" &&
      typeof obj.tool_input === "object" &&
      obj.tool_input !== null &&
      typeof obj.tool_input.file_path === "string"
    ) {
      return {
        session_id: obj.session_id,
        file_path: obj.tool_input.file_path,
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

async function readFileStat(absPath: string): Promise<{ mtimeIso: string; size: number } | null> {
  try {
    const stat = await fs.stat(absPath);
    return { mtimeIso: stat.mtime.toISOString(), size: stat.size };
  } catch {
    return null;
  }
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

async function persistState(
  state: SessionState,
  cwd: string,
  sessionId: string,
  onError: (msg: string) => Promise<void>
): Promise<void> {
  try {
    await saveSession(cwd, sessionId, state);
  } catch (err) {
    await onError(String(err));
  }
}

async function main() {
  if (process.env.CREW_COST_HYGIENE === "0") {
    process.stdin.resume();
    return;
  }
  const raw = await readStdin();
  const input = parseInput(raw);
  if (input === null) {
    return;
  }
  const { session_id, file_path, cwd } = input;

  // Gate on feature flag: if "redundant-read-stop" is disabled, short-circuit
  const config = await readCrewConfig(cwd);
  if (!isEnabled("redundant-read-stop", config)) {
    process.stdin.resume();
    return;
  }

  const absPath = path.resolve(cwd, file_path);

  const fileStat = await readFileStat(absPath);
  if (fileStat === null) {
    return;
  }
  const { mtimeIso, size } = fileStat;

  const state = await loadState(cwd, session_id, (msg) =>
    logEvent(cwd, "state-load-fail", session_id, msg)
  );
  if (state === null) {
    return;
  }

  const stored = state.entries[absPath] ?? null;
  const result = decide({
    path: absPath,
    storedEntry: stored,
    currentMtime: mtimeIso,
    currentSize: size,
    now: new Date().toISOString()
  });
  if (result.action === "warn" && result.message !== null) {
    process.stdout.write(JSON.stringify({ decision: "approve", systemMessage: result.message }));
  }

  const updated = evictLRU(
    recordRead(state, absPath, mtimeIso, size, new Date().toISOString()),
    absPath
  );
  await persistState(updated, cwd, session_id, (msg) =>
    logEvent(cwd, "state-write-fail", session_id, msg)
  );
}

main().catch(async (err) => {
  process.stdin.resume();
  await logHookError(process.cwd(), "check-redundant-read", err);
});
