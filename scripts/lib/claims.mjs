import fs from "node:fs/promises";
import path from "node:path";

const STATE_DIR = [".claude", "state", "crew"];
const CLAIMS_PATH = [...STATE_DIR, "claims.json"];
const HISTORY_PATH = [...STATE_DIR, "history.jsonl"];
const LOCK_SUFFIX = ".lock";
const LOCK_RETRY_MS = 25;
const LOCK_TIMEOUT_MS = 5000;
const LOCK_STALE_MS = 30_000;

function nowIso() {
  return new Date().toISOString();
}

function defaultClaimsState() {
  return {
    version: "1.0",
    updatedAt: nowIso(),
    claims: {},
    warnings: []
  };
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function ensureFile(filePath, contents) {
  try {
    await fs.access(filePath);
  } catch {
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, contents);
  }
}

function toRepoRelative(repoPath, inputPath) {
  const absolute = path.resolve(repoPath, inputPath);
  const relative = path.relative(repoPath, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Claim path must stay inside the repo: ${inputPath}`);
  }
  return relative.split(path.sep).join("/");
}

// BUG-A fix: serialize read-modify-write on claims.json using a lock file.
// `wx` flag is fs's name for O_CREAT|O_EXCL|O_WRONLY which is atomic on
// POSIX and Windows. If the lock file already exists, the open fails and
// we retry. A stale lock (older than LOCK_STALE_MS) is forcibly cleared
// to recover from crashed processes.
async function acquireClaimsLock(repoPath) {
  const claimsPath = path.join(repoPath, ...CLAIMS_PATH);
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
      if (err.code !== "EEXIST") {
        throw err;
      }
      // Check for a stale lock and reap it.
      try {
        const stat = await fs.stat(lockPath);
        if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
          await fs.unlink(lockPath).catch(() => {});
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
      await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_MS));
    }
  }
}

async function releaseClaimsLock(lockPath) {
  await fs.unlink(lockPath).catch(() => {});
}

async function withClaimsLock(repoPath, fn) {
  const lockPath = await acquireClaimsLock(repoPath);
  try {
    return await fn();
  } finally {
    await releaseClaimsLock(lockPath);
  }
}

async function saveClaimsState(repoPath, state) {
  const claimsPath = path.join(repoPath, ...CLAIMS_PATH);
  state.updatedAt = nowIso();
  await fs.writeFile(claimsPath, `${JSON.stringify(state, null, 2)}\n`);
}

async function appendHistoryEvent(repoPath, event) {
  const historyPath = path.join(repoPath, ...HISTORY_PATH);
  await fs.appendFile(historyPath, `${JSON.stringify({ timestamp: nowIso(), ...event })}\n`);
}

export async function ensureStateScaffold(repoPath) {
  const stateDir = path.join(repoPath, ...STATE_DIR);
  await ensureDir(stateDir);
  await ensureFile(
    path.join(repoPath, ...CLAIMS_PATH),
    `${JSON.stringify(defaultClaimsState(), null, 2)}\n`
  );
  await ensureFile(path.join(repoPath, ...HISTORY_PATH), "");
}

async function claimsStateExists(repoPath) {
  try {
    await fs.access(path.join(repoPath, ...CLAIMS_PATH));
    return true;
  } catch {
    return false;
  }
}

export async function loadClaimsState(repoPath, options = {}) {
  if (options.createIfMissing === false && !(await claimsStateExists(repoPath))) {
    return defaultClaimsState();
  }
  await ensureStateScaffold(repoPath);
  const claimsPath = path.join(repoPath, ...CLAIMS_PATH);
  return JSON.parse(await fs.readFile(claimsPath, "utf8"));
}

export async function claimFiles(repoPath, filePaths, options = {}) {
  const owner = options.owner || "lead-session";
  const note = options.note || "";

  return withClaimsLock(repoPath, async () => {
    const state = await loadClaimsState(repoPath);
    const claimed = [];
    const alreadyOwned = [];
    const conflicts = [];

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

    await saveClaimsState(repoPath, state);
    if (claimed.length > 0) {
      await appendHistoryEvent(repoPath, { event: "claim", owner, files: claimed, note });
    }

    return { owner, claimed, alreadyOwned, conflicts };
  });
}

export async function releaseFiles(repoPath, filePaths = [], options = {}) {
  const owner = options.owner || null;

  return withClaimsLock(repoPath, async () => {
    const state = await loadClaimsState(repoPath);
    const released = [];
    const skipped = [];

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

    await saveClaimsState(repoPath, state);
    if (released.length > 0) {
      await appendHistoryEvent(repoPath, { event: "release", owner, files: released });
    }

    return { owner, released, skipped };
  });
}

export async function listClaims(repoPath, options = {}) {
  const state = await loadClaimsState(repoPath, { createIfMissing: options.createIfMissing });
  return Object.entries(state.claims)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([filePath, claim]) => ({
      path: filePath,
      owner: claim.owner,
      createdAt: claim.createdAt,
      note: claim.note || ""
    }));
}

export async function inspectClaims(repoPath, filePaths = [], options = {}) {
  const owner = options.owner || null;
  const claims = await listClaims(repoPath);
  const claimsByPath = new Map(claims.map((claim) => [claim.path, claim]));

  if (filePaths.length === 0) {
    if (!owner) {
      return {
        owner,
        owned: [],
        conflicts: claims,
        available: []
      };
    }

    const owned = [];
    const conflicts = [];
    for (const claim of claims) {
      if (claim.owner === owner) {
        owned.push(claim);
      } else {
        conflicts.push(claim);
      }
    }

    return { owner, owned, conflicts, available: [] };
  }

  const requested = [...new Set(filePaths.map((inputPath) => toRepoRelative(repoPath, inputPath)))];
  const owned = [];
  const conflicts = [];
  const available = [];

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

  return { owner, owned, conflicts, available };
}
