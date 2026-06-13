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

const AGENTS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "agents");

// Agents whose Peer dispatch whitelists are parsed for graph construction.
// Must be kept in sync with PEER_DISPATCH_ALLOWLIST in validate-agents.ts.
const PEER_DISPATCH_ALLOWLIST = new Set([
  "document-writer",
  "refactor",
  "architect",
  "uxdesigner",
  "qa-expert",
  "performance-engineer"
]);

// Documented bidirectional pairs that are intentional and MUST NOT trigger
// the cycle detector. Format: [agentA, agentB] — order within the pair is
// irrelevant (both directions are covered).
export const BIDIRECTIONAL_ALLOWED: Array<[string, string]> = [
  ["qa-expert", "performance-engineer"]
];

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
  const peerDispatchIdx = text.search(/##\s+Peer dispatch/i);
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
}
