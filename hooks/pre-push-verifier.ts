#!/usr/bin/env node
// PreToolUse hook on Bash. Intercepts `git push` and `gh pr create` commands and
// checks for a recent PASS validation artifact. If no PASS artifact exists within
// the cache window, blocks the push with a stderr message directing the user to
// run /crew:ship or dispatch crew:verifier first.
//
// NOTE: Hook processes cannot invoke the Agent tool directly — dispatch is not
// available from a hook shim. This hook implements the cache-only path: if a
// PASS validation artifact exists (written by crew:verifier during /crew:ship),
// the push is allowed. If none exists, it blocks. The /crew:ship command runs
// crew:verifier before pushing, which writes the artifact this hook reads.
//
// Default-ON; opt out via CREW_PUSH_VERIFY=0.
import fs from "node:fs/promises";
import path from "node:path";
import { logHookError } from "./hook-error.ts";

const CACHE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

function parseInput(
  raw: string
): { sessionId: string; command: string; cwd: string } | null {
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    if (
      typeof obj["session_id"] === "string" &&
      typeof obj["cwd"] === "string" &&
      typeof obj["tool_input"] === "object" &&
      obj["tool_input"] !== null &&
      typeof (obj["tool_input"] as Record<string, unknown>)["command"] === "string"
    ) {
      return {
        sessionId: obj["session_id"] as string,
        command: (obj["tool_input"] as Record<string, unknown>)["command"] as string,
        cwd: obj["cwd"] as string
      };
    }
    return null;
  } catch {
    return null;
  }
}

function isPushCommand(command: string): boolean {
  const trimmed = command.trim();
  return (
    /\bgit\s+push\b/.test(trimmed) ||
    /\bgh\s+pr\s+create\b/.test(trimmed)
  );
}

interface ValidationScan {
  hasPassed: boolean;
  newestArtifactPath: string | null;
  newestDecision: string | null;
}

async function scanValidationArtifacts(repoPath: string): Promise<ValidationScan> {
  const validationsDir = path.join(repoPath, ".claude", "artifacts", "crew", "validations");
  const cutoffMs = Date.now() - CACHE_WINDOW_MS;

  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(validationsDir, { withFileTypes: true });
  } catch {
    return { hasPassed: false, newestArtifactPath: null, newestDecision: null };
  }

  const mdFiles = entries
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => path.join(validationsDir, e.name));

  // Sort by name descending — filenames start with ISO timestamps (YYYYMMDDTHHMMSSZ-*).
  mdFiles.sort((a, b) => b.localeCompare(a));

  for (const filePath of mdFiles) {
    let stat: Awaited<ReturnType<typeof fs.stat>>;
    try {
      stat = await fs.stat(filePath);
    } catch {
      continue;
    }
    if (stat.mtimeMs < cutoffMs) break; // files are sorted desc; once past window, stop

    let content: string;
    try {
      content = await fs.readFile(filePath, "utf8");
    } catch {
      continue;
    }

    // Match "Decision: passed" or "Decision: approved" (case-insensitive, leading whitespace ok)
    const decisionMatch = content.match(/^[-\s]*Decision:\s*(\w+)/im);
    const decision = decisionMatch ? decisionMatch[1]!.toLowerCase() : null;

    if (decision === "passed" || decision === "approved") {
      return { hasPassed: true, newestArtifactPath: filePath, newestDecision: decision };
    }
    // Keep scanning — there may be an older PASS behind a recent non-pass
    continue;
  }

  return { hasPassed: false, newestArtifactPath: null, newestDecision: null };
}

async function main(): Promise<void> {
  if (process.env["CREW_PUSH_VERIFY"] === "0") {
    process.stdin.resume();
    return;
  }

  const raw = await readStdin();
  const input = parseInput(raw);
  if (input === null) return; // unrecognised payload — pass through

  if (!isPushCommand(input.command)) return; // not a push — pass through

  const scan = await scanValidationArtifacts(input.cwd);

  if (scan.hasPassed) {
    // Cache hit — recent PASS exists, allow push
    return;
  }

  // No recent PASS validation artifact — block and guide the user
  const artifactHint =
    scan.newestArtifactPath !== null
      ? `\n  Most recent artifact (decision=${scan.newestDecision ?? "unknown"}): ${scan.newestArtifactPath}`
      : "\n  No validation artifacts found in .claude/artifacts/crew/validations/";

  const message =
    `[crew:pre-push-verifier] Push blocked — no PASS validation within the last hour.` +
    artifactHint +
    `\n  Run /crew:ship (dispatches crew:verifier + QA before pushing) or` +
    `\n  dispatch crew:verifier manually, then retry the push.` +
    `\n  To bypass: set CREW_PUSH_VERIFY=0 in your shell.`;

  process.stderr.write(message + "\n");
  process.stdout.write(
    JSON.stringify({
      decision: "block",
      reason: message
    }) + "\n"
  );
}

main().catch(async (err) => {
  await logHookError(process.cwd(), "pre-push-verifier", err);
  process.exit(0); // hook errors must never block Claude
});
