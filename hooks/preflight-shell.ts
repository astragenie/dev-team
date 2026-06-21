#!/usr/bin/env node
// PreToolUse hook on Bash and PowerShell. Default-on; opt out via
// crew.json features["shell-preflight"].enabled=false. Always exits 0.
import { runPreflightShellHook } from "./lib/preflight-shell.ts";
import { logHookError } from "./hook-error.ts";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const raw = await readStdin();
  const out = await runPreflightShellHook(raw);
  if (out !== null) process.stdout.write(out);
}

main().catch(async (err) => {
  await logHookError(process.cwd(), "preflight-shell", err);
  process.exit(0);
});
