// Fleet view: reads .claude/state/crew/slice-progress.md from sibling
// worktrees/repos and renders a one-pane summary. Keeps the one-way
// dependency clean — reads only the filesystem artifact; never imports
// loop code.

import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import { readFileIfExists } from "./fs-utils.mjs";

export interface FleetItem {
  repoName: string;
  progressPath?: string;
  isSelf?: boolean;
  inProgressSlice?: string | null;
  inProgressTitle?: string | null;
  completedCount?: number | null;
  totalCount?: number | null;
  updatedAt?: string | null;
  error?: string;
}

interface SliceProgressResult {
  repoName: string;
  inProgressSlice: string | null;
  inProgressTitle: string | null;
  completedCount: number | null;
  totalCount: number | null;
  updatedAt: string | null;
}

interface FoundEntry {
  repoName: string;
  progressPath: string;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

// Extract the updated-at, progress counts, and in-progress slice from
// a single pass over the lines of a slice-progress.md file.
function extractProgressFields(lines: string[]): {
  updatedAt: string | null;
  completedCount: number | null;
  totalCount: number | null;
  inProgressSlice: string | null;
  inProgressTitle: string | null;
} {
  let updatedAt: string | null = null;
  let completedCount: number | null = null;
  let totalCount: number | null = null;
  let inProgressSlice: string | null = null;
  let inProgressTitle: string | null = null;

  for (const line of lines) {
    const updatedMatch = line.match(/^Updated:\s+(.+)$/);
    if (updatedMatch) {
      updatedAt = (updatedMatch[1] ?? "").trim();
      continue;
    }

    const progressMatch = line.match(/^Progress:\s+(\d+)\/(\d+)\s+completed/);
    if (progressMatch) {
      completedCount = Number(progressMatch[1] ?? "0");
      totalCount = Number(progressMatch[2] ?? "0");
      continue;
    }

    const parsed = parseInProgressLine(line);
    if (parsed) {
      inProgressSlice = parsed.slice;
      inProgressTitle = parsed.title;
    }
  }

  return { updatedAt, completedCount, totalCount, inProgressSlice, inProgressTitle };
}

// Lines like: `- SLICE-18 — Title — **IN_PROGRESS** — `path``
function parseInProgressLine(line: string): { slice: string; title: string } | null {
  const m = line.match(/^-\s+(SLICE-\d+)\s*[—–-]+\s*(.+?)\s*[—–-]+\s*\*\*IN_PROGRESS\*\*/);
  if (!m) return null;
  return { slice: m[1] ?? "", title: (m[2] ?? "").trim() };
}

// Parse a slice-progress.md file into a SliceProgressResult. All fields
// are best-effort: missing sections return null so the fleet view degrades
// gracefully.
function parseSliceProgress(text: string, repoName: string): SliceProgressResult {
  const lines = text.split(/\r?\n/);
  const { updatedAt, completedCount, totalCount, inProgressSlice, inProgressTitle } =
    extractProgressFields(lines);
  return { repoName, inProgressSlice, inProgressTitle, completedCount, totalCount, updatedAt };
}

// Find all slice-progress.md files under the given scan roots.
// Each entry in roots is searched one level deep (immediate subdirs).
async function findSliceProgressFiles(roots: string[]): Promise<FoundEntry[]> {
  const found: FoundEntry[] = [];
  for (const root of roots) {
    if (!(await pathExists(root))) continue;
    let entries: Dirent[];
    try {
      entries = await fs.readdir(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const candidate = path.join(
        root,
        entry.name,
        ".claude",
        "state",
        "crew",
        "slice-progress.md"
      );
      if (await pathExists(candidate)) {
        found.push({ repoName: entry.name, progressPath: candidate });
      }
    }
  }
  return found;
}

// Read and parse a single progress file, returning a FleetItem.
async function loadProgressItem(
  repoName: string,
  progressPath: string,
  isSelf: boolean
): Promise<FleetItem> {
  try {
    const text = await fs.readFile(progressPath, "utf8");
    return { ...parseSliceProgress(text, repoName), progressPath, isSelf };
  } catch {
    return { repoName, progressPath, isSelf, error: "unreadable" };
  }
}

// Deduplicate found entries and load each into a FleetItem, respecting
// the includeSelf flag and filtering out already-seen paths.
async function deduplicateAndLoad(
  found: FoundEntry[],
  selfProgress: string,
  includeSelf: boolean
): Promise<{ items: FleetItem[]; seen: Set<string> }> {
  const seen = new Set<string>();
  const items: FleetItem[] = [];

  for (const { repoName, progressPath } of found) {
    const resolved = path.resolve(progressPath);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    const isSelf = resolved === path.resolve(selfProgress);
    if (isSelf && !includeSelf) continue;
    items.push(await loadProgressItem(repoName, resolved, isSelf));
  }

  return { items, seen };
}

// Collect fleet data from slice-progress.md files found in sibling repos
// relative to rootDir (defaults to parent of the current repo).
// If includeSelf is true (the default), also includes the currentRepoPath itself.
export async function collectFleetWorktrees(
  currentRepoPath: string,
  { extraRoots = [], includeSelf = true }: { extraRoots?: string[]; includeSelf?: boolean } = {}
): Promise<FleetItem[]> {
  const parent = path.dirname(currentRepoPath);
  const scanRoots = [parent, ...extraRoots.map((r) => path.resolve(r))];

  const found = await findSliceProgressFiles(scanRoots);
  const selfProgress = path.join(currentRepoPath, ".claude", "state", "crew", "slice-progress.md");

  const { items, seen } = await deduplicateAndLoad(found, selfProgress, includeSelf);

  // Always include self if includeSelf and self wasn't found via sibling scan.
  if (includeSelf && !seen.has(path.resolve(selfProgress))) {
    const text = await readFileIfExists(selfProgress);
    if (text !== null) {
      const selfName = path.basename(currentRepoPath);
      items.push({
        ...parseSliceProgress(text, selfName),
        progressPath: path.resolve(selfProgress),
        isSelf: true
      });
    }
  }

  return items.sort((a, b) => a.repoName.localeCompare(b.repoName));
}

function formatAge(isoString: string | null | undefined): string {
  if (!isoString) return "unknown";
  const ms = Date.now() - new Date(isoString).getTime();
  if (isNaN(ms) || ms < 0) return "just now";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Render one row of the fleet table for an item with an error.
function renderErrorRow(item: FleetItem): string {
  return `| ${item.repoName}${item.isSelf ? " *(this)*" : ""} | _(unreadable)_ | — | — |`;
}

// Render one row of the fleet table for a normal item.
function renderItemRow(item: FleetItem): string {
  const sliceCol = item.inProgressSlice
    ? `**${item.inProgressSlice}** — ${item.inProgressTitle ?? ""}`
    : "_(idle)_";
  const progressCol =
    item.completedCount != null && item.totalCount != null
      ? `${item.completedCount}/${item.totalCount}`
      : "—";
  const ageCol = formatAge(item.updatedAt);
  const nameCol = item.isSelf ? `${item.repoName} *(this)*` : item.repoName;
  return `| ${nameCol} | ${sliceCol} | ${progressCol} | ${ageCol} |`;
}

// Render the fleet data as a markdown one-pane summary.
export function renderFleet(items: FleetItem[]): string {
  if (items.length === 0) {
    return "# Fleet\n\n_(no active loops found — no sibling repos with `.claude/state/crew/slice-progress.md`)_\n";
  }

  const now = new Date().toISOString();
  const lines = [
    "# Fleet",
    "",
    `Generated: ${now}`,
    "",
    `| Repo | In Progress | Progress | Updated |`,
    `|------|------------|----------|---------|`
  ];

  for (const item of items) {
    lines.push(item.error ? renderErrorRow(item) : renderItemRow(item));
  }

  lines.push("");
  return lines.join("\n");
}

// Top-level function: collect + render + return both raw data and markdown.
export async function buildFleetReport(
  currentRepoPath: string,
  { extraRoots = [], includeSelf = true }: { extraRoots?: string[]; includeSelf?: boolean } = {}
): Promise<{ items: FleetItem[]; markdown: string }> {
  const items = await collectFleetWorktrees(currentRepoPath, { extraRoots, includeSelf });
  const markdown = renderFleet(items);
  return { items, markdown };
}
