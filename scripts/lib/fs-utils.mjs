import fs from "node:fs/promises";

/**
 * Reads a file as UTF-8 text, returning null when the file does not exist.
 * Any error other than ENOENT (e.g. EACCES, EISDIR) is re-thrown.
 *
 * Prefer this over a pathExists/access check followed by readFile — it uses
 * a single syscall on the happy path and avoids a TOCTOU race.
 *
 * @param {string} filePath
 * @returns {Promise<string | null>}
 */
export async function readFileIfExists(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (err) {
    if (/** @type {NodeJS.ErrnoException} */ (err).code === "ENOENT") return null;
    throw err;
  }
}
