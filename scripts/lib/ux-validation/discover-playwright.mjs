import fs from "node:fs/promises";
import path from "node:path";

// Locate consumer-repo Playwright config and extract the base URL.
// Returns { url: string } on success, null when no config + URL can be
// resolved. Order: playwright.config.{ts,js,mts} → package.json dev script
// port detection.

const CONFIG_FILES = ["playwright.config.ts", "playwright.config.js", "playwright.config.mts"];
const BASE_URL_RE = /baseURL\s*:\s*["'`]([^"'`]+)["'`]/;
const DEV_PORT_RE = /-p\s+(\d+)|--port[= ](\d+)/;

/** @param {string} p */
async function readFileOrNull(p) {
  try {
    return await fs.readFile(p, "utf8");
  } catch {
    return null;
  }
}

/** @param {string} repoPath */
async function tryConfigFiles(repoPath) {
  for (const name of CONFIG_FILES) {
    const content = await readFileOrNull(path.join(repoPath, name));
    if (!content) continue;
    const m = BASE_URL_RE.exec(content);
    if (m) return { url: m[1] };
  }
  return null;
}

/** @param {string} repoPath */
async function tryPackageJsonScripts(repoPath) {
  const content = await readFileOrNull(path.join(repoPath, "package.json"));
  if (!content) return null;
  let pkg;
  try {
    pkg = JSON.parse(content);
  } catch {
    return null;
  }
  const scripts = pkg.scripts || {};
  if (!scripts.playwright) return null;
  const devCommand = scripts.dev || scripts.start || "";
  const m = DEV_PORT_RE.exec(devCommand);
  if (m) {
    const port = m[1] || m[2];
    return { url: `http://localhost:${port}` };
  }
  return null;
}

/**
 * @param {string} repoPath
 * @returns {Promise<{url: string} | null>}
 */
export async function discoverPlaywrightConfig(repoPath) {
  return (await tryConfigFiles(repoPath)) || (await tryPackageJsonScripts(repoPath));
}
