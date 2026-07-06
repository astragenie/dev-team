// scripts/lib/memory/types.ts — FEAT-188 S2
//
// The provider-swap interface every backend (noop | file | astramem) must
// implement. Mirrors the gepa-core TrialStore pattern this FEAT is modeled
// on: capture() is fire-and-forget, recall() is ranked + budget-truncated,
// supersede()/invalidate() manage the append-only entry lifecycle.
import type { MemoryEntry, MemoryEntryInput } from "./schema.ts";

export interface RecallQuery {
  /** Scope results to one agent (entries with no agent apply to everyone). */
  agent?: string;
  /** Scope results to entries carrying at least one of these tags. */
  tags?: string[];
  /** Max number of entries to return before token-budget truncation. Default 5. */
  k?: number;
  /** Token budget for the returned entry set. Default 800. */
  maxTokens?: number;
}

export interface MemoryProvider {
  describe(): { provider: "noop" | "file" | "astramem" };
  /** Fire-and-forget: implementations must never throw into the caller. */
  capture(entry: MemoryEntryInput): Promise<void>;
  /** Ranked recency x severity, token-budget truncated, supersede/invalidate resolved. */
  recall(query: RecallQuery): Promise<MemoryEntry[]>;
  /** Records `replacement` as the entry that supersedes `id`. */
  supersede(id: string, replacement: MemoryEntryInput): Promise<void>;
  /** Marks `id` as invalidated — never returned by recall() again. */
  invalidate(id: string): Promise<void>;
}
