// tests/agent-topology.test.mjs — pin the exact set of first-party agents.
// Fails if an agent is added without updating EXPECTED_AGENTS,
// or if any expected agent is removed or renamed.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const AGENTS_ROOT = path.join(repoRoot, "agents");

/**
 * The canonical set of first-party agents.
 * Update this list — and governance.md + README.md — when adding or removing an agent.
 */
const EXPECTED_AGENTS = new Set([
  "lead",
  "builder",
  "builder-fe",
  "builder-be",
  "reviewer",
  "validator",
  "deployer",
  "integrator",
  "researcher",
  "architect",
  "uxdesigner"
]);

/** Read `name:` from frontmatter. Returns null if absent. */
async function readAgentName(filePath: string) {
  const text = await fs.readFile(filePath, "utf8");
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const nameLine = m[1]!.match(/^name:\s*(.+)$/m);
  return nameLine ? nameLine[1]!.trim() : null;
}

test("agents/ root contains exactly the expected first-party agents", async () => {
  const entries = await fs.readdir(AGENTS_ROOT, { withFileTypes: true });
  const mdFiles = entries.filter((e) => e.isFile() && e.name.endsWith(".md"));

  const names = [];
  for (const f of mdFiles) {
    const name = await readAgentName(path.join(AGENTS_ROOT, f.name));
    if (name) names.push(name);
  }

  const foundSet = new Set(names);

  // Every expected agent must exist
  for (const expected of EXPECTED_AGENTS) {
    assert.ok(
      foundSet.has(expected),
      `Expected agent "${expected}" is missing from agents/ root. Add it or update EXPECTED_AGENTS.`
    );
  }

  // No unexpected agents allowed
  for (const found of foundSet) {
    assert.ok(
      EXPECTED_AGENTS.has(found),
      `Unexpected agent "${found}" found in agents/ root. Add it to EXPECTED_AGENTS if intentional.`
    );
  }

  // Exact count
  assert.equal(
    names.length,
    EXPECTED_AGENTS.size,
    `Expected ${EXPECTED_AGENTS.size} agents, found ${names.length}: [${names.join(", ")}]`
  );
});

test("no .md files at agents/ root belong to 3rdparty/ subdirectory", async () => {
  // Confirm 3rdparty agents are NOT at the root level (they live in agents/3rdparty/)
  const entries = await fs.readdir(AGENTS_ROOT, { withFileTypes: true });
  const rootMdFiles = entries
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => path.basename(e.name, ".md"));

  // All root-level .md files should be in EXPECTED_AGENTS
  for (const name of rootMdFiles) {
    const agentName = await readAgentName(path.join(AGENTS_ROOT, `${name}.md`));
    if (agentName) {
      assert.ok(
        EXPECTED_AGENTS.has(agentName),
        `Root-level agent "${agentName}" is not in the expected topology. ` +
          "3rdparty agents must live under agents/3rdparty/, not agents/ root."
      );
    }
  }
});
