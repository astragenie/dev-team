// tests/validate-skills-frontmatter.test.ts — FEAT-167 SLICE-79
//
// Tests for the prompt_id + version frontmatter checks added to
// validate-skills.ts. Skills never require an evals: field in this slice.
// Uses the same temp-fixture pattern as tests/validate-skills.test.ts.

import { test, expect } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateSkills } from "../scripts/validate-skills.ts";

async function makeSkillsDir(skills: Record<string, string>) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "validate-skills-fm-"));
  for (const [dirName, content] of Object.entries(skills)) {
    const dir = path.join(root, dirName);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "SKILL.md"), content, "utf8");
  }
  return root;
}

// AC-ST-1: happy path — prompt_id + version present, no errors on new fields
test("AC-ST-1: passes on well-formed skill file with prompt_id and version", async () => {
  const content = `---
name: foo-skill
prompt_id: foo-skill
version: 1.0.0
tier: workflow
description: Does something useful.
owner: lead
last_reviewed: 2026-01-01
triggers: When you need this skill.
---

## When to Use

Use this skill when needed.

## Done

Stop when the task is complete.
`;
  const root = await makeSkillsDir({ "foo-skill": content });
  const result = await validateSkills(root);
  expect(result.ok, `unexpected errors: ${result.errors.join("; ")}`).toBe(true);
  expect(result.skillCount).toBe(1);
});

// AC-ST-2: missing version → error
test("AC-ST-2: fails when version field is missing", async () => {
  const content = `---
name: foo-skill
prompt_id: foo-skill
tier: workflow
description: Does something useful.
owner: lead
last_reviewed: 2026-01-01
triggers: When you need this skill.
---

## When to Use

Use when needed.

## Done

Stop here.
`;
  const root = await makeSkillsDir({ "foo-skill": content });
  const result = await validateSkills(root);
  expect(result.ok, "missing version should error").toBe(false);
  expect(
    result.errors.some((e) => /missing required frontmatter "version"/.test(e)),
    `expected missing-version error, got: ${result.errors.join("; ")}`
  ).toBeTruthy();
});

// AC-ST-3: skills never require evals — even if name matches a reserved word
test("AC-ST-3: skill with name matching EVALS_REQUIRED word never requires evals", async () => {
  const content = `---
name: lead
prompt_id: lead
version: 1.0.0
tier: workflow
description: A skill named like a reserved agent.
owner: lead
last_reviewed: 2026-01-01
triggers: When you need this skill.
---

## When to Use

Use when needed.

## Done

Stop here.
`;
  // skill dir name must match name field to pass directory-name check
  const root = await makeSkillsDir({ lead: content });
  const result = await validateSkills(root);
  expect(
    !result.errors.some((e) => /requires "evals"/.test(e)),
    `skills should never require evals, got: ${result.errors.join("; ")}`
  ).toBeTruthy();
});
