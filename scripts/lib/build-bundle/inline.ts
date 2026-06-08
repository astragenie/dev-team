import fs from "node:fs/promises";
import path from "node:path";

import { INLINE_HEADER, INLINE_TRUNCATION_WARNING, SCHEMA_VERSION } from "./types.ts";

export interface InlineOptions {
  sliceId: string;
  bundlesRoot?: string;
  supportedSchemaVersion?: number;
  warn?: (msg: string) => void;
}

const DEFAULT_BUNDLES_ROOT = path.join(".claude", "artifacts", "crew", "bundles");

interface ParsedFrontmatter {
  schema_version: number;
  truncated: boolean;
}

function parseFrontmatter(text: string): ParsedFrontmatter | null {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const body = match[1] ?? "";
  let schemaVersion: number | null = null;
  let truncated = false;
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    const sv = line.match(/^schema_version:\s*(\d+)\s*$/);
    if (sv && sv[1]) {
      schemaVersion = Number(sv[1]);
      continue;
    }
    const tr = line.match(/^truncated:\s*(true|false)\s*$/);
    if (tr) {
      truncated = tr[1] === "true";
    }
  }
  if (schemaVersion === null || !Number.isFinite(schemaVersion)) return null;
  return { schema_version: schemaVersion, truncated };
}

async function pickLatest(dir: string): Promise<string | null> {
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
  const bundles = entries.filter((n) => n.endsWith("-build-bundle.md"));
  if (bundles.length === 0) return null;
  const stats = await Promise.all(
    bundles.map(async (name) => ({
      name,
      mtime: (await fs.stat(path.join(dir, name))).mtimeMs
    }))
  );
  stats.sort((a, b) => {
    if (Math.abs(a.mtime - b.mtime) < 1000) {
      return a.name < b.name ? 1 : -1; // alphabetically-last wins
    }
    return b.mtime - a.mtime;
  });
  const winner = stats[0];
  return winner ? path.join(dir, winner.name) : null;
}

export async function inlineLatestBundle(opts: InlineOptions): Promise<string> {
  const supported = opts.supportedSchemaVersion ?? SCHEMA_VERSION;
  const warn = opts.warn ?? ((msg) => process.stderr.write(`[build-bundle] ${msg}\n`));
  const root = opts.bundlesRoot ?? DEFAULT_BUNDLES_ROOT;
  const dir = path.join(root, opts.sliceId);

  const file = await pickLatest(dir);
  if (!file) {
    warn(`no bundle for slice ${opts.sliceId}`);
    return "";
  }

  const body = await fs.readFile(file, "utf8");
  const fm = parseFrontmatter(body);
  if (!fm) {
    warn(`malformed bundle frontmatter at ${file}`);
    return "";
  }
  if (fm.schema_version > supported) {
    warn(`bundle schema_version ${fm.schema_version} > supported ${supported} at ${file}`);
    return "";
  }

  const lines = [INLINE_HEADER, "", body];
  if (fm.truncated) {
    lines.push("", INLINE_TRUNCATION_WARNING);
  }
  return lines.join("\n");
}
