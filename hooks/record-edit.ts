#!/usr/bin/env node
// PostToolUse hook on Edit / Write / MultiEdit. Default-on; opt out with
// CREW_COST_HYGIENE=0. Always exits 0. Records the successful edit so a
// subsequent Read of the same file inside the verify-loop window is flagged
// (FEAT-156).
import { runRecordEditHook } from "./lib/record-edit.ts";
import { logHookError } from "./hook-error.ts";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  if (process.env.CREW_COST_HYGIENE === "0") {
    process.exit(0);
  }
  const raw = await readStdin();
  await runRecordEditHook(raw, process.env);
}

main().catch(async (err) => {
  await logHookError(process.cwd(), "record-edit", err);
  process.exit(0);
});
