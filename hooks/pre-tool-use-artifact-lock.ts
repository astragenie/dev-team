#!/usr/bin/env node
// PreToolUse hook on Write | Edit — declarative artifact-lock enforcement
// (dev-team#257 piece 2; contract mirrored from runner-plugin's
// docs/upstream-requests/2026-07-18-crew-artifact-lock-hook-contract.md).
//
// Lock file shape (one JSON file per active slice under
// <repo-cwd>/.claude/state/loop/artifact-locks/<sliceId>.json):
//   {
//     "sliceId": "SLICE-NNN",
//     "lockedPaths": [".claude/artifacts/crew/validations/<plan-file>.md"],
//     "lockedBy": "qa-gate",
//     "createdAt": "<ISO>",
//     "expiresAt": "<ISO, optional TTL guard>"
//   }
//
// On PreToolUse Write|Edit, glob .claude/state/loop/artifact-locks/*.json
// (consumer repo cwd); if tool_input.file_path matches any lockedPaths entry
// (normalized, repo-relative), deny with the lock's lockedBy + sliceId in the
// reason. Fail-open: malformed lock file, unreadable dir, or any hook error
// -> allow. Warn-first: config.features["artifact-lock"].enabled must be
// explicitly true to escalate from warn (systemMessage) to block
// (decision:"block") — default is warn, mirroring dispatch-size-gate /
// git-gate-block. Orphan handling: locks past expiresAt (or older than the
// 48h default TTL) are ignored — a dead slice cannot wedge future work.
// Lifecycle ownership is entirely on the consumer (runner-plugin) side: it
// writes the lock at its qa-gate pre-flight and removes it at
// runner:close/dispatch-prune; this hook only ever reads.
import { runArtifactLockHook } from "./lib/pre-tool-use-artifact-lock.ts";
import { logHookError } from "./hook-error.ts";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  const raw = await readStdin();
  const out = await runArtifactLockHook(raw);
  if (out !== null) process.stdout.write(out);
}

main().catch(async (err) => {
  await logHookError(process.cwd(), "pre-tool-use-artifact-lock", err);
  process.exit(0);
});
