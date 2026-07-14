#!/usr/bin/env node
// SubagentStart hook — deterministic agent-profile injection at dispatch
// (dev-team #235). Loads the spawning agent's ranked astramem profile and
// emits it as hookSpecificOutput.additionalContext (a system reminder in the
// subagent's context). Always exits 0 — never blocks; emits nothing on any
// failure or when the profile is disabled/empty. Core logic + rationale live
// in ./lib/subagent-profile-core.ts.
import { runSubagentProfileInjection } from "./lib/subagent-profile-core.ts";
import { logHookError } from "./hook-error.ts";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  const raw = await readStdin();
  const out = await runSubagentProfileInjection(raw, process.env);
  if (out !== null) process.stdout.write(out);
  // No output = inject nothing (byte-identical dispatch).
}

main().catch(async (err) => {
  await logHookError(process.cwd(), "subagent-start-profile", err);
  process.exit(0);
});
