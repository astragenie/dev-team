// scripts/lib/cost-hygiene/state.mjs
import fs from "node:fs/promises";
import path from "node:path";

const STATE_DIR_REL = path.join(".claude", "state", "cost-hygiene");

/**
 * @typedef {Object} StoredEntry
 * @property {number} read_count
 * @property {string} first_read_at
 * @property {string} last_read_at
 * @property {string} mtime_at_last_read
 * @property {number} size_at_last_read
 * @property {number} content_bytes
 * @property {string | null} content
 */

/**
 * @typedef {Object} SessionState
 * @property {string} session_id
 * @property {string} first_seen
 * @property {string} last_seen
 * @property {number} total_bytes
 * @property {Record<string, StoredEntry>} entries
 */

/**
 * @param {string} repoPath
 * @param {string} sessionId
 * @returns {string}
 */
function statePath(repoPath, sessionId) {
  return path.join(repoPath, STATE_DIR_REL, `${sessionId}.json`);
}

/**
 * @param {string} sessionId
 * @returns {SessionState}
 */
function emptyState(sessionId) {
  const nowIso = new Date().toISOString();
  return {
    session_id: sessionId,
    first_seen: nowIso,
    last_seen: nowIso,
    total_bytes: 0,
    entries: {}
  };
}

/**
 * @param {string} repoPath
 * @param {string} sessionId
 * @param {SessionState} state
 * @returns {Promise<void>}
 */
export async function saveSession(repoPath, sessionId, state) {
  const file = statePath(repoPath, sessionId);
  const dir = path.dirname(file);
  await fs.mkdir(dir, { recursive: true });
  const tempFile = `${file}.tmp.${process.pid}`;
  state.last_seen = new Date().toISOString();
  await fs.writeFile(tempFile, JSON.stringify(state, null, 2), "utf8");
  await fs.rename(tempFile, file);
}

/**
 * @param {string} repoPath
 * @param {string} sessionId
 * @returns {Promise<SessionState>}
 */
export async function loadSession(repoPath, sessionId) {
  const file = statePath(repoPath, sessionId);
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = /** @type {SessionState} */ (JSON.parse(raw));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.session_id === "string" &&
      typeof parsed.entries === "object" &&
      parsed.entries !== null
    ) {
      return parsed;
    }
    return emptyState(sessionId);
  } catch {
    return emptyState(sessionId);
  }
}

const PER_FILE_CAP_BYTES = 50 * 1024;

/**
 * @param {SessionState} state
 * @param {string} filePath
 * @param {string} mtime
 * @param {number} size
 * @param {string} now
 * @returns {SessionState}
 */
export function recordRead(state, filePath, mtime, size, now) {
  const existing = state.entries[filePath];
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

/**
 * @param {SessionState} state
 * @param {string} filePath
 * @param {string} content
 * @returns {SessionState}
 */
export function recordReadContent(state, filePath, content) {
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

/**
 * @param {SessionState} state
 * @param {string | null} protectedPath
 * @returns {SessionState}
 */
export function evictLRU(state, protectedPath = null) {
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
