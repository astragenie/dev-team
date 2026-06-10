import fs from "node:fs/promises";
import path from "node:path";

// ---------------------------------------------------------------------------
// Exported interface
// ---------------------------------------------------------------------------

export interface BundleStats {
  written: number;
  malformed: number;
  truncated: number;
}

// ---------------------------------------------------------------------------
// Exported constants
// ---------------------------------------------------------------------------

const SLICE_RE_BRIEF = /SLICE[-_](\d+)/i;

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

async function readCurrentSliceId(repoPath: string): Promise<string | undefined> {
  const statePath = path.join(repoPath, ".claude", "state", "crew", "workflow-state.json");
  try {
    const raw = await fs.readFile(statePath, "utf8");
    const obj = JSON.parse(raw) as { currentRun?: { title?: unknown } };
    const title = obj?.currentRun?.title;
    if (typeof title !== "string") return undefined;
    const m = title.match(SLICE_RE_BRIEF);
    if (!m || !m[1]) return undefined;
    return `SLICE-${String(Number(m[1])).padStart(2, "0")}`;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Exported collector
// ---------------------------------------------------------------------------

export async function collectBundleStats(
  repoPath: string,
  sliceIdOverride?: string
): Promise<BundleStats> {
  const zero: BundleStats = { written: 0, malformed: 0, truncated: 0 };
  const sliceId = sliceIdOverride ?? (await readCurrentSliceId(repoPath));
  if (!sliceId) return zero;

  const dir = path.join(repoPath, ".claude", "artifacts", "crew", "bundles", sliceId);
  let entries: string[];
  try {
    const all = await fs.readdir(dir);
    entries = all.filter((n) => n.endsWith("-build-bundle.md"));
  } catch {
    return zero;
  }

  type EntryStatus = "ok" | "malformed" | "truncated";
  const statuses = await Promise.all(
    entries.map(async (name): Promise<EntryStatus> => {
      try {
        const text = await fs.readFile(path.join(dir, name), "utf8");
        const hasFrontmatter = /^---\n[\s\S]*?\nschema_version:\s*\d+\n[\s\S]*?\n---/.test(text);
        if (!hasFrontmatter) return "malformed";
        if (/^truncated:\s*true$/m.test(text)) return "truncated";
        return "ok";
      } catch {
        return "malformed";
      }
    })
  );

  const malformed = statuses.filter((s) => s === "malformed").length;
  const truncated = statuses.filter((s) => s === "truncated").length;
  return { written: entries.length, malformed, truncated };
}
