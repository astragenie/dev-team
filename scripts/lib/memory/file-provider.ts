// scripts/lib/memory/file-provider.ts — FEAT-188 S2
//
// JSONL-backed MemoryProvider. Writes go through capture-learning.ts's
// appendJsonlEntry() into the SAME .claude/artifacts/loop/learnings.jsonl
// store S1a's captureFailureLearning() already writes to — this is a
// consolidation, not a second JSONL writer. Reads go through
// tailReadJsonl() (scripts/lib/jsonl.mjs), which already implements
// torn/truncated-line discard on the byte-window boundary; normalizeLegacyRow
// discards anything else unrecognized (including a genuinely corrupt row).
import crypto from "node:crypto";
import path from "node:path";
// eslint-disable-next-line import/no-unresolved -- allowJs JSDoc-typed sibling module (see scripts/lib/jsonl.mjs)
import { tailReadJsonl } from "../jsonl.mjs";
import { appendJsonlEntry, LEARNINGS_PATH } from "./capture-learning.ts";
import { normalizeLegacyRow } from "./legacy-adapter.ts";
import { rankAndTruncate } from "./ranking.ts";
import { MemoryEntrySchema, type MemoryEntry, type MemoryEntryInput } from "./schema.ts";
import type { MemoryProvider, RecallQuery } from "./types.ts";

const DEFAULT_K = 5;
const DEFAULT_MAX_TOKENS = 800;
const MAX_SUMMARY_LENGTH = 280;
/**
 * S5 fix (S2 review MEDIUM note): tailReadJsonl's default byte window
 * (64KB) could silently drop entries older than the window in a large
 * store — a correctness bug once decay hygiene (ranking.ts) lets `critical`
 * entries survive indefinitely: a buried critical entry beyond the old 64KB
 * window would never reach rankAndTruncate at all, regardless of severity.
 * FULL_STORE_MAX_BYTES raises the window generously (16MB — several orders
 * of magnitude past any realistic learnings.jsonl size) so recall()
 * effectively performs full-file ranking. FULL_STORE_RECORD_CAP similarly
 * removes the record-count cap; `.slice(-count)` is safe even when `count`
 * exceeds the array length, so this is not a behavior change for small
 * stores, only a correctness fix for large ones.
 */
const FULL_STORE_MAX_BYTES = 16 * 1024 * 1024;
const FULL_STORE_RECORD_CAP = Number.MAX_SAFE_INTEGER;

const TOMBSTONE_MARKER = "__memory_invalidated__";

export interface FileProviderOptions {
  recall?: { k?: number; maxTokens?: number };
}

function toStoredEntry(input: MemoryEntryInput, supersedesOverride?: string): MemoryEntry {
  return MemoryEntrySchema.parse({
    id: input.id ?? crypto.randomUUID(),
    ts: input.ts ?? new Date().toISOString(),
    kind: input.kind,
    severity: input.severity,
    agent: input.agent ?? null,
    tags: input.tags ?? [],
    summary: input.summary.slice(0, MAX_SUMMARY_LENGTH),
    detail: input.detail,
    source: input.source,
    supersedes: supersedesOverride ?? input.supersedes
  });
}

export function fileProvider(repoPath: string, options: FileProviderOptions = {}): MemoryProvider {
  const defaultK = options.recall?.k ?? DEFAULT_K;
  const defaultMaxTokens = options.recall?.maxTokens ?? DEFAULT_MAX_TOKENS;

  async function readAllRaw(): Promise<Record<string, unknown>[]> {
    const targetPath = path.join(repoPath, ...LEARNINGS_PATH);
    return tailReadJsonl(targetPath, FULL_STORE_RECORD_CAP, { maxBytes: FULL_STORE_MAX_BYTES });
  }

  return {
    describe: () => ({ provider: "file" }),

    async capture(input: MemoryEntryInput): Promise<void> {
      await appendJsonlEntry(repoPath, LEARNINGS_PATH, toStoredEntry(input));
    },

    async recall(query: RecallQuery): Promise<MemoryEntry[]> {
      const raw = await readAllRaw();
      const invalidated = new Set<string>();
      const entries: MemoryEntry[] = [];

      raw.forEach((row, index) => {
        if (row && row[TOMBSTONE_MARKER] === true && typeof row.targetId === "string") {
          invalidated.add(row.targetId);
          return;
        }
        const normalized = normalizeLegacyRow(row, index);
        if (normalized) entries.push(normalized);
      });

      return rankAndTruncate(entries, invalidated, {
        ...(query.agent !== undefined ? { agent: query.agent } : {}),
        ...(query.tags !== undefined ? { tags: query.tags } : {}),
        k: query.k ?? defaultK,
        maxTokens: query.maxTokens ?? defaultMaxTokens
      });
    },

    async supersede(id: string, replacement: MemoryEntryInput): Promise<void> {
      await appendJsonlEntry(
        repoPath,
        LEARNINGS_PATH,
        toStoredEntry(replacement, replacement.supersedes ?? id)
      );
    },

    async invalidate(id: string): Promise<void> {
      await appendJsonlEntry(repoPath, LEARNINGS_PATH, {
        [TOMBSTONE_MARKER]: true,
        targetId: id,
        ts: new Date().toISOString()
      });
    }
  };
}
