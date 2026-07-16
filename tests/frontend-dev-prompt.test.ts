import { test, expect } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AGENT_PATH = path.join(REPO_ROOT, "agents", "frontend-dev.md");

test("frontend-dev.md exists and has frontmatter name=frontend-dev", async () => {
  const md = await fs.readFile(AGENT_PATH, "utf8");
  expect(md).toMatch(/^---/);
  expect(md).toMatch(/name:\s*frontend-dev/);
});

test("frontend-dev.md declares React + TS scope and forbids server code", async () => {
  const md = await fs.readFile(AGENT_PATH, "utf8");
  expect(md).toMatch(/Owned scope/);
  expect(md).toMatch(/\*\.tsx/);
  expect(md).toMatch(/Forbidden/);
  expect(md).toMatch(/\*\.cs/);
  expect(md).toMatch(/server code/i);
});

test("frontend-dev.md routes contract-codegen skill for orval + openapi-msw", async () => {
  const md = await fs.readFile(AGENT_PATH, "utf8");
  expect(md).toMatch(/skills\/domain\/contract-codegen/);
  expect(md).toMatch(/orval/);
  expect(md).toMatch(/openapi-msw/);
});

test("frontend-dev.md mandates OpenAPI YAML + UX spec consumption", async () => {
  const md = await fs.readFile(AGENT_PATH, "utf8");
  expect(md).toMatch(/OpenAPI YAML/);
  expect(md).toMatch(/UX spec/);
});

test("frontend-dev.md mandates drift handling via help_request", async () => {
  const md = await fs.readFile(AGENT_PATH, "utf8");
  expect(md).toMatch(/help_request/);
  expect(md).toMatch(/do not invent/i);
});
