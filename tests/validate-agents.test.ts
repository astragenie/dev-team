// tests/validate-agents.test.mjs — FEAT-035 SLICE-14
import { test, expect } from "bun:test";
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
  expect(result.ok, `unexpected errors: ${result.errors.join("; ")}`).toBe(true);
  expect(result.agentCount).toBe(1);
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
  expect(result.ok).toBe(false);
  expect(
    result.errors.some((e) => /missing required frontmatter "model"/.test(e)),
    `expected missing-model error, got: ${result.errors.join("; ")}`
  ).toBeTruthy();
});

test("fails on missing or malformed frontmatter block", async () => {
  const noFrontmatter = `# Builder

You are the builder.

## Report contract

x
`;
  const root = await makeAgentsDir({ "builder.md": noFrontmatter });
  const result = await validateAgents(root);
  expect(result.ok).toBe(false);
  expect(result.errors.some((e) => /missing or malformed frontmatter/.test(e))).toBeTruthy();
});

test("fails when filename does not match frontmatter name", async () => {
  const root = await makeAgentsDir({ "wrong-name.md": WELL_FORMED_BODY });
  const result = await validateAgents(root);
  expect(result.ok).toBe(false);
  expect(result.errors.some((e) => /does not match frontmatter name/.test(e))).toBeTruthy();
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
  expect(result.ok).toBe(false);
  expect(
    result.errors.some((e) => /missing required section "## Report contract"/.test(e))
  ).toBeTruthy();
});

// lead role removed in v0.41 hard cut — exemption test removed with it. All
// active agents now MUST carry "## Report contract" per the validator gate.

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
  expect(result.ok).toBe(false);
  expect(result.errors.some((e) => /missing identity intro/.test(e))).toBeTruthy();
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
  expect(result.ok).toBe(false);
  expect(
    result.errors.some((e) => /exceeds the 350-line agent prompt cap/.test(e)),
    `expected line-cap error, got: ${result.errors.join("; ")}`
  ).toBeTruthy();
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
  expect(result.ok).toBe(false);
  expect(
    result.errors.some((e) => /exceeds the 120-line agent prompt cap/.test(e)),
    `expected override line-cap error, got: ${result.errors.join("; ")}`
  ).toBeTruthy();
});

test("fails on duplicate agent names across the directory", async () => {
  const a = WELL_FORMED_BODY;
  const b = WELL_FORMED_BODY.replace("description: Implementation specialist.", "description: dup");
  const root = await makeAgentsDir({ "builder.md": a, "dup.md": b });
  const result = await validateAgents(root);
  // dup.md will also fail filename-mismatch; that's fine, but we still need
  // the duplicate-name error to surface.
  expect(result.ok).toBe(false);
  expect(result.errors.some((e) => /duplicate agent name/.test(e))).toBeTruthy();
});

test("returns ok and agentCount:0 when agents/ directory is missing", async () => {
  const result = await validateAgents(path.join(os.tmpdir(), "definitely-not-a-real-dir-xyz"));
  expect(result.ok).toBe(true);
  expect(result.agentCount).toBe(0);
});

// Backlog-id discipline: agents on the no-backlog-ids allowlist must not
// embed FEAT-NNN / DEC-NNN / SLICE-NN. Tested via a synthetic backend-dev.md
// — using a real allowlisted name is intentional because the rule keys off
// frontmatter `name`, not the file path.
const BACKEND_DEV_BASE = `---
name: backend-dev
prompt_id: backend-dev
version: 1.0.0
description: backend specialist.
model: sonnet
evals: planned:evals/agents/backend-dev.yaml
---

You are the backend-dev on a Claude Code engineering team.

Coalesce Bash calls: chain related data-collection commands.

## Report contract

Write your handoff via write-handoff.
`;

test("fails when an allowlisted agent embeds FEAT-NNN in its prompt body", async () => {
  const withFeatRef = BACKEND_DEV_BASE.replace(
    "## Report contract",
    "See FEAT-163 for peer dispatch design.\n\n## Report contract"
  );
  const root = await makeAgentsDir({ "backend-dev.md": withFeatRef });
  const result = await validateAgents(root);
  expect(result.ok).toBe(false);
  expect(
    result.errors.some((e) => /backlog ids must not appear/.test(e) && /FEAT-163/.test(e)),
    `expected backlog-id error citing FEAT-163, got: ${result.errors.join("; ")}`
  ).toBeTruthy();
});

test("fails when an allowlisted agent embeds DEC-NNN or SLICE-NN", async () => {
  const withRefs = BACKEND_DEV_BASE.replace(
    "## Report contract",
    "Per DEC-023 and SLICE-71.\n\n## Report contract"
  );
  const root = await makeAgentsDir({ "backend-dev.md": withRefs });
  const result = await validateAgents(root);
  expect(result.ok).toBe(false);
  expect(
    result.errors.some((e) => /DEC-023/.test(e) && /SLICE-71/.test(e)),
    `expected backlog-id error citing DEC-023 + SLICE-71, got: ${result.errors.join("; ")}`
  ).toBeTruthy();
});

test("passes on an allowlisted agent with zero backlog ids", async () => {
  const root = await makeAgentsDir({ "backend-dev.md": BACKEND_DEV_BASE });
  const result = await validateAgents(root);
  expect(result.ok, `unexpected errors: ${result.errors.join("; ")}`).toBe(true);
});

test("ignores backlog ids on agents NOT in the no-backlog-ids allowlist", async () => {
  const builderWithRef = WELL_FORMED_BODY.replace(
    "## Report contract",
    "See FEAT-163.\n\n## Report contract"
  );
  const root = await makeAgentsDir({ "builder.md": builderWithRef });
  const result = await validateAgents(root);
  // `builder` is not in NO_BACKLOG_IDS_REQUIRED, so the FEAT ref must not error.
  expect(
    !result.errors.some((e) => /backlog ids must not appear/.test(e)),
    `unexpected backlog-id error for non-allowlisted agent: ${result.errors.join("; ")}`
  ).toBeTruthy();
});
