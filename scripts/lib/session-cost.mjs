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

  for (const file of sessions) {
    let touched = false;
    for await (const obj of readJsonlLines(file)) {
      if (obj?.type !== "assistant") continue;
      const ts = obj.timestamp;
      const tsMs = ts ? Date.parse(ts) : NaN;
      if (Number.isNaN(tsMs) || tsMs < startMs || tsMs > endMs) continue;
      const usage = obj?.message?.usage;
      if (!usage) continue;
      const model = obj?.message?.model || "unknown";
      const tokens = tokensFromUsage(usage);
      addTotals(totals, tokens);
      if (!byModel[model]) byModel[model] = { tokens: emptyTotals(), usd: 0, messages: 0 };
      addTotals(byModel[model].tokens, tokens);
      byModel[model].messages += 1;
      messagesCounted += 1;
      touched = true;
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

  return {
    window: { start: startedAt, end: endIso },
    totals,
    usd: Number(totalUsd.toFixed(4)),
    byModel,
    messagesCounted,
    sessionsScanned,
    sessionsAvailable: sessions.length,
    pricingFallback: pricing.fallback
  };
}
