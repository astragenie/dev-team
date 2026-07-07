// FEAT-193 AC-10 — a champion-provenance-written agent must still pass
// validate-agents (the leading `gepa:` block must not hide name/description).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { validateAgents } from "../scripts/validate-agents.ts";
import {
  writeChampionProvenance,
  stripGepafrontmatter
} from "../scripts/lib/gepa/champion-provenance-writer.ts";

const WELL_FORMED = `---
name: foo
prompt_id: foo
version: 1.0.0
description: A test agent.
model: sonnet
---

You are a foo agent on a Claude Code engineering team.

## Report contract

Write your handoff via write-handoff.
`;

test("AC-10: validate-agents passes on a champion-provenance-written agent", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "gepa-provenance-"));
  try {
    const agentPath = path.join(root, "foo.md");
    await fs.writeFile(agentPath, WELL_FORMED, "utf8");

    // Baseline: clean file validates.
    const before = await validateAgents(root);
    assert.equal(before.ok, true, `baseline errors: ${before.errors.join("; ")}`);

    // Promote: prepends a leading `gepa:` frontmatter block.
    writeChampionProvenance({ agentPath, trialUuid: randomUUID() });
    const promoted = await fs.readFile(agentPath, "utf8");
    assert.ok(promoted.startsWith("---\ngepa:\n"), "provenance block must be prepended");

    // The provenance-written agent must STILL validate — no missing name/description.
    const after = await validateAgents(root);
    assert.equal(
      after.ok,
      true,
      `provenance-written agent must validate; errors: ${after.errors.join("; ")}`
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("AC-10: idempotent — re-promoting replaces the block, still validates", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "gepa-provenance-"));
  try {
    const agentPath = path.join(root, "foo.md");
    await fs.writeFile(agentPath, WELL_FORMED, "utf8");
    writeChampionProvenance({ agentPath, trialUuid: randomUUID() });
    writeChampionProvenance({ agentPath, trialUuid: randomUUID() });

    const twice = await fs.readFile(agentPath, "utf8");
    // Exactly one gepa block: stripping it once yields a body with no `gepa:` left.
    assert.ok(!stripGepafrontmatter(twice).includes("gepa:"), "must not stack gepa blocks");
    const after = await validateAgents(root);
    assert.equal(after.ok, true, `errors: ${after.errors.join("; ")}`);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
