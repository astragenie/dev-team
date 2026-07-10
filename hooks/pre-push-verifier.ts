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
// Default-OFF; enable via crew.json features["push-verify"].enabled=true.
// Per-repo opt-out (when globally enabled): deployment.md `push.verify: false`.
// Emergency bypass: CREW_PUSH_VERIFY=0 in the shell that launched Claude Code,
// or `! CREW_PUSH_VERIFY=0 git push` to run directly in the terminal.
import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { logHookError } from "./hook-error.ts";
import { readCrewConfig, isEnabled } from "../scripts/lib/features-service.ts";
import { parseFrontmatterBlock } from "../scripts/lib/briefing/collect-cost-parser.ts";

const CACHE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

function parseInput(raw: string): { sessionId: string; command: string; cwd: string } | null {
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
  return /\bgit\s+push\b/.test(trimmed) || /\bgh\s+pr\s+create\b/.test(trimmed);
}

// Defect #1 fix (issue #164): PreToolUse's `cwd` field is the session's
// tracked working dir, which is the MAIN checkout even when the actual
// command changes into a git worktree first (`cd <worktree> && git push`).
// Parse a leading `cd <path>` segment off the command so path resolution
// below targets the directory the push actually runs from.
function resolveCommandCwd(command: string, sessionCwd: string): string {
  const cdMatch = command.match(/^\s*cd\s+("[^"]+"|'[^']+'|\S+)\s*(?:&&|;)/);
  if (!cdMatch) return sessionCwd;
  const rawTarget = (cdMatch[1] ?? "").replace(/^["']|["']$/g, "");
  if (rawTarget === "") return sessionCwd;
  return path.isAbsolute(rawTarget) ? rawTarget : path.resolve(sessionCwd, rawTarget);
}

// Normalizes a working directory to its git worktree root (works for both
// the main checkout and a linked worktree — `git rev-parse --show-toplevel`
// resolves to whichever one `dir` actually sits inside). Falls back to
// `dir` unchanged when it isn't inside a git repo (e.g. hook test fixtures).
function resolveGitWorktreeRoot(dir: string): string {
  try {
    const result = spawnSync("git", ["-C", dir, "rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      windowsHide: true
    });
    if (result.status === 0 && result.stdout.trim() !== "") {
      return result.stdout.trim();
    }
  } catch {
    // git not on PATH, or dir doesn't exist — fall back below
  }
  return dir;
}

// Combines both steps: parse the command's effective cwd, then resolve it
// to the git repo root actually being pushed from.
function resolveTargetRepoRoot(command: string, sessionCwd: string): string {
  return resolveGitWorktreeRoot(resolveCommandCwd(command, sessionCwd));
}

async function isVerifyDisabledInDeployment(repoPath: string): Promise<boolean> {
  try {
    const content = await fs.readFile(
      path.join(repoPath, ".claude", "crew", "deployment.md"),
      "utf8"
    );
    // Match both plain `push.verify: false` and backtick-quoted markdown form.
    return /push\.verify:\s*false\b/i.test(content);
  } catch {
    return false;
  }
}

interface ValidationScan {
  hasPassed: boolean;
  // Defect #3 fix (issue #164): carry enough diagnostic detail that the
  // block message can distinguish "dir empty/missing" from "artifacts
  // exist but none within the window" from "artifacts in window, none
  // PASS" instead of one generic "not found" string for all three.
  scannedDir: string;
  windowFileCount: number;
  newestArtifactPath: string | null;
  newestDecision: string | null;
}

// P1.3: prefer the canonical frontmatter `decision:` enum (pass|fail|skipped)
// when present — only "pass" counts as a pass. Fall back to the body-prose
// "Decision: passed"/"Decision: approved" regex for pre-P1.3 (legacy)
// artifacts that have no frontmatter decision field at all. Hoisted out of
// scanValidationArtifacts to stay under the cognitive-complexity cap.
function resolveDecisionFromArtifactContent(content: string): {
  decision: string | null;
  isPass: boolean;
} {
  const fm = parseFrontmatterBlock(content);
  if (fm["decision"]) {
    const decision = fm["decision"].toLowerCase();
    return { decision, isPass: decision === "pass" };
  }
  const decisionMatch = content.match(/^[-\s]*Decision:\s*(\w+)/im);
  const decision = (decisionMatch?.[1] ?? "").toLowerCase() || null;
  return { decision, isPass: decision === "passed" || decision === "approved" };
}

async function scanValidationArtifacts(repoPath: string): Promise<ValidationScan> {
  const validationsDir = path.join(repoPath, ".claude", "artifacts", "crew", "validations");
  const cutoffMs = Date.now() - CACHE_WINDOW_MS;

  let entries: Dirent[];
  try {
    entries = await fs.readdir(validationsDir, { withFileTypes: true });
  } catch {
    return {
      hasPassed: false,
      scannedDir: validationsDir,
      windowFileCount: 0,
      newestArtifactPath: null,
      newestDecision: null
    };
  }

  const mdFiles = entries
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => path.join(validationsDir, e.name));

  // Sort by name descending — filenames start with ISO timestamps (YYYYMMDDTHHMMSSZ-*).
  mdFiles.sort((a, b) => b.localeCompare(a));

  let windowFileCount = 0;
  let newestArtifactPath: string | null = null;
  let newestDecision: string | null = null;

  for (const filePath of mdFiles) {
    let stat: Awaited<ReturnType<typeof fs.stat>>;
    try {
      stat = await fs.stat(filePath);
    } catch {
      continue;
    }
    // Filename-sort doesn't guarantee mtime-sort (fresh clone resets all mtimes
    // to checkout time). Use `continue` to keep scanning instead of `break`.
    if (stat.mtimeMs < cutoffMs) continue;
    windowFileCount++;

    let content: string;
    try {
      content = await fs.readFile(filePath, "utf8");
    } catch {
      continue;
    }

    const { decision, isPass } = resolveDecisionFromArtifactContent(content);
    if (newestArtifactPath === null) {
      // First in-window artifact in filename-descending order — tracked for
      // the block message even when it isn't the PASS we're looking for.
      newestArtifactPath = filePath;
      newestDecision = decision;
    }
    if (isPass) {
      return {
        hasPassed: true,
        scannedDir: validationsDir,
        windowFileCount,
        newestArtifactPath: filePath,
        newestDecision: decision
      };
    }
    // Keep scanning — there may be an older PASS behind a recent non-pass
    continue;
  }

  return {
    hasPassed: false,
    scannedDir: validationsDir,
    windowFileCount,
    newestArtifactPath,
    newestDecision
  };
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

  // Defect #1 fix: resolve the repo the push actually targets (handles
  // `cd <worktree> && git push` where PreToolUse's cwd is the main checkout)
  // and use THAT root for every path-based check below.
  const repoRoot = resolveTargetRepoRoot(input.command, input.cwd);

  const config = await readCrewConfig(repoRoot);
  if (!isEnabled("push-verify", config)) return; // feature disabled (default) — pass through

  if (await isVerifyDisabledInDeployment(repoRoot)) return; // repo opted out via push.verify: false

  const scan = await scanValidationArtifacts(repoRoot);

  if (scan.hasPassed) {
    // Cache hit — recent PASS exists, allow push
    return;
  }

  // No recent PASS validation artifact — block and guide the user.
  // Defect #3 fix: report the exact dir scanned, how many artifacts fell
  // within the 1h window, and the newest one's parsed decision, instead of
  // one generic "not found" string for every distinct cause.
  const artifactHint =
    scan.windowFileCount === 0
      ? `\n  Scanned: ${scan.scannedDir}` +
        `\n  No validation artifacts (*.md) found within the last hour.`
      : `\n  Scanned: ${scan.scannedDir}` +
        `\n  ${scan.windowFileCount} validation artifact(s) found within the last hour.` +
        `\n  Newest artifact (decision=${scan.newestDecision ?? "unparsed"}): ${scan.newestArtifactPath}`;

  const message =
    `[crew:pre-push-verifier] Push blocked — no PASS validation within the last hour.` +
    artifactHint +
    // Defect #2 fix: PreToolUse blocks are all-or-nothing — clarify that any
    // other steps chained in the same Bash call are blocked too, not just
    // the push itself, so a compound command doesn't get silently truncated.
    `\n  Note: this blocks the ENTIRE command as submitted, including any` +
    `\n  non-push steps chained before/after it (e.g. \`cp x && git push\` blocks the cp too).` +
    `\n  Run /crew:ship (dispatches crew:verifier + QA before pushing) or` +
    `\n  dispatch crew:verifier manually, then retry the push.` +
    `\n  To disable this gate: set features["push-verify"].enabled=false in .claude/crew.json` +
    `\n  or run \`! CREW_PUSH_VERIFY=0 git push\` directly in your terminal.`;

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
