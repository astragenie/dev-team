// scripts/lib/dispatch/resolve-token.ts — FEAT-crew-architecture-review review follow-up
//
// Single resolution semantics for first-party `crew:<name>` dispatch tokens.
// Previously validate-agent-refs.ts and validate-configs.ts each hand-rolled
// their own resolver and the two disagreed: one resolved agents+commands plus
// a hardcoded forward-reference allowlist (no skills), the other resolved
// agents+commands+skills (no allowlist). Two ground truths for one concept —
// a resolution-rule fix in one silently left the other stale.
//
// A token resolves when any of these exists:
//   - agents/<name>.md
//   - commands/<name>.md
//   - skills/**/<name>/SKILL.md
//   - <name> is listed in docs/routing-table.yaml `forward_references:`
//     (intentionally referenced before the agent ships; each entry must have
//     documented registry-fallback handling at its reference sites)
//
// The skills tree is walked ONCE per resolver (single recursive sweep into a
// Set) instead of once per unresolved token — validate-configs previously
// re-walked all of skills/ for every miss inside a hard CI gate.

import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";

async function listMdBasenames(dir: string): Promise<Set<string>> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return new Set(
      entries
        .filter((e) => e.isFile() && e.name.endsWith(".md"))
        .map((e) => path.basename(e.name, ".md"))
    );
  } catch {
    return new Set();
  }
}

async function collectSkillDirNames(dir: string, out: Set<string>): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const full = path.join(dir, entry.name);
    try {
      await fs.access(path.join(full, "SKILL.md"));
      out.add(entry.name);
    } catch {
      // not a skill dir — keep walking
    }
    await collectSkillDirNames(full, out);
  }
}

/**
 * Reads the documented forward-reference allowlist from docs/routing-table.yaml.
 * Returns an empty set when the file is missing or malformed — validate-configs
 * owns reporting that as its own structural error.
 */
export async function loadForwardReferences(repoRoot: string): Promise<Set<string>> {
  try {
    const raw = await fs.readFile(path.join(repoRoot, "docs", "routing-table.yaml"), "utf8");
    const data = parseYaml(raw) as { forward_references?: unknown } | null;
    const refs = data?.forward_references;
    if (Array.isArray(refs)) return new Set(refs.filter((r): r is string => typeof r === "string"));
    return new Set();
  } catch {
    return new Set();
  }
}

export interface TokenResolver {
  /** True when `crew:<name>` resolves to a real agent, command, skill, or documented forward reference. */
  resolves(name: string): boolean;
  agentNames: Set<string>;
  commandNames: Set<string>;
  skillNames: Set<string>;
  forwardReferences: Set<string>;
}

/** Builds a resolver with one upfront scan of agents/, commands/, skills/ and the forward-reference allowlist. */
export async function createTokenResolver(repoRoot: string): Promise<TokenResolver> {
  const skillNames = new Set<string>();
  const [agentNames, commandNames, forwardReferences] = await Promise.all([
    listMdBasenames(path.join(repoRoot, "agents")),
    listMdBasenames(path.join(repoRoot, "commands")),
    loadForwardReferences(repoRoot),
    collectSkillDirNames(path.join(repoRoot, "skills"), skillNames)
  ]);
  return {
    resolves: (name: string) =>
      agentNames.has(name) ||
      commandNames.has(name) ||
      skillNames.has(name) ||
      forwardReferences.has(name),
    agentNames,
    commandNames,
    skillNames,
    forwardReferences
  };
}
