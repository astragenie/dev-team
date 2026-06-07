import fs from "node:fs/promises";

/**
 * Process-level directory listing cache keyed by (dirPath, mtimeMs).
 * Invalidates when the directory's mtime changes (new or removed files).
 * Lifetime is one CLI invocation — no cross-process sharing.
 */

/** @type {Map<string, { mtimeMs: number, files: string[] }>} */
const _cache = new Map();

/**
 * Returns a sorted (descending) list of file paths in `dirPath` whose names
 * match `filter`. Result is cached until the directory's mtime changes.
 *
 * @param {string} dirPath     Absolute directory path.
 * @param {(name: string) => boolean} [filter]  Optional filename predicate.
 * @returns {Promise<string[]>}
 */
export async function getCachedDirFiles(dirPath, filter) {
  let dirMtime;
  try {
    const stat = await fs.stat(dirPath);
    dirMtime = stat.mtimeMs;
  } catch (err) {
    if (/** @type {NodeJS.ErrnoException} */ (err).code === "ENOENT") return [];
    throw err;
  }

  const cached = _cache.get(dirPath);
  if (cached && cached.mtimeMs === dirMtime) {
    return cached.files;
  }

  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch (err) {
    if (/** @type {NodeJS.ErrnoException} */ (err).code === "ENOENT") return [];
    throw err;
  }

  const files = entries
    .filter((e) => e.isFile() && (!filter || filter(e.name)))
    .map((e) => e.name)
    .sort()
    .reverse()
    .map((name) => `${dirPath}/${name}`.replace(/\\/g, "/"));

  _cache.set(dirPath, { mtimeMs: dirMtime, files });
  return files;
}

/** Expose cache for testing. */
export function _cacheForTesting() {
  return _cache;
}
