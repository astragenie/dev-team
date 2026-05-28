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
