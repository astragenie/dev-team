// tests/validate-agents-frontmatter.test.ts — FEAT-167 SLICE-79
//
// Tests for the prompt_id + version + evals frontmatter checks added to
// validate-agents.ts. Uses the same temp-fixture pattern as the existing
// validate-agents.test.ts.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateAgents } from "../scripts/validate-agents.ts";

async function makeAgentsDir(files: Record<string, string>) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "validate-agents-fm-"));
  for (const [name, content] of Object.entries(files)) {
    await fs.writeFile(path.join(root, name), content, "utf8");
  }
  return root;
}

// Minimal well-formed body that satisfies all existing checks PLUS new ones.
// Uses "foo" as the agent name (not in EVALS_REQUIRED_AGENT_NAMES) so no evals
// field is needed.
const WELL_FORMED = `---
name: foo
prompt_id: foo
version: 1.0.0
description: A test agent.
model: sonnet
---

You are a foo agent on a Claude Code engineering team.

TaskUpdate batching: never run >=3 back-to-back without intervening work.
Coalesce Bash calls: chain related data-collection commands.

## Report contract

Write your handoff via write-handoff.
`;

// AC-AT-1: happy path — all required frontmatter present, no errors
test("AC-AT-1: passes on well-formed agent file with prompt_id and version", async () => {
  const root = await makeAgentsDir({ "foo.md": WELL_FORMED });
  const result = await validateAgents(root);
  assert.equal(result.ok, true, `unexpected errors: ${result.errors.join("; ")}`);
  assert.equal(result.agentCount, 1);
});

// AC-AT-2: missing prompt_id → error
test("AC-AT-2: fails when prompt_id is missing", async () => {
  const body = `---
name: foo
version: 1.0.0
description: A test agent.
model: sonnet
---

You are a foo agent on a Claude Code engineering team.

TaskUpdate batching: never run >=3 back-to-back.
Coalesce Bash calls: chain related data-collection commands.

## Report contract

x
`;
  const root = await makeAgentsDir({ "foo.md": body });
  const result = await validateAgents(root);
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((e) => /missing required frontmatter "prompt_id"/.test(e)),
    `expected missing prompt_id error, got: ${result.errors.join("; ")}`
  );
});

// AC-AT-3: version with only two segments → semver error
test("AC-AT-3: fails when version is not three-part semver", async () => {
  const body = `---
name: foo
prompt_id: foo
version: 1.0
description: A test agent.
model: sonnet
---

You are a foo agent on a Claude Code engineering team.

TaskUpdate batching: never run >=3 back-to-back.
Coalesce Bash calls: chain related data-collection commands.

## Report contract

x
`;
  const root = await makeAgentsDir({ "foo.md": body });
  const result = await validateAgents(root);
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((e) => /must be semver/.test(e)),
    `expected semver error, got: ${result.errors.join("; ")}`
  );
});

// AC-AT-4: prompt_id with uppercase and underscore → kebab error
test("AC-AT-4: fails when prompt_id is not kebab-slug", async () => {
  const body = `---
name: foo
prompt_id: Foo_Bar
version: 1.0.0
description: A test agent.
model: sonnet
---

You are a foo agent on a Claude Code engineering team.

TaskUpdate batching: never run >=3 back-to-back.
Coalesce Bash calls: chain related data-collection commands.

## Report contract

x
`;
  const root = await makeAgentsDir({ "foo.md": body });
  const result = await validateAgents(root);
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((e) => /must be kebab-slug/.test(e)),
    `expected kebab-slug error, got: ${result.errors.join("; ")}`
  );
});

// AC-AT-5: inspector (EVALS_REQUIRED) without evals field → error
test("AC-AT-5: fails when EVALS_REQUIRED agent is missing evals field", async () => {
  const body = `---
name: inspector
prompt_id: inspector
version: 1.0.0
description: Review specialist.
model: sonnet
maxLines: 400
---

You are the inspector on a Claude Code engineering team.

TaskUpdate batching: never run >=3 back-to-back.
Coalesce Bash calls: chain related data-collection commands.

## Report contract

x
`;
  const root = await makeAgentsDir({ "inspector.md": body });
  const result = await validateAgents(root);
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((e) => /requires "evals" frontmatter field/.test(e)),
    `expected evals-required error, got: ${result.errors.join("; ")}`
  );
});

// AC-AT-6: architect (not in EVALS_REQUIRED) without evals → passes
test("AC-AT-6: passes when non-EVALS_REQUIRED agent has no evals field", async () => {
  const body = `---
name: architect
prompt_id: architect
version: 1.0.0
description: Architecture specialist.
model: opus
---

You are the architect on a Claude Code engineering team.

## Report contract

x
`;
  const root = await makeAgentsDir({ "architect.md": body });
  const result = await validateAgents(root);
  // Only check for the new fields; other existing checks (sections, etc.) may fire
  // but we assert that NO evals error is present.
  assert.ok(
    !result.errors.some((e) => /requires "evals"/.test(e)),
    `should not require evals for architect, got: ${result.errors.join("; ")}`
  );
});
