// tests/architect-feature.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CMD = path.join(repoRoot, "commands", "architect-feature.md");

test("commands/architect-feature.md exists", async () => {
  await assert.doesNotReject(fs.access(CMD), "command file must exist");
});

test("architect-feature has description frontmatter", async () => {
  const text = await fs.readFile(CMD, "utf8");
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(match, "file must start with YAML frontmatter");
  assert.match(match[1], /^description:\s*.+/m, "frontmatter must have non-empty description:");
});

test("architect-feature references crew:researcher in Phase 1", async () => {
  const text = await fs.readFile(CMD, "utf8");
  assert.match(text, /crew:researcher/, "command must dispatch crew:researcher");
});

test("architect-feature references crew:architect in Phase 2", async () => {
  const text = await fs.readFile(CMD, "utf8");
  assert.match(text, /crew:architect/, "command must dispatch crew:architect");
});

test("architect-feature documents ## Inferred Tags section requirement", async () => {
  const text = await fs.readFile(CMD, "utf8");
  assert.match(text, /Inferred Tags/, "command must reference ## Inferred Tags");
});

test("architect-feature documents tag write-back as additive", async () => {
  const text = await fs.readFile(CMD, "utf8");
  assert.match(
    text,
    /additive|never remove|net.new/i,
    "command must document that tag write-back never removes existing tags"
  );
});

test("architect-feature documents --auto-start flag", async () => {
  const text = await fs.readFile(CMD, "utf8");
  assert.match(text, /--auto-start/, "command must document --auto-start flag");
});

test("architect-feature documents FEAT-not-found error handling", async () => {
  const text = await fs.readFile(CMD, "utf8");
  assert.match(
    text,
    /not found|paths tried|halt/i,
    "command must document FEAT-not-found error case"
  );
});
