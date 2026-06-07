// Session scanning helpers extracted from session-cost.mjs.
// All functions here are internal helpers used by scanSessions / computeSessionCost.

import readline from "node:readline";
import { createReadStream } from "node:fs";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";

const PROJECTS_ROOT = path.join(os.homedir(), ".claude", "projects");

function emptyTotals(): Record<string, number> {
  return {
    input: 0,
    cache_create_5m: 0,
    cache_create_1h: 0,
    cache_read: 0,
    output: 0
  };
}

export interface CachePrimeEntry {
  calls: number;
  totalResultBytes: number;
  attributedCacheCreate: number;
}

export interface Counters {
  messagesCounted: number;
  sessionsScanned: number;
  compactionCount: number;
  userMsgCount: number;
  userMsgTotalLen: number;
  skillInvocations: number;
  subagentDispatches: number;
  turnsBeforeFirstTool: number;
}

export interface Flags {
  sawFirstTool: boolean;
}

export interface CachePrimeState {
  pendingToolUses: Array<{ id: string; name: string }>;
  pendingResultSizes: Record<string, number>;
}

export interface SourceEntry {
  messages: number;
  tokens: Record<string, number>;
  modelTokens: Record<string, Record<string, number>>;
  touched: boolean;
}

export interface ScanCtx {
  totals: Record<string, number>;
  byModel: Record<
    string,
    { tokens: Record<string, number>; usd: number; messages: number; pricedAs?: string }
  >;
  toolUseCounts: Record<string, number>;
  toolFailureCounts: Record<string, number>;
  toolResultSizes: number[];
  filesRead: Record<string, number>;
  toolNameById: Map<string, string>;
  counters: Counters;
  flags: Flags;
  ensureSource: (slug: string) => SourceEntry;
  toolCachePrime: Record<string, CachePrimeEntry>;
  cachePrimeState: CachePrimeState;
}

export interface JsonlLine {
  type?: string;
  timestamp?: string;
  isMeta?: boolean;
  message?: {
    usage?: Record<string, unknown>;
    content?: unknown;
    model?: string;
  };
}

/**
 * @param {Record<string, number>} target
 * @param {Record<string, number>} source
 */
export function addTotals(target: Record<string, number>, source: Record<string, number>): void {
  for (const k of Object.keys(target)) {
    target[k] = (target[k] ?? 0) + (source[k] ?? 0);
  }
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

export function percentile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) return 0;
  const idx = Math.min(sortedArr.length - 1, Math.floor((p / 100) * sortedArr.length));
  return sortedArr[idx] ?? 0;
}

export function approxSize(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "string") return value.length;
  try {
    return JSON.stringify(value).length;
  } catch {
    return 0;
  }
}

// Walk a content array and collect tool_use / tool_result / text signals.
export function inspectContent(content: unknown): {
  toolUses: Array<{ id: string; name: string; input: unknown }>;
  toolResults: Array<{ id: string; size: number; isError: boolean }>;
  textLen: number;
} {
  const out: {
    toolUses: Array<{ id: string; name: string; input: unknown }>;
    toolResults: Array<{ id: string; size: number; isError: boolean }>;
    textLen: number;
  } = { toolUses: [], toolResults: [], textLen: 0 };
  if (!Array.isArray(content)) {
    if (typeof content === "string") out.textLen = content.length;
    return out;
  }
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const b = block as Record<string, unknown>;
    if (b["type"] === "tool_use") {
      out.toolUses.push({
        id: b["id"] as string,
        name: b["name"] as string,
        input: b["input"]
      });
    } else if (b["type"] === "tool_result") {
      out.toolResults.push({
        id: b["tool_use_id"] as string,
        size: approxSize(b["content"]),
        isError: Boolean(b["is_error"])
      });
    } else if (b["type"] === "text") {
      out.textLen += ((b["text"] as string | undefined) || "").length;
    }
  }
  return out;
}

// Iterates project dir subdirectories. Filters non-dir entries up-front.
async function listProjectDirEntries(): Promise<string[]> {
  try {
    const entries = await fs.readdir(PROJECTS_ROOT, { withFileTypes: true });
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
      if (obj?.type !== "assistant") continue;
      const tsMs = obj.timestamp ? Date.parse(obj.timestamp) : NaN;
      if (Number.isNaN(tsMs) || tsMs < startMs || tsMs > endMs) continue;
      if (!obj?.message?.usage) continue;
      count += 1;
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
    const dir = path.join(PROJECTS_ROOT, slug);
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
      if (obj?.type !== "assistant") continue;
      const tsMs = obj.timestamp ? Date.parse(obj.timestamp) : NaN;
      if (Number.isNaN(tsMs) || tsMs < startMs || tsMs > endMs) continue;
      if (!obj?.message?.usage) continue;
      return true;
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
    { messages: number; tokens: Record<string, number>; modelTokens: Record<string, Record<string, number>>; touched: boolean }
  >;
  toolCachePrime: Record<string, CachePrimeEntry>;
}

// Scans every .jsonl session file, accumulating token usage, tool stats,
// conversation-shape counters, and per-source attribution.
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
    { messages: number; tokens: Record<string, number>; modelTokens: Record<string, Record<string, number>>; touched: boolean }
  >();
  const counters: Counters = {
    messagesCounted: 0,
    sessionsScanned: 0,
    compactionCount: 0,
    userMsgCount: 0,
    userMsgTotalLen: 0,
    skillInvocations: 0,
    subagentDispatches: 0,
    turnsBeforeFirstTool: 0
  };
  const flags: Flags = { sawFirstTool: false };
  const toolCachePrime: Record<string, CachePrimeEntry> = {};
  const cachePrimeState: CachePrimeState = {
    pendingToolUses: [],
    pendingResultSizes: {}
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

export function recordTokenUsage(
  ctx: ScanCtx,
  model: string,
  tokens: Record<string, number>,
  file: string,
  fileToSlug: Map<string, string>
): void {
  addTotals(ctx.totals, tokens);
  if (!ctx.byModel[model]) {
    ctx.byModel[model] = { tokens: emptyTotals(), usd: 0, messages: 0 };
  }
  addTotals(ctx.byModel[model]!.tokens, tokens);
  ctx.byModel[model]!.messages += 1;
  ctx.counters.messagesCounted += 1;

  const srcSlug = fileToSlug.get(file);
  if (srcSlug) {
    const s = ctx.ensureSource(srcSlug);
    addTotals(s.tokens, tokens);
    if (!s.modelTokens[model]) s.modelTokens[model] = emptyTotals();
    addTotals(s.modelTokens[model]!, tokens);
    s.messages += 1;
    s.touched = true;
  }
}

// Maps tool-use names to the counter they bump on the context.
export const TOOL_COUNTERS: Partial<Record<string, (ctx: ScanCtx) => void>> = {
  Skill: (ctx) => (ctx.counters.skillInvocations += 1),
  Agent: (ctx) => (ctx.counters.subagentDispatches += 1)
};

export function recordToolUse(
  ctx: ScanCtx,
  tu: { id: string; name: string; input: unknown }
): void {
  ctx.flags.sawFirstTool = true;
  ctx.toolUseCounts[tu.name] = (ctx.toolUseCounts[tu.name] ?? 0) + 1;
  if (tu.id) ctx.toolNameById.set(tu.id, tu.name);
  TOOL_COUNTERS[tu.name]?.(ctx);
  if (tu.name === "Read") {
    const inp = tu.input as Record<string, unknown>;
    const p = inp?.["file_path"] as string | undefined;
    if (p) ctx.filesRead[p] = (ctx.filesRead[p] ?? 0) + 1;
  }
}

export function attributeCachePrime(ctx: ScanCtx, usage: Record<string, unknown>): void {
  const pending = ctx.cachePrimeState.pendingToolUses;
  if (!pending.length || !usage) return;
  const cc = usage["cache_creation"] as Record<string, number> | null | undefined;
  const cacheCreate = cc
    ? ((cc["ephemeral_5m_input_tokens"] ?? 0) + (cc["ephemeral_1h_input_tokens"] ?? 0))
    : ((usage["cache_creation_input_tokens"] as number | undefined) ?? 0);
  if (cacheCreate <= 0) return;
  const sizes = pending.map((tu) => ctx.cachePrimeState.pendingResultSizes[tu.id] ?? 0);
  const totalSize = sizes.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pending.length; i += 1) {
    const tu = pending[i]!;
    const weight = totalSize > 0 ? (sizes[i] ?? 0) / totalSize : 1 / pending.length;
    const attributed = cacheCreate * weight;
    if (!ctx.toolCachePrime[tu.name]) {
      ctx.toolCachePrime[tu.name] = { calls: 0, totalResultBytes: 0, attributedCacheCreate: 0 };
    }
    ctx.toolCachePrime[tu.name]!.attributedCacheCreate += attributed;
  }
}

// `<synthetic>` is a Claude-Code-internal sentinel for system-injected
// assistant messages with no real LLM call. They show $0 cost but pollute
// byModel/modelMix output. Filter them out at capture time.
export const SYNTHETIC_MODEL_PREFIXES = ["<synthetic>", "<", "synthetic"];
export function isSyntheticModel(model: string): boolean {
  if (!model) return false;
  return SYNTHETIC_MODEL_PREFIXES.some((p) => model.startsWith(p));
}

export function handleAssistantTurn(
  obj: JsonlLine,
  file: string,
  fileToSlug: Map<string, string>,
  ctx: ScanCtx
): boolean {
  const usage = obj?.message?.usage;
  const touched = Boolean(usage);
  if (usage) {
    const model = obj?.message?.model || "unknown";
    if (!isSyntheticModel(model)) {
      recordTokenUsage(ctx, model, tokensFromUsage(usage), file, fileToSlug);
      attributeCachePrime(ctx, usage);
    }
  }
  const insp = inspectContent(obj?.message?.content);
  if (insp.toolUses.length === 0 && !ctx.flags.sawFirstTool) {
    ctx.counters.turnsBeforeFirstTool += 1;
  }
  for (const tu of insp.toolUses) {
    recordToolUse(ctx, tu);
  }
  // Update pending state: this turn's tool_uses become the candidates for
  // next turn's cache_create attribution.
  if (insp.toolUses.length > 0) {
    ctx.cachePrimeState.pendingToolUses = insp.toolUses.map((tu) => ({ id: tu.id, name: tu.name }));
    ctx.cachePrimeState.pendingResultSizes = {};
  }
  return touched;
}

function tokensFromUsage(usage: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {
    input: 0,
    cache_create_5m: 0,
    cache_create_1h: 0,
    cache_read: 0,
    output: 0
  };
  if (!usage || typeof usage !== "object") return out;
  out["input"] = (usage["input_tokens"] as number | undefined) ?? 0;
  out["cache_read"] = (usage["cache_read_input_tokens"] as number | undefined) ?? 0;
  out["output"] = (usage["output_tokens"] as number | undefined) ?? 0;

  const cc = usage["cache_creation"];
  if (cc && typeof cc === "object") {
    const cc2 = cc as Record<string, number>;
    out["cache_create_5m"] = cc2["ephemeral_5m_input_tokens"] ?? 0;
    out["cache_create_1h"] = cc2["ephemeral_1h_input_tokens"] ?? 0;
  } else {
    out["cache_create_5m"] = (usage["cache_creation_input_tokens"] as number | undefined) ?? 0;
  }
  return out;
}

// Updates ctx with tool-result sizes/failures, conversation-shape counters,
// and compaction signals from one user turn.
export function handleUserTurn(obj: JsonlLine, ctx: ScanCtx): void {
  if (obj.isMeta) {
    ctx.counters.compactionCount += 1;
    return;
  }
  const insp = inspectContent(obj?.message?.content);
  if (insp.toolResults.length > 0) {
    for (const tr of insp.toolResults) {
      ctx.toolResultSizes.push(tr.size);
      if (tr.id) ctx.cachePrimeState.pendingResultSizes[tr.id] = tr.size;
      const toolName = tr.id ? ctx.toolNameById.get(tr.id) : null;
      if (toolName) {
        if (!ctx.toolCachePrime[toolName]) {
          ctx.toolCachePrime[toolName] = {
            calls: 0,
            totalResultBytes: 0,
            attributedCacheCreate: 0
          };
        }
        ctx.toolCachePrime[toolName]!.calls += 1;
        ctx.toolCachePrime[toolName]!.totalResultBytes += tr.size || 0;
      }
      if (tr.isError && tr.id) {
        const errToolName = ctx.toolNameById.get(tr.id) || "unknown";
        ctx.toolFailureCounts[errToolName] = (ctx.toolFailureCounts[errToolName] ?? 0) + 1;
      }
    }
  } else {
    ctx.counters.userMsgCount += 1;
    ctx.counters.userMsgTotalLen += insp.textLen;
  }
}
