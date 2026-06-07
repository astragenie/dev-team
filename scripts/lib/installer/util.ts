// Small filesystem + JSON helpers shared across installer submodules.
// Extracted from installer.mjs during the Tier B-5 split. Pure utilities
// only — no installer-specific knowledge belongs here.

import fs from "node:fs/promises";
import path from "node:path";

export function indentJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function writeFileIfChanged(
  filePath: string,
  contents: string,
  options: Parameters<typeof fs.writeFile>[2] = {}
): Promise<boolean> {
  const existing = await fs.readFile(filePath, "utf8").catch((): null => null);
  if (existing === contents) {
    return false;
  }
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, contents, options);
  return true;
}

export async function writeSeedIfMissing(
  filePath: string,
  contents: string,
  options: Parameters<typeof fs.writeFile>[2] = {}
): Promise<boolean> {
  if (await pathExists(filePath)) {
    return false;
  }
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, contents, options);
  return true;
}
