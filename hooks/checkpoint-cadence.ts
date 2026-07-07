#!/usr/bin/env node
// PostToolUse hook (no matcher — fires on every tool call inside a session).
// dev-team#174: after the first Edit/Write, nudges the agent to write a resume
// scaffold every N post-edit tool calls. Default-on; opt out via
// crew.json features["checkpoint-cadence"].enabled=false. Cadence via
// features["checkpoint-cadence"].threshold (default 20). Always exits 0.
import { runCheckpointCadenceHook } from "./lib/checkpoint-cadence.ts";
import { logHookError } from "./hook-error.ts";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  const raw = await readStdin();
  const out = await runCheckpointCadenceHook(raw);
  if (out !== null) process.stdout.write(out);
}

main().catch(async (err) => {
  await logHookError(process.cwd(), "checkpoint-cadence", err);
  process.exit(0);
});
