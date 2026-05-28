// Small filesystem + JSON helpers shared across installer submodules.
// Extracted from installer.mjs during the Tier B-5 split. Pure utilities
// only — no installer-specific knowledge belongs here.

import fs from "node:fs/promises";
import path from "node:path";

/** @param {unknown} value */
export function indentJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/** @param {string} targetPath */
export async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

/** @param {string} dirPath */
export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * @param {string} filePath
 * @param {string} contents
 * @param {object} [options]
 */
export async function writeFileIfChanged(filePath, contents, options = {}) {
  const existing = await fs.readFile(filePath, "utf8").catch(/** @returns {null} */ () => null);
  if (existing === contents) {
    return false;
  }
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, contents, options);
  return true;
}

/**
 * @param {string} filePath
 * @param {string} contents
 * @param {object} [options]
 */
export async function writeSeedIfMissing(filePath, contents, options = {}) {
  if (await pathExists(filePath)) {
    return false;
  }
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, contents, options);
  return true;
}
