import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILL_PATH = path.join(REPO_ROOT, "skills", "workflow", "integration-smoke", "SKILL.md");

test("integration-smoke skill has correct frontmatter", async () => {
  const md = await fs.readFile(SKILL_PATH, "utf8");
  assert.match(md, /name:\s*integration-smoke/);
  assert.match(md, /tier:\s*workflow/);
});

test("integration-smoke skill covers pre-flight, run, exercise, teardown, artifact", async () => {
  const md = await fs.readFile(SKILL_PATH, "utf8");
  assert.match(md, /Pre-flight/i);
  assert.match(md, /Start BE/i);
  assert.match(md, /Start FE/i);
  assert.match(md, /Exercise/i);
  assert.match(md, /Tear down/i);
  assert.match(md, /Write the artifact/i);
});

test("integration-smoke skill names runtime OpenAPI validator", async () => {
  const md = await fs.readFile(SKILL_PATH, "utf8");
  assert.match(md, /openapi-response-validator|ajv/i);
});
