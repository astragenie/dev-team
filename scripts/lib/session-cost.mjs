import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";
import { createReadStream } from "node:fs";

const PROJECTS_ROOT = path.join(os.homedir(), ".claude", "projects");

export function slugifyRepoPath(repoPath) {
  return repoPath.replace(/[^A-Za-z0-9]/g, "-");
}

export async function loadPricing() {
  const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
  const file = path.join(here, "pricing.json");
  const raw = await fs.readFile(file, "utf8");
  return JSON.parse(raw);
}

function matchModelKey(model, pricing) {
  if (!model) return pricing.fallback;
  const keys = Object.keys(pricing.models);
  const sorted = [...keys].sort((a, b) => b.length - a.length);
  for (const k of sorted) {
    if (model.startsWith(k)) return k;
  }
  return pricing.fallback;
}

function emptyTotals() {
  return {
    input: 0,
    cache_create_5m: 0,
    cache_create_1h: 0,
    cache_read: 0,
    output: 0
  };
}

function addTotals(target, source) {
  for (const k of Object.keys(target)) target[k] += source[k] || 0;
}

function tokensFromUsage(usage) {
  const out = emptyTotals();
  if (!usage || typeof usage !== "object") return out;
  out.input = usage.input_tokens || 0;
  out.cache_read = usage.cache_read_input_tokens || 0;
  out.output = usage.output_tokens || 0;

  const cc = usage.cache_creation;
  if (cc && typeof cc === "object") {
    out.cache_create_5m = cc.ephemeral_5m_input_tokens || 0;
    out.cache_create_1h = cc.ephemeral_1h_input_tokens || 0;
  } else {
    out.cache_create_5m = usage.cache_creation_input_tokens || 0;
  }
  return out;
}

function priceTokens(tokens, modelRates) {
  let usd = 0;
  for (const k of Object.keys(tokens)) {
    const rate = modelRates[k] || 0;
    usd += (tokens[k] * rate) / 1_000_000;
  }
  return usd;
}

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

async function* readJsonlLines(file) {
  const stream = createReadStream(file, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    try {
      yield JSON.parse(line);
    } catch {
      // skip malformed lines
    }
  }
}

function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0;
  const idx = Math.min(sortedArr.length - 1, Math.floor((p / 100) * sortedArr.length));
  return sortedArr[idx];
}

function approxSize(value) {
  if (value == null) return 0;
  if (typeof value === "string") return value.length;
  try {
    return JSON.stringify(value).length;
  } catch {
    return 0;
  }
}

// Walk a content array and collect tool_use / tool_result / text signals.
function inspectContent(content) {
  const out = { toolUses: [], toolResults: [], textLen: 0 };
  if (!Array.isArray(content)) {
    if (typeof content === "string") out.textLen = content.length;
    return out;
  }
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    if (block.type === "tool_use") {
      out.toolUses.push({ id: block.id, name: block.name, input: block.input });
    } else if (block.type === "tool_result") {
      out.toolResults.push({
        id: block.tool_use_id,
        size: approxSize(block.content),
        isError: Boolean(block.is_error)
      });
    } else if (block.type === "text") {
      out.textLen += (block.text || "").length;
    }
  }
  return out;
}

// Build a list of project dirs that have at least one in-window assistant
// turn. Used by aggregateAll mode to scope summation to relevant dirs only
// (skips unrelated ambient sessions).
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

// Decides which `~/.claude/projects/<slug>/` directories to scan.
// Three modes:
//   - aggregateAll: every project dir with in-window activity.
//   - explicit sourceProject: scan only that dir.
//   - default: scan the repo-derived dir; if empty + autoDetect enabled,
//     fall back to the busiest in-window project.
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

// True iff any .jsonl session file has at least one assistant turn with
// usage data inside [startMs, endMs]. Short-circuits as soon as one match
// is found.
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

// Scans every .jsonl session file, accumulating token usage, tool stats,
// conversation-shape counters, and per-source attribution. Pulled out of
// computeSessionCost so the orchestrator stays small and so this loop can
// be unit-tested in isolation in the future.
async function scanSessions({ sessions, fileToSlug, startMs, endMs }) {
  const totals = emptyTotals();
  const byModel = {};
  const toolUseCounts = {};
  const toolFailureCounts = {};
  const toolResultSizes = [];
  const filesRead = {};
  const toolNameById = new Map();
  const perSourceState = new Map();
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
  // Cache priming attribution (Item 3, approximate). Tracks per-tool
  // contribution to cache_create on the NEXT assistant turn after a
  // tool_use → tool_result pair. State lives across turns inside the
  // scanner loop.
  const toolCachePrime = {}; // { toolName: { calls, totalResultBytes, attributedCacheCreate } }
  const cachePrimeState = {
    pendingToolUses: [], // [{ id, name }] from the previous assistant turn
    pendingResultSizes: {} // { tool_use_id: bytes } from the next user turn
  };

  const ensureSource = (slug) => {
    if (!perSourceState.has(slug)) {
      perSourceState.set(slug, {
        messages: 0,
        tokens: emptyTotals(),
        modelTokens: {},
        touched: false
      });
    }
    return perSourceState.get(slug);
  };

  const ctx = {
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

// Updates ctx with token usage + tool-use stats from one assistant turn.
// Returns true when the turn produced billable activity (used by the outer
// scan to count `sessionsScanned`).
function recordTokenUsage(ctx, model, tokens, file, fileToSlug) {
  addTotals(ctx.totals, tokens);
  if (!ctx.byModel[model]) {
    ctx.byModel[model] = { tokens: emptyTotals(), usd: 0, messages: 0 };
  }
  addTotals(ctx.byModel[model].tokens, tokens);
  ctx.byModel[model].messages += 1;
  ctx.counters.messagesCounted += 1;

  const srcSlug = fileToSlug.get(file);
  if (srcSlug) {
    const s = ctx.ensureSource(srcSlug);
    addTotals(s.tokens, tokens);
    if (!s.modelTokens[model]) s.modelTokens[model] = emptyTotals();
    addTotals(s.modelTokens[model], tokens);
    s.messages += 1;
    s.touched = true;
  }
}

// Maps tool-use names to the counter they bump on the context. Adding a new
// tracked tool = one entry.
const TOOL_COUNTERS = {
  Skill: (ctx) => (ctx.counters.skillInvocations += 1),
  Agent: (ctx) => (ctx.counters.subagentDispatches += 1)
};

function recordToolUse(ctx, tu) {
  ctx.flags.sawFirstTool = true;
  ctx.toolUseCounts[tu.name] = (ctx.toolUseCounts[tu.name] || 0) + 1;
  if (tu.id) ctx.toolNameById.set(tu.id, tu.name);
  TOOL_COUNTERS[tu.name]?.(ctx);
  if (tu.name === "Read") {
    const p = tu.input?.file_path;
    if (p) ctx.filesRead[p] = (ctx.filesRead[p] || 0) + 1;
  }
}

function attributeCachePrime(ctx, usage) {
  // Attribute this turn's cache_create_* tokens to the tool_uses from the
  // PRIOR assistant turn, weighted by their tool_result sizes. Approximate:
  // ignores interleaved system content, prompt re-injection, etc.
  const pending = ctx.cachePrimeState.pendingToolUses;
  if (!pending.length || !usage) return;
  const cc = usage.cache_creation;
  const cacheCreate = cc
    ? (cc.ephemeral_5m_input_tokens || 0) + (cc.ephemeral_1h_input_tokens || 0)
    : usage.cache_creation_input_tokens || 0;
  if (cacheCreate <= 0) return;
  const sizes = pending.map((tu) => ctx.cachePrimeState.pendingResultSizes[tu.id] || 0);
  const totalSize = sizes.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pending.length; i += 1) {
    const tu = pending[i];
    const weight = totalSize > 0 ? sizes[i] / totalSize : 1 / pending.length;
    const attributed = cacheCreate * weight;
    if (!ctx.toolCachePrime[tu.name]) {
      ctx.toolCachePrime[tu.name] = { calls: 0, totalResultBytes: 0, attributedCacheCreate: 0 };
    }
    ctx.toolCachePrime[tu.name].attributedCacheCreate += attributed;
  }
}

function handleAssistantTurn(obj, file, fileToSlug, ctx) {
  const usage = obj?.message?.usage;
  const touched = Boolean(usage);
  if (usage) {
    const model = obj?.message?.model || "unknown";
    recordTokenUsage(ctx, model, tokensFromUsage(usage), file, fileToSlug);
    attributeCachePrime(ctx, usage);
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

// Updates ctx with tool-result sizes/failures, conversation-shape counters,
// and compaction signals from one user turn.
function handleUserTurn(obj, ctx) {
  if (obj.isMeta) {
    // Meta-injected user messages = compaction summaries, skill activations,
    // hook injections. Treated as compaction signal.
    ctx.counters.compactionCount += 1;
    return;
  }
  const insp = inspectContent(obj?.message?.content);
  if (insp.toolResults.length > 0) {
    for (const tr of insp.toolResults) {
      ctx.toolResultSizes.push(tr.size);
      // Capture result size for cache-prime attribution on the NEXT turn.
      if (tr.id) ctx.cachePrimeState.pendingResultSizes[tr.id] = tr.size;
      // Per-tool result-size bookkeeping (used by the priming summary).
      const toolName = tr.id ? ctx.toolNameById.get(tr.id) : null;
      if (toolName) {
        if (!ctx.toolCachePrime[toolName]) {
          ctx.toolCachePrime[toolName] = {
            calls: 0,
            totalResultBytes: 0,
            attributedCacheCreate: 0
          };
        }
        ctx.toolCachePrime[toolName].calls += 1;
        ctx.toolCachePrime[toolName].totalResultBytes += tr.size || 0;
      }
      if (tr.isError && tr.id) {
        const errToolName = ctx.toolNameById.get(tr.id) || "unknown";
        ctx.toolFailureCounts[errToolName] = (ctx.toolFailureCounts[errToolName] || 0) + 1;
      }
    }
  } else {
    ctx.counters.userMsgCount += 1;
    ctx.counters.userMsgTotalLen += insp.textLen;
  }
}

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

  let totalUsd = 0;
  for (const model of Object.keys(byModel)) {
    const key = matchModelKey(model, pricing);
    const rates = pricing.models[key] || pricing.models[pricing.fallback];
    const usd = priceTokens(byModel[model].tokens, rates);
    byModel[model].usd = Number(usd.toFixed(4));
    byModel[model].pricedAs = key;
    totalUsd += usd;
  }

  // Per-source USD: price each source's model-token map and sum.
  for (const [slug, s] of perSourceState.entries()) {
    if (!s.touched) continue;
    let usd = 0;
    for (const [model, tokens] of Object.entries(s.modelTokens)) {
      const key = matchModelKey(model, pricing);
      const rates = pricing.models[key] || pricing.models[pricing.fallback];
      usd += priceTokens(tokens, rates);
    }
    sources.push({ slug, messages: s.messages, usd: Number(usd.toFixed(4)) });
  }
  sources.sort((a, b) => b.usd - a.usd);

  // Model mix: % of priced assistant messages per model, sorted by usd desc.
  const modelMix = [];
  for (const [model, info] of Object.entries(byModel)) {
    modelMix.push({
      model,
      pricedAs: info.pricedAs,
      messages: info.messages,
      msgPct:
        messagesCounted > 0 ? Number(((info.messages / messagesCounted) * 100).toFixed(2)) : 0,
      usd: info.usd,
      usdPct: totalUsd > 0 ? Number(((info.usd / totalUsd) * 100).toFixed(2)) : 0
    });
  }
  modelMix.sort((a, b) => b.usd - a.usd);

  // Tool result size distribution
  toolResultSizes.sort((a, b) => a - b);
  const sizeStats = {
    count: toolResultSizes.length,
    sumBytes: toolResultSizes.reduce((a, b) => a + b, 0),
    p50Bytes: percentile(toolResultSizes, 50),
    p90Bytes: percentile(toolResultSizes, 90),
    maxBytes: toolResultSizes[toolResultSizes.length - 1] || 0
  };

  // File re-reads (paths read > 1)
  const fileReReadEntries = Object.entries(filesRead)
    .filter(([, c]) => c > 1)
    .sort((a, b) => b[1] - a[1]);
  const fileReReadCount = fileReReadEntries.reduce((a, [, c]) => a + (c - 1), 0);

  // Tool usage rollup, sorted by count desc
  const toolUsage = Object.entries(toolUseCounts)
    .map(([name, count]) => ({
      name,
      count,
      failures: toolFailureCounts[name] || 0
    }))
    .sort((a, b) => b.count - a.count);

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
