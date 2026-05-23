import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const scriptPath = path.join(repoRoot, "scripts", "validate-routing-table.mjs");

async function makeTempDir(prefix) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function makeFixture(tmpDir, routingTableContent, installedPlugins = null) {
  const docsDir = path.join(tmpDir, "docs");
  const skillsDir = path.join(tmpDir, "skills", "domain", "foo");
  const pluginsDir = path.join(tmpDir, "plugins");

  await fs.mkdir(docsDir, { recursive: true });
  await fs.mkdir(skillsDir, { recursive: true });
  await fs.mkdir(pluginsDir, { recursive: true });

  await fs.writeFile(path.join(docsDir, "routing-table.md"), routingTableContent);

  await fs.writeFile(
    path.join(skillsDir, "SKILL.md"),
    "---\nname: foo\ntier: domain\ndescription: test\n---\n# foo\n"
  );

  const defaultPlugins = {
    version: 2,
    plugins: {
      "fake-plugin@fake-market": [
        {
          scope: "user",
          installPath: path.join(pluginsDir, "fake-plugin"),
          version: "1.0.0",
          installedAt: "2026-01-01T00:00:00.000Z",
          lastUpdated: "2026-01-01T00:00:00.000Z"
        }
      ]
    }
  };

  const pluginsJson = installedPlugins ?? defaultPlugins;
  const pluginsJsonPath = path.join(tmpDir, "installed_plugins.json");
  await fs.writeFile(pluginsJsonPath, JSON.stringify(pluginsJson, null, 2));

  const fakePluginSkillDir = path.join(pluginsDir, "fake-plugin", "skills", "fake-skill");
  await fs.mkdir(fakePluginSkillDir, { recursive: true });
  await fs.writeFile(
    path.join(fakePluginSkillDir, "SKILL.md"),
    "---\nname: fake-skill\ntier: domain\ndescription: test\n---\n# fake-skill\n"
  );

  return { routingTablePath: path.join(docsDir, "routing-table.md"), pluginsJsonPath };
}

function runScript(tmpDir, pluginsJsonPath, envOverrides = {}) {
  const env = {
    ...process.env,
    CREW_VALIDATE_ROUTING_TABLE_REPO_ROOT: tmpDir,
    CREW_VALIDATE_ROUTING_TABLE_FILE: path.join(tmpDir, "docs", "routing-table.md"),
    CREW_VALIDATE_ROUTING_TABLE_PLUGINS_JSON: pluginsJsonPath,
    ...envOverrides
  };
  return spawnSync("node", [scriptPath], { env, encoding: "utf8" });
}

test("resolve-pass: all skill IDs found exits 0", async () => {
  const tmpDir = await makeTempDir("vrt-pass-");
  const routingContent = `# Routing Table\n\n| Signal | Route to | Notes |\n|---|---|---|\n| **New feature** | crew:foo | some notes |\n| **Ext skill** | fake-plugin:fake-skill | notes |\n`;
  const { pluginsJsonPath } = await makeFixture(tmpDir, routingContent);
  const result = runScript(tmpDir, pluginsJsonPath, { CREW_VALIDATE_ROUTING_TABLE: "1" });
  assert.equal(result.status, 0, `Expected exit 0, got ${result.status}. stderr: ${result.stderr}`);
});

test("resolve-fail: missing skill ID exits 1 with error message", async () => {
  const tmpDir = await makeTempDir("vrt-fail-");
  const routingContent = `# Routing Table\n\n| Signal | Route to | Notes |\n|---|---|---|\n| **New feature** | crew:does-not-exist | notes |\n`;
  const { pluginsJsonPath } = await makeFixture(tmpDir, routingContent);
  const result = runScript(tmpDir, pluginsJsonPath, { CREW_VALIDATE_ROUTING_TABLE: "1" });
  assert.equal(result.status, 1, `Expected exit 1, got ${result.status}`);
  const output = result.stdout + result.stderr;
  assert.match(output, /crew:does-not-exist/, "Error should name the bad skill ID");
});

test("ignore-skip: rows with routing-lint:ignore are skipped", async () => {
  const tmpDir = await makeTempDir("vrt-ignore-");
  const routingContent =
    `# Routing Table\n\n| Signal | Route to | Notes |\n|---|---|---|\n` +
    `| **Future feature** <!-- routing-lint:ignore --> | crew:nonexistent-skill | notes |\n`;
  const { pluginsJsonPath } = await makeFixture(tmpDir, routingContent);
  const result = runScript(tmpDir, pluginsJsonPath, { CREW_VALIDATE_ROUTING_TABLE: "1" });
  assert.equal(result.status, 0, `Expected exit 0 for ignored row, got ${result.status}`);
});

test("env-skip: no env var set exits 0 with skip message", async () => {
  const tmpDir = await makeTempDir("vrt-envskip-");
  const routingContent = `# Routing Table\n\n| Signal | Route to |\n|---|---|\n| **Feature** | crew:does-not-exist |\n`;
  const { pluginsJsonPath } = await makeFixture(tmpDir, routingContent);
  const envWithoutFlag = { ...process.env };
  delete envWithoutFlag.CREW_VALIDATE_ROUTING_TABLE;
  envWithoutFlag.CREW_VALIDATE_ROUTING_TABLE_REPO_ROOT = tmpDir;
  envWithoutFlag.CREW_VALIDATE_ROUTING_TABLE_FILE = path.join(tmpDir, "docs", "routing-table.md");
  envWithoutFlag.CREW_VALIDATE_ROUTING_TABLE_PLUGINS_JSON = pluginsJsonPath;
  const result = spawnSync("node", [scriptPath], { env: envWithoutFlag, encoding: "utf8" });
  assert.equal(result.status, 0, `Expected exit 0 when env not set, got ${result.status}`);
  assert.match(result.stdout, /skipped/, "Should print skip message");
});
