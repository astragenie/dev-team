import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { scanSessions, percentile, readJsonlLines } from "./session-cost-scanner.mjs";

const PROJECTS_ROOT = path.join(os.homedir(), ".claude", "projects");

/**
 * @param {string} repoPath
 * @returns {string}
 */
export function slugifyRepoPath(repoPath) {
  return repoPath.replace(/[^A-Za-z0-9]/g, "-");
}

export async function loadPricing() {
  const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
  const file = path.join(here, "pricing.json");
  const raw = await fs.readFile(file, "utf8");
  return JSON.parse(raw);
}

/**
 * @param {string} model
 * @param {{ fallback: string, models: Record<string, Record<string, number>> }} pricing
 * @returns {string}
 */
function matchModelKey(model, pricing) {
  if (!model) return pricing.fallback;
  const keys = Object.keys(pricing.models);
  const sorted = [...keys].sort((a, b) => b.length - a.length);
  for (const k of sorted) {
    if (model.startsWith(k)) return k;
  }
  return pricing.fallback;
}

/**
 * @typedef {{ calls: number, totalResultBytes: number, attributedCacheCreate: number }} CachePrimeEntry
 * @typedef {{ messagesCounted: number, sessionsScanned: number, compactionCount: number, userMsgCount: number, userMsgTotalLen: number, skillInvocations: number, subagentDispatches: number, turnsBeforeFirstTool: number }} Counters
 * @typedef {{ sawFirstTool: boolean }} Flags
 * @typedef {{ pendingToolUses: Array<{id: string, name: string}>, pendingResultSizes: Record<string, number> }} CachePrimeState
 * @typedef {{ totals: Record<string, number>, byModel: Record<string, {tokens: Record<string, number>, usd: number, messages: number, pricedAs?: string}>, toolUseCounts: Record<string, number>, toolFailureCounts: Record<string, number>, toolResultSizes: number[], filesRead: Record<string, number>, toolNameById: Map<string, string>, counters: Counters, flags: Flags, ensureSource: (slug: string) => {messages: number, tokens: Record<string, number>, modelTokens: Record<string, Record<string, number>>, touched: boolean}, toolCachePrime: Record<string, CachePrimeEntry>, cachePrimeState: CachePrimeState }} ScanCtx
 */

/**
 * @param {Record<string, number>} tokens
 * @param {Record<string, number>} modelRates
 * @returns {number}
 */
function priceTokens(tokens, modelRates) {
  let usd = 0;
  for (const k of Object.keys(tokens)) {
    const rate = modelRates[k] || 0;
    usd += (tokens[k] * rate) / 1_000_000;
  }
  return usd;
}

/**
 * @param {string} repoPath
 * @param {string|null} [sourceProjectSlug]
 * @returns {Promise<string[]>}
 */
async function listProjectSessions(repoPath, sourceProjectSlug = null) {
  // sourceProjectSlug overrides the repo-derived slug so callers can attribute
  // cost to a Claude session that ran in a different repo (e.g. multi-repo
  // work where the human is in repo-A but the work targets repo-B). When
  // unset, the default behaviour resolves the session dir from repoPath.
  const slug = sourceProjectSlug || slugifyRepoPath(repoPath);
  const dir = path.join(PROJECTS_ROOT, slug);
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".jsonl"))
    .map((e) => path.join(dir, e.name));
}

// Auto-detect the Claude project dir that actually has activity in the
// target window. Useful when the caller doesn't know which slug to pass —
// the dir with the most assistant turns in the window wins. Returns the
// slug of the winning dir, or null if no project dir has any activity.
// Lists .jsonl files in a single project dir, or empty array on any error.
/**
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function listJsonlInDir(dir) {
  try {
    return (await fs.readdir(dir)).filter((f) => f.endsWith(".jsonl"));
  } catch {
    return [];
  }
}

// Iterates project dir subdirectories. Filters non-dir entries up-front.
async function listProjectDirEntries() {
  try {
    const entries = await fs.readdir(PROJECTS_ROOT, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

// Counts assistant turns with billable usage inside [startMs, endMs] across
// every .jsonl file in `dir`.
/**
 * @param {string} dir
 * @param {number} startMs
 * @param {number} endMs
 * @returns {Promise<number>}
 */
async function countInWindowAssistantTurns(dir, startMs, endMs) {
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

/**
 * @param {{ startedAt?: string, completedAt?: string }} [options]
 */
export async function autoDetectSourceProject({ startedAt, completedAt } = {}) {
  if (!startedAt) return null;
  const endIso = completedAt || new Date().toISOString();
  const startMs = Date.parse(startedAt);
  const endMs = Date.parse(endIso);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return null;

  const slugs = await listProjectDirEntries();
  let best = null;
  for (const slug of slugs) {
    const count = await countInWindowAssistantTurns(path.join(PROJECTS_ROOT, slug), startMs, endMs);
    if (count > 0 && (!best || count > best.count)) {
      best = { slug, count };
    }
  }
  return best ? best.slug : null;
}

// Pure helpers (readJsonlLines, percentile, approxSize, inspectContent,
// scanSessions, recordTokenUsage, TOOL_COUNTERS, recordToolUse,
// attributeCachePrime, SYNTHETIC_MODEL_PREFIXES, isSyntheticModel,
// handleAssistantTurn, handleUserTurn) — extracted to session-cost-scanner.mjs.

// Build a list of project dirs that have at least one in-window assistant
// turn. Used by aggregateAll mode to scope summation to relevant dirs only
// (skips unrelated ambient sessions).
/**
 * @param {{ startMs: number, endMs: number }} opts
 * @returns {Promise<Array<{slug: string, dir: string}>>}
 */
async function listActiveProjectDirs({ startMs, endMs }) {
  const slugs = await listProjectDirEntries();
  const active = [];
  for (const slug of slugs) {
    const dir = path.join(PROJECTS_ROOT, slug);
    const count = await countInWindowAssistantTurns(dir, startMs, endMs);
    if (count > 0) active.push({ slug, dir });
  }
  return active;
}

// True iff any .jsonl session file has at least one assistant turn with
// usage data inside [startMs, endMs]. Short-circuits as soon as one match
// is found.
/**
 * @param {string[]} files
 * @param {number} startMs
 * @param {number} endMs
 * @returns {Promise<boolean>}
 */
async function sessionsHaveInWindowAssistantTurns(files, startMs, endMs) {
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

// Decides which `~/.claude/projects/<slug>/` directories to scan.
// Three modes:
//   - aggregateAll: every project dir with in-window activity.
//   - explicit sourceProject: scan only that dir.
//   - default: scan the repo-derived dir; if empty + autoDetect enabled,
//     fall back to the busiest in-window project.
/**
 * @param {{ aggregateAll: boolean, sourceProject: string|null, autoDetect: boolean, repoPath: string, startedAt: string, endIso: string, startMs: number, endMs: number }} opts
 * @returns {Promise<{ sessionsBySource: Map<string, string[]>, effectiveSlug: string, autoDetected: boolean }>}
 */
async function resolveScanSources({
  aggregateAll,
  sourceProject,
  autoDetect,
  repoPath,
  startedAt,
  endIso,
  startMs,
  endMs
}) {
  const sessionsBySource = new Map();
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

// Prices every model's accumulated tokens in place and returns the total USD.
/**
 * @param {Record<string, {tokens: Record<string, number>, usd: number, messages: number, pricedAs?: string}>} byModel
 * @param {{ fallback: string, models: Record<string, Record<string, number>> }} pricing
 */
function priceByModel(byModel, pricing) {
  let totalUsd = 0;
  for (const model of Object.keys(byModel)) {
    const key = matchModelKey(model, pricing);
    const rates = pricing.models[key] || pricing.models[pricing.fallback];
    const usd = priceTokens(byModel[model].tokens, rates);
    byModel[model].usd = Number(usd.toFixed(4));
    byModel[model].pricedAs = key;
    totalUsd += usd;
  }
  return totalUsd;
}

// Per-source USD breakdown, sorted by usd desc.
/**
 * @param {Map<string, {messages: number, tokens: Record<string, number>, modelTokens: Record<string, Record<string, number>>, touched: boolean}>} perSourceState
 * @param {{ fallback: string, models: Record<string, Record<string, number>> }} pricing
 */
function computeSourceBreakdown(perSourceState, pricing) {
  const out = [];
  for (const [slug, s] of perSourceState.entries()) {
    if (!s.touched) continue;
    let usd = 0;
    for (const [model, tokens] of Object.entries(s.modelTokens)) {
      const key = matchModelKey(model, pricing);
      const rates = pricing.models[key] || pricing.models[pricing.fallback];
      usd += priceTokens(tokens, rates);
    }
    out.push({ slug, messages: s.messages, usd: Number(usd.toFixed(4)) });
  }
  return out.sort((a, b) => b.usd - a.usd);
}

/**
 * @param {Record<string, {tokens: Record<string, number>, usd: number, messages: number, pricedAs?: string}>} byModel
 * @param {number} messagesCounted
 * @param {number} totalUsd
 */
function buildModelMix(byModel, messagesCounted, totalUsd) {
  return Object.entries(byModel)
    .map(([model, info]) => ({
      model,
      pricedAs: info.pricedAs,
      messages: info.messages,
      msgPct:
        messagesCounted > 0 ? Number(((info.messages / messagesCounted) * 100).toFixed(2)) : 0,
      usd: info.usd,
      usdPct: totalUsd > 0 ? Number(((info.usd / totalUsd) * 100).toFixed(2)) : 0
    }))
    .sort((a, b) => b.usd - a.usd);
}

/** @param {number[]} toolResultSizes */
function computeSizeStats(toolResultSizes) {
  toolResultSizes.sort((a, b) => a - b);
  return {
    count: toolResultSizes.length,
    sumBytes: toolResultSizes.reduce((a, b) => a + b, 0),
    p50Bytes: percentile(toolResultSizes, 50),
    p90Bytes: percentile(toolResultSizes, 90),
    maxBytes: toolResultSizes[toolResultSizes.length - 1] || 0
  };
}

/** @param {Record<string, number>} filesRead */
function collectFileReReadEntries(filesRead) {
  return Object.entries(filesRead)
    .filter(([, c]) => c > 1)
    .sort((a, b) => b[1] - a[1]);
}

/**
 * @param {Record<string, number>} toolUseCounts
 * @param {Record<string, number>} toolFailureCounts
 */
function buildToolUsage(toolUseCounts, toolFailureCounts) {
  return Object.entries(toolUseCounts)
    .map(([name, count]) => ({ name, count, failures: toolFailureCounts[name] || 0 }))
    .sort((a, b) => b.count - a.count);
}

/**
 * @param {string} repoPath
 * @param {{
 *   startedAt?: string,
 *   completedAt?: string,
 *   sourceProject?: string | null,
 *   autoDetect?: boolean,
 *   aggregateAll?: boolean
 * }} [options]
 */
export async function computeSessionCost(
  repoPath,
  { startedAt, completedAt, sourceProject = null, autoDetect = true, aggregateAll = false } = {}
) {
  if (!startedAt) throw new Error("computeSessionCost requires startedAt");
  const endIso = completedAt || new Date().toISOString();
  const startMs = Date.parse(startedAt);
  const endMs = Date.parse(endIso);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    throw new Error(`Invalid window: startedAt=${startedAt} completedAt=${endIso}`);
  }

  const pricing = await loadPricing();

  const resolved = await resolveScanSources({
    aggregateAll,
    sourceProject,
    autoDetect,
    repoPath,
    startedAt,
    endIso,
    startMs,
    endMs
  });
  const { sessionsBySource } = resolved;
  const { effectiveSlug, autoDetected } = resolved;

  const fileToSlug = new Map();
  const sessions = [];
  for (const [slug, files] of sessionsBySource.entries()) {
    for (const f of files) {
      fileToSlug.set(f, slug);
      sessions.push(f);
    }
  }

  const scan = await scanSessions({ sessions, fileToSlug, startMs, endMs });
  const {
    totals,
    byModel,
    messagesCounted,
    sessionsScanned,
    toolUseCounts,
    toolFailureCounts,
    toolResultSizes,
    filesRead,
    compactionCount,
    userMsgCount,
    userMsgTotalLen,
    skillInvocations,
    subagentDispatches,
    turnsBeforeFirstTool,
    perSourceState,
    toolCachePrime
  } = scan;
  const sources = [];

  const totalUsd = priceByModel(byModel, pricing);
  sources.push(...computeSourceBreakdown(perSourceState, pricing));
  const modelMix = buildModelMix(byModel, messagesCounted, totalUsd);
  const sizeStats = computeSizeStats(toolResultSizes);
  const fileReReadEntries = collectFileReReadEntries(filesRead);
  const fileReReadCount = fileReReadEntries.reduce((a, [, c]) => a + (c - 1), 0);
  const toolUsage = buildToolUsage(toolUseCounts, toolFailureCounts);
  const conversation = {
    userMsgCount,
    userMsgAvgLen: userMsgCount > 0 ? Math.round(userMsgTotalLen / userMsgCount) : 0,
    userMsgTotalLen,
    turnsBeforeFirstTool,
    compactionCount,
    skillInvocations,
    subagentDispatches
  };

  return {
    window: { start: startedAt, end: endIso, durationMs: endMs - startMs },
    totals,
    usd: Number(totalUsd.toFixed(4)),
    byModel,
    modelMix,
    messagesCounted,
    sessionsScanned,
    sessionsAvailable: sessions.length,
    sourceProject: effectiveSlug,
    autoDetected,
    aggregateAll,
    sources,
    pricingFallback: pricing.fallback,
    toolUsage,
    toolResultSizes: sizeStats,
    fileReReadCount,
    fileReReadTopPaths: fileReReadEntries.slice(0, 5).map(([p, c]) => ({ path: p, reads: c })),
    conversation,
    // Per-tool cache priming (approximate). For each tool, totalResultBytes
    // is the sum of bytes its tool_results returned across the window;
    // attributedCacheCreate is the share of the next assistant turn's
    // cache_create tokens attributed to that tool, weighted by result size.
    // Ratio >1 means the tool's result generated more cache content than
    // its own bytes (system prompt drift, framework prose, prior-turn
    // re-injection). Ratio <1 means content compressed in cache.
    toolCachePrime: Object.entries(toolCachePrime)
      .map(([name, v]) => ({
        name,
        calls: v.calls,
        totalResultBytes: v.totalResultBytes,
        attributedCacheCreate: Math.round(v.attributedCacheCreate),
        ratio:
          v.totalResultBytes > 0
            ? Number((v.attributedCacheCreate / v.totalResultBytes).toFixed(2))
            : null
      }))
      .sort((a, b) => b.attributedCacheCreate - a.attributedCacheCreate)
  };
}
