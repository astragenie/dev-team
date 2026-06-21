#!/usr/bin/env node
// PreToolUse hook on TaskUpdate. Default-on; opt out via
// crew.json features["cost-hygiene"].enabled=false. Always exits 0.
// Non-blocking telemetry only — agent prompt rule does the actual gating (FEAT-155).
import { runCheckTaskUpdateBurstHook } from "./lib/check-task-update-burst.ts";
import { logHookError } from "./hook-error.ts";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  const raw = await readStdin();
  await runCheckTaskUpdateBurstHook(raw);
}

main().catch(async (err) => {
  await logHookError(process.cwd(), "check-task-update-burst", err);
  process.exit(0);
});
