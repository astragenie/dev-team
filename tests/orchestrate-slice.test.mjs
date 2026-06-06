// tests/orchestrate-slice.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const COMMAND_PATH = path.join(repoRoot, "commands", "orchestrate-slice.md");
const ARCHITECT_PATH = path.join(repoRoot, "agents", "architect.md");

test("commands/orchestrate-slice.md exists", async () => {
  await assert.doesNotReject(fs.access(COMMAND_PATH), "command file must exist");
});

test("orchestrate-slice command has description frontmatter", async () => {
  const text = await fs.readFile(COMMAND_PATH, "utf8");
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(match, "file must start with a YAML frontmatter block");
  assert.match(match[1], /^description:\s*.+/m, "frontmatter must include non-empty description:");
});

test("orchestrate-slice command body contains Steps 0 through 8", async () => {
  const text = await fs.readFile(COMMAND_PATH, "utf8");
  for (let i = 0; i <= 8; i++) {
    assert.match(text, new RegExp(`Step ${i}`), `command body must contain "Step ${i}"`);
  }
});

test("orchestrate-slice command references all required specialist agents", async () => {
  const text = await fs.readFile(COMMAND_PATH, "utf8");
  const required = [
    "crew:architect",
    "crew:uxdesigner",
    "crew:builder",
    "crew:reviewer",
    "crew:validator"
  ];
  for (const agent of required) {
    assert.match(text, new RegExp(agent), `command must reference ${agent}`);
  }
});

test("agents/architect.md contains ## Contract artifact schema section", async () => {
  const text = await fs.readFile(ARCHITECT_PATH, "utf8");
  assert.match(
    text,
    /^## Contract artifact schema/m,
    "architect.md must have ## Contract artifact schema section"
  );
});

test("architect contract artifact schema lists the three-file OpenAPI shape", async () => {
  const text = await fs.readFile(ARCHITECT_PATH, "utf8");
  const required = [
    "<FEAT-ID>-contracts.openapi.yaml",
    "<FEAT-ID>-contracts.md",
    "<FEAT-ID>-contracts.ts"
  ];
  for (const section of required) {
    assert.ok(text.includes(section), `architect.md contract schema must mention "${section}"`);
  }
});

test("architect contract artifact schema mentions the validate-contracts regeneration step", async () => {
  const text = await fs.readFile(ARCHITECT_PATH, "utf8");
  assert.match(
    text,
    /validate-contracts\.mjs/,
    "architect.md must document the validate-contracts regeneration step for derived TS"
  );
});
