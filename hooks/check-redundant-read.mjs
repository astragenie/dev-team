#!/usr/bin/env node
// PreToolUse hook on Read. Env-var gated. Always exits 0.
import fs from "node:fs/promises";
import path from "node:path";
import {
  loadSession,
  saveSession,
  recordRead,
  evictLRU
} from "../scripts/lib/cost-hygiene/state.ts";
import { decide } from "../scripts/lib/cost-hygiene/decide.ts";
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
      event: `cost-hygiene:${code}`,
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
 * @returns {{session_id: string, file_path: string, cwd: string} | null}
 */
function parseInput(raw) {
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

/**
 * @returns {Promise<string>}
 */
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  if (process.env.CREW_COST_HYGIENE !== "1") {
    process.exit(0);
  }
  const raw = await readStdin();
  const input = parseInput(raw);
  if (input === null) {
    process.exit(0);
  }
  const { session_id, file_path, cwd } = input;
  const absPath = path.resolve(cwd, file_path);

  /** @type {string} */
  let mtimeIso;
  /** @type {number} */
  let size;
  try {
    const stat = await fs.stat(absPath);
    mtimeIso = stat.mtime.toISOString();
    size = stat.size;
  } catch {
    process.exit(0);
  }

  /** @type {import("../scripts/lib/cost-hygiene/state.mjs").SessionState} */
  let state;
  try {
    state = await loadSession(cwd, session_id);
  } catch (err) {
    await logEvent(cwd, "state-load-fail", session_id, String(err));
    process.exit(0);
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

  state = recordRead(state, absPath, mtimeIso, size, new Date().toISOString());
  state = evictLRU(state, absPath);

  try {
    await saveSession(cwd, session_id, state);
  } catch (err) {
    await logEvent(cwd, "state-write-fail", session_id, String(err));
  }
}

main().catch(async (err) => {
  await logHookError(process.cwd(), "check-redundant-read", err);
  process.exit(0);
});
