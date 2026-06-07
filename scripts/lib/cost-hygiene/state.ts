// scripts/lib/cost-hygiene/state.ts
import fs from "node:fs/promises";
import path from "node:path";

const STATE_DIR_REL = path.join(".claude", "state", "cost-hygiene");

export interface StoredEntry {
  read_count: number;
  first_read_at: string;
  last_read_at: string;
  mtime_at_last_read: string;
  size_at_last_read: number;
  content_bytes: number;
  content: string | null;
}

export interface SessionState {
  session_id: string;
  first_seen: string;
  last_seen: string;
  total_bytes: number;
  entries: Record<string, StoredEntry>;
}

function statePath(repoPath: string, sessionId: string): string {
  return path.join(repoPath, STATE_DIR_REL, `${sessionId}.json`);
}

function emptyState(sessionId: string): SessionState {
  const nowIso = new Date().toISOString();
  return {
    session_id: sessionId,
    first_seen: nowIso,
    last_seen: nowIso,
    total_bytes: 0,
    entries: {}
  };
}

export async function saveSession(
  repoPath: string,
  sessionId: string,
  state: SessionState
): Promise<void> {
  const file = statePath(repoPath, sessionId);
  const dir = path.dirname(file);
  await fs.mkdir(dir, { recursive: true });
  const tempFile = `${file}.tmp.${process.pid}`;
  state.last_seen = new Date().toISOString();
  await fs.writeFile(tempFile, JSON.stringify(state, null, 2), "utf8");
  await fs.rename(tempFile, file);
}

export async function loadSession(repoPath: string, sessionId: string): Promise<SessionState> {
  await cleanupStaleTempFiles(repoPath, sessionId);
  const file = statePath(repoPath, sessionId);
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as Record<string, unknown>).session_id === "string" &&
      typeof (parsed as Record<string, unknown>).entries === "object" &&
      (parsed as Record<string, unknown>).entries !== null
    ) {
      return parsed as SessionState;
    }
    return emptyState(sessionId);
  } catch {
    return emptyState(sessionId);
  }
}

const PER_FILE_CAP_BYTES = 50 * 1024;

export function recordRead(
  state: SessionState,
  filePath: string,
  mtime: string,
  size: number,
  now: string
): SessionState {
  const existing: StoredEntry | undefined = state.entries[filePath];
  if (existing) {
    existing.read_count += 1;
    existing.last_read_at = now;
    existing.mtime_at_last_read = mtime;
    existing.size_at_last_read = size;
  } else {
    state.entries[filePath] = {
      read_count: 1,
      first_read_at: now,
      last_read_at: now,
      mtime_at_last_read: mtime,
      size_at_last_read: size,
      content_bytes: 0,
      content: null
    };
  }
  return state;
}

export function recordReadContent(
  state: SessionState,
  filePath: string,
  content: string
): SessionState {
  const entry = state.entries[filePath];
  if (!entry) return state;
  const previousBytes = entry.content_bytes;
  const candidateBytes = Buffer.byteLength(content, "utf8");
  if (candidateBytes > PER_FILE_CAP_BYTES) {
    entry.content = null;
    entry.content_bytes = 0;
    state.total_bytes = state.total_bytes - previousBytes;
  } else {
    entry.content = content;
    entry.content_bytes = candidateBytes;
    state.total_bytes = state.total_bytes - previousBytes + candidateBytes;
  }
  return state;
}

const SESSION_CAP_BYTES = 2_000_000;

export function evictLRU(state: SessionState, protectedPath: string | null = null): SessionState {
  if (state.total_bytes <= SESSION_CAP_BYTES) return state;
  const entries = Object.entries(state.entries)
    .filter(([p]) => p !== protectedPath)
    .sort(([, a], [, b]) => Date.parse(a.last_read_at) - Date.parse(b.last_read_at));
  for (const [evictPath, entry] of entries) {
    if (state.total_bytes <= SESSION_CAP_BYTES) break;
    state.total_bytes -= entry.content_bytes;
    delete state.entries[evictPath];
  }
  return state;
}

const TEMP_FILE_MAX_AGE_MS = 60_000;

async function cleanupStaleTempFiles(repoPath: string, sessionId: string): Promise<void> {
  const dir = path.join(repoPath, STATE_DIR_REL);
  let files;
  try {
    files = await fs.readdir(dir);
  } catch {
    return;
  }
  const prefix = `${sessionId}.json.tmp.`;
  const cutoff = Date.now() - TEMP_FILE_MAX_AGE_MS;
  for (const name of files) {
    if (!name.startsWith(prefix)) continue;
    const fullPath = path.join(dir, name);
    try {
      const stat = await fs.stat(fullPath);
      if (stat.mtimeMs < cutoff) {
        await fs.unlink(fullPath);
      }
    } catch {
      // best-effort
    }
  }
}
