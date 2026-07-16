// tests/validate-dispatch-graph.test.ts — FEAT-163 SLICE-73
//
// Unit tests for the dispatch-graph cycle detector in
// scripts/validate-dispatch-graph.ts.
//
// Test cases:
//   (a) 0-cycle graph PASSES (empty graph or simple DAG)
//   (b) 2-node cycle FAILS (A → B → A)
//   (c) 3-node cycle FAILS (A → B → C → A)
//   (d) Valid DAG with shared dependency PASSES (diamond — A → C, B → C)
//   (e) qa-expert ↔ performance-engineer bidirectional pair PASSES (allowlisted exception)
//   (f) parseWhitelistEntries extracts entries only from whitelist region

import { test, expect, describe } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  detectCycles,
  parseWhitelistEntries,
  buildDispatchGraph,
  BIDIRECTIONAL_ALLOWED
} from "../scripts/validate-dispatch-graph.ts";

// ── Unit tests: detectCycles ──────────────────────────────────────────────────

describe("detectCycles — 0-cycle graph", () => {
  test("empty graph has no cycles", () => {
    const graph = new Map<string, string[]>();
    const cycles = detectCycles(graph);
    expect(cycles.length, "Empty graph should have no cycles").toBe(0);
  });

  test("single node with no edges has no cycles", () => {
    const graph = new Map([["a", []]]);
    const cycles = detectCycles(graph);
    expect(cycles.length, "Single node with no edges should have no cycles").toBe(0);
  });

  test("linear chain A → B → C has no cycles", () => {
    const graph = new Map([
      ["a", ["b"]],
      ["b", ["c"]],
      ["c", []]
    ]);
    const cycles = detectCycles(graph);
    expect(cycles.length, "Linear chain should have no cycles").toBe(0);
  });
});

describe("detectCycles — 2-node cycle", () => {
  test("A → B → A is detected as a cycle", () => {
    const graph = new Map([
      ["a", ["b"]],
      ["b", ["a"]]
    ]);
    const cycles = detectCycles(graph);
    expect(cycles.length > 0, "Expected at least one cycle for A → B → A").toBeTruthy();
    // The cycle must contain both 'a' and 'b'
    const cycleNodes = cycles.flat();
    expect(cycleNodes.includes("a"), "Cycle should mention node 'a'").toBeTruthy();
    expect(cycleNodes.includes("b"), "Cycle should mention node 'b'").toBeTruthy();
  });
});

describe("detectCycles — 3-node cycle", () => {
  test("A → B → C → A is detected as a cycle", () => {
    const graph = new Map([
      ["a", ["b"]],
      ["b", ["c"]],
      ["c", ["a"]]
    ]);
    const cycles = detectCycles(graph);
    expect(cycles.length > 0, "Expected at least one cycle for A → B → C → A").toBeTruthy();
    const cycleNodes = cycles.flat();
    expect(cycleNodes.includes("a"), "Cycle should mention node 'a'").toBeTruthy();
    expect(cycleNodes.includes("b"), "Cycle should mention node 'b'").toBeTruthy();
    expect(cycleNodes.includes("c"), "Cycle should mention node 'c'").toBeTruthy();
  });
});

describe("detectCycles — valid DAG with shared dependency", () => {
  test("diamond DAG (A → C, B → C) has no cycles", () => {
    const graph = new Map([
      ["a", ["c"]],
      ["b", ["c"]],
      ["c", []]
    ]);
    const cycles = detectCycles(graph);
    expect(cycles.length, "Diamond DAG should have no cycles").toBe(0);
  });

  test("two independent chains with a shared leaf have no cycles", () => {
    // architect → researcher, uxdesigner → researcher (both advisory agents
    // pointing to the same leaf)
    const graph = new Map([
      ["architect", ["researcher"]],
      ["uxdesigner", ["researcher"]],
      ["researcher", []]
    ]);
    const cycles = detectCycles(graph);
    expect(cycles.length, "Shared-leaf DAG should have no cycles").toBe(0);
  });
});

// ── BIDIRECTIONAL_ALLOWED constant ────────────────────────────────────────────

describe("BIDIRECTIONAL_ALLOWED constant", () => {
  test("qa-expert ↔ performance-engineer pair is in the allowlist", () => {
    const hasQaPerfPair = BIDIRECTIONAL_ALLOWED.some(
      ([a, b]) =>
        (a === "qa-expert" && b === "performance-engineer") ||
        (a === "performance-engineer" && b === "qa-expert")
    );
    expect(
      hasQaPerfPair,
      "qa-expert ↔ performance-engineer must be in BIDIRECTIONAL_ALLOWED (FEAT-163 line 50)"
    ).toBeTruthy();
  });
});

// ── Integration test: buildDispatchGraph from real agent files ─────────────────

describe("buildDispatchGraph — qa-expert ↔ performance-engineer bidirectional exception", () => {
  test("real agent files do not produce qa-expert ↔ performance-engineer cycle", async () => {
    // Use the actual agents/ directory from the repo root (relative to this test file).
    const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
    const agentsRoot = path.join(repoRoot, "agents");

    let graph: Map<string, string[]>;
    try {
      graph = await buildDispatchGraph(agentsRoot);
    } catch {
      // If agents dir is unavailable in this test environment, skip gracefully.
      return;
    }

    const cycles = detectCycles(graph);
    expect(
      cycles.length,
      `Real agent graph should have no cycles. Found: ${cycles.map((c) => c.join(" → ")).join("; ")}`
    ).toBe(0);

    // Verify qa-expert and performance-engineer are present in the graph.
    // Their bidirectional edges are filtered out by buildDispatchGraph.
    const qaEdges = graph.get("qa-expert") ?? [];
    const perfEdges = graph.get("performance-engineer") ?? [];
    // After filtering the bidirectional pair, neither should point to the other
    expect(
      !qaEdges.includes("performance-engineer"),
      "qa-expert → performance-engineer edge should be filtered (bidirectional exception)"
    ).toBeTruthy();
    expect(
      !perfEdges.includes("qa-expert"),
      "performance-engineer → qa-expert edge should be filtered (bidirectional exception)"
    ).toBeTruthy();
  });
});

// ── parseWhitelistEntries ─────────────────────────────────────────────────────

describe("parseWhitelistEntries", () => {
  test("extracts entries from whitelist region only (before MUST NOT dispatch)", () => {
    const text = `
## Peer dispatch — when to use the Agent tool

You MAY dispatch:

- \`researcher\`: when prior context is needed.
- \`investigator\`: when locating files.

You MUST NOT dispatch:

- \`backend-dev\`: implementers; never.
- \`frontend-dev\`: implementers; never.
`;
    const entries = parseWhitelistEntries(text);
    expect(entries).toEqual(["researcher", "investigator"]);
  });

  test("does NOT include backtick entries from blacklist region", () => {
    const text = `
## Peer dispatch — when to use the Agent tool

No whitelist entries here.

You MUST NOT dispatch:

- \`backend-dev\`: implementers.
- \`frontend-dev\`: implementers.
`;
    const entries = parseWhitelistEntries(text);
    expect(entries.length, "Blacklist backtick entries must not appear in whitelist").toBe(0);
  });

  test("returns empty array when no Peer dispatch heading present", () => {
    const text = `
## Integration with Other Agents

- Receive scope from lead.
`;
    const entries = parseWhitelistEntries(text);
    expect(entries.length, "No Peer dispatch section → empty entries").toBe(0);
  });

  test("handles section with no MUST NOT boundary (entire section is whitelist region)", () => {
    const text = `
## Peer dispatch — when to use the Agent tool

- \`architect\`: for design context.
`;
    const entries = parseWhitelistEntries(text);
    expect(entries).toEqual(["architect"]);
  });
});

// ── Synthetic buildDispatchGraph test ─────────────────────────────────────────

describe("buildDispatchGraph — synthetic fixtures", () => {
  /** Write synthetic agent files and return the tmpdir path. */
  async function makeAgentsDir(files: Record<string, string>): Promise<string> {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "validate-dispatch-graph-"));
    for (const [name, content] of Object.entries(files)) {
      await fs.writeFile(path.join(root, name), content, "utf8");
    }
    return root;
  }

  test("graph with no cycles passes detectCycles", async () => {
    const root = await makeAgentsDir({
      "document-writer.md": `---
name: document-writer
---
## Peer dispatch — when to use the Agent tool
- \`researcher\`: context.
You MUST NOT dispatch backend-dev.
`,
      "researcher.md": `---
name: researcher
---
`
    });

    const graph = await buildDispatchGraph(root);
    const cycles = detectCycles(graph);
    expect(cycles.length, "Linear graph should have no cycles").toBe(0);
  });

  test("graph with 2-node cycle fails detectCycles", async () => {
    // This tests the cycle detection logic with synthetic content;
    // real agents should not create this shape.
    const agentA = `---
name: document-writer
---
## Peer dispatch — when to use the Agent tool
- \`refactor\`: for cycle test.
You MUST NOT dispatch backend-dev.
`;
    const agentB = `---
name: refactor
---
## Peer dispatch — when to use the Agent tool
- \`document-writer\`: for cycle test.
You MUST NOT dispatch backend-dev.
`;
    const root = await makeAgentsDir({
      "document-writer.md": agentA,
      "refactor.md": agentB
    });

    const graph = await buildDispatchGraph(root);
    const cycles = detectCycles(graph);
    expect(cycles.length > 0, "2-node cycle must be detected").toBeTruthy();
  });

  test("qa-expert ↔ performance-engineer bidirectional pair does NOT produce a cycle", async () => {
    // When both agents whitelist each other, buildDispatchGraph strips those
    // edges as BIDIRECTIONAL_ALLOWED. The result is a DAG with no cycles.
    const qaContent = `---
name: qa-expert
---
## Peer dispatch — when to use the Agent tool
- \`performance-engineer\`: coordinate perf scenarios.
You MUST NOT dispatch backend-dev.
`;
    const perfContent = `---
name: performance-engineer
---
## Peer dispatch — when to use the Agent tool
- \`qa-expert\`: coordinate qa scenarios.
You MUST NOT dispatch backend-dev.
`;
    const root = await makeAgentsDir({
      "qa-expert.md": qaContent,
      "performance-engineer.md": perfContent
    });

    const graph = await buildDispatchGraph(root);
    const cycles = detectCycles(graph);
    expect(
      cycles.length,
      "qa-expert ↔ performance-engineer is an allowlisted bidirectional pair — must NOT be flagged as a cycle"
    ).toBe(0);
  });
});
