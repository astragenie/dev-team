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

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  detectCycles,
  parseWhitelistEntries,
  buildDispatchGraph,
  findDanglingDispatchRefs,
  BIDIRECTIONAL_ALLOWED
} from "../scripts/validate-dispatch-graph.ts";

// ── Unit tests: detectCycles ──────────────────────────────────────────────────

describe("detectCycles — 0-cycle graph", () => {
  test("empty graph has no cycles", () => {
    const graph = new Map<string, string[]>();
    const cycles = detectCycles(graph);
    assert.equal(cycles.length, 0, "Empty graph should have no cycles");
  });

  test("single node with no edges has no cycles", () => {
    const graph = new Map([["a", []]]);
    const cycles = detectCycles(graph);
    assert.equal(cycles.length, 0, "Single node with no edges should have no cycles");
  });

  test("linear chain A → B → C has no cycles", () => {
    const graph = new Map([
      ["a", ["b"]],
      ["b", ["c"]],
      ["c", []]
    ]);
    const cycles = detectCycles(graph);
    assert.equal(cycles.length, 0, "Linear chain should have no cycles");
  });
});

describe("detectCycles — 2-node cycle", () => {
  test("A → B → A is detected as a cycle", () => {
    const graph = new Map([
      ["a", ["b"]],
      ["b", ["a"]]
    ]);
    const cycles = detectCycles(graph);
    assert.ok(cycles.length > 0, "Expected at least one cycle for A → B → A");
    // The cycle must contain both 'a' and 'b'
    const cycleNodes = cycles.flat();
    assert.ok(cycleNodes.includes("a"), "Cycle should mention node 'a'");
    assert.ok(cycleNodes.includes("b"), "Cycle should mention node 'b'");
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
    assert.ok(cycles.length > 0, "Expected at least one cycle for A → B → C → A");
    const cycleNodes = cycles.flat();
    assert.ok(cycleNodes.includes("a"), "Cycle should mention node 'a'");
    assert.ok(cycleNodes.includes("b"), "Cycle should mention node 'b'");
    assert.ok(cycleNodes.includes("c"), "Cycle should mention node 'c'");
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
    assert.equal(cycles.length, 0, "Diamond DAG should have no cycles");
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
    assert.equal(cycles.length, 0, "Shared-leaf DAG should have no cycles");
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
    assert.ok(
      hasQaPerfPair,
      "qa-expert ↔ performance-engineer must be in BIDIRECTIONAL_ALLOWED (FEAT-163 line 50)"
    );
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
    assert.equal(
      cycles.length,
      0,
      `Real agent graph should have no cycles. Found: ${cycles.map((c) => c.join(" → ")).join("; ")}`
    );

    // Verify qa-expert and performance-engineer are present in the graph.
    // Their bidirectional edges are filtered out by buildDispatchGraph.
    const qaEdges = graph.get("qa-expert") ?? [];
    const perfEdges = graph.get("performance-engineer") ?? [];
    // After filtering the bidirectional pair, neither should point to the other
    assert.ok(
      !qaEdges.includes("performance-engineer"),
      "qa-expert → performance-engineer edge should be filtered (bidirectional exception)"
    );
    assert.ok(
      !perfEdges.includes("qa-expert"),
      "performance-engineer → qa-expert edge should be filtered (bidirectional exception)"
    );
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
    assert.deepEqual(entries, ["researcher", "investigator"]);
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
    assert.equal(entries.length, 0, "Blacklist backtick entries must not appear in whitelist");
  });

  test("returns empty array when no Peer dispatch heading present", () => {
    const text = `
## Integration with Other Agents

- Receive scope from lead.
`;
    const entries = parseWhitelistEntries(text);
    assert.equal(entries.length, 0, "No Peer dispatch section → empty entries");
  });

  test("handles section with no MUST NOT boundary (entire section is whitelist region)", () => {
    const text = `
## Peer dispatch — when to use the Agent tool

- \`architect\`: for design context.
`;
    const entries = parseWhitelistEntries(text);
    assert.deepEqual(entries, ["architect"]);
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
    assert.equal(cycles.length, 0, "Linear graph should have no cycles");
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
    assert.ok(cycles.length > 0, "2-node cycle must be detected");
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
    assert.equal(
      cycles.length,
      0,
      "qa-expert ↔ performance-engineer is an allowlisted bidirectional pair — must NOT be flagged as a cycle"
    );
  });
});

// ── Unit tests: findDanglingDispatchRefs (arch-review §2.1 phantom-agent guard) ──
describe("findDanglingDispatchRefs", () => {
  async function makeRepo(files: Record<string, string>): Promise<string> {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "dispatch-refs-"));
    for (const [rel, content] of Object.entries(files)) {
      const full = path.join(root, rel);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, content, "utf8");
    }
    return root;
  }

  test("flags a crew:<name> token with no agent or command target", async () => {
    const root = await makeRepo({
      "commands/orchestrate-slice.md": "Dispatch `crew:reviewer-validator` for light tier.",
      "agents/reviewer.md": "# reviewer"
    });
    const dangling = await findDanglingDispatchRefs(root);
    assert.equal(dangling.length, 1);
    assert.equal(dangling[0]?.token, "crew:reviewer-validator");
    assert.ok(dangling[0]?.files.some((f) => f.includes("orchestrate-slice.md")));
  });

  test("resolves agent, command, and 3rdparty tokens (no false positives)", async () => {
    const root = await makeRepo({
      "commands/review.md": "Dispatch `crew:reviewer` then run `crew:ship`.",
      "skills/x/SKILL.md": "Use `crew:verifier` and `crew:3rdparty:critical-thinking`.",
      "agents/reviewer.md": "# reviewer",
      "agents/verifier.md": "# verifier",
      "commands/ship.md": "# ship",
      "agents/3rdparty/critical-thinking.md": "# ct"
    });
    const dangling = await findDanglingDispatchRefs(root);
    assert.deepEqual(dangling, [], `unexpected dangling: ${JSON.stringify(dangling)}`);
  });
});
