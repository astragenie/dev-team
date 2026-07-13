#!/usr/bin/env node
// PreToolUse hook on Agent. A3 — the dispatch size gate: estimates a
// dispatch's token cost from tier + file/dir mentions + wide-scope markers
// in tool_input.prompt, and warns (or, once the `dispatch-size-gate` feature
// flag flips to block after a bake period, hard-blocks) dispatches estimated
// over hooks/lib/dispatch-size-estimate.ts's DISPATCH_SIZE_THRESHOLD.
//
// Why this exists: 8 agent deaths, every one from an oversized dispatch (see
// .claude/artifacts/crew/designs/2026-07-12-reviewchannel-and-dispatch-gate.md
// Blocker 2 for the full design — this shim implements it, does not redesign
// it). Staged rollout mirrors the proven git-gate-block bake-in pattern
// (scripts/lib/features-service.ts): default OFF (warn-only) until warn-phase
// telemetry is joined against real dispatch-timing.ts token counts and the
// threshold is confirmed well-calibrated.
//
// Fail-open by construction: any parse/estimate/config error falls through
// to pass-through (allow, unmodified) — this hook must never block a
// legitimate dispatch on its own failure, matching every other Agent-tool
// hook in this codebase (pre-tool-use-agent.ts, pre-tool-use-model-enforce.ts).
// Default-ON at the shim level (the hook always evaluates and may warn);
// opt out entirely via CREW_DISPATCH_SIZE_GATE=0. The separate
// `dispatch-size-gate` feature flag governs warn-vs-block, not whether this
// hook runs at all.
import { logHookError } from "./hook-error.ts";
import { runDispatchSizeGateHook } from "./lib/dispatch-size-estimate.ts";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  if (process.env["CREW_DISPATCH_SIZE_GATE"] === "0") {
    process.stdin.resume();
    return;
  }

  const raw = await readStdin();
  try {
    const out = await runDispatchSizeGateHook(raw);
    if (out !== null) process.stdout.write(out);
  } catch (err) {
    // Fail-open: an unexpected error must never block a legitimate dispatch.
    await logHookError(process.cwd(), "pre-tool-use-dispatch-size", err);
  }
}

main().catch(async (err) => {
  await logHookError(process.cwd(), "pre-tool-use-dispatch-size", err);
  process.exit(0);
});
