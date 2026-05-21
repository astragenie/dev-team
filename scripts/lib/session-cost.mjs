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

async function listProjectSessions(repoPath) {
  const slug = slugifyRepoPath(repoPath);
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
  try { return JSON.stringify(value).length; } catch { return 0; }
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

export async function computeSessionCost(repoPath, { startedAt, completedAt } = {}) {
  if (!startedAt) throw new Error("computeSessionCost requires startedAt");
  const endIso = completedAt || new Date().toISOString();
  const startMs = Date.parse(startedAt);
  const endMs = Date.parse(endIso);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    throw new Error(`Invalid window: startedAt=${startedAt} completedAt=${endIso}`);
  }

  const pricing = await loadPricing();
  const sessions = await listProjectSessions(repoPath);

  const totals = emptyTotals();
  const byModel = {};
  let messagesCounted = 0;
  let sessionsScanned = 0;

  // Conversation-shape + tool-depth metrics
  const toolUseCounts = {};
  const toolFailureCounts = {};
  const toolResultSizes = [];
  const filesRead = {};
  let compactionCount = 0;
  let userMsgCount = 0;
  let userMsgTotalLen = 0;
  let skillInvocations = 0;
  let subagentDispatches = 0;
  let turnsBeforeFirstTool = 0;
  let sawFirstTool = false;
  // Map tool_use_id -> tool name, so we can attribute failures to a tool.
  const toolNameById = new Map();

  for (const file of sessions) {
    let touched = false;
    for await (const obj of readJsonlLines(file)) {
      const ts = obj?.timestamp;
      const tsMs = ts ? Date.parse(ts) : NaN;
      if (Number.isNaN(tsMs) || tsMs < startMs || tsMs > endMs) continue;

      // --- assistant turns: cost + tool_use ---
      if (obj?.type === "assistant") {
        const usage = obj?.message?.usage;
        if (usage) {
          const model = obj?.message?.model || "unknown";
          const tokens = tokensFromUsage(usage);
          addTotals(totals, tokens);
          if (!byModel[model]) byModel[model] = { tokens: emptyTotals(), usd: 0, messages: 0 };
          addTotals(byModel[model].tokens, tokens);
          byModel[model].messages += 1;
          messagesCounted += 1;
          touched = true;
        }
        const insp = inspectContent(obj?.message?.content);
        if (insp.toolUses.length === 0 && !sawFirstTool) {
          turnsBeforeFirstTool += 1;
        }
        for (const tu of insp.toolUses) {
          sawFirstTool = true;
          toolUseCounts[tu.name] = (toolUseCounts[tu.name] || 0) + 1;
          if (tu.id) toolNameById.set(tu.id, tu.name);
          if (tu.name === "Skill") skillInvocations += 1;
          if (tu.name === "Agent") subagentDispatches += 1;
          if (tu.name === "Read") {
            const p = tu.input?.file_path;
            if (p) filesRead[p] = (filesRead[p] || 0) + 1;
          }
        }
        continue;
      }

      // --- user turns: tool_result sizes/failures, msg shape, compactions ---
      if (obj?.type === "user") {
        if (obj.isMeta) {
          // Meta-injected user messages = compaction summaries, skill
          // activations, hook injections. Treated as compaction signal.
          compactionCount += 1;
          continue;
        }
        const insp = inspectContent(obj?.message?.content);
        if (insp.toolResults.length > 0) {
          for (const tr of insp.toolResults) {
            toolResultSizes.push(tr.size);
            if (tr.isError && tr.id) {
              const toolName = toolNameById.get(tr.id) || "unknown";
              toolFailureCounts[toolName] = (toolFailureCounts[toolName] || 0) + 1;
            }
          }
        } else {
          // True user-typed message (no tool result block)
          userMsgCount += 1;
          userMsgTotalLen += insp.textLen;
        }
      }
    }
    if (touched) sessionsScanned += 1;
  }

  let totalUsd = 0;
  for (const model of Object.keys(byModel)) {
    const key = matchModelKey(model, pricing);
    const rates = pricing.models[key] || pricing.models[pricing.fallback];
    const usd = priceTokens(byModel[model].tokens, rates);
    byModel[model].usd = Number(usd.toFixed(4));
    byModel[model].pricedAs = key;
    totalUsd += usd;
  }

  // Model mix: % of priced assistant messages per model, sorted by usd desc.
  const modelMix = [];
  for (const [model, info] of Object.entries(byModel)) {
    modelMix.push({
      model,
      pricedAs: info.pricedAs,
      messages: info.messages,
      msgPct: messagesCounted > 0 ? Number(((info.messages / messagesCounted) * 100).toFixed(2)) : 0,
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
    pricingFallback: pricing.fallback,
    toolUsage,
    toolResultSizes: sizeStats,
    fileReReadCount,
    fileReReadTopPaths: fileReReadEntries.slice(0, 5).map(([p, c]) => ({ path: p, reads: c })),
    conversation
  };
}
