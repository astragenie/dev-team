#!/usr/bin/env node
// SubagentStop hook — reviewer-tier decision-line guard (dev-team#199).
// Default-on; opt out via crew.json features["reviewer-decision-guard"].enabled=false.
// Blocks (decision:"block") a reviewer-tier subagent (crew:reviewer,
// crew:reviewer-lite, crew:typescript-reviewer, crew:csharp-reviewer,
// crew:architect-reviewer) that is about to go idle without ever delivering a
// decision (a literal "decision: approved|approved_with_notes|rejected" line,
// or a written review-result artifact path). Fail-open on malformed input,
// non-reviewer agents, stop_hook_active re-entry, or a runtime that doesn't
// populate last_assistant_message — see hooks/lib/check-reviewer-decision.ts
// header for the documented residual gap.
import { runCheckReviewerDecisionHook } from "./lib/check-reviewer-decision.ts";
import { logHookError } from "./hook-error.ts";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  const raw = await readStdin();
  const out = await runCheckReviewerDecisionHook(raw);
  if (out !== null) process.stdout.write(out);
}

main().catch(async (err) => {
  await logHookError(process.cwd(), "check-reviewer-decision", err);
  process.exit(0);
});
