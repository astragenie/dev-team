#!/usr/bin/env node
// PreToolUse hook on Read. Default-on; opt out with CREW_COST_HYGIENE=0. Always exits 0.
import { runCheckRedundantReadHook } from "./lib/check-redundant-read.ts";
import { logHookError } from "./hook-error.ts";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  if (process.env.CREW_COST_HYGIENE === "0") {
    process.stdin.resume();
    return;
  }
  const raw = await readStdin();
  const out = await runCheckRedundantReadHook(raw, process.env);
  if (out !== null) process.stdout.write(out);
}

main().catch(async (err) => {
  process.stdin.resume();
  await logHookError(process.cwd(), "check-redundant-read", err);
});
