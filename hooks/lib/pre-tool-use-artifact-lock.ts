// Core flow for the PreToolUse Write|Edit artifact-lock hook (dev-team#257
// piece 2). No stdin/stdout/process.exit here — hooks/pre-tool-use-artifact-lock.ts
// owns process I/O, matching the shim/lib split used throughout this hooks
// tree (hooks/lib/dispatch-size-estimate.ts, hooks/lib/model-routing-enforce.ts).
//
// Contract (mirrored from runner-plugin's cross-plugin request doc:
// docs/upstream-requests/2026-07-18-crew-artifact-lock-hook-contract.md,
// option A — state file). One JSON file per active slice under
// <repo-cwd>/.claude/state/loop/artifact-locks/<sliceId>.json:
//
//   {
//     "sliceId": "SLICE-NNN",
//     "lockedPaths": [".claude/artifacts/crew/validations/<plan-file>.md"],
//     "lockedBy": "qa-gate",
//     "createdAt": "<ISO>",
//     "expiresAt": "<ISO, optional TTL guard>"
//   }
//
// On PreToolUse Write|Edit, glob .claude/state/loop/artifact-locks/*.json;
// if tool_input.file_path (normalized, made repo-relative) matches any
// lockedPaths entry, deny with the lock's lockedBy + sliceId in the reason.
//
// Fail-open by construction: an unreadable lock dir returns no locks; a
// malformed individual lock file (missing/wrong-typed field) is skipped —
// its lock is simply not applied, it does not fail the whole scan; any
// error in the orchestration function itself is caught and treated as
// allow. A legitimate edit must never be blocked by this hook's own
// failure to read its own state.
//
// Orphan handling: a lock past its `expiresAt`, OR older than the 48h
// default TTL (createdAt-based) when `expiresAt` is absent, is ignored —
// a dead slice cannot wedge future work (the cross-plugin doc's reviewer
// OBJ-3 concern). Lifecycle ownership is entirely on the consumer
// (runner-plugin) side: it writes the lock at its qa-gate pre-flight and
// removes it at runner:close/dispatch-prune; this hook only ever reads.
//
// Warn-first rollout: config.features["artifact-lock"].enabled must be
// explicitly true (see hooks/lib/warn-first-flag.ts) to escalate from warn
// (systemMessage, never blocks) to block (decision:"block"). Default warn.
import fs from "node:fs/promises";
import path from "node:path";
import { readCrewConfig } from "../../scripts/lib/features-service.ts";
import { resolveBlockMode } from "./warn-first-flag.ts";

export const ARTIFACT_LOCK_FEATURE = "artifact-lock";

const LOCK_DIR = [".claude", "state", "loop", "artifact-locks"] as const;
const DEFAULT_TTL_MS = 48 * 60 * 60 * 1000; // 48h, per the cross-plugin doc's example TTL

export interface ArtifactLock {
  sliceId: string;
  lockedPaths: string[];
  lockedBy: string;
  createdAt: string;
  expiresAt?: string;
}

/** Normalize path separators and strip a leading "./" for stable comparison. */
export function normalizeLockPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\//, "");
}

/** Resolve a tool_input.file_path (absolute or relative) to a repo-relative, normalized path. */
export function toRepoRelative(cwd: string, filePath: string): string {
  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath);
  return normalizeLockPath(path.relative(cwd, abs));
}

function isWellFormedLock(obj: unknown): obj is ArtifactLock {
  if (typeof obj !== "object" || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o["sliceId"] === "string" &&
    Array.isArray(o["lockedPaths"]) &&
    o["lockedPaths"].every((p) => typeof p === "string") &&
    typeof o["lockedBy"] === "string" &&
    typeof o["createdAt"] === "string" &&
    (o["expiresAt"] === undefined || typeof o["expiresAt"] === "string")
  );
}

export function isLockExpired(lock: ArtifactLock, nowMs: number): boolean {
  if (lock.expiresAt !== undefined) {
    const exp = Date.parse(lock.expiresAt);
    if (!Number.isNaN(exp)) return exp < nowMs;
  }
  const created = Date.parse(lock.createdAt);
  // Unparseable createdAt (and no usable expiresAt above) means this lock's
  // age can never be established — treat it as expired rather than
  // immortal. An un-reapable lock that silently outlives its slice forever
  // is a worse failure mode than an edit falling through to warn/allow.
  if (Number.isNaN(created)) return true;
  return nowMs - created > DEFAULT_TTL_MS;
}

/**
 * Read every well-formed, non-expired lock file from the lock dir.
 * Missing dir -> []. A malformed or unreadable individual file is skipped
 * (not applied), never thrown — this function itself never throws.
 */
export async function readActiveLocks(
  cwd: string,
  nowMs: number = Date.now()
): Promise<ArtifactLock[]> {
  const dir = path.join(cwd, ...LOCK_DIR);
  let names: string[];
  try {
    names = (await fs.readdir(dir)).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }

  const locks: ArtifactLock[] = [];
  for (const name of names) {
    try {
      const raw = await fs.readFile(path.join(dir, name), "utf8");
      const obj = JSON.parse(raw);
      if (!isWellFormedLock(obj)) continue;
      if (isLockExpired(obj, nowMs)) continue;
      locks.push(obj);
    } catch {
      continue;
    }
  }
  return locks;
}

export interface LockMatch {
  lock: ArtifactLock;
  matchedPath: string;
}

export function findMatchingLock(
  locks: ArtifactLock[],
  repoRelativePath: string
): LockMatch | null {
  for (const lock of locks) {
    for (const lockedPath of lock.lockedPaths) {
      if (normalizeLockPath(lockedPath) === repoRelativePath) {
        return { lock, matchedPath: lockedPath };
      }
    }
  }
  return null;
}

interface ParsedInput {
  sessionId: string;
  cwd: string;
  filePath: string;
}

function parseInput(raw: string): ParsedInput | null {
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    if (obj["tool_name"] !== "Write" && obj["tool_name"] !== "Edit") return null;
    const toolInput = obj["tool_input"];
    if (typeof toolInput !== "object" || toolInput === null) return null;
    const filePath = (toolInput as Record<string, unknown>)["file_path"];
    if (typeof filePath !== "string" || filePath === "") return null;
    const cwd = typeof obj["cwd"] === "string" ? obj["cwd"] : process.cwd();
    const sessionId = typeof obj["session_id"] === "string" ? obj["session_id"] : "";
    return { sessionId, cwd, filePath };
  } catch {
    return null;
  }
}

async function logEvent(
  repoPath: string,
  code: string,
  sessionId: string,
  detail: string
): Promise<void> {
  try {
    const dir = path.join(repoPath, ".claude", "logs");
    await fs.mkdir(dir, { recursive: true });
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      event: `artifact-lock:${code}`,
      session_id: sessionId,
      detail
    });
    await fs.appendFile(path.join(dir, "events.jsonl"), line + "\n", "utf8");
  } catch {
    // best-effort
  }
}

export async function runArtifactLockHook(raw: string): Promise<string | null> {
  const input = parseInput(raw);
  if (input === null) return null; // not Write/Edit, or malformed — pass through

  const { sessionId, cwd, filePath } = input;

  try {
    const locks = await readActiveLocks(cwd);
    if (locks.length === 0) return null;

    const relPath = toRepoRelative(cwd, filePath);
    const match = findMatchingLock(locks, relPath);
    if (match === null) return null;

    const config = await readCrewConfig(cwd);
    const blockMode = resolveBlockMode(config, ARTIFACT_LOCK_FEATURE);

    const reason =
      `[crew:artifact-lock] "${relPath}" is locked by "${match.lock.lockedBy}" for ` +
      `${match.lock.sliceId}. Wait for the lock to clear (runner:close / dispatch prune removes ` +
      `it) or coordinate with the lock owner before editing this path. (dev-team#257 piece 2 — ` +
      `runner-plugin FEAT-264 SLICE-4.)`;

    await logEvent(cwd, blockMode ? "denied" : "warned", sessionId, reason);

    if (!blockMode) {
      // Warn-only: PreToolUse shape per hooks/lib/dispatch-size-estimate.ts's
      // buildDispatchSizeOutput precedent — hookSpecificOutput.permissionDecision
      // explicitly "allow" (not just an omitted decision) + systemMessage.
      return JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "allow"
        },
        systemMessage: reason
      });
    }
    return JSON.stringify({ decision: "block", reason });
  } catch (err) {
    // Fail-open: a lock-dir read/parse failure must never block a legitimate edit.
    await logEvent(cwd, "internal-error", sessionId, String(err));
    return null;
  }
}
