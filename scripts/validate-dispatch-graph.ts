#!/usr/bin/env node

// Dispatch-graph cycle detector — FEAT-163 SLICE-73
//
// Parses the `## Peer dispatch` whitelist from every agent in
// PEER_DISPATCH_ALLOWLIST, builds a directed graph (agent → whitelisted peer),
// and asserts the graph has NO cycles (i.e. is a DAG).
//
// Exception: the qa-expert ↔ performance-engineer bidirectional pair is an
// explicitly documented allowlist exception per FEAT-163 line 50 — both roles
// are advisory non-gating, and the bidirectional coordination is intentional.
// Edges within this pair are excluded from cycle detection.
//
// Exit non-zero with a descriptive error on any other cycle.
// Exit 0 on a clean DAG.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PEER_DISPATCH_ALLOWLIST,
  BIDIRECTIONAL_ALLOWED
} from "./lib/dispatch/peer-dispatch-allowlist.ts";

const AGENTS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "agents");

// Agents whose Peer dispatch whitelists are parsed for graph construction, and
// the documented bidirectional cycle-detector exception, now both live in
// ./lib/dispatch/peer-dispatch-allowlist.ts — a single source shared with
// validate-agents.ts (previously two independently hand-maintained copies with
// only a "must be kept in sync" comment enforcing parity).
export { BIDIRECTIONAL_ALLOWED };

/**
 * Returns true when the edge (from → to) is covered by an allowlisted
 * bidirectional pair and should be excluded from cycle detection.
 */
function isBidirectionalAllowed(from: string, to: string): boolean {
  return BIDIRECTIONAL_ALLOWED.some(
    ([a, b]) => (a === from && b === to) || (b === from && a === to)
  );
}

/**
 * Parse the whitelist bullet entries from a `## Peer dispatch` section.
 * Returns an array of peer names (strings inside backticks on `- \`name\`:`
 * bullets before the `MUST NOT dispatch` boundary).
 */
export function parseWhitelistEntries(text: string): string[] {
  // Anchor to a heading at start-of-line — otherwise inline references to
  // "`## Peer dispatch`" in body text (e.g. the Tool restrictions section
  // pointing readers at the real Peer dispatch section below) would match
  // first and the parser would start before the actual heading, producing
  // phantom whitelist entries.
  const peerDispatchIdx = text.search(/^##\s+Peer dispatch/im);
  if (peerDispatchIdx === -1) return [];

  const afterHeading = text.slice(peerDispatchIdx);

  // Restrict to the region before "MUST NOT dispatch" (same split as
  // validate-agents.ts `hasWhitelistEntry` tightening).
  const blacklistSplitIdx = afterHeading.search(/MUST NOT dispatch/i);
  const whitelistRegion =
    blacklistSplitIdx > -1 ? afterHeading.slice(0, blacklistSplitIdx) : afterHeading;

  // Extract names from `- \`name\`` bullets (capture the identifier).
  const pattern = /\n- `([^`]+)`/g;
  const entries: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(whitelistRegion)) !== null) {
    if (m[1] !== undefined) entries.push(m[1].trim());
  }
  return entries;
}

/**
 * Build a directed adjacency map from agent files.
 * Only edges from agents in PEER_DISPATCH_ALLOWLIST are included.
 * Edges covered by BIDIRECTIONAL_ALLOWED are excluded.
 */
export async function buildDispatchGraph(
  agentsRoot: string = AGENTS_ROOT
): Promise<Map<string, string[]>> {
  const graph = new Map<string, string[]>();

  for (const agentName of PEER_DISPATCH_ALLOWLIST) {
    const filePath = path.join(agentsRoot, `${agentName}.md`);
    let text: string;
    try {
      text = await fs.readFile(filePath, "utf8");
    } catch {
      // Agent file missing — skip (validate-agents.ts will catch the absence).
      continue;
    }

    const peers = parseWhitelistEntries(text).filter(
      (peer) => !isBidirectionalAllowed(agentName, peer)
    );
    graph.set(agentName, peers);
  }

  return graph;
}

/**
 * Detect cycles in a directed graph using DFS with three-color marking.
 * Returns an array of cycles, each represented as an array of node names
 * forming the cycle path (e.g. ["a", "b", "c", "a"]).
 */
export function detectCycles(graph: Map<string, string[]>): string[][] {
  // 0 = white (unvisited), 1 = gray (in current DFS path), 2 = black (done)
  const color = new Map<string, 0 | 1 | 2>();
  const parent = new Map<string, string | null>();
  const cycles: string[][] = [];

  function dfs(node: string, path: string[]): void {
    color.set(node, 1);
    const neighbors = graph.get(node) ?? [];
    for (const neighbor of neighbors) {
      const neighborColor = color.get(neighbor) ?? 0;
      if (neighborColor === 1) {
        // Back edge → cycle found. Reconstruct the cycle path.
        const cycleStart = path.indexOf(neighbor);
        if (cycleStart !== -1) {
          cycles.push([...path.slice(cycleStart), neighbor]);
        } else {
          cycles.push([...path, neighbor]);
        }
      } else if (neighborColor === 0) {
        parent.set(neighbor, node);
        dfs(neighbor, [...path, neighbor]);
      }
      // neighborColor === 2 → already fully explored, no cycle via this edge
    }
    color.set(node, 2);
  }

  for (const node of graph.keys()) {
    if ((color.get(node) ?? 0) === 0) {
      dfs(node, [node]);
    }
  }

  return cycles;
}

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COMMANDS_ROOT = path.join(REPO_ROOT, "commands");

// `crew:<name>` tokens that legitimately resolve to something other than an
// agent or command file (hooks, external references). Keep this list tiny and
// justified — every entry is a dispatch token that has no `agents/<name>.md`
// or `commands/<name>.md` on purpose.
const ALLOWED_NONFILE_TOKENS = new Set<string>([]);

/**
 * Recursively collect `.md` files under a directory.
 */
async function collectMarkdown(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await collectMarkdown(full)));
    else if (e.name.endsWith(".md")) out.push(full);
  }
  return out;
}

/**
 * Scan commands/ + skills/ for `crew:<name>` (and `crew:3rdparty:<name>`)
 * dispatch tokens and return the ones that resolve to no real target — i.e.
 * neither `agents/<name>.md`, `agents/3rdparty/<name>.md`, `commands/<name>.md`,
 * nor an ALLOWED_NONFILE_TOKENS entry. This catches phantom-agent references
 * (arch-review §2.1) before they reach a live dispatch path.
 */
export async function findDanglingDispatchRefs(
  repoRoot: string = REPO_ROOT
): Promise<{ token: string; files: string[] }[]> {
  const scanRoots = [path.join(repoRoot, "commands"), path.join(repoRoot, "skills")];
  const files: string[] = [];
  for (const root of scanRoots) files.push(...(await collectMarkdown(root)));

  const tokenPattern = /crew:(?:3rdparty:)?[a-z][a-z0-9-]+/g;
  const hits = new Map<string, Set<string>>();

  for (const file of files) {
    const text = await fs.readFile(file, "utf8");
    for (const m of text.matchAll(tokenPattern)) {
      const token = m[0];
      if (!hits.has(token)) hits.set(token, new Set());
      hits.get(token)!.add(path.relative(repoRoot, file));
    }
  }

  const dangling: { token: string; files: string[] }[] = [];
  for (const [token, fileSet] of hits) {
    if (ALLOWED_NONFILE_TOKENS.has(token)) continue;
    const rest = token.slice("crew:".length);
    let resolved = false;
    if (rest.startsWith("3rdparty:")) {
      const name = rest.slice("3rdparty:".length);
      resolved = await exists(path.join(AGENTS_ROOT, "3rdparty", `${name}.md`));
    } else {
      resolved =
        (await exists(path.join(AGENTS_ROOT, `${rest}.md`))) ||
        (await exists(path.join(COMMANDS_ROOT, `${rest}.md`)));
    }
    if (!resolved) dangling.push({ token, files: [...fileSet].sort() });
  }
  return dangling.sort((a, b) => a.token.localeCompare(b.token));
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function isMainEntry() {
  if (!process.argv[1]) return false;
  return path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMainEntry()) {
  const graph = await buildDispatchGraph();

  console.log(`Dispatch graph nodes: ${graph.size}`);
  for (const [agent, peers] of graph.entries()) {
    const edgeList = peers.length > 0 ? peers.join(", ") : "(none)";
    console.log(`  ${agent} → ${edgeList}`);
  }

  const cycles = detectCycles(graph);
  if (cycles.length > 0) {
    console.error(`\nDispatch graph validation FAILED: ${cycles.length} cycle(s) detected.`);
    for (const cycle of cycles) {
      console.error(`  Cycle: ${cycle.join(" → ")}`);
    }
    console.error(
      "\nCycles in the dispatch graph create infinite dispatch loops. " +
        "Fix by removing one of the whitelist entries that closes the cycle. " +
        "If this is a legitimate bidirectional advisory pair, add it to " +
        "BIDIRECTIONAL_ALLOWED in scripts/validate-dispatch-graph.ts."
    );
    process.exitCode = 1;
  } else {
    console.log("\nDispatch graph OK: no cycles detected (clean DAG).");
  }

  // Phantom-agent resolver check (arch-review §2.1): every crew:<name> dispatch
  // token in commands/ + skills/ must resolve to a real agent or command file.
  const dangling = await findDanglingDispatchRefs();
  if (dangling.length > 0) {
    console.error(
      `\nDispatch-ref validation FAILED: ${dangling.length} phantom dispatch token(s).`
    );
    for (const { token, files } of dangling) {
      console.error(`  ${token} — no agents/ or commands/ target. Referenced in: ${files.join(", ")}`);
    }
    console.error(
      "\nA crew:<name> token must resolve to agents/<name>.md, agents/3rdparty/<name>.md, " +
        "or commands/<name>.md. Fix the reference to a real target, rename the agent, " +
        "or (for a deliberate non-file token) add it to ALLOWED_NONFILE_TOKENS."
    );
    process.exitCode = 1;
  } else {
    console.log("Dispatch-ref OK: all crew:<name> tokens in commands/ + skills/ resolve.");
  }
}
