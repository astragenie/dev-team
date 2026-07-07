// scripts/lib/memory/astramem-provider.ts — FEAT-188 S4
//
// The source-of-truth writer. Provider resolution is delegated to the
// shared `@astragenie/astramem-client` package's `resolveWireProvider()`
// (FEAT-188 unification, dev-team#172) — this module no longer hand-rolls
// dynamic imports of astramem-plugin's provider factories or its own
// local-then-saas health-probe/cache; that logic now lives once in
// astramem-client's src/resolve.ts and is shared verbatim with
// runner-plugin's memory-transport. Never shells the CLI (resolveCli(),
// stale per runner-plugin#324) and never hand-rolls an MCP client.
//
// Unpaired (resolveWireProvider() resolves null) always falls back to
// fileProvider — best-effort, never throws (S4 AC-2).
import crypto from "node:crypto";
import { resolveWireProvider, type WireProvider } from "@astragenie/astramem-client";
import type { IngestPayload, RecallHit } from "@astragenie/astramem-plugin/contracts";
import { fileProvider, type FileProviderOptions } from "./file-provider.ts";
import {
  MemoryEntrySchema,
  MemoryKindSchema,
  type MemoryEntry,
  type MemoryEntryInput,
  type MemorySeverity
} from "./schema.ts";
import type { MemoryProvider, RecallQuery } from "./types.ts";

const MAX_SUMMARY_LENGTH = 280;
const DEFAULT_K = 5;
const DEFAULT_MAX_TOKENS = 800;
const CHARS_PER_TOKEN = 4;

const SEVERITY_TO_IMPORTANCE: Record<MemorySeverity, number> = {
  critical: 1,
  high: 0.75,
  medium: 0.5,
  low: 0.25
};

export interface RemoteHandle {
  provider: WireProvider;
  name: "local" | "saas";
}

export interface AstramemProviderOptions extends FileProviderOptions {
  /** When true, also mirror every capture/supersede into the local JSONL
   * (the operator's "2 parallel providers" mode — astramem is source of
   * truth, the JSONL is the derived duplicate). */
  dualWrite?: boolean;
  /**
   * Internal test seam (FEAT-188 S4 issue #170). Overrides the default
   * resolver (`defaultResolveRemote()`, wrapping astramem-client's
   * `resolveWireProvider()`) so tests can inject a pure in-memory fake
   * `RemoteHandle` instead of standing up a real `http.Server` daemon.
   * Never set by production callers — `resolveProvider()`/
   * `astramemProvider()` production paths never pass this.
   * Underscore-prefixed to signal "not part of the public contract."
   */
  __resolveRemote?: () => Promise<RemoteHandle | null>;
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

function toIngestPayload(entry: MemoryEntry): IngestPayload {
  return {
    id: entry.id,
    type: entry.kind,
    text: entry.summary,
    source: entry.source,
    importance: SEVERITY_TO_IMPORTANCE[entry.severity],
    metadata: {
      tags: entry.tags,
      ts: entry.ts,
      ...(entry.agent ? { agent: entry.agent } : {}),
      ...(entry.supersedes ? { supersedes: entry.supersedes } : {})
    }
  };
}

/**
 * Default remote resolver — wraps the shared astramem-client's
 * `resolveWireProvider()` (dep-mode selector → dep-mode local/saas probe →
 * runtime plugin-root discovery, cached for the process lifetime; see
 * astramem-client/src/resolve.ts) into this module's `RemoteHandle` shape.
 *
 * Compromise: the shared resolver deliberately does not report which
 * backend (local vs saas) it paired with — that distinction lived only in
 * this module's now-deleted local-then-saas probe, and folding it back in
 * would mean re-implementing the health probe this module just deleted.
 * `name` is therefore a best-effort "local" default; it is surfaced to
 * callers (e.g. the memory-drift-check CLI's `provider` field, S5) for
 * display purposes only — no code in this module or its callers branches
 * on it. Follow-up: ask astramem-client to expose the resolved backend
 * name if that distinction becomes load-bearing (see commit body).
 */
async function defaultResolveRemote(): Promise<RemoteHandle | null> {
  const provider = await resolveWireProvider();
  return provider ? { provider, name: "local" } : null;
}

/**
 * Public one-shot resolver — resolution of the paired astramem backend, if
 * any (subject to astramem-client's process-lifetime resolution cache).
 * Used by the S5 drift-check and available to any other one-shot caller
 * that needs a RemoteHandle without standing up a full astramemProvider.
 */
export async function resolveAstramemRemote(): Promise<RemoteHandle | null> {
  return defaultResolveRemote();
}

/**
 * Best-effort mapping of the astramem wire recall response into our
 * MemoryEntry shape. RecallHitSchema carries no timestamp or tags, so this
 * path ranks by the server-provided score alone — a degraded-fidelity
 * fallback used only for the paired + dualWrite:false case. dualWrite:true
 * (recommended) reads the local JSONL instead, which carries full recency x
 * severity ranking fidelity (see recall() below).
 */
function mapHitsToEntries(
  hits: RecallHit[],
  query: RecallQuery,
  defaultMaxTokens: number
): MemoryEntry[] {
  const k = query.k ?? DEFAULT_K;
  const maxTokens = query.maxTokens ?? defaultMaxTokens;
  const sorted = [...hits].sort((a, b) => b.score - a.score).slice(0, k);

  const entries: MemoryEntry[] = [];
  let remainingBudget = maxTokens;
  for (const hit of sorted) {
    const summary = hit.text.slice(0, MAX_SUMMARY_LENGTH);
    const cost = Math.max(1, Math.ceil(summary.length / CHARS_PER_TOKEN));
    if (cost > remainingBudget) break;
    remainingBudget -= cost;
    const kindResult = MemoryKindSchema.safeParse(hit.type);
    entries.push(
      MemoryEntrySchema.parse({
        id: hit.id,
        ts: new Date().toISOString(),
        kind: kindResult.success ? kindResult.data : "lesson",
        severity: "medium",
        tags: [],
        summary,
        source: hit.source ?? "astramem"
      })
    );
  }
  return entries;
}

/**
 * astramemProvider — the FEAT-188 source-of-truth writer. Paired: writes go
 * to astramem via remember() (fire-and-forget, best-effort). Unpaired:
 * transparently falls back to fileProvider so capture/recall never throw
 * and never silently drop data.
 */
export function astramemProvider(
  repoPath: string,
  options: AstramemProviderOptions = {}
): MemoryProvider {
  const dualWrite = options.dualWrite ?? false;
  const defaultMaxTokens = options.recall?.maxTokens ?? DEFAULT_MAX_TOKENS;
  const fallback = fileProvider(repoPath, options.recall ? { recall: options.recall } : {});
  const resolveRemote = options.__resolveRemote ?? defaultResolveRemote;

  async function writeThrough(entry: MemoryEntryInput, supersedesOverride?: string): Promise<void> {
    const stored = toStoredEntry(entry, supersedesOverride);
    const remote = await resolveRemote();

    if (!remote) {
      // Unpaired -> fall back to file entirely (best-effort, never throw).
      await fallback.capture(stored).catch(() => {
        /* fire-and-forget: never propagate */
      });
      return;
    }

    // Paired: astramem is the primary write. Fire-and-forget — errors are
    // absorbed here, never propagated to the caller (capture() contract).
    void remote.provider.remember(toIngestPayload(stored)).catch(() => {
      /* fire-and-forget: never propagate */
    });

    if (dualWrite) {
      await fallback.capture(stored).catch(() => {
        /* fire-and-forget: never propagate */
      });
    }
  }

  return {
    describe: () => ({ provider: "astramem" }),

    async capture(entry: MemoryEntryInput): Promise<void> {
      await writeThrough(entry);
    },

    async recall(query: RecallQuery): Promise<MemoryEntry[]> {
      const remote = await resolveRemote();

      if (!remote || dualWrite) {
        // Unpaired, or dualWrite:true — the local JSONL is either the only
        // copy (unpaired) or the ranking-complete derived duplicate
        // (dualWrite) — always read from there for full ranking fidelity
        // and contract parity with fileProvider.
        return fallback.recall(query);
      }

      // Paired + dualWrite:false — no local duplicate exists; read straight
      // from astramem (degraded-fidelity passthrough — see mapHitsToEntries).
      try {
        const q = query.tags?.join(" ") || query.agent || "recent";
        const res = await remote.provider.recall({
          query: q,
          k: query.k ?? DEFAULT_K,
          ...(query.agent ? { agent: query.agent } : {})
        });
        return mapHitsToEntries(res.hits, query, defaultMaxTokens);
      } catch {
        // Best-effort: never throw from recall().
        return [];
      }
    },

    async supersede(id: string, replacement: MemoryEntryInput): Promise<void> {
      await writeThrough(replacement, replacement.supersedes ?? id);
    },

    async invalidate(id: string): Promise<void> {
      // No wire-level tombstone concept in astramem's remember()/IngestPayload
      // contract — the supersede/invalidate chain is dev-team-side ranking
      // state (rankAndTruncate), which only ever operates over the local
      // JSONL. So invalidate always targets the fallback store, regardless
      // of dualWrite; harmless no-op if the id was never mirrored locally.
      await fallback.invalidate(id).catch(() => {
        /* fire-and-forget: never propagate */
      });
    }
  };
}
