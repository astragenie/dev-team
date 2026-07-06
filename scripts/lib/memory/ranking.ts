// scripts/lib/memory/ranking.ts — FEAT-188 S2
//
// recall() ranking = recency x severity, with token-budget truncation and
// supersede-chain resolution. Token cost is an approximation (chars / 4,
// the common no-tokenizer heuristic) — no tokenizer dependency is justified
// for a coarse recall-block budget.
import type { MemoryEntry, MemorySeverity } from "./schema.ts";

const SEVERITY_WEIGHT: Record<MemorySeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

const CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / CHARS_PER_TOKEN));
}

export interface RankOptions {
  agent?: string;
  tags?: string[];
  k: number;
  maxTokens: number;
  now?: Date;
}

/** Ids that some other entry's `supersedes` field points at — the superseded half of a chain. */
function collectSupersededIds(entries: MemoryEntry[]): Set<string> {
  const superseded = new Set<string>();
  for (const entry of entries) {
    if (entry.supersedes) superseded.add(entry.supersedes);
  }
  return superseded;
}

function matchesScope(entry: MemoryEntry, opts: RankOptions): boolean {
  if (opts.agent && entry.agent && entry.agent !== opts.agent) return false;
  if (opts.tags && opts.tags.length > 0) {
    return entry.tags.some((tag) => opts.tags?.includes(tag));
  }
  return true;
}

function scoreEntry(entry: MemoryEntry, now: number): number {
  const ageMs = Math.max(0, now - Date.parse(entry.ts));
  const ageDays = ageMs / (24 * 60 * 60 * 1000);
  const recencyScore = 1 / (1 + ageDays);
  return SEVERITY_WEIGHT[entry.severity] * recencyScore;
}

/**
 * Rank entries by recency x severity, resolve supersede chains (only the
 * latest entry in a chain survives), exclude invalidated ids, then truncate
 * to `k` entries and a `maxTokens` budget.
 */
export function rankAndTruncate(
  entries: MemoryEntry[],
  invalidatedIds: Set<string>,
  opts: RankOptions
): MemoryEntry[] {
  const supersededIds = collectSupersededIds(entries);
  const now = (opts.now ?? new Date()).getTime();

  const eligible = entries.filter(
    (entry) =>
      !supersededIds.has(entry.id) && !invalidatedIds.has(entry.id) && matchesScope(entry, opts)
  );

  const scored = eligible
    .map((entry) => ({ entry, score: scoreEntry(entry, now) }))
    .sort((a, b) => b.score - a.score || Date.parse(b.entry.ts) - Date.parse(a.entry.ts));

  const topK = scored.slice(0, opts.k).map((s) => s.entry);

  const truncated: MemoryEntry[] = [];
  let remainingBudget = opts.maxTokens;
  for (const entry of topK) {
    const cost = estimateTokens(entry.summary);
    if (cost > remainingBudget) break;
    truncated.push(entry);
    remainingBudget -= cost;
  }
  return truncated;
}
