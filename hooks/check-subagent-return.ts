#!/usr/bin/env node
// PostToolUse hook on Agent. Default-on; opt out via
// crew.json features["subagent-inline-warn"].enabled=false. Threshold via
// features["subagent-inline-warn"].threshold (bytes, default 512).
// Emits a soft-warn systemMessage when a subagent return body exceeds the byte
// threshold AND contains no .claude/artifacts/crew/* artifact path. Never blocks.
import { runCheckSubagentReturnHook } from "./lib/check-subagent-return.ts";
import { logHookError } from "./hook-error.ts";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  const raw = await readStdin();
  const out = await runCheckSubagentReturnHook(raw);
  if (out !== null) process.stdout.write(out);
}

main().catch(async (err) => {
  await logHookError(process.cwd(), "check-subagent-return", err);
  process.exit(0);
});
