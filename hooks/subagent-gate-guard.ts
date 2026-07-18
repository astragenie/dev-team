#!/usr/bin/env node
// SubagentStop hook — gate-guard (dev-team#257 piece 1). Warn-first; opt
// into hard block via crew.json features["gate-guard"].enabled=true.
// Blocks (decision:"block") a builder-tier subagent (crew:fullstack-dev,
// crew:backend-dev, crew:frontend-dev, crew:aiplugin-dev, crew:dev-lite)
// that is about to go idle with an explicit DONE: completion claim while
// the current run's review or validation gate is recorded "failed" in
// .claude/state/crew/workflow-state.json. A BLOCKED:/HELP:/HELP-REQUEST:/
// IN-PROGRESS: report, or a message with no recognized STATUS marker at
// all, is always allowed here regardless of gate state. Default warn-only
// (systemMessage, never blocks) until the flag flips — see
// hooks/lib/warn-first-flag.ts. Fail-open on malformed input,
// non-builder-tier agents, stop_hook_active re-entry, missing/unreadable
// workflow-state.json, or any internal error — see
// hooks/lib/subagent-gate-guard.ts header for the documented residual gap.
import { runSubagentGateGuardHook } from "./lib/subagent-gate-guard.ts";
import { logHookError } from "./hook-error.ts";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  const raw = await readStdin();
  const out = await runSubagentGateGuardHook(raw);
  if (out !== null) process.stdout.write(out);
}

main().catch(async (err) => {
  await logHookError(process.cwd(), "subagent-gate-guard", err);
  process.exit(0);
});
