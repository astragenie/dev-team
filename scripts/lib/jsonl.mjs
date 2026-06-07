import fs from "node:fs/promises";

const DEFAULT_TAIL_BYTES = 64 * 1024;

/**
 * Reads the last `maxBytes` of a JSONL file and returns up to `count` parsed
 * objects from the tail. Discards the first (possibly truncated) line when the
 * read starts mid-file. Returns an empty array when the file is absent or empty.
 *
 * @param {string} filePath
 * @param {number} count  Maximum number of records to return (taken from the end).
 * @param {{ maxBytes?: number }} [options]
 * @returns {Promise<Record<string, unknown>[]>}
 */
export async function tailReadJsonl(filePath, count, options = {}) {
  const maxBytes = options.maxBytes ?? DEFAULT_TAIL_BYTES;
  let handle;
  try {
    handle = await fs.open(filePath, "r");
  } catch (err) {
    if (/** @type {NodeJS.ErrnoException} */ (err).code === "ENOENT") return [];
    throw err;
  }
  try {
    const stat = await handle.stat();
    if (stat.size === 0) return [];

    const start = Math.max(0, stat.size - maxBytes);
    const length = stat.size - start;
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, start);

    let raw = buffer.toString("utf8");
    if (start > 0) {
      const firstNewline = raw.indexOf("\n");
      raw = firstNewline === -1 ? "" : raw.slice(firstNewline + 1);
    }

    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(-count)
      .map((line) => {
        try {
          return /** @type {Record<string, unknown>} */ (JSON.parse(line));
        } catch {
          return {};
        }
      });
  } finally {
    await handle.close();
  }
}
