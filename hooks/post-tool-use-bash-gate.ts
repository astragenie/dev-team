#!/usr/bin/env node
// PostToolUse hook on Bash. Records gate end time and writes JSONL row (FEAT-150).
// Default-ON; opt out via CREW_BASH_GATE_LOG=0. Always exits 0 — never blocks.
import { parsePostInput, recordGateEnd } from "./lib/bash-gate-timer-tap.ts";
import { logHookError } from "./hook-error.ts";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  if (process.env["CREW_BASH_GATE_LOG"] === "0") {
    process.stdin.resume();
    return;
  }
  const raw = await readStdin();
  const input = parsePostInput(raw);
  if (input !== null) {
    recordGateEnd(input.sessionId, input.command, input.exitCode);
  }
  // PostToolUse: no output needed
}

main().catch(async (err) => {
  await logHookError(process.cwd(), "post-tool-use-bash-gate", err);
  process.exit(0);
});
