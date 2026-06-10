#!/usr/bin/env node
// PreToolUse hook on Bash and PowerShell. Env-var gated (default ON). Always exits 0.
import { runPreflightShellHook } from "./lib/preflight-shell.ts";
import { logHookError } from "./hook-error.ts";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  if (process.env.CREW_TOOL_PREFLIGHT === "0") {
    process.stdin.resume();
    return;
  }
  const raw = await readStdin();
  const out = await runPreflightShellHook(raw, process.env);
  if (out !== null) process.stdout.write(out);
}

main().catch(async (err) => {
  await logHookError(process.cwd(), "preflight-shell", err);
  process.exit(0);
});
