import fs from "node:fs/promises";

/**
 * Process-level, mtime-keyed cache for artifact file reads.
 * Cache entry is invalidated when the file's mtime changes.
 * Lifetime is one CLI invocation — no cross-process sharing.
 *
 * @typedef {{ fm: Record<string, string>, body: string, mtimeMs: number }} CachedArtifact
 */

/** @type {Map<string, CachedArtifact>} */
const _cache = new Map();

/**
 * Parse YAML frontmatter scalar fields from artifact body.
 * Returns key-value pairs; stops at the closing `---` delimiter.
 *
 * @param {string} body
 * @returns {Record<string, string>}
 */
function parseFrontmatter(body) {
  const result = /** @type {Record<string, string>} */ ({});
  if (!body.startsWith("---")) return result;
  const endIdx = body.indexOf("\n---", 3);
  if (endIdx === -1) return result;
  const block = body.slice(4, endIdx);
  for (const line of block.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (key && value) result[key] = value;
  }
  return result;
}

/**
 * Read and parse an artifact file, returning cached result when the mtime
 * is unchanged since the last read. Throws for any file-system error.
 *
 * @param {string} absPath  Absolute path to the artifact file.
 * @returns {Promise<CachedArtifact>}
 */
export async function getCachedArtifact(absPath) {
  const stat = await fs.stat(absPath);
  const mtimeMs = stat.mtimeMs;
  const cached = _cache.get(absPath);
  if (cached && cached.mtimeMs === mtimeMs) {
    return cached;
  }
  const body = await fs.readFile(absPath, "utf8");
  const fm = parseFrontmatter(body);
  const entry = { fm, body, mtimeMs };
  _cache.set(absPath, entry);
  return entry;
}

/** Expose the underlying cache for testing. */
export function _cacheForTesting() {
  return _cache;
}
