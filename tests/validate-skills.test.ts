// tests/validate-skills.test.mjs — FEAT-043
// Covers: last_reviewed warning (AC-3) + basic error/pass paths.
import { test, expect } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateSkills } from "../scripts/validate-skills.ts";

async function makeSkillsDir(skills: Record<string, string>) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "validate-skills-"));
  for (const [dirName, content] of Object.entries(skills)) {
    const dir = path.join(root, dirName);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "SKILL.md"), content, "utf8");
  }
  return root;
}

const WELL_FORMED = `---
name: my-skill
prompt_id: my-skill
version: 1.0.0
tier: universal
description: Does something useful.
owner: lead
last_reviewed: 2025-12-01
triggers: When you need this skill.
---

## When to Use

Use this skill when needed.

## Done

Stop when the task is complete.
`;

const MISSING_LAST_REVIEWED = `---
name: my-skill
prompt_id: my-skill
version: 1.0.0
tier: universal
description: Does something useful.
owner: lead
triggers: When you need this skill.
---

## When to Use

Use this skill when needed.

## Done

Stop when the task is complete.
`;

test("passes on a well-formed skill", async () => {
  const root = await makeSkillsDir({ "my-skill": WELL_FORMED });
  const result = await validateSkills(root);
  expect(result.ok, `unexpected errors: ${result.errors.join("; ")}`).toBe(true);
  expect(result.skillCount).toBe(1);
});

test("warns when last_reviewed is absent", async () => {
  const root = await makeSkillsDir({ "my-skill": MISSING_LAST_REVIEWED });
  const result = await validateSkills(root);
  expect(result.ok, "missing last_reviewed should warn, not error").toBe(true);
  const hasWarning = result.warnings.some((w) => w.includes("last_reviewed"));
  expect(
    hasWarning,
    `expected last_reviewed warning, got: ${result.warnings.join("; ")}`
  ).toBeTruthy();
});

test("errors on missing required frontmatter", async () => {
  const noTier = `---
name: my-skill
description: Missing tier.
---

## When to Use

Use when needed.

## Done

Stop here.
`;
  const root = await makeSkillsDir({ "my-skill": noTier });
  const result = await validateSkills(root);
  expect(result.ok, "missing tier should error").toBe(false);
});
