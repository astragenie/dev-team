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

See the project peer-dispatch design notes.
`;

// ── Positive case ─────────────────────────────────────────────────────────────

describe("Peer dispatch lint rule — positive case", () => {
  test("allowlisted agent with Agent in tools and correct Peer dispatch section passes", async () => {
    const content = `---
name: refactor
prompt_id: refactor
version: 1.0.0
evals: planned:evals/agents/refactor.yaml
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
prompt_id: document-writer
version: 1.0.0
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
prompt_id: refactor
version: 1.0.0
evals: planned:evals/agents/refactor.yaml
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

- Receive sweep scope from reviewer.

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
prompt_id: document-writer
version: 1.0.0
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
prompt_id: refactor
version: 1.0.0
evals: planned:evals/agents/refactor.yaml
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
prompt_id: document-writer
version: 1.0.0
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

// ── Regex tightening regression case (FEAT-163 SLICE-73 reviewer MEDIUM) ────
//
// Prior regex matched backtick bullets ANYWHERE in the post-heading content,
// including in the blacklist region. This test verifies the tightened split:
// a section with ONLY blacklist backtick entries and NO whitelist bullets must
// fail the whitelist-entry check.

describe("Peer dispatch lint rule — regex tightening (backtick blacklist only)", () => {
  test("section with backtick entries only in blacklist region (no whitelist bullets) fails", async () => {
    const content = `---
name: refactor
prompt_id: refactor
version: 1.0.0
evals: planned:evals/agents/refactor.yaml
description: Code quality specialist.
model: sonnet
tools:
  - Read
  - Bash
  - Agent
---

You are a refactor agent on a Claude Code engineering team.

## Peer dispatch — when to use the Agent tool

You MAY dispatch peers in this whitelist when you need their output to complete YOUR task.

No whitelist bullets above — only backtick entries appear below the blacklist boundary.

You MUST NOT dispatch:

- \`backend-dev\`: implementers; never.
- \`frontend-dev\`: implementers; never.
- \`fullstack-dev\`: implementers; never.

Dispatch budget per slice: max 2 peer dispatches.

## Report contract

Write your handoff via write-handoff.
`;
    const root = await makeAgentsDir({ "refactor.md": content });
    const result = await validateAgents(root);
    assert.equal(
      result.ok,
      false,
      "Expected validation failure: backtick entries only in blacklist region should NOT satisfy whitelist-entry check"
    );
    assert.ok(
      result.errors.some((e) => /missing whitelist entry/.test(e)),
      `Expected whitelist error, got: ${result.errors.join("; ")}`
    );
  });

  test("section with whitelist bullet BEFORE blacklist and blacklist backticks after passes", async () => {
    const content = `---
name: refactor
prompt_id: refactor
version: 1.0.0
evals: planned:evals/agents/refactor.yaml
description: Code quality specialist.
model: sonnet
tools:
  - Read
  - Bash
  - Agent
---

You are a refactor agent on a Claude Code engineering team.

## Peer dispatch — when to use the Agent tool

You MAY dispatch peers in this whitelist when you need their output:

- \`investigator\`: when locating target files before sweep.

You MUST NOT dispatch:

- \`backend-dev\`: implementers; never.
- \`frontend-dev\`: implementers; never.

Dispatch budget per slice: max 2 peer dispatches.

## Report contract

Write your handoff via write-handoff.
`;
    const root = await makeAgentsDir({ "refactor.md": content });
    const result = await validateAgents(root);
    assert.equal(
      result.ok,
      true,
      `Whitelist bullet before blacklist should pass. Errors: ${result.errors.join("; ")}`
    );
  });
});

// ── Advisory agents (SLICE-73) ────────────────────────────────────────────────

describe("Peer dispatch lint rule — SLICE-73 advisory agents", () => {
  // Extra required phrases per agent (from TASK_UPDATE_BATCHING_REQUIRED and
  // BASH_COALESCING_REQUIRED sets in validate-agents.ts).
  // architect requires both; the others do not.
  const ADVISORY_AGENTS: Array<{
    name: string;
    intro: string;
    whitelist: string;
    extraBody?: string;
  }> = [
    {
      name: "architect",
      intro: "You are the Architect for this crew.",
      whitelist: "- `researcher`: when prior-decision context is needed.",
      // architect is in TASK_UPDATE_BATCHING_REQUIRED + BASH_COALESCING_REQUIRED
      extraBody:
        "TaskUpdate batching: never run >=3 back-to-back without intervening work.\n" +
        "Coalesce Bash calls: chain related data-collection commands."
    },
    {
      name: "uxdesigner",
      intro: "You are the UXDesigner for this crew.",
      whitelist: "- `architect`: when system constraints are needed."
    },
    {
      name: "qa-expert",
      intro: "You are the QA specialist for this crew.",
      whitelist: "- `investigator`: when locating test files."
    },
    {
      name: "performance-engineer",
      intro: "You are the performance specialist for this crew.",
      whitelist: "- `investigator`: when locating code paths."
    }
  ];

  for (const { name, intro, whitelist, extraBody } of ADVISORY_AGENTS) {
    test(`allowlisted advisory agent "${name}" with Agent tool and correct Peer dispatch section passes`, async () => {
      const content = `---
name: ${name}
prompt_id: ${name}
version: 1.0.0
description: ${name} specialist.
model: sonnet
tools:
  - Read
  - Bash
  - Agent
---

${intro}

${extraBody ?? ""}

## Report contract

Write your handoff via write-handoff.

## Integration with Other Agents

- Receive scope from lead.

## Peer dispatch — when to use the Agent tool

You MAY dispatch peers in this whitelist:

${whitelist}

You MUST NOT dispatch:

- \`backend-dev\`, \`frontend-dev\`, \`fullstack-dev\` — implementers.

Dispatch budget per slice: max 2 peer dispatches.
Dispatch budget per turn: max 1 peer dispatch.

### Dispatch prompt purity (inherited from lead v0.35.2)

Do NOT inject identity. Never use caveman:* agents.

### Final-tool-call invariant (HARD)

Peer outputs are inputs to YOUR work. Your LAST tool call MUST be your role write-*.

See the project peer-dispatch design notes.
`;
      const root = await makeAgentsDir({ [`${name}.md`]: content });
      const result = await validateAgents(root);
      assert.equal(
        result.ok,
        true,
        `Advisory agent "${name}" with correct Peer dispatch section should pass. Errors: ${result.errors.join("; ")}`
      );
    });
  }
});

// ── Inline YAML tools format (Fix 3 — SLICE-74 cleanup) ─────────────────────
//
// architect.md and uxdesigner.md use `tools: [Read, Grep, Agent]` (inline YAML
// array) instead of a block-list. parseFrontmatterTools previously returned []
// for this format, silently suppressing the Peer dispatch lint rule for both
// agents. These tests verify the fix: inline format is parsed correctly, so the
// rule fires as expected.

describe("Peer dispatch lint rule — inline YAML tools: [A, B] format", () => {
  test("allowlisted agent with inline tools: [Agent] and correct Peer dispatch section passes", async () => {
    const content = `---
name: architect
prompt_id: architect
version: 1.0.0
description: Architecture specialist.
model: opus
tools: [Read, Grep, Glob, Bash, Edit, Write, Agent]
---

You are the Architect for this crew.

TaskUpdate batching: never run >=3 back-to-back without intervening work.
Coalesce Bash calls: chain related data-collection commands.

## Report contract

Write your design artifact.

## Integration with Other Agents

- Receive scope from lead.

## Peer dispatch — when to use the Agent tool

You MAY dispatch peers in this whitelist:

- \`researcher\`: when prior-decision context is needed.

You MUST NOT dispatch:

- \`backend-dev\`, \`frontend-dev\`, \`fullstack-dev\` — implementers.

Dispatch budget per slice: max 2 peer dispatches.
Dispatch budget per turn: max 1 peer dispatch.

### Dispatch prompt purity (inherited from lead v0.35.2)

Do NOT inject identity. Never use caveman:* agents.

### Final-tool-call invariant (HARD)

Peer outputs are inputs to YOUR work. Your LAST tool call MUST be your role write-*.

See the project peer-dispatch design notes.
`;
    const root = await makeAgentsDir({ "architect.md": content });
    const result = await validateAgents(root);
    assert.equal(
      result.ok,
      true,
      `architect with inline tools and correct Peer dispatch should pass. Errors: ${result.errors.join("; ")}`
    );
  });

  test("allowlisted agent with inline tools: [Agent] but missing Peer dispatch section fails", async () => {
    const content = `---
name: architect
prompt_id: architect
version: 1.0.0
description: Architecture specialist.
model: opus
tools: [Read, Grep, Agent]
---

You are the Architect for this crew.

TaskUpdate batching: never run >=3 back-to-back without intervening work.
Coalesce Bash calls: chain related data-collection commands.

## Integration with Other Agents

- Receive scope from lead.

## Report contract

Write your design artifact.
`;
    const root = await makeAgentsDir({ "architect.md": content });
    const result = await validateAgents(root);
    assert.equal(
      result.ok,
      false,
      "Expected validation failure: inline tools: [Agent] without Peer dispatch section should fail"
    );
    assert.ok(
      result.errors.some((e) => /missing "## Peer dispatch" section/.test(e)),
      `Expected missing Peer dispatch error, got: ${result.errors.join("; ")}`
    );
  });
});

// ── Implementer + release-engineer agents (SLICE-75) ─────────────────────────

describe("Peer dispatch lint rule — SLICE-75 implementer + release-engineer agents", () => {
  // backend-dev and frontend-dev carry `disallowedTools: Agent` (not `tools:`),
  // so the lint rule does NOT fire for them (condition (b) requires `tools:` with
  // `Agent` explicitly). fullstack-dev and release-engineer use the `tools:` format.
  //
  // These tests verify that agents in the SLICE-75 allowlist extension PASS
  // validation when they carry the correct Peer dispatch section AND Agent in tools:.
  // Separate tests cover the disallowedTools path (lint rule correctly skips them).

  const IMPLEMENTER_AGENTS: Array<{
    name: string;
    intro: string;
    whitelist: string;
    extraBody?: string;
  }> = [
    {
      name: "backend-dev",
      intro: "You are a backend-dev agent.",
      // backend-dev is in BASH_COALESCING_REQUIRED
      extraBody: "Coalesce Bash calls: chain related data-collection commands.",
      whitelist:
        "- `architect`: when mid-implementation needs contract clarification.\n- `investigator`: when locating call sites or dependency chains.\n- `document-writer`: when implementation completes and API docs need writing."
    },
    {
      name: "frontend-dev",
      intro: "You are a frontend-dev agent.",
      // frontend-dev is in BASH_COALESCING_REQUIRED
      extraBody: "Coalesce Bash calls: chain related data-collection commands.",
      whitelist:
        "- `architect`: when contract clarification mid-implementation is needed.\n- `investigator`: when locating existing component patterns.\n- `uxdesigner`: when implementation hits a design ambiguity.\n- `document-writer`: when implementation completes and component docs need writing."
    },
    {
      name: "fullstack-dev",
      intro: "You are a fullstack-dev agent.",
      // fullstack-dev is in TASK_UPDATE_BATCHING_REQUIRED + BASH_COALESCING_REQUIRED
      extraBody:
        "TaskUpdate batching: never run >=3 back-to-back without intervening work.\n" +
        "Coalesce Bash calls: chain related data-collection commands.",
      whitelist:
        "- `architect`: when contract clarification mid-implementation is needed.\n- `investigator`: when locating call sites or existing patterns.\n- `uxdesigner`: when implementation hits a design ambiguity.\n- `document-writer`: when implementation completes and downstream docs need writing.\n- `performance-engineer`: when implementation hits a perf-critical path."
    },
    {
      name: "release-engineer",
      intro: "You are the release-engineer on a Claude Code engineering team.",
      // release-engineer is in BASH_COALESCING_REQUIRED
      extraBody: "Coalesce Bash calls: chain related data-collection commands.",
      whitelist:
        "- `document-writer`: when a release needs CHANGELOG entry, release notes, or migration doc written."
    }
  ];

  for (const { name, intro, whitelist, extraBody } of IMPLEMENTER_AGENTS) {
    test(`allowlisted implementer agent "${name}" with Agent in tools and correct Peer dispatch section passes`, async () => {
      const content = `---
name: ${name}
prompt_id: ${name}
version: 1.0.0
evals: planned:evals/agents/${name}.yaml
description: ${name} specialist.
model: sonnet
tools:
  - Read
  - Bash
  - Agent
---

${intro}

${extraBody ?? ""}

## Report contract

Write your handoff via write-handoff.

## Integration with Other Agents

- Receive scope from lead.

## Peer dispatch — when to use the Agent tool

You have the \`Agent\` tool. You MAY dispatch peers in this whitelist when you need
their output to complete YOUR task:

${whitelist}

You MUST NOT dispatch:

- \`reviewer\`, \`reviewer-verifier\`, \`verifier\` — review and validation gates; orchestrator-only.
- \`lead\`, \`refactor\`, \`integrator\`, \`parallel-runner\` — orchestration roles.

Dispatch budget per slice: max 2 peer dispatches.
Dispatch budget per turn: max 1 peer dispatch.

### Dispatch prompt purity (inherited from lead v0.35.2)

Do NOT inject identity. Address peer directly. State deliverable. Never use \`caveman:*\`.

### Final-tool-call invariant (HARD)

Peer outputs are inputs to YOUR work. Your LAST tool call MUST be your role write-*.

See the project peer-dispatch design notes.
`;
      const root = await makeAgentsDir({ [`${name}.md`]: content });
      const result = await validateAgents(root);
      assert.equal(
        result.ok,
        true,
        `Implementer agent "${name}" with correct Peer dispatch section should pass. Errors: ${result.errors.join("; ")}`
      );
    });
  }

  test("backend-dev with disallowedTools (no explicit tools: block) passes without Peer dispatch section", async () => {
    // backend-dev in real life uses disallowedTools: Agent — no tools: block.
    // The lint rule fires only when tools: includes Agent explicitly.
    // This test verifies that an allowlisted agent WITHOUT Agent in tools: is not penalised.
    const content = `---
name: backend-dev
prompt_id: backend-dev
version: 1.0.0
evals: planned:evals/agents/backend-dev.yaml
description: Backend implementation specialist.
model: sonnet
disallowedTools: Agent
---

You are a backend-dev agent.

Coalesce Bash calls: chain related data-collection commands.

## Integration with Other Agents

- Receive scope from lead.

## Report contract

Write your handoff via write-handoff.
`;
    const root = await makeAgentsDir({ "backend-dev.md": content });
    const result = await validateAgents(root);
    assert.equal(
      result.ok,
      true,
      `backend-dev with disallowedTools (no tools: block) should pass without Peer dispatch section. Errors: ${result.errors.join("; ")}`
    );
  });
});

// ── Exempt case ───────────────────────────────────────────────────────────────

describe("Peer dispatch lint rule — exempt case (not in allowlist)", () => {
  test("non-allowlisted agent with Agent in tools but NO Peer dispatch section passes", async () => {
    // investigator is NOT in PEER_DISPATCH_ALLOWLIST (it is a leaf node — consumers
    // dispatch investigator, not the other way around). Validator must not flag it
    // even though it has Agent in its tools: block.
    const content = `---
name: investigator
prompt_id: investigator
version: 1.0.0
description: Code investigation specialist.
model: sonnet
tools:
  - Read
  - Grep
  - Glob
  - Bash
  - Agent
---

You are an investigator agent on a Claude Code engineering team.

## Integration with Other Agents

- Receive scope from lead.

## Report contract

Write your handoff via write-handoff.
`;
    const root = await makeAgentsDir({ "investigator.md": content });
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
prompt_id: document-writer
version: 1.0.0
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
