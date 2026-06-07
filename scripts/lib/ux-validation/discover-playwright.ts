import fs from "node:fs/promises";
import path from "node:path";

interface PlaywrightConfig {
  url: string;
}

const CONFIG_FILES = ["playwright.config.ts", "playwright.config.js", "playwright.config.mts"];
const BASE_URL_RE = /baseURL\s*:\s*["'`]([^"'`]+)["'`]/;
const DEV_PORT_RE = /-p\s+(\d+)|--port[= ](\d+)/;

async function readFileOrNull(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, "utf8");
  } catch {
    return null;
  }
}

async function tryConfigFiles(repoPath: string): Promise<PlaywrightConfig | null> {
  for (const name of CONFIG_FILES) {
    const content = await readFileOrNull(path.join(repoPath, name));
    if (!content) continue;
    const m = BASE_URL_RE.exec(content);
    if (m?.[1]) return { url: m[1]! };
  }
  return null;
}

async function tryPackageJsonScripts(repoPath: string): Promise<PlaywrightConfig | null> {
  const content = await readFileOrNull(path.join(repoPath, "package.json"));
  if (!content) return null;
  let pkg: { scripts?: Record<string, string> };
  try {
    pkg = JSON.parse(content) as { scripts?: Record<string, string> };
  } catch {
    return null;
  }
  const scripts = pkg.scripts ?? {};
  if (!scripts["playwright"]) return null;
  const devCommand = scripts["dev"] ?? scripts["start"] ?? "";
  const m = DEV_PORT_RE.exec(devCommand);
  if (m) {
    const port = (m[1] ?? m[2])!;
    return { url: `http://localhost:${port}` };
  }
  return null;
}

export async function discoverPlaywrightConfig(repoPath: string): Promise<PlaywrightConfig | null> {
  return (await tryConfigFiles(repoPath)) ?? (await tryPackageJsonScripts(repoPath));
}
