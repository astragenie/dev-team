// tests/validate-agents-peer-dispatch.test.ts — FEAT-163 SLICE-71
//
// Unit tests for the Peer dispatch lint rule added to validate-agents.ts.
// Covers three cases:
//   (a) Positive: allowlisted agent with Agent tool + correct Peer dispatch section → passes
//   (b) Negative: allowlisted agent with Agent tool but missing Peer dispatch section → fails
//   (c) Exempt: non-allowlisted agent with Agent tool (e.g. "fullstack-dev") → passes
//
// Uses the same temp-fixture pattern as tests/validate-agents.test.ts.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateAgents } from "../scripts/validate-agents.ts";

/** Write a synthetic agents/ directory under a tmpdir and return its path. */
async function makeAgentsDir(files: Record<string, string>) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "validate-agents-pd-"));
  for (const [name, content] of Object.entries(files)) {
    await fs.writeFile(path.join(root, name), content, "utf8");
  }
  return root;
}

// ── Shared fixture fragments ───────────────────────────────────────────────────

const WELL_FORMED_PEER_DISPATCH_SECTION = `
## Integration with Other Agents

- Receive scope from lead

## Peer dispatch — when to use the Agent tool

You have the \`Agent\` tool. You MAY dispatch peers in this whitelist:

- \`investigator\`: when locating target files before sweep.

You MUST NOT dispatch:

- \`backend-dev\`, \`frontend-dev\`, \`fullstack-dev\` — implementers.

Dispatch budget per slice: max 2 peer dispatches.
Dispatch budget per turn: max 1 peer dispatch.

### Dispatch prompt purity (inherited from lead v0.35.2)

Do NOT inject identity. Address peer directly. State deliverable. Never use \`caveman:*\`.

### Final-tool-call invariant (HARD)

Peer outputs are inputs to YOUR work. Your LAST tool call MUST be your role write-*.

See FEAT-163 for the full peer-dispatch design.
`;

// ── Positive case ─────────────────────────────────────────────────────────────

describe("Peer dispatch lint rule — positive case", () => {
  test("allowlisted agent with Agent in tools and correct Peer dispatch section passes", async () => {
    const content = `---
name: refactor
description: Code quality specialist.
model: sonnet
tools:
  - Read
  - Edit
  - Bash
  - Agent
---

You are a refactor agent on a Claude Code engineering team.

## Report contract

Write your handoff via write-handoff.
${WELL_FORMED_PEER_DISPATCH_SECTION}`;

    const root = await makeAgentsDir({ "refactor.md": content });
    const result = await validateAgents(root);
    assert.equal(
      result.ok,
      true,
      `Unexpected errors for allowlisted agent with correct Peer dispatch: ${result.errors.join("; ")}`
    );
  });

  test("allowlisted agent document-writer with Agent tool and full Peer dispatch section passes", async () => {
    const content = `---
name: document-writer
description: Documentation specialist.
model: haiku
tools:
  - Read
  - Edit
  - Write
  - Bash
  - Agent
---

You are the documentation writer for this repository.

## Report contract

Write your handoff or final doc Write/Edit.
${WELL_FORMED_PEER_DISPATCH_SECTION}`;

    const root = await makeAgentsDir({ "document-writer.md": content });
    const result = await validateAgents(root);
    assert.equal(
      result.ok,
      true,
      `Unexpected errors for document-writer with correct Peer dispatch: ${result.errors.join("; ")}`
    );
  });
});

// ── Negative case ─────────────────────────────────────────────────────────────

describe("Peer dispatch lint rule — negative case", () => {
  test("allowlisted agent with Agent in tools but missing Peer dispatch section fails", async () => {
    const content = `---
name: refactor
description: Code quality specialist.
model: sonnet
tools:
  - Read
  - Edit
  - Bash
  - Agent
---

You are a refactor agent on a Claude Code engineering team.

## Integration with Other Agents

- Receive sweep scope from inspector.

## Report contract

Write your handoff via write-handoff.
`;
    const root = await makeAgentsDir({ "refactor.md": content });
    const result = await validateAgents(root);
    assert.equal(
      result.ok,
      false,
      "Expected validation failure when Peer dispatch section is absent for allowlisted agent"
    );
    assert.ok(
      result.errors.some((e) => /missing "## Peer dispatch" section/.test(e)),
      `Expected missing Peer dispatch error, got: ${result.errors.join("; ")}`
    );
  });

  test("allowlisted agent with Agent tool but missing whitelist entry fails", async () => {
    const content = `---
name: document-writer
description: Documentation specialist.
model: haiku
tools:
  - Read
  - Write
  - Agent
---

You are the documentation writer for this repository.

## Integration with Other Agents

- Receive scope from lead.

## Peer dispatch — when to use the Agent tool

No whitelist entries here.

You MUST NOT dispatch backend-dev.

Dispatch budget per slice: max 2 peer dispatches.

### Final-tool-call invariant (HARD)

Peer outputs are inputs. See FEAT-163.

## Report contract

Write your handoff.
`;
    const root = await makeAgentsDir({ "document-writer.md": content });
    const result = await validateAgents(root);
    assert.equal(
      result.ok,
      false,
      "Expected validation failure when Peer dispatch section has no whitelist bullet"
    );
    assert.ok(
      result.errors.some((e) => /missing whitelist entry/.test(e)),
      `Expected whitelist error, got: ${result.errors.join("; ")}`
    );
  });

  test("allowlisted agent with Agent tool but missing blacklist fails", async () => {
    const content = `---
name: refactor
description: Code quality specialist.
model: sonnet
tools:
  - Read
  - Bash
  - Agent
---

You are a refactor agent on a Claude Code engineering team.

## Peer dispatch — when to use the Agent tool

You MAY dispatch:

- \`investigator\`: when locating target files.

No blacklist declared here.

Dispatch budget per slice: max 2 peer dispatches.

## Report contract

Write your handoff.
`;
    const root = await makeAgentsDir({ "refactor.md": content });
    const result = await validateAgents(root);
    assert.equal(
      result.ok,
      false,
      "Expected validation failure when Peer dispatch section has no blacklist"
    );
    assert.ok(
      result.errors.some((e) => /missing blacklist/.test(e)),
      `Expected blacklist error, got: ${result.errors.join("; ")}`
    );
  });

  test("allowlisted agent with Agent tool but missing budget line fails", async () => {
    const content = `---
name: document-writer
description: Documentation specialist.
model: haiku
tools:
  - Read
  - Agent
---

You are the documentation writer for this repository.

## Peer dispatch — when to use the Agent tool

You MAY dispatch:

- \`investigator\`: when locating cross-references.

You MUST NOT dispatch backend-dev.

No budget line declared here.

## Report contract

Write your handoff.
`;
    const root = await makeAgentsDir({ "document-writer.md": content });
    const result = await validateAgents(root);
    assert.equal(
      result.ok,
      false,
      "Expected validation failure when Peer dispatch section has no budget line"
    );
    assert.ok(
      result.errors.some((e) => /missing dispatch budget line/.test(e)),
      `Expected budget error, got: ${result.errors.join("; ")}`
    );
  });
});

// ── Exempt case ───────────────────────────────────────────────────────────────

describe("Peer dispatch lint rule — exempt case (not in allowlist)", () => {
  test("non-allowlisted agent with Agent in tools but NO Peer dispatch section passes", async () => {
    // fullstack-dev has Agent in its tools via the global builder frontmatter
    // but is NOT in PEER_DISPATCH_ALLOWLIST for SLICE-71 (SLICE-B scope).
    // Validator must not flag it.
    const content = `---
name: fullstack-dev
description: Fullstack implementation specialist.
model: sonnet
tools:
  - Read
  - Edit
  - Write
  - Bash
  - Agent
---

You are a fullstack-dev agent on a Claude Code engineering team.

TaskUpdate batching: never run >=3 back-to-back without intervening work.
Coalesce Bash calls: chain related data-collection commands.

## Integration with Other Agents

- Receive scope from lead.

## Report contract

Write your handoff via write-handoff.
`;
    const root = await makeAgentsDir({ "fullstack-dev.md": content });
    const result = await validateAgents(root);
    assert.equal(
      result.ok,
      true,
      `Non-allowlisted agent should pass even without Peer dispatch section. Errors: ${result.errors.join("; ")}`
    );
  });

  test("allowlisted agent WITHOUT Agent in tools also passes (rule only fires when Agent explicit)", async () => {
    // document-writer without Agent in tools: rule must not fire even though
    // it is in the allowlist.
    const content = `---
name: document-writer
description: Documentation specialist.
model: haiku
tools:
  - Read
  - Edit
  - Write
  - Bash
---

You are the documentation writer for this repository.

## Integration with Other Agents

- Receive scope from lead.

## Report contract

Write your handoff.
`;
    const root = await makeAgentsDir({ "document-writer.md": content });
    const result = await validateAgents(root);
    assert.equal(
      result.ok,
      true,
      `Allowlisted agent without Agent tool should pass without Peer dispatch section. Errors: ${result.errors.join("; ")}`
    );
  });
});
