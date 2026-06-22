import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AGENT_PATH = path.join(REPO_ROOT, "agents", "frontend-dev.md");

test("frontend-dev.md exists and has frontmatter name=frontend-dev", async () => {
  const md = await fs.readFile(AGENT_PATH, "utf8");
  assert.match(md, /^---/);
  assert.match(md, /name:\s*frontend-dev/);
});

test("frontend-dev.md declares React + TS scope and forbids server code", async () => {
  const md = await fs.readFile(AGENT_PATH, "utf8");
  assert.match(md, /Owned scope/);
  assert.match(md, /\*\.tsx/);
  assert.match(md, /Forbidden/);
  assert.match(md, /\*\.cs/);
  assert.match(md, /server code/i);
});

test("frontend-dev.md routes contract-codegen skill for orval + openapi-msw", async () => {
  const md = await fs.readFile(AGENT_PATH, "utf8");
  assert.match(md, /skills\/domain\/contract-codegen/);
  assert.match(md, /orval/);
  assert.match(md, /openapi-msw/);
});

test("frontend-dev.md mandates OpenAPI YAML + UX spec consumption", async () => {
  const md = await fs.readFile(AGENT_PATH, "utf8");
  assert.match(md, /OpenAPI YAML/);
  assert.match(md, /UX spec/);
});

test("frontend-dev.md mandates drift handling via help_request", async () => {
  const md = await fs.readFile(AGENT_PATH, "utf8");
  assert.match(md, /help_request/);
  assert.match(md, /do not invent/i);
});
