// tests/validate-agents.test.mjs — FEAT-035 SLICE-14
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateAgents } from "../scripts/validate-agents.ts";

/** Write a synthetic agents/ directory under a tmpdir and return its path. */
async function makeAgentsDir(files: Record<string, string>) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "validate-agents-"));
  for (const [name, content] of Object.entries(files)) {
    await fs.writeFile(path.join(root, name), content, "utf8");
  }
  return root;
}

const WELL_FORMED_BODY = `---
name: builder
prompt_id: builder
version: 1.0.0
description: Implementation specialist.
model: sonnet
---

You are the builder on a Claude Code engineering team.

TaskUpdate batching: never run >=3 back-to-back without intervening work.
Coalesce Bash calls: chain related data-collection commands.

## Report contract

Write your handoff via write-handoff.
`;

test("passes on a well-formed agent file", async () => {
  const root = await makeAgentsDir({ "builder.md": WELL_FORMED_BODY });
  const result = await validateAgents(root);
  assert.equal(result.ok, true, `unexpected errors: ${result.errors.join("; ")}`);
  assert.equal(result.agentCount, 1);
});

test("fails on missing required frontmatter field", async () => {
  const noModel = `---
name: builder
description: foo
---

You are the builder.

## Report contract

x
`;
  const root = await makeAgentsDir({ "builder.md": noModel });
  const result = await validateAgents(root);
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((e) => /missing required frontmatter "model"/.test(e)),
    `expected missing-model error, got: ${result.errors.join("; ")}`
  );
});

test("fails on missing or malformed frontmatter block", async () => {
  const noFrontmatter = `# Builder

You are the builder.

## Report contract

x
`;
  const root = await makeAgentsDir({ "builder.md": noFrontmatter });
  const result = await validateAgents(root);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /missing or malformed frontmatter/.test(e)));
});

test("fails when filename does not match frontmatter name", async () => {
  const root = await makeAgentsDir({ "wrong-name.md": WELL_FORMED_BODY });
  const result = await validateAgents(root);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /does not match frontmatter name/.test(e)));
});

test("fails on missing required '## Report contract' section (non-lead)", async () => {
  const noReportContract = `---
name: builder
description: foo
model: sonnet
---

You are the builder.

## Some Other Section

x
`;
  const root = await makeAgentsDir({ "builder.md": noReportContract });
  const result = await validateAgents(root);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /missing required section "## Report contract"/.test(e)));
});

test("lead role is exempt from '## Report contract' requirement", async () => {
  const leadBody = `---
name: lead
prompt_id: lead
version: 1.0.0
evals: evals/agents/lead.yaml
description: User-facing coordinator.
model: opus
---

You are the lead for a small software team.

TaskUpdate batching: never run >=3 back-to-back without intervening work.
Coalesce Bash calls: chain related data-collection commands.

## Core responsibilities

- coordinate
`;
  const root = await makeAgentsDir({ "lead.md": leadBody });
  const result = await validateAgents(root);
  assert.equal(result.ok, true, `unexpected errors: ${result.errors.join("; ")}`);
});

test("fails on missing identity intro statement", async () => {
  const noIdentity = `---
name: builder
description: foo
model: sonnet
---

Some text without a role declaration.

## Report contract

x
`;
  const root = await makeAgentsDir({ "builder.md": noIdentity });
  const result = await validateAgents(root);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /missing identity intro/.test(e)));
});

test("fails when file exceeds the default 350-line cap", async () => {
  const padded =
    `---
name: builder
description: foo
model: sonnet
---

You are the builder.

## Report contract

` + "x\n".repeat(351);
  const root = await makeAgentsDir({ "builder.md": padded });
  const result = await validateAgents(root);
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((e) => /exceeds the 350-line agent prompt cap/.test(e)),
    `expected line-cap error, got: ${result.errors.join("; ")}`
  );
});

test("maxLines frontmatter overrides the default cap", async () => {
  const padded =
    `---
name: builder
description: foo
model: sonnet
maxLines: 120
---

You are the builder.

## Report contract

` + "x\n".repeat(121);
  const root = await makeAgentsDir({ "builder.md": padded });
  const result = await validateAgents(root);
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((e) => /exceeds the 120-line agent prompt cap/.test(e)),
    `expected override line-cap error, got: ${result.errors.join("; ")}`
  );
});

test("fails on duplicate agent names across the directory", async () => {
  const a = WELL_FORMED_BODY;
  const b = WELL_FORMED_BODY.replace("description: Implementation specialist.", "description: dup");
  const root = await makeAgentsDir({ "builder.md": a, "dup.md": b });
  const result = await validateAgents(root);
  // dup.md will also fail filename-mismatch; that's fine, but we still need
  // the duplicate-name error to surface.
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /duplicate agent name/.test(e)));
});

test("returns ok and agentCount:0 when agents/ directory is missing", async () => {
  const result = await validateAgents(path.join(os.tmpdir(), "definitely-not-a-real-dir-xyz"));
  assert.equal(result.ok, true);
  assert.equal(result.agentCount, 0);
});
