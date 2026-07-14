// scripts/lib/memory/injected-atoms.ts — per-run record of atom ids injected
// into a dispatch, so the feedback step (Task 5) can attribute usefulness.
// Machine-local/ignored (.claude/state/): ephemeral, not durable history.
// Fire-and-forget: never throws.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

function sidecarPath(repoPath: string, runId: string): string {
  const safe = runId.replace(/[^A-Za-z0-9._-]/g, "_");
  return path.join(repoPath, ".claude", "state", "crew", "injected-atoms", `${safe}.json`);
}

export async function writeInjectedAtoms(repoPath: string, runId: string, ids: string[]): Promise<void> {
  try {
    const target = sidecarPath(repoPath, runId);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, JSON.stringify({ runId, ids }), "utf8");
  } catch { /* fire-and-forget */ }
}

export async function readInjectedAtoms(repoPath: string, runId: string): Promise<string[]> {
  try {
    const parsed = JSON.parse(await readFile(sidecarPath(repoPath, runId), "utf8")) as { ids?: unknown };
    return Array.isArray(parsed.ids) ? parsed.ids.filter((x): x is string => typeof x === "string") : [];
  } catch { return []; }
}
