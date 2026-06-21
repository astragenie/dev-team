// agent-registry.ts — filesystem-driven capability registry (FEAT-160 partial).
// Walks agents/**/*.md, parses YAML frontmatter `capabilities:` + name + priority,
// builds queryable index for the route CLI. Read-only. Reads frontmatter once
// per call; callers cache as appropriate.
import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";

export interface AgentCapabilities {
  role?: string[];
  surfaces?: string[];
  stacks?: string[];
  concerns?: string[];
  lens?: string[];
  scopes?: string[];
  priority?: number;
}

export interface AgentRegistryEntry {
  name: string; // agent file basename without .md
  path: string; // relative to repo root
  capabilities: AgentCapabilities;
  priority: number; // 0 if absent
}

export type RouteQuery = {
  role?: string;
  surface?: string;
  stack?: string;
  concern?: string;
  lens?: string;
  scope?: string;
};

export interface RouteMatch {
  entry: AgentRegistryEntry;
  matched: string[]; // which dimensions matched (e.g. ["role:implementer", "stack:typescript"])
  score: number; // matched-count * 10 + priority (deterministic ranking)
}

// ── Frontmatter parser ──────────────────────────────────────────────────────

function extractFrontmatter(md: string): string | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(md);
  return m?.[1] ?? null;
}

function parseEntry(name: string, relPath: string, md: string): AgentRegistryEntry | null {
  const fm = extractFrontmatter(md);
  if (!fm) return null;
  let parsed: unknown;
  try {
    parsed = parseYaml(fm);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  const caps = obj["capabilities"];
  if (!caps || typeof caps !== "object") return null;
  const capsRec = caps as Record<string, unknown>;
  const asStrArr = (v: unknown): string[] | undefined =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : undefined;
  const asNum = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);
  const capabilities: AgentCapabilities = {};
  const role = asStrArr(capsRec["role"]);
  const surfaces = asStrArr(capsRec["surfaces"]);
  const stacks = asStrArr(capsRec["stacks"]);
  const concerns = asStrArr(capsRec["concerns"]);
  const lens = asStrArr(capsRec["lens"]);
  const scopes = asStrArr(capsRec["scopes"]);
  const priority = asNum(capsRec["priority"]);
  if (role) capabilities.role = role;
  if (surfaces) capabilities.surfaces = surfaces;
  if (stacks) capabilities.stacks = stacks;
  if (concerns) capabilities.concerns = concerns;
  if (lens) capabilities.lens = lens;
  if (scopes) capabilities.scopes = scopes;
  if (priority !== undefined) capabilities.priority = priority;
  return { name, path: relPath, capabilities, priority: priority ?? 0 };
}

// ── Filesystem walker ───────────────────────────────────────────────────────

async function walkAgentDir(dir: string, repo: string): Promise<AgentRegistryEntry[]> {
  let entries: import("node:fs").Dirent[] = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: AgentRegistryEntry[] = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await walkAgentDir(full, repo)));
      continue;
    }
    if (!e.isFile() || !e.name.endsWith(".md")) continue;
    let md = "";
    try {
      md = await fs.readFile(full, "utf-8");
    } catch {
      continue;
    }
    const name = e.name.replace(/\.md$/, "");
    const rel = path.relative(repo, full).split(path.sep).join("/");
    const entry = parseEntry(name, rel, md);
    if (entry) out.push(entry);
  }
  return out;
}

export async function loadAgentRegistry(
  repo: string,
  agentsSubdir = "agents"
): Promise<AgentRegistryEntry[]> {
  const dir = path.isAbsolute(agentsSubdir) ? agentsSubdir : path.join(repo, agentsSubdir);
  const all = await walkAgentDir(dir, repo);
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

// ── Query ──────────────────────────────────────────────────────────────────

function matchDimension(
  values: string[] | undefined,
  needle: string | undefined,
  label: string,
  hits: string[]
): boolean {
  if (!needle) return true;
  if (!values || !values.includes(needle)) return false;
  hits.push(`${label}:${needle}`);
  return true;
}

export function routeByTags(registry: AgentRegistryEntry[], query: RouteQuery): RouteMatch[] {
  const out: RouteMatch[] = [];
  for (const entry of registry) {
    const matched: string[] = [];
    const c = entry.capabilities;
    const ok =
      matchDimension(c.role, query.role, "role", matched) &&
      matchDimension(c.surfaces, query.surface, "surface", matched) &&
      matchDimension(c.stacks, query.stack, "stack", matched) &&
      matchDimension(c.concerns, query.concern, "concern", matched) &&
      matchDimension(c.lens, query.lens, "lens", matched) &&
      matchDimension(c.scopes, query.scope, "scope", matched);
    if (!ok) continue;
    // Must have matched at least one declared filter (avoid returning every agent on empty query).
    const askedFilters = Object.values(query).filter(Boolean).length;
    if (askedFilters > 0 && matched.length === 0) continue;
    out.push({ entry, matched, score: matched.length * 10 + (entry.priority ?? 0) });
  }
  return out.sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name));
}
