#!/usr/bin/env node
// PostToolUse hook on Read. Default-on; opt out via crew.json features["cost-hygiene"].enabled=false.
// Always exits 0.
import { runRecordReadContentHook } from "./lib/record-read-content.ts";
import { logHookError } from "./hook-error.ts";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  const raw = await readStdin();
  await runRecordReadContentHook(raw);
}

main().catch(async (err) => {
  await logHookError(process.cwd(), "record-read-content", err);
  process.exit(0);
});
