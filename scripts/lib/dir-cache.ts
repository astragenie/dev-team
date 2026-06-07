import fs from "node:fs/promises";
import { type Dirent } from "node:fs";

const _cache = new Map<string, { mtimeMs: number; files: string[] }>();

export async function getCachedDirFiles(
  dirPath: string,
  filter?: (name: string) => boolean
): Promise<string[]> {
  let dirMtime: number;
  try {
    const stat = await fs.stat(dirPath);
    dirMtime = stat.mtimeMs;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }

  const cached = _cache.get(dirPath);
  if (cached && cached.mtimeMs === dirMtime) {
    return cached.files;
  }

  let entries: Dirent[];
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
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

export function _cacheForTesting() {
  return _cache;
}
