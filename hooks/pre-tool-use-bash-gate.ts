#!/usr/bin/env node
// PreToolUse hook on Bash. Records gate start time for known gate commands (FEAT-150).
// Default-ON; opt out via CREW_BASH_GATE_LOG=0 or crew.json features["bash-gate-telemetry"].enabled=false.
// Always exits 0 — never blocks.
import { parsePreInput, recordGateStart } from "./lib/bash-gate-timer-tap.ts";
import { logHookError } from "./hook-error.ts";
import { isEnabled, readCrewConfig } from "../scripts/lib/features-service.ts";

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
  const input = parsePreInput(raw);
  if (input === null) return;
  const config = await readCrewConfig(input.cwd ?? process.cwd());
  if (!isEnabled("bash-gate-telemetry", config)) return;
  recordGateStart(input.sessionId, input.command);
  // PreToolUse: no output = allow (pass through)
}

main().catch(async (err) => {
  await logHookError(process.cwd(), "pre-tool-use-bash-gate", err);
  process.exit(0);
});
