// scripts/lib/memory/drift-check.ts — FEAT-188 S5 (S4 accepted-risk follow-up)
//
// astramem writes are fire-and-forget (astramem-provider.ts's writeThrough():
// errors are logged/swallowed, never propagated) while the local JSONL
// append is synchronous/atomic. So a silent astramem failure can leave the
// "derived duplicate" (JSONL) MORE complete than the "source of truth"
// (astramem) — an accepted best-effort-MVP risk documented on S4.
//
// This module is the read-only diagnostic S5 promised: it compares JSONL
// entries captured within a recency window against astramem's recall()
// results and reports which local entries could not be confirmed present
// remotely, so an operator can reconcile the source of truth. It NEVER
// writes to astramem — backfill/reconciliation is a deliberate follow-up
// action, not something this slice auto-applies.
import path from "node:path";
// eslint-disable-next-line import/no-unresolved -- allowJs JSDoc-typed sibling module (see scripts/lib/jsonl.mjs)
import { tailReadJsonl } from "../jsonl.mjs";
import type { RemoteHandle } from "./astramem-provider.ts";
import { LEARNINGS_PATH } from "./capture-learning.ts";
import { normalizeLegacyRow } from "./legacy-adapter.ts";
import type { MemoryEntry } from "./schema.ts";

const DEFAULT_WINDOW_DAYS = 45;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Mirrors file-provider.ts's full-store read window (S5 tail-window fix). */
const FULL_STORE_MAX_BYTES = 16 * 1024 * 1024;
const FULL_STORE_RECORD_CAP = Number.MAX_SAFE_INTEGER;
/** How many hits to inspect per presence check — generous, cheap relative to the network round trip it's already paying for. */
const PRESENCE_CHECK_K = 10;

export interface DriftReport {
  windowDays: number;
  /** Number of local JSONL entries considered (within the window). */
  checked: number;
  /** Entries present locally that could not be confirmed present in astramem. */
  missingFromAstramem: MemoryEntry[];
}

export interface DriftCheckOptions {
  windowDays?: number;
  now?: Date;
}

async function readEntriesInWindow(
  repoPath: string,
  windowDays: number,
  now: number
): Promise<MemoryEntry[]> {
  const targetPath = path.join(repoPath, ...LEARNINGS_PATH);
  const raw = await tailReadJsonl(targetPath, FULL_STORE_RECORD_CAP, {
    maxBytes: FULL_STORE_MAX_BYTES
  });
  const cutoff = now - windowDays * MS_PER_DAY;

  const entries: MemoryEntry[] = [];
  raw.forEach((row, index) => {
    const normalized = normalizeLegacyRow(row, index);
    if (normalized && Date.parse(normalized.ts) >= cutoff) entries.push(normalized);
  });
  return entries;
}

/**
 * Best-effort presence check: queries astramem's recall() with the entry's
 * own summary as the query and looks for the entry's id among the top hits.
 * This is an APPROXIMATION — astramem's recall() is semantic similarity, not
 * an exact id lookup — so it is a candidate-drift signal for operator review,
 * not an authoritative reconciliation. A recall() error is itself treated as
 * "not confirmed present" (fail closed toward surfacing drift, not hiding it).
 */
async function isPresentInAstramem(remote: RemoteHandle, entry: MemoryEntry): Promise<boolean> {
  try {
    const res = await remote.provider.recall({ query: entry.summary, k: PRESENCE_CHECK_K });
    return res.hits.some((hit) => hit.id === entry.id);
  } catch {
    return false;
  }
}

/**
 * Read-only drift diagnostic: compares JSONL entries captured within
 * `windowDays` (default 45 — same window as decay hygiene, ranking.ts)
 * against astramem's recall() results and reports which local entries could
 * not be confirmed present remotely. Never writes to astramem.
 */
export async function checkDrift(
  repoPath: string,
  remote: RemoteHandle,
  options: DriftCheckOptions = {}
): Promise<DriftReport> {
  const windowDays = options.windowDays ?? DEFAULT_WINDOW_DAYS;
  const now = (options.now ?? new Date()).getTime();
  const entries = await readEntriesInWindow(repoPath, windowDays, now);

  const missingFromAstramem: MemoryEntry[] = [];
  for (const entry of entries) {
    const present = await isPresentInAstramem(remote, entry);
    if (!present) missingFromAstramem.push(entry);
  }

  return { windowDays, checked: entries.length, missingFromAstramem };
}
