// Fleet view: reads .claude/state/crew/slice-progress.md from sibling
// worktrees/repos and renders a one-pane summary. Keeps the one-way
// dependency clean — reads only the filesystem artifact; never imports
// loop code.

import fs from "node:fs/promises";
import path from "node:path";

/** @param {string} p */
async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

// Parse a slice-progress.md file into { repoName, inProgressSlice,
// completedCount, totalCount, updatedAt }. All fields are best-effort:
// missing sections return null so the fleet view degrades gracefully.
/** @param {string} text @param {string} repoName */
function parseSliceProgress(text, repoName) {
  const lines = text.split(/\r?\n/);
  let updatedAt = null;
  let completedCount = null;
  let totalCount = null;
  let inProgressSlice = null;
  let inProgressTitle = null;

  for (const line of lines) {
    const updatedMatch = line.match(/^Updated:\s+(.+)$/);
    if (updatedMatch) {
      updatedAt = updatedMatch[1].trim();
      continue;
    }

    const progressMatch = line.match(/^Progress:\s+(\d+)\/(\d+)\s+completed/);
    if (progressMatch) {
      completedCount = Number(progressMatch[1]);
      totalCount = Number(progressMatch[2]);
      continue;
    }

    // Lines like: `- SLICE-18 — Title — **IN_PROGRESS** — `path``
    const inProgressMatch = line.match(
      /^-\s+(SLICE-\d+)\s*[—–-]+\s*(.+?)\s*[—–-]+\s*\*\*IN_PROGRESS\*\*/
    );
    if (inProgressMatch) {
      inProgressSlice = inProgressMatch[1];
      inProgressTitle = inProgressMatch[2].trim();
    }
  }

  return { repoName, inProgressSlice, inProgressTitle, completedCount, totalCount, updatedAt };
}

// Find all slice-progress.md files under the given scan roots.
// Each entry in roots is searched one level deep (immediate subdirs).
/** @param {string[]} roots */
async function findSliceProgressFiles(roots) {
  const found = [];
  for (const root of roots) {
    if (!(await pathExists(root))) continue;
    let entries;
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

// Collect fleet data from slice-progress.md files found in sibling repos
// relative to rootDir (defaults to parent of the current repo).
// If --include-self is set, also includes the currentRepoPath itself.
/** @param {string} currentRepoPath @param {{ extraRoots?: string[], includeSelf?: boolean }} [opts] */
export async function collectFleetWorktrees(
  currentRepoPath,
  { extraRoots = [], includeSelf = true } = {}
) {
  const parent = path.dirname(currentRepoPath);
  const scanRoots = [parent, ...extraRoots.map((r) => path.resolve(r))];

  const found = await findSliceProgressFiles(scanRoots);

  // Deduplicate by progressPath and filter out the current repo's own file
  // if includeSelf is false, or ensure it's included exactly once.
  const seen = new Set();
  const items = [];
  const selfProgress = path.join(currentRepoPath, ".claude", "state", "crew", "slice-progress.md");

  for (const { repoName, progressPath } of found) {
    const resolved = path.resolve(progressPath);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    const isSelf = resolved === path.resolve(selfProgress);
    if (isSelf && !includeSelf) continue;
    try {
      const text = await fs.readFile(progressPath, "utf8");
      items.push({ ...parseSliceProgress(text, repoName), progressPath: resolved, isSelf });
    } catch {
      items.push({ repoName, progressPath: resolved, isSelf, error: "unreadable" });
    }
  }

  // Always include self if includeSelf and self wasn't found via sibling scan.
  if (includeSelf && !seen.has(path.resolve(selfProgress))) {
    if (await pathExists(selfProgress)) {
      try {
        const text = await fs.readFile(selfProgress, "utf8");
        const selfName = path.basename(currentRepoPath);
        items.push({
          ...parseSliceProgress(text, selfName),
          progressPath: path.resolve(selfProgress),
          isSelf: true
        });
      } catch {
        // best-effort
      }
    }
  }

  return items.sort((a, b) => a.repoName.localeCompare(b.repoName));
}

/** @param {string | null} isoString */
function formatAge(isoString) {
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

// Render the fleet data as a markdown one-pane summary.
/** @param {any[]} items */
export function renderFleet(items) {
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
    if (item.error) {
      lines.push(`| ${item.repoName}${item.isSelf ? " *(this)*" : ""} | _(unreadable)_ | — | — |`);
      continue;
    }
    const sliceCol = item.inProgressSlice
      ? `**${item.inProgressSlice}** — ${item.inProgressTitle || ""}`
      : "_(idle)_";
    const progressCol =
      item.completedCount != null && item.totalCount != null
        ? `${item.completedCount}/${item.totalCount}`
        : "—";
    const ageCol = formatAge(item.updatedAt);
    const nameCol = item.isSelf ? `${item.repoName} *(this)*` : item.repoName;
    lines.push(`| ${nameCol} | ${sliceCol} | ${progressCol} | ${ageCol} |`);
  }

  lines.push("");
  return lines.join("\n");
}

// Top-level function: collect + render + return both raw data and markdown.
/** @param {string} currentRepoPath @param {{ extraRoots?: string[], includeSelf?: boolean }} [opts] */
export async function buildFleetReport(
  currentRepoPath,
  { extraRoots = [], includeSelf = true } = {}
) {
  const items = await collectFleetWorktrees(currentRepoPath, { extraRoots, includeSelf });
  const markdown = renderFleet(items);
  return { items, markdown };
}
