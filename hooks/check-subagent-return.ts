#!/usr/bin/env node
// PostToolUse hook on Agent. Default-ON; opt-out via CREW_SUBAGENT_INLINE_THRESHOLD=0.
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
  if (process.env.CREW_SUBAGENT_INLINE_THRESHOLD === "0") {
    process.stdin.resume();
    return;
  }

  const raw = await readStdin();
  const out = await runCheckSubagentReturnHook(raw, process.env);
  if (out !== null) process.stdout.write(out);
}

main().catch(async (err) => {
  await logHookError(process.cwd(), "check-subagent-return", err);
  process.exit(0);
});
