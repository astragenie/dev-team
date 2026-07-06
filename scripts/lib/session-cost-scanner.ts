// Session scanning helpers extracted from session-cost.mjs.
// I/O layer — pure computation lives in ./session-cost-scanner/compute.ts.

import readline from "node:readline";
import { createReadStream } from "node:fs";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";

import {
  emptyTotals,
  handleAssistantTurn,
  handleUserTurn
} from "./session-cost-scanner/compute.ts";

import type {
  ScanCtx,
  JsonlLine,
  CachePrimeEntry,
  SourceEntry
} from "./session-cost-scanner/compute.ts";

export type {
  CachePrimeEntry,
  Counters,
  Flags,
  CachePrimeState,
  SourceEntry,
  ScanCtx,
  JsonlLine
} from "./session-cost-scanner/compute.ts";

export {
  addTotals,
  percentile,
  approxSize,
  inspectContent,
  recordTokenUsage,
  recordToolUse,
  attributeCachePrime,
  isSyntheticModel,
  handleAssistantTurn,
  handleUserTurn,
  tokensFromUsage,
  TOOL_COUNTERS,
  SYNTHETIC_MODEL_PREFIXES
} from "./session-cost-scanner/compute.ts";

// Resolve the user's home directory, honoring an explicitly-set HOME / USERPROFILE
// env var BEFORE falling back to os.homedir(). This matters because runtimes
// disagree: Bun-on-Linux's os.homedir() reads the passwd/uid database and ignores
// a reassigned $HOME, whereas Node and Bun-on-Windows honor the env var. Preferring
// the env var makes the fallback path deterministic across runtimes (and testable
// via a temp-dir HOME override). For real runs where the env var matches the OS home
// this is a no-op.
function resolveHomeDir(): string {
  const fromEnv = process.env.HOME || process.env.USERPROFILE;
  return fromEnv && fromEnv.trim() ? fromEnv : os.homedir();
}

export function getProjectsRoot(): string {
  const override = process.env.CREW_PROJECTS_ROOT;
  return override ? path.resolve(override) : path.join(resolveHomeDir(), ".claude", "projects");
}

export async function* readJsonlLines(file: string): AsyncGenerator<JsonlLine> {
  const stream = createReadStream(file, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    try {
      yield JSON.parse(line) as JsonlLine;
    } catch {
      // skip malformed lines
    }
  }
}

// Iterates project dir subdirectories. Filters non-dir entries up-front.
async function listProjectDirEntries(): Promise<string[]> {
  try {
    const entries = await fs.readdir(getProjectsRoot(), { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

// Lists .jsonl files in a single project dir, or empty array on any error.
async function listJsonlInDir(dir: string): Promise<string[]> {
  try {
    return (await fs.readdir(dir)).filter((f) => f.endsWith(".jsonl"));
  } catch {
    return [];
  }
}

function isAssistantTurnInWindow(
  obj: { type?: string; timestamp?: string; message?: { usage?: unknown } } | null | undefined,
  startMs: number,
  endMs: number
): boolean {
  if (obj?.type !== "assistant") return false;
  if (!obj?.message?.usage) return false;
  const tsMs = obj.timestamp ? Date.parse(obj.timestamp) : NaN;
  if (Number.isNaN(tsMs)) return false;
  return tsMs >= startMs && tsMs <= endMs;
}

// Counts assistant turns with billable usage inside [startMs, endMs] across
// every .jsonl file in `dir`.
async function countInWindowAssistantTurns(
  dir: string,
  startMs: number,
  endMs: number
): Promise<number> {
  const files = await listJsonlInDir(dir);
  let count = 0;
  for (const f of files) {
    const full = path.join(dir, f);
    for await (const obj of readJsonlLines(full)) {
      if (isAssistantTurnInWindow(obj, startMs, endMs)) count += 1;
    }
  }
  return count;
}

// Build a list of project dirs that have at least one in-window assistant
// turn. Used by aggregateAll mode to scope summation to relevant dirs only
// (skips unrelated ambient sessions).
export async function listActiveProjectDirs({
  startMs,
  endMs
}: {
  startMs: number;
  endMs: number;
}): Promise<Array<{ slug: string; dir: string }>> {
  const slugs = await listProjectDirEntries();
  const active: Array<{ slug: string; dir: string }> = [];
  for (const slug of slugs) {
    const dir = path.join(getProjectsRoot(), slug);
    const count = await countInWindowAssistantTurns(dir, startMs, endMs);
    if (count > 0) active.push({ slug, dir });
  }
  return active;
}

export interface ResolveScanSourcesInput {
  aggregateAll: boolean;
  sourceProject: string | null;
  autoDetect: boolean;
  repoPath: string;
  startedAt: string;
  endIso: string;
  startMs: number;
  endMs: number;
  slugifyRepoPath: (p: string) => string;
  listProjectSessions: (repoPath: string, slug: string | null) => Promise<string[]>;
  autoDetectSourceProject: (opts: {
    startedAt: string;
    completedAt: string;
  }) => Promise<string | null>;
}

export interface ResolveScanSourcesResult {
  sessionsBySource: Map<string, string[]>;
  effectiveSlug: string;
  autoDetected: boolean;
}

// Decides which `~/.claude/projects/<slug>/` directories to scan.
// Three modes:
//   - aggregateAll: every project dir with in-window activity.
//   - explicit sourceProject: scan only that dir.
//   - default: scan the repo-derived dir; if empty + autoDetect enabled,
//     fall back to the busiest in-window project.
export async function resolveScanSources({
  aggregateAll,
  sourceProject,
  autoDetect,
  repoPath,
  startedAt,
  endIso,
  startMs,
  endMs,
  slugifyRepoPath,
  listProjectSessions,
  autoDetectSourceProject
}: ResolveScanSourcesInput): Promise<ResolveScanSourcesResult> {
  const sessionsBySource = new Map<string, string[]>();
  let effectiveSlug = sourceProject || slugifyRepoPath(repoPath);
  let autoDetected = false;

  if (aggregateAll) {
    const active = await listActiveProjectDirs({ startMs, endMs });
    for (const { slug, dir } of active) {
      const files = (await fs.readdir(dir))
        .filter((f) => f.endsWith(".jsonl"))
        .map((f) => path.join(dir, f));
      sessionsBySource.set(slug, files);
    }
    return { sessionsBySource, effectiveSlug: "aggregate", autoDetected };
  }

  let initialFiles = await listProjectSessions(repoPath, effectiveSlug);
  if (!sourceProject && autoDetect) {
    const hasActivity = await sessionsHaveInWindowAssistantTurns(initialFiles, startMs, endMs);
    if (!hasActivity) {
      const detected = await autoDetectSourceProject({ startedAt, completedAt: endIso });
      if (detected && detected !== effectiveSlug) {
        effectiveSlug = detected;
        initialFiles = await listProjectSessions(repoPath, effectiveSlug);
        autoDetected = true;
      }
    }
  }
  sessionsBySource.set(effectiveSlug, initialFiles);
  return { sessionsBySource, effectiveSlug, autoDetected };
}

// True iff any .jsonl session file has at least one assistant turn with
// usage data inside [startMs, endMs]. Short-circuits as soon as one match
// is found.
export async function sessionsHaveInWindowAssistantTurns(
  files: string[],
  startMs: number,
  endMs: number
): Promise<boolean> {
  for (const file of files) {
    for await (const obj of readJsonlLines(file)) {
      if (isAssistantTurnInWindow(obj, startMs, endMs)) return true;
    }
  }
  return false;
}

export interface ScanSessionsInput {
  sessions: string[];
  fileToSlug: Map<string, string>;
  startMs: number;
  endMs: number;
}

export interface ScanSessionsResult {
  totals: Record<string, number>;
  byModel: Record<
    string,
    { tokens: Record<string, number>; usd: number; messages: number; pricedAs?: string }
  >;
  messagesCounted: number;
  sessionsScanned: number;
  toolUseCounts: Record<string, number>;
  toolFailureCounts: Record<string, number>;
  toolResultSizes: number[];
  filesRead: Record<string, number>;
  compactionCount: number;
  userMsgCount: number;
  userMsgTotalLen: number;
  skillInvocations: number;
  subagentDispatches: number;
  turnsBeforeFirstTool: number;
  perSourceState: Map<
    string,
    {
      messages: number;
      tokens: Record<string, number>;
      modelTokens: Record<string, Record<string, number>>;
      touched: boolean;
    }
  >;
  toolCachePrime: Record<string, CachePrimeEntry>;
}

// Scan one session file. Returns true if any in-window turn touched the
// per-source counters (so the caller can increment sessionsScanned).
async function scanOneSession(
  file: string,
  fileToSlug: Map<string, string>,
  ctx: ScanCtx,
  startMs: number,
  endMs: number
): Promise<boolean> {
  let touched = false;
  for await (const obj of readJsonlLines(file)) {
    const ts = obj?.timestamp;
    const tsMs = ts ? Date.parse(ts) : NaN;
    if (Number.isNaN(tsMs) || tsMs < startMs || tsMs > endMs) continue;
    if (obj?.type === "assistant") {
      touched = handleAssistantTurn(obj, file, fileToSlug, ctx) || touched;
      continue;
    }
    if (obj?.type === "user") {
      handleUserTurn(obj, ctx);
    }
  }
  return touched;
}

// Scans every .jsonl session file, accumulating token usage, tool stats,
// conversation-shape counters, and per-source attribution.
// eslint-disable-next-line max-lines-per-function
export async function scanSessions({
  sessions,
  fileToSlug,
  startMs,
  endMs
}: ScanSessionsInput): Promise<ScanSessionsResult> {
  const totals = emptyTotals();
  const byModel: Record<
    string,
    { tokens: Record<string, number>; usd: number; messages: number; pricedAs?: string }
  > = {};
  const toolUseCounts: Record<string, number> = {};
  const toolFailureCounts: Record<string, number> = {};
  const toolResultSizes: number[] = [];
  const filesRead: Record<string, number> = {};
  const toolNameById = new Map<string, string>();
  const perSourceState = new Map<
    string,
    {
      messages: number;
      tokens: Record<string, number>;
      modelTokens: Record<string, Record<string, number>>;
      touched: boolean;
    }
  >();
  const counters = {
    messagesCounted: 0,
    sessionsScanned: 0,
    compactionCount: 0,
    userMsgCount: 0,
    userMsgTotalLen: 0,
    skillInvocations: 0,
    subagentDispatches: 0,
    turnsBeforeFirstTool: 0
  };
  const flags = { sawFirstTool: false };
  const toolCachePrime: Record<string, CachePrimeEntry> = {};
  const cachePrimeState = {
    pendingToolUses: [] as Array<{ id: string; name: string }>,
    pendingResultSizes: {} as Record<string, number>
  };

  const ensureSource = (slug: string): SourceEntry => {
    if (!perSourceState.has(slug)) {
      perSourceState.set(slug, {
        messages: 0,
        tokens: emptyTotals(),
        modelTokens: {},
        touched: false
      });
    }
    return perSourceState.get(slug)!;
  };

  const ctx: ScanCtx = {
    totals,
    byModel,
    toolUseCounts,
    toolFailureCounts,
    toolResultSizes,
    filesRead,
    toolNameById,
    counters,
    flags,
    ensureSource,
    toolCachePrime,
    cachePrimeState
  };

  for (const file of sessions) {
    const touched = await scanOneSession(file, fileToSlug, ctx, startMs, endMs);
    if (touched) counters.sessionsScanned += 1;
  }

  return {
    totals,
    byModel,
    messagesCounted: counters.messagesCounted,
    sessionsScanned: counters.sessionsScanned,
    toolUseCounts,
    toolFailureCounts,
    toolResultSizes,
    filesRead,
    compactionCount: counters.compactionCount,
    userMsgCount: counters.userMsgCount,
    userMsgTotalLen: counters.userMsgTotalLen,
    skillInvocations: counters.skillInvocations,
    subagentDispatches: counters.subagentDispatches,
    turnsBeforeFirstTool: counters.turnsBeforeFirstTool,
    perSourceState,
    toolCachePrime
  };
}
