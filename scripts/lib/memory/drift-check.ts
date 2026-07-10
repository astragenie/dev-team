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
//
// FEAT-201: CLI entry point (--repo/--threshold[/--window-days]) so this
// diagnostic can actually be *run* — nothing invoked it before this. Gates on
// entries-only-in-JSONL count vs --threshold: exceeding it exits non-zero and
// emits a structured `memory_drift` event to `.claude/logs/events.jsonl` (own
// small emitter, deliberately NOT routed through
// scripts/lib/gepa/observability-events.ts — that sink is GEPA-event branded,
// see scripts/e2e-smoke.ts's logSmokeEvent for the same call). Astramem being
// unreachable (unpaired) is treated as inconclusive, not a pass — exit 2, no
// event (nothing to reconcile ids for).
import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
// eslint-disable-next-line import/no-unresolved -- allowJs JSDoc-typed sibling module (see scripts/lib/jsonl.mjs)
import { tailReadJsonl } from "../jsonl.mjs";
import {
  normalizeLegacyRow,
  resolveAstramemRemote,
  type MemoryEntry,
  type RemoteHandle
} from "@astragenie/memory-provider";
import { LEARNINGS_PATH } from "./capture-learning.ts";

const EVENTS_LOG_REL = [".claude", "logs", "events.jsonl"] as const;

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

// ---------------------------------------------------------------------------
// CLI (FEAT-201)
// ---------------------------------------------------------------------------

export interface DriftCheckCliOptions {
  repo: string;
  threshold: number;
  windowDays?: number;
}

function parseThreshold(raw: string | undefined): number {
  const parsed = raw !== undefined ? Number(raw) : Number.NaN;
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`--threshold must be a non-negative number, got: ${String(raw)}`);
  }
  return parsed;
}

function parseWindowDays(raw: string | undefined): number {
  const parsed = raw !== undefined ? Number(raw) : Number.NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`--window-days must be a positive number, got: ${String(raw)}`);
  }
  return parsed;
}

export function parseDriftCheckArgs(argv: string[]): DriftCheckCliOptions {
  let repo = process.cwd();
  let threshold = 0;
  let windowDays: number | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--repo") {
      repo = argv[++i] ?? repo;
    } else if (a === "--threshold") {
      threshold = parseThreshold(argv[++i]);
    } else if (a === "--window-days") {
      windowDays = parseWindowDays(argv[++i]);
    }
  }
  return { repo, threshold, ...(windowDays !== undefined ? { windowDays } : {}) };
}

/**
 * Emits the `memory_drift` event (AC-4: carries count + ids of entries
 * missing from the SoT so an operator can reconcile). Never throws — mirrors
 * emitGepaEvent's contract (scripts/lib/gepa/observability-events.ts) even
 * though this is a deliberately separate, non-GEPA-branded sink.
 */
function emitDriftEvent(repoPath: string, report: DriftReport, threshold: number): void {
  try {
    const logPath = path.join(repoPath, ...EVENTS_LOG_REL);
    mkdirSync(path.dirname(logPath), { recursive: true });
    const line = `${JSON.stringify({
      ts: new Date().toISOString(),
      event: "memory_drift",
      windowDays: report.windowDays,
      threshold,
      checked: report.checked,
      count: report.missingFromAstramem.length,
      ids: report.missingFromAstramem.map((entry) => entry.id)
    })}\n`;
    appendFileSync(logPath, line, { flag: "a" });
  } catch {
    // Event log write must never propagate — this is diagnostic telemetry.
  }
}

export interface DriftCheckCliResult {
  report: DriftReport | null;
  threshold: number;
  exitCode: number;
  /** Set only for the inconclusive (astramem unreachable) path. */
  reason?: string;
}

export interface DriftCheckCliOverrides {
  /**
   * Internal test seam (mirrors AstramemProviderOptions.__resolveRemote in
   * astramem-provider.ts). Overrides the default `resolveAstramemRemote()`
   * so tests can inject a pure in-memory fake `RemoteHandle` instead of
   * standing up a real astramem daemon. Never set by production callers.
   */
  __resolveRemote?: () => Promise<RemoteHandle | null>;
}

/**
 * CLI-runnable wrapper around checkDrift(). Exit codes:
 *   0 — no drift (missingFromAstramem.length <= threshold)
 *   1 — drift exceeds threshold (memory_drift event emitted)
 *   2 — astramem unreachable/unpaired; drift is inconclusive (no event —
 *       there is nothing confirmed-missing to reconcile ids for)
 */
export async function runDriftCheckCli(
  argv: string[],
  overrides: DriftCheckCliOverrides = {}
): Promise<DriftCheckCliResult> {
  const { repo, threshold, windowDays } = parseDriftCheckArgs(argv);
  const resolveRemote = overrides.__resolveRemote ?? resolveAstramemRemote;
  const remote = await resolveRemote();
  if (!remote) {
    return {
      report: null,
      threshold,
      exitCode: 2,
      reason: "astramem is not paired/reachable — drift cannot be verified this run"
    };
  }

  const report = await checkDrift(repo, remote, windowDays !== undefined ? { windowDays } : {});
  const driftCount = report.missingFromAstramem.length;
  if (driftCount > threshold) {
    emitDriftEvent(repo, report, threshold);
    return { report, threshold, exitCode: 1 };
  }
  return { report, threshold, exitCode: 0 };
}

// Run when invoked directly (not when imported by tests) — same isMain
// pattern as scripts/validate-backlog-drift.ts.
const isMain =
  import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("drift-check.ts");

if (isMain) {
  const { report, threshold, exitCode, reason } = await runDriftCheckCli(process.argv.slice(2));
  if (reason) {
    process.stdout.write(`memory-drift-check: ${reason}\n`);
  } else if (report) {
    const driftCount = report.missingFromAstramem.length;
    process.stdout.write(
      `memory-drift-check: checked ${report.checked} entr${report.checked === 1 ? "y" : "ies"} ` +
        `in the last ${report.windowDays}d window; ${driftCount} missing from astramem ` +
        `(threshold: ${threshold})\n`
    );
    if (driftCount > 0) {
      for (const entry of report.missingFromAstramem) {
        process.stdout.write(`  - ${entry.id}: ${entry.summary}\n`);
      }
    }
  }
  process.exit(exitCode);
}
