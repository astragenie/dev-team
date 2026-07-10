import fs from "node:fs/promises";
import path from "node:path";
import { type Result, ok, err } from "./result.ts";
import { resolveCanonicalRepoRoot } from "./repo-root.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClaimEntry {
  owner: string;
  createdAt: string;
  note: string;
}

interface ClaimsState {
  version: string;
  updatedAt: string;
  claims: Record<string, ClaimEntry>;
  warnings: string[];
}

export interface ClaimConflict {
  path: string;
  owner: string;
  createdAt: string;
  note: string;
}

export interface ClaimResult {
  owner: string;
  claimed: string[];
  alreadyOwned: string[];
  conflicts: ClaimConflict[];
}

export interface ReleaseSkipped {
  path: string;
  reason: string;
  owner?: string;
}

export interface ReleaseResult {
  owner: string | null;
  released: string[];
  skipped: ReleaseSkipped[];
}

export interface ClaimRecord {
  path: string;
  owner: string;
  createdAt: string;
  note: string;
}

export interface InspectResult {
  owner: string | null;
  owned: ClaimRecord[];
  conflicts: ClaimRecord[];
  available: Array<{ path: string }>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATE_DIR = [".claude", "state", "crew"] as const;
const CLAIMS_PATH = [...STATE_DIR, "claims.json"] as const;
const HISTORY_PATH = [...STATE_DIR, "history.jsonl"] as const;
const LOCK_SUFFIX = ".lock";
const LOCK_RETRY_MS = 25;
const LOCK_TIMEOUT_MS = 5000;
const LOCK_STALE_MS = 30_000;

// ---------------------------------------------------------------------------
// Private utilities
// ---------------------------------------------------------------------------

function nowIso(): string {
  return new Date().toISOString();
}

function defaultClaimsState(): ClaimsState {
  return {
    version: "1.0",
    updatedAt: nowIso(),
    claims: {},
    warnings: []
  };
}

async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

async function ensureFile(filePath: string, contents: string): Promise<void> {
  try {
    await fs.access(filePath);
  } catch {
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, contents);
  }
}

function toRepoRelative(repoPath: string, inputPath: string): string {
  const absolute = path.resolve(repoPath, inputPath);
  const relative = path.relative(repoPath, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Claim path must stay inside the repo: ${inputPath}`);
  }
  return relative.split(path.sep).join("/");
}

// ---------------------------------------------------------------------------
// Lock helpers
//
// BUG-A fix: serialize read-modify-write on claims.json using a lock file.
// `wx` flag is fs's name for O_CREAT|O_EXCL|O_WRONLY which is atomic on
// POSIX and Windows. If the lock file already exists, the open fails and
// we retry. A stale lock (older than LOCK_STALE_MS) is forcibly cleared
// to recover from crashed processes.
// ---------------------------------------------------------------------------

async function acquireClaimsLock(storageRoot: string): Promise<string> {
  const claimsPath = path.join(storageRoot, ...CLAIMS_PATH);
  const lockPath = `${claimsPath}${LOCK_SUFFIX}`;
  await ensureDir(path.dirname(lockPath));
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  for (;;) {
    try {
      const handle = await fs.open(lockPath, "wx");
      await handle.write(`${process.pid}\n`);
      await handle.close();
      return lockPath;
    } catch (err) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code !== "EEXIST") {
        throw err;
      }
      // Check for a stale lock and reap it.
      try {
        const stat = await fs.stat(lockPath);
        if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
          await fs.unlink(lockPath).catch(() => {
            /* ignore stale-lock unlink errors */
          });
          continue;
        }
      } catch {
        // Lock disappeared between EEXIST and stat — race with a releaser. Retry.
        continue;
      }
      if (Date.now() >= deadline) {
        throw new Error(
          `Timed out acquiring claims lock at ${lockPath} after ${LOCK_TIMEOUT_MS}ms`
        );
      }
      await new Promise<void>((resolve) => setTimeout(resolve, LOCK_RETRY_MS));
    }
  }
}

async function releaseClaimsLock(lockPath: string): Promise<void> {
  await fs.unlink(lockPath).catch(() => {
    /* ignore already-deleted lock errors */
  });
}

async function withClaimsLock<T>(storageRoot: string, fn: () => Promise<T>): Promise<T> {
  const lockPath = await acquireClaimsLock(storageRoot);
  try {
    return await fn();
  } finally {
    await releaseClaimsLock(lockPath);
  }
}

// ---------------------------------------------------------------------------
// State persistence
// ---------------------------------------------------------------------------

async function saveClaimsState(storageRoot: string, state: ClaimsState): Promise<void> {
  const claimsPath = path.join(storageRoot, ...CLAIMS_PATH);
  state.updatedAt = nowIso();
  await fs.writeFile(claimsPath, `${JSON.stringify(state, null, 2)}\n`);
}

async function appendHistoryEvent(
  storageRoot: string,
  event: Record<string, unknown>
): Promise<void> {
  const historyPath = path.join(storageRoot, ...HISTORY_PATH);
  await fs.appendFile(historyPath, `${JSON.stringify({ timestamp: nowIso(), ...event })}\n`);
}

// ---------------------------------------------------------------------------
// Public scaffold / load
//
// #163: claim state must converge on the MAIN worktree regardless of which
// worktree (wave/slice checkout, or a concurrent chore-branch lane) a caller
// invokes from — otherwise each linked worktree gets its own invisible
// .claude/state/crew/claims.json and cross-lane file-claim conflicts can
// never be detected. resolveCanonicalRepoRoot no-ops for the main worktree
// and for non-git fixtures, so single-worktree callers are unaffected.
// ---------------------------------------------------------------------------

export async function ensureStateScaffold(repoPath: string): Promise<void> {
  const storageRoot = await resolveCanonicalRepoRoot(repoPath);
  const stateDir = path.join(storageRoot, ...STATE_DIR);
  await ensureDir(stateDir);
  await ensureFile(
    path.join(storageRoot, ...CLAIMS_PATH),
    `${JSON.stringify(defaultClaimsState(), null, 2)}\n`
  );
  await ensureFile(path.join(storageRoot, ...HISTORY_PATH), "");
}

async function claimsStateExists(storageRoot: string): Promise<boolean> {
  try {
    await fs.access(path.join(storageRoot, ...CLAIMS_PATH));
    return true;
  } catch {
    return false;
  }
}

export async function loadClaimsState(
  repoPath: string,
  options: { createIfMissing?: boolean } = {}
): Promise<ClaimsState> {
  const storageRoot = await resolveCanonicalRepoRoot(repoPath);
  if (options.createIfMissing === false && !(await claimsStateExists(storageRoot))) {
    return defaultClaimsState();
  }
  await ensureStateScaffold(repoPath);
  const claimsPath = path.join(storageRoot, ...CLAIMS_PATH);
  // State file is always written by this module; shape is trusted.
  return JSON.parse(await fs.readFile(claimsPath, "utf8")) as ClaimsState;
}

// ---------------------------------------------------------------------------
// Claim / release mutations
// ---------------------------------------------------------------------------

export async function claimFiles(
  repoPath: string,
  filePaths: string[],
  options: { owner?: string; note?: string } = {}
): Promise<Result<ClaimResult, Error>> {
  try {
    const owner = options.owner || "lead-session";
    const note = options.note || "";
    const storageRoot = await resolveCanonicalRepoRoot(repoPath);

    const value = await withClaimsLock(storageRoot, async () => {
      const state = await loadClaimsState(repoPath);
      const claimed: string[] = [];
      const alreadyOwned: string[] = [];
      const conflicts: ClaimConflict[] = [];

      for (const inputPath of filePaths) {
        const repoRelativePath = toRepoRelative(repoPath, inputPath);
        const existing = state.claims[repoRelativePath];

        if (!existing) {
          state.claims[repoRelativePath] = {
            owner,
            createdAt: nowIso(),
            note
          };
          claimed.push(repoRelativePath);
          continue;
        }

        if (existing.owner === owner) {
          alreadyOwned.push(repoRelativePath);
          continue;
        }

        conflicts.push({
          path: repoRelativePath,
          owner: existing.owner,
          createdAt: existing.createdAt,
          note: existing.note || ""
        });
      }

      await saveClaimsState(storageRoot, state);
      if (claimed.length > 0) {
        await appendHistoryEvent(storageRoot, { event: "claim", owner, files: claimed, note });
      }

      return { owner, claimed, alreadyOwned, conflicts };
    });
    return ok(value);
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}

export async function releaseFiles(
  repoPath: string,
  filePaths: string[] = [],
  options: { owner?: string } = {}
): Promise<Result<ReleaseResult, Error>> {
  try {
    const owner = options.owner ?? null;
    const storageRoot = await resolveCanonicalRepoRoot(repoPath);

    const value = await withClaimsLock(storageRoot, async () => {
      const state = await loadClaimsState(repoPath);
      const released: string[] = [];
      const skipped: ReleaseSkipped[] = [];

      const targets =
        filePaths.length > 0
          ? filePaths.map((inputPath) => toRepoRelative(repoPath, inputPath))
          : Object.keys(state.claims);

      for (const repoRelativePath of targets) {
        const existing = state.claims[repoRelativePath];
        if (!existing) {
          skipped.push({ path: repoRelativePath, reason: "not_claimed" });
          continue;
        }
        if (owner && existing.owner !== owner) {
          skipped.push({ path: repoRelativePath, reason: "owned_by_other", owner: existing.owner });
          continue;
        }

        delete state.claims[repoRelativePath];
        released.push(repoRelativePath);
      }

      await saveClaimsState(storageRoot, state);
      if (released.length > 0) {
        await appendHistoryEvent(storageRoot, { event: "release", owner, files: released });
      }

      return { owner, released, skipped };
    });
    return ok(value);
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

export async function listClaims(
  repoPath: string,
  options: { createIfMissing?: boolean } = {}
): Promise<ClaimRecord[]> {
  const state = await loadClaimsState(repoPath, {
    ...(options.createIfMissing !== undefined ? { createIfMissing: options.createIfMissing } : {})
  });
  return Object.entries(state.claims)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([filePath, claim]) => ({
      path: filePath,
      owner: claim.owner,
      createdAt: claim.createdAt,
      note: claim.note || ""
    }));
}

// Sweep all claims (no path filter): partition into owned-by-`owner` vs
// the rest. If `owner` is null, every claim is a conflict.
function inspectAllClaims(claims: ClaimRecord[], owner: string | null): InspectResult {
  if (!owner) {
    return { owner, owned: [], conflicts: claims, available: [] };
  }
  const owned: ClaimRecord[] = [];
  const conflicts: ClaimRecord[] = [];
  for (const claim of claims) {
    if (claim.owner === owner) owned.push(claim);
    else conflicts.push(claim);
  }
  return { owner, owned, conflicts, available: [] };
}

// Classify a specific list of paths against existing claims.
function classifyRequestedPaths(
  requested: string[],
  claimsByPath: Map<string, ClaimRecord>,
  owner: string | null
): { owned: ClaimRecord[]; conflicts: ClaimRecord[]; available: Array<{ path: string }> } {
  const owned: ClaimRecord[] = [];
  const conflicts: ClaimRecord[] = [];
  const available: Array<{ path: string }> = [];
  for (const requestedPath of requested) {
    const claim = claimsByPath.get(requestedPath);
    if (!claim) {
      available.push({ path: requestedPath });
      continue;
    }
    if (owner && claim.owner === owner) {
      owned.push(claim);
      continue;
    }
    conflicts.push(claim);
  }
  return { owned, conflicts, available };
}

export async function inspectClaims(
  repoPath: string,
  filePaths: string[] = [],
  options: { owner?: string } = {}
): Promise<InspectResult> {
  const owner = options.owner ?? null;
  const claims = await listClaims(repoPath);

  if (filePaths.length === 0) {
    return inspectAllClaims(claims, owner);
  }

  const claimsByPath = new Map(claims.map((claim) => [claim.path, claim]));
  const requested = [...new Set(filePaths.map((inputPath) => toRepoRelative(repoPath, inputPath)))];
  const { owned, conflicts, available } = classifyRequestedPaths(requested, claimsByPath, owner);
  return { owner, owned, conflicts, available };
}
