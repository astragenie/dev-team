// scripts/lib/cost-hygiene/decide.mjs

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
 * @typedef {Object} DecideInput
 * @property {string} path
 * @property {StoredEntry | null} storedEntry
 * @property {string} currentMtime
 * @property {number} currentSize
 * @property {string} now
 */

/**
 * @typedef {Object} DecideResult
 * @property {"pass" | "warn"} action
 * @property {string | null} message
 */

/**
 * @param {StoredEntry} entry
 * @param {string} path
 * @returns {string}
 */
function formatWarning(entry, path) {
  const count = entry.read_count;
  const countLabel = count === 1 ? "1 time" : `${count} times`;
  const mtime = entry.mtime_at_last_read;
  const contentBlock =
    entry.content !== null
      ? `Prior content:\n\n${entry.content}\n\n`
      : `Prior content: (content omitted, file size ${Math.round(entry.size_at_last_read / 1000)} KB)\n\n`;
  return (
    `<system-reminder>You already loaded ${path} ${countLabel} this session. ` +
    `Content unchanged (mtime ${mtime}). ${contentBlock}` +
    `Do not re-issue the Read.</system-reminder>`
  );
}

/**
 * @param {DecideInput} input
 * @returns {DecideResult}
 */
export function decide(input) {
  const { path, storedEntry, currentMtime } = input;
  if (storedEntry === null) {
    return { action: "pass", message: null };
  }
  if (Date.parse(currentMtime) > Date.parse(storedEntry.mtime_at_last_read)) {
    return { action: "pass", message: null };
  }
  return { action: "warn", message: formatWarning(storedEntry, path) };
}
