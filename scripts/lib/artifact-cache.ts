import fs from "node:fs/promises";

interface CachedArtifact {
  fm: Record<string, string>;
  body: string;
  mtimeMs: number;
}

const _cache = new Map<string, CachedArtifact>();

function parseFrontmatter(body: string): Record<string, string> {
  const result: Record<string, string> = {};
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

export async function getCachedArtifact(absPath: string): Promise<CachedArtifact> {
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

export function _cacheForTesting() {
  return _cache;
}
