import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AGENT_PATH = path.join(REPO_ROOT, "agents", "builder-be.md");

test("builder-be.md exists and has frontmatter name=builder-be", async () => {
  const md = await fs.readFile(AGENT_PATH, "utf8");
  assert.match(md, /^---/);
  assert.match(md, /name:\s*builder-be/);
});

test("builder-be.md declares server + DB scope and forbids FE code", async () => {
  const md = await fs.readFile(AGENT_PATH, "utf8");
  assert.match(md, /Owned scope/);
  assert.match(md, /api\//);
  assert.match(md, /Forbidden/);
  assert.match(md, /\*\.tsx/);
  assert.match(md, /UX spec files/i);
});

test("builder-be.md routes per-stack skills via FEAT stack tag", async () => {
  const md = await fs.readFile(AGENT_PATH, "utf8");
  assert.match(md, /stack:csharp/);
  assert.match(md, /stack:python/);
  assert.match(md, /stack:node/);
  assert.match(md, /stack:go/);
});

test("builder-be.md mandates OpenAPI codegen as FIRST step", async () => {
  const md = await fs.readFile(AGENT_PATH, "utf8");
  assert.match(md, /contract-codegen/);
  assert.match(md, /FIRST step/i);
});

test("builder-be.md mandates drift handling via help_request", async () => {
  const md = await fs.readFile(AGENT_PATH, "utf8");
  assert.match(md, /help_request/);
  assert.match(md, /do not invent/i);
});

test("builder-be.md self-verify includes per-stack test runners", async () => {
  const md = await fs.readFile(AGENT_PATH, "utf8");
  assert.match(md, /dotnet test|pytest|go test|npm run test:be/);
});
