import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AGENT_PATH = path.join(REPO_ROOT, "agents", "backend-dev.md");

test("backend-dev.md exists and has frontmatter name=backend-dev", async () => {
  const md = await fs.readFile(AGENT_PATH, "utf8");
  assert.match(md, /^---/);
  assert.match(md, /name:\s*backend-dev/);
});

test("backend-dev.md declares server + DB scope and forbids FE code", async () => {
  const md = await fs.readFile(AGENT_PATH, "utf8");
  assert.match(md, /Owned scope/);
  assert.match(md, /api\//);
  assert.match(md, /Forbidden/);
  assert.match(md, /\*\.tsx/);
  assert.match(md, /UX spec files/i);
});

test("backend-dev.md routes per-stack skills via FEAT stack tag", async () => {
  const md = await fs.readFile(AGENT_PATH, "utf8");
  assert.match(md, /stack:csharp/);
  assert.match(md, /stack:python/);
  assert.match(md, /stack:node/);
});

test("backend-dev.md mandates OpenAPI codegen as FIRST step", async () => {
  const md = await fs.readFile(AGENT_PATH, "utf8");
  assert.match(md, /contract-codegen/);
  assert.match(md, /FIRST step/i);
});

test("backend-dev.md mandates drift handling via help_request", async () => {
  const md = await fs.readFile(AGENT_PATH, "utf8");
  assert.match(md, /help_request/);
  assert.match(md, /do not invent/i);
});

test("backend-dev.md references the shared self-verify-gate skill", async () => {
  const md = await fs.readFile(AGENT_PATH, "utf8");
  assert.match(md, /skills\/workflow\/self-verify-gate/);
});

test("self-verify-gate skill covers per-stack BE test runners", async () => {
  const skillPath = path.join(REPO_ROOT, "skills", "workflow", "self-verify-gate", "SKILL.md");
  const md = await fs.readFile(skillPath, "utf8");
  assert.match(md, /dotnet test|pytest|bun test/);
});
