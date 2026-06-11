#!/usr/bin/env node
// PreToolUse hook on Agent. Records dispatch start time for timing telemetry (FEAT-149).
// Default-ON; opt out via CREW_DISPATCH_TIMING_LOG=0. Always exits 0 — never blocks.
import { runDispatchTimingPreTap } from "./lib/dispatch-timing-pre-tap.ts";
import { logHookError } from "./hook-error.ts";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  if (process.env["CREW_DISPATCH_TIMING_LOG"] === "0") {
    process.stdin.resume();
    return;
  }
  const raw = await readStdin();
  await runDispatchTimingPreTap(raw, process.env);
  // PreToolUse: no output = allow (pass through)
}

main().catch(async (err) => {
  await logHookError(process.cwd(), "pre-tool-use-agent", err);
  process.exit(0);
});
