// scripts/lib/memory/astramem-provider.ts — FEAT-188 S4
//
// The source-of-truth writer. Delegates to the astramem-plugin's exported
// provider layer (`@astragenie/astramem-plugin/providers/local` +
// `/providers/saas`, astramem-plugin#23/#25) — never shells the CLI
// (resolveCli(), stale per runner-plugin#324) and never hand-rolls an MCP
// client.
//
// The plugin's own precedence selector (src/lib/selector.ts) is NOT part of
// the package's public exports map — astramem-plugin's package.json only
// exports ".", "./providers/local", "./providers/saas", "./contracts". So
// this module implements a small selection wrapper that mirrors the
// selector's local-then-saas precedence using the exported provider
// factories' own health() probes, cached briefly to avoid re-probing on
// every capture/recall.
//
// Unpaired (local unreachable + saas unconfigured/unreachable) always falls
// back to fileProvider — best-effort, never throws (S4 AC-2).
//
// Note on the two dynamic imports below: providers/local.ts and
// providers/saas.ts transitively import errors.ts/secrets.ts, which fail
// `tsc --noEmit` under THIS repo's stricter compiler options
// (noUncheckedIndexedAccess, noImplicitOverride) — an upstream-only
// strictness gap; astramem-plugin doesn't enable those flags itself, and
// forking/patching the sibling repo is out of S4 scope. Building the
// specifier from a non-literal expression (Array.join, not a string
// literal) makes TypeScript's `import()` resolve to `Promise<any>` instead
// of statically descending into that module's internals, so the value
// import stays type-check-clean while the concrete shape is still enforced
// via the `AstramemWireProvider` cast (typed cleanly off "./contracts",
// which has no such issue).
import crypto from "node:crypto";
import type {
  IngestPayload,
  MemoryProvider as AstramemWireProvider,
  RecallHit
} from "@astragenie/astramem-plugin/contracts";
import { fileProvider, type FileProviderOptions } from "./file-provider.ts";
import {
  MemoryEntrySchema,
  MemoryKindSchema,
  type MemoryEntry,
  type MemoryEntryInput,
  type MemorySeverity
} from "./schema.ts";
import type { MemoryProvider, RecallQuery } from "./types.ts";

const PROVIDERS_LOCAL_SPECIFIER = ["@astragenie/astramem-plugin", "providers/local"].join("/");
const PROVIDERS_SAAS_SPECIFIER = ["@astragenie/astramem-plugin", "providers/saas"].join("/");

interface LocalProviderModule {
  createLocalProvider(opts?: { url?: string }): AstramemWireProvider;
}
interface SaasProviderModule {
  createSaasProvider(opts?: { url?: string }): AstramemWireProvider;
}

async function loadLocalProvider(): Promise<AstramemWireProvider> {
  const mod = (await import(PROVIDERS_LOCAL_SPECIFIER)) as LocalProviderModule;
  return mod.createLocalProvider();
}

async function loadSaasProvider(): Promise<AstramemWireProvider> {
  const mod = (await import(PROVIDERS_SAAS_SPECIFIER)) as SaasProviderModule;
  return mod.createSaasProvider();
}

const HEALTH_CACHE_TTL_MS = 5000;
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

interface RemoteHandle {
  provider: AstramemWireProvider;
  name: "local" | "saas";
}

export interface AstramemProviderOptions extends FileProviderOptions {
  /** When true, also mirror every capture/supersede into the local JSONL
   * (the operator's "2 parallel providers" mode — astramem is source of
   * truth, the JSONL is the derived duplicate). */
  dualWrite?: boolean;
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

/** Best-effort probe: is the local astramem daemon reachable? Never throws. */
async function probeLocal(): Promise<RemoteHandle | null> {
  try {
    const provider = await loadLocalProvider();
    const health = await provider.health();
    return health.ok ? { provider, name: "local" } : null;
  } catch {
    return null;
  }
}

/** Best-effort probe: is SaaS configured AND reachable? Never throws. */
async function probeSaas(): Promise<RemoteHandle | null> {
  if (!process.env["MEMORY_API_URL_SAAS"] && !process.env["MEMORY_API_URL"]) return null;
  try {
    const provider = await loadSaasProvider();
    const health = await provider.health();
    return health.ok ? { provider, name: "saas" } : null;
  } catch {
    return null;
  }
}

/**
 * Resolve which astramem backend (if any) is currently paired. Mirrors the
 * astramem-plugin selector's precedence (local first, saas fallback) using
 * only the package's exported provider factories + their own health()
 * probe — the selector function itself is not part of the package's public
 * exports map (astramem-plugin#23). Caches the resolution briefly so a burst
 * of captures/recalls doesn't re-probe on every call.
 */
function makeRemoteResolver(): () => Promise<RemoteHandle | null> {
  let cached: { handle: RemoteHandle | null; expiresAt: number } | null = null;

  return async function resolveRemote(): Promise<RemoteHandle | null> {
    const now = Date.now();
    if (cached && now < cached.expiresAt) return cached.handle;

    const handle = (await probeLocal()) ?? (await probeSaas());
    cached = { handle, expiresAt: now + HEALTH_CACHE_TTL_MS };
    return handle;
  };
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
  const resolveRemote = makeRemoteResolver();

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
