#!/usr/bin/env node
// SubagentStop hook — builder-tier terminal-state guard (dev-team#187, #174 —
// Wave 3 Guard 1, "deliver-before-die"). Default-on; opt out via crew.json
// features["builder-terminal-state-guard"].enabled=false.
// Blocks (decision:"block") a builder-tier subagent (crew:fullstack-dev,
// crew:backend-dev, crew:frontend-dev, crew:aiplugin-dev, crew:dev-lite) that
// is about to go idle without ever delivering a terminal state (a
// STATUS: DONE|BLOCKED|HELP|IN-PROGRESS line, or a completion-artifact path).
// Fail-open on malformed input, non-builder agents, stop_hook_active
// re-entry, or a runtime that doesn't populate last_assistant_message — see
// hooks/lib/check-builder-terminal-state.ts header for the documented
// residual gap.
import { runCheckBuilderTerminalStateHook } from "./lib/check-builder-terminal-state.ts";
import { logHookError } from "./hook-error.ts";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  const raw = await readStdin();
  const out = await runCheckBuilderTerminalStateHook(raw);
  if (out !== null) process.stdout.write(out);
}

main().catch(async (err) => {
  await logHookError(process.cwd(), "check-builder-terminal-state", err);
  process.exit(0);
});
