// tests/validate-configs.test.ts — FEAT-crew-architecture-review Section 7/8
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  checkStructure,
  checkDrift,
  checkResolution,
  resolveCrewToken,
  extractCrewTokens
} from "../scripts/validate-configs.ts";
import { render } from "../scripts/render-routing-table.ts";
import type { RoutingRow } from "../scripts/lib/routing/schema.ts";

const VALID_YAML = `version: "1.0.0"
rows:
  - section: workflow-signals
    signal: "**New feature request**"
    route_to: dispatcher + fullstack-dev
    notes: Pair with crew:refactor for cleanup.
`;

async function writeTmp(name: string, content: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "validate-configs-"));
  const filePath = path.join(dir, name);
  await fs.writeFile(filePath, content, "utf8");
  return filePath;
}

// ── checkStructure ──────────────────────────────────────────────────────────

test("checkStructure accepts a well-formed yaml", async () => {
  const yamlPath = await writeTmp("routing-table.yaml", VALID_YAML);
  const { table, errors } = await checkStructure(yamlPath);
  assert.equal(errors.length, 0);
  assert.ok(table);
  assert.equal(table?.rows.length, 1);
});

test("checkStructure rejects malformed yaml with a schema error", async () => {
  const bad = `version: "1.0.0"\nrows:\n  - section: not-a-real-section\n    signal: x\n    route_to: y\n`;
  const yamlPath = await writeTmp("routing-table.yaml", bad);
  const { table, errors } = await checkStructure(yamlPath);
  assert.equal(table, null);
  assert.equal(errors.length, 1);
  assert.match(errors[0] ?? "", /schema validation/);
});

test("checkStructure reports a missing file", async () => {
  const { table, errors } = await checkStructure("/definitely/does/not/exist.yaml");
  assert.equal(table, null);
  assert.match(errors[0] ?? "", /does not exist/);
});

// ── checkDrift ───────────────────────────────────────────────────────────────

const ROW: RoutingRow = {
  section: "workflow-signals",
  signal: "**New feature request**",
  route_to: "dispatcher + fullstack-dev",
  notes: "Pair with crew:refactor for cleanup."
};

test("checkDrift passes when the committed .md matches a fresh render", async () => {
  const rendered = render([ROW]);
  const mdPath = await writeTmp("routing-table.md", rendered);
  const errors = await checkDrift([ROW], mdPath);
  assert.equal(errors.length, 0);
});

test("checkDrift fails when the committed .md is stale", async () => {
  const mdPath = await writeTmp("routing-table.md", "# stale content\n");
  const errors = await checkDrift([ROW], mdPath);
  assert.equal(errors.length, 1);
  assert.match(errors[0] ?? "", /stale/);
});

test("checkDrift fails when the .md does not exist", async () => {
  const errors = await checkDrift([ROW], "/definitely/does/not/exist.md");
  assert.equal(errors.length, 1);
  assert.match(errors[0] ?? "", /does not exist/);
});

// ── resolveCrewToken / extractCrewTokens / checkResolution ──────────────────

async function makeFakeRepo(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "validate-configs-repo-"));
  await fs.mkdir(path.join(root, "agents"), { recursive: true });
  await fs.mkdir(path.join(root, "commands"), { recursive: true });
  await fs.mkdir(path.join(root, "skills", "workflow", "some-skill"), { recursive: true });
  await fs.writeFile(path.join(root, "agents", "refactor.md"), "stub", "utf8");
  await fs.writeFile(path.join(root, "commands", "build.md"), "stub", "utf8");
  await fs.writeFile(
    path.join(root, "skills", "workflow", "some-skill", "SKILL.md"),
    "stub",
    "utf8"
  );
  return root;
}

test("resolveCrewToken finds an existing agent file", async () => {
  const root = await makeFakeRepo();
  assert.equal(await resolveCrewToken("refactor", root), true);
});

test("resolveCrewToken finds an existing command file", async () => {
  const root = await makeFakeRepo();
  assert.equal(await resolveCrewToken("build", root), true);
});

test("resolveCrewToken finds an existing skill by directory name", async () => {
  const root = await makeFakeRepo();
  assert.equal(await resolveCrewToken("some-skill", root), true);
});

test("resolveCrewToken returns false for a name that resolves nowhere", async () => {
  const root = await makeFakeRepo();
  assert.equal(await resolveCrewToken("totally-made-up", root), false);
});

test("extractCrewTokens pulls tokens from both route_to and notes, deduped", () => {
  const row: RoutingRow = {
    section: "workflow-signals",
    signal: "s",
    route_to: "crew:reviewer + crew:verifier",
    notes: "Pair with crew:reviewer for the fanout."
  };
  const tokens = extractCrewTokens(row);
  assert.deepEqual(tokens.sort(), ["reviewer", "verifier"]);
});

test("checkResolution reports an error for a phantom crew: token", async () => {
  const row: RoutingRow = {
    section: "workflow-signals",
    signal: "s",
    route_to: "crew:totally-made-up-agent"
  };
  const errors = await checkResolution([row]);
  assert.equal(errors.length, 1);
  assert.match(errors[0] ?? "", /crew:totally-made-up-agent/);
});

test("checkResolution passes for a token that resolves to a real agent", async () => {
  const row: RoutingRow = {
    section: "workflow-signals",
    signal: "s",
    route_to: "crew:refactor"
  };
  const errors = await checkResolution([row]);
  assert.equal(errors.length, 0);
});
