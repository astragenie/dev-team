#!/usr/bin/env node
// PreToolUse hook on Read. Default-on; opt out via crew.json features["cost-hygiene"].enabled=false.
// Always exits 0.
import { runCheckRedundantReadHook } from "./lib/check-redundant-read.ts";
import { logHookError } from "./hook-error.ts";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const raw = await readStdin();
  const out = await runCheckRedundantReadHook(raw);
  if (out !== null) process.stdout.write(out);
}

main().catch(async (err) => {
  process.stdin.resume();
  await logHookError(process.cwd(), "check-redundant-read", err);
});
