import { test, expect } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AGENT_PATH = path.join(REPO_ROOT, "agents", "integrator.md");

test("integrator.md exists with frontmatter name=integrator and color=purple", async () => {
  const md = await fs.readFile(AGENT_PATH, "utf8");
  expect(md).toMatch(/name:\s*integrator/);
  expect(md).toMatch(/color:\s*purple/);
});

test("integrator.md mandates pre-flight env check and skip-and-block on missing vars", async () => {
  const md = await fs.readFile(AGENT_PATH, "utf8");
  expect(md).toMatch(/pre-flight/i);
  expect(md).toMatch(/env_required/);
  expect(md).toMatch(/help_request/);
});

test("integrator.md procedure references integration-smoke skill", async () => {
  const md = await fs.readFile(AGENT_PATH, "utf8");
  expect(md).toMatch(/skills\/workflow\/integration-smoke/);
});

test("integrator.md writes artifact under .claude/artifacts/crew/integrations/", async () => {
  const md = await fs.readFile(AGENT_PATH, "utf8");
  expect(md).toMatch(/\.claude\/artifacts\/crew\/integrations\//);
});

test("integrator.md validates responses against OpenAPI schema at runtime", async () => {
  const md = await fs.readFile(AGENT_PATH, "utf8");
  expect(md).toMatch(/runtime/i);
  expect(md).toMatch(/OpenAPI/);
  expect(md).toMatch(/validate/i);
});
