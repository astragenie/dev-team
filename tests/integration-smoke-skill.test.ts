import { test, expect } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILL_PATH = path.join(REPO_ROOT, "skills", "workflow", "integration-smoke", "SKILL.md");

test("integration-smoke skill has correct frontmatter", async () => {
  const md = await fs.readFile(SKILL_PATH, "utf8");
  expect(md).toMatch(/name:\s*integration-smoke/);
  expect(md).toMatch(/tier:\s*workflow/);
});

test("integration-smoke skill covers pre-flight, run, exercise, teardown, artifact", async () => {
  const md = await fs.readFile(SKILL_PATH, "utf8");
  expect(md).toMatch(/Pre-flight/i);
  expect(md).toMatch(/Start BE/i);
  expect(md).toMatch(/Start FE/i);
  expect(md).toMatch(/Exercise/i);
  expect(md).toMatch(/Tear down/i);
  expect(md).toMatch(/Write the artifact/i);
});

test("integration-smoke skill names runtime OpenAPI validator", async () => {
  const md = await fs.readFile(SKILL_PATH, "utf8");
  expect(md).toMatch(/openapi-response-validator|ajv/i);
});
