// tests/validate-configs.test.ts — FEAT-crew-architecture-review Section 7/8
import { test, expect } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  checkStructure,
  checkDrift,
  checkResolution,
  checkModelsConfig,
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
  expect(errors.length).toBe(0);
  expect(table).toBeTruthy();
  expect(table?.rows.length).toBe(1);
});

test("checkStructure rejects malformed yaml with a schema error", async () => {
  const bad = `version: "1.0.0"\nrows:\n  - section: not-a-real-section\n    signal: x\n    route_to: y\n`;
  const yamlPath = await writeTmp("routing-table.yaml", bad);
  const { table, errors } = await checkStructure(yamlPath);
  expect(table).toBe(null);
  expect(errors.length).toBe(1);
  expect(errors[0] ?? "").toMatch(/schema validation/);
});

test("checkStructure reports a missing file", async () => {
  const { table, errors } = await checkStructure("/definitely/does/not/exist.yaml");
  expect(table).toBe(null);
  expect(errors[0] ?? "").toMatch(/does not exist/);
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
  expect(errors.length).toBe(0);
});

test("checkDrift fails when the committed .md is stale", async () => {
  const mdPath = await writeTmp("routing-table.md", "# stale content\n");
  const errors = await checkDrift([ROW], mdPath);
  expect(errors.length).toBe(1);
  expect(errors[0] ?? "").toMatch(/stale/);
});

test("checkDrift fails when the .md does not exist", async () => {
  const errors = await checkDrift([ROW], "/definitely/does/not/exist.md");
  expect(errors.length).toBe(1);
  expect(errors[0] ?? "").toMatch(/does not exist/);
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
  expect(await resolveCrewToken("refactor", root)).toBe(true);
});

test("resolveCrewToken finds an existing command file", async () => {
  const root = await makeFakeRepo();
  expect(await resolveCrewToken("build", root)).toBe(true);
});

test("resolveCrewToken finds an existing skill by directory name", async () => {
  const root = await makeFakeRepo();
  expect(await resolveCrewToken("some-skill", root)).toBe(true);
});

test("resolveCrewToken returns false for a name that resolves nowhere", async () => {
  const root = await makeFakeRepo();
  expect(await resolveCrewToken("totally-made-up", root)).toBe(false);
});

test("extractCrewTokens pulls tokens from both route_to and notes, deduped", () => {
  const row: RoutingRow = {
    section: "workflow-signals",
    signal: "s",
    route_to: "crew:reviewer + crew:verifier",
    notes: "Pair with crew:reviewer for the fanout."
  };
  const tokens = extractCrewTokens(row);
  expect(tokens.sort()).toEqual(["reviewer", "verifier"]);
});

test("checkResolution reports an error for a phantom crew: token", async () => {
  const row: RoutingRow = {
    section: "workflow-signals",
    signal: "s",
    route_to: "crew:totally-made-up-agent"
  };
  const errors = await checkResolution([row]);
  expect(errors.length).toBe(1);
  expect(errors[0] ?? "").toMatch(/crew:totally-made-up-agent/);
});

test("checkResolution passes for a token that resolves to a real agent", async () => {
  const row: RoutingRow = {
    section: "workflow-signals",
    signal: "s",
    route_to: "crew:refactor"
  };
  const errors = await checkResolution([row]);
  expect(errors.length).toBe(0);
});

// ── checkModelsConfig (Decision 4) ──────────────────────────────────────────

test("checkModelsConfig accepts a well-formed models.yaml", async () => {
  const yamlPath = await writeTmp(
    "models.yaml",
    'version: "1.0.0"\ndefault_profile: claude\nprofiles:\n  claude:\n    reasoning: opus\n    standard: sonnet\n    light: haiku\n'
  );
  const { config, errors } = await checkModelsConfig(yamlPath);
  expect(errors.length).toBe(0);
  expect(config).toBeTruthy();
  expect(config?.default_profile).toBe("claude");
});

test("checkModelsConfig rejects a profile missing a tier", async () => {
  const yamlPath = await writeTmp(
    "models.yaml",
    'version: "1.0.0"\ndefault_profile: claude\nprofiles:\n  claude:\n    reasoning: opus\n    standard: sonnet\n'
  );
  const { config, errors } = await checkModelsConfig(yamlPath);
  expect(config).toBe(null);
  expect(errors.length).toBe(1);
  expect(errors[0] ?? "").toMatch(/schema validation/);
});

test("checkModelsConfig rejects an unknown default_profile", async () => {
  const yamlPath = await writeTmp(
    "models.yaml",
    'version: "1.0.0"\ndefault_profile: codex\nprofiles:\n  claude:\n    reasoning: opus\n    standard: sonnet\n    light: haiku\n'
  );
  const { config, errors } = await checkModelsConfig(yamlPath);
  expect(config).toBe(null);
  expect(errors.length).toBe(1);
});

test("checkModelsConfig reports a missing file", async () => {
  const { config, errors } = await checkModelsConfig("/definitely/does/not/exist/models.yaml");
  expect(config).toBe(null);
  expect(errors[0] ?? "").toMatch(/does not exist/);
});
