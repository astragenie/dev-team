import { test, expect } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const scriptPath = path.join(repoRoot, "scripts", "validate-routing-table.ts");

async function makeTempDir(prefix: string) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function makeFixture(
  tmpDir: string,
  routingTableContent: string,
  installedPlugins: unknown = null
) {
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

function runScript(
  tmpDir: string,
  pluginsJsonPath: string,
  envOverrides: Record<string, string> = {},
  extraArgs: string[] = []
) {
  const env = {
    ...process.env,
    CREW_VALIDATE_ROUTING_TABLE_REPO_ROOT: tmpDir,
    CREW_VALIDATE_ROUTING_TABLE_FILE: path.join(tmpDir, "docs", "routing-table.md"),
    CREW_VALIDATE_ROUTING_TABLE_PLUGINS_JSON: pluginsJsonPath,
    ...envOverrides
  };
  return spawnSync("node", ["--experimental-strip-types", scriptPath, ...extraArgs], {
    env,
    encoding: "utf8"
  });
}

test("resolve-pass: all skill IDs found exits 0", async () => {
  const tmpDir = await makeTempDir("vrt-pass-");
  const routingContent = `# Routing Table\n\n| Signal | Route to | Notes |\n|---|---|---|\n| **New feature** | crew:foo | some notes |\n| **Ext skill** | fake-plugin:fake-skill | notes |\n`;
  const { pluginsJsonPath } = await makeFixture(tmpDir, routingContent);
  const result = runScript(tmpDir, pluginsJsonPath, { CREW_VALIDATE_ROUTING_TABLE: "1" });
  expect(result.status, `Expected exit 0, got ${result.status}. stderr: ${result.stderr}`).toBe(0);
});

test("resolve-fail: missing skill ID exits 1 with error message", async () => {
  const tmpDir = await makeTempDir("vrt-fail-");
  const routingContent = `# Routing Table\n\n| Signal | Route to | Notes |\n|---|---|---|\n| **New feature** | crew:does-not-exist | notes |\n`;
  const { pluginsJsonPath } = await makeFixture(tmpDir, routingContent);
  const result = runScript(tmpDir, pluginsJsonPath, { CREW_VALIDATE_ROUTING_TABLE: "1" });
  expect(result.status, `Expected exit 1, got ${result.status}`).toBe(1);
  const output = result.stdout + result.stderr;
  expect(output, "Error should name the bad skill ID").toMatch(/crew:does-not-exist/);
});

test("ignore-skip: rows with routing-lint:ignore are skipped", async () => {
  const tmpDir = await makeTempDir("vrt-ignore-");
  const routingContent =
    `# Routing Table\n\n| Signal | Route to | Notes |\n|---|---|---|\n` +
    `| **Future feature** <!-- routing-lint:ignore --> | crew:nonexistent-skill | notes |\n`;
  const { pluginsJsonPath } = await makeFixture(tmpDir, routingContent);
  const result = runScript(tmpDir, pluginsJsonPath, { CREW_VALIDATE_ROUTING_TABLE: "1" });
  expect(result.status, `Expected exit 0 for ignored row, got ${result.status}`).toBe(0);
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
  const result = spawnSync("node", ["--experimental-strip-types", scriptPath], {
    env: envWithoutFlag,
    encoding: "utf8"
  });
  expect(result.status, `Expected exit 0 when env not set, got ${result.status}`).toBe(0);
  expect(result.stdout, "Should print skip message").toMatch(/skipped/);
});

// --coverage-only tests (Pass 3: agent-roster coverage, arch-review Finding 2.7).
// Runs unconditionally — no CREW_VALIDATE_ROUTING_TABLE gate needed.

test("coverage-only: every agents/*.md basename referenced in the table exits 0", async () => {
  const tmpDir = await makeTempDir("vrt-cov-pass-");
  const routingContent = `# Routing Table\n\n| Signal | Route to |\n|---|---|\n| **Feature** | crew:foo and crew:bar |\n`;
  const { pluginsJsonPath } = await makeFixture(tmpDir, routingContent);
  const agentsDir = path.join(tmpDir, "agents");
  await fs.mkdir(agentsDir, { recursive: true });
  await fs.writeFile(path.join(agentsDir, "foo.md"), "---\nname: foo\n---\n");
  await fs.writeFile(path.join(agentsDir, "bar.md"), "---\nname: bar\n---\n");
  const result = runScript(tmpDir, pluginsJsonPath, {}, ["--coverage-only"]);
  expect(result.status, `Expected exit 0, got ${result.status}. stderr: ${result.stderr}`).toBe(0);
});

test("coverage-only: an agent missing from the table exits 1 and names it", async () => {
  const tmpDir = await makeTempDir("vrt-cov-fail-");
  const routingContent = `# Routing Table\n\n| Signal | Route to |\n|---|---|\n| **Feature** | crew:foo |\n`;
  const { pluginsJsonPath } = await makeFixture(tmpDir, routingContent);
  const agentsDir = path.join(tmpDir, "agents");
  await fs.mkdir(agentsDir, { recursive: true });
  await fs.writeFile(path.join(agentsDir, "foo.md"), "---\nname: foo\n---\n");
  await fs.writeFile(path.join(agentsDir, "orphan-agent.md"), "---\nname: orphan-agent\n---\n");
  const result = runScript(tmpDir, pluginsJsonPath, {}, ["--coverage-only"]);
  expect(result.status, `Expected exit 1, got ${result.status}`).toBe(1);
  expect(result.stderr, "Error should name the uncovered agent").toMatch(/orphan-agent/);
});

test("coverage-only: no agents/ directory at all exits 0 (nothing to check)", async () => {
  const tmpDir = await makeTempDir("vrt-cov-noagents-");
  const routingContent = `# Routing Table\n\n| Signal | Route to |\n|---|---|\n| **Feature** | crew:foo |\n`;
  const { pluginsJsonPath } = await makeFixture(tmpDir, routingContent);
  const result = runScript(tmpDir, pluginsJsonPath, {}, ["--coverage-only"]);
  expect(result.status, `Expected exit 0, got ${result.status}. stderr: ${result.stderr}`).toBe(0);
});

// Fixture-based cross-check tests (consistency validator)

const fixturesBase = path.join(repoRoot, "tests", "fixtures", "validate-routing-table");

/**
 * Run the script against an in-tree fixture directory.
 * The fixture provides routing-table.md under docs/ and agents/ under agents/.
 * @param {string} fixtureDir absolute path to the fixture directory
 */
function runFixture(fixtureDir: string) {
  const env = {
    ...process.env,
    CREW_VALIDATE_ROUTING_TABLE: "1",
    CREW_VALIDATE_ROUTING_TABLE_FILE: path.join(fixtureDir, "docs", "routing-table.md"),
    CREW_VALIDATE_ROUTING_TABLE_REPO_ROOT: fixtureDir,
    // Use a non-existent plugins JSON so ID-resolution doesn't flag external skills
    CREW_VALIDATE_ROUTING_TABLE_PLUGINS_JSON: path.join(fixtureDir, "no-plugins.json")
  };
  return spawnSync("node", ["--experimental-strip-types", scriptPath], { env, encoding: "utf8" });
}

test("consistency-pass: aligned row and agent block exits 0", () => {
  const result = runFixture(path.join(fixturesBase, "consistency-pass"));
  expect(
    result.status,
    `Expected exit 0 for aligned fixture. stdout: ${result.stdout} stderr: ${result.stderr}`
  ).toBe(0);
});

test("consistency-fail: missing skill in agent block exits 1 with actionable error", () => {
  const result = runFixture(path.join(fixturesBase, "consistency-fail"));
  expect(
    result.status,
    `Expected exit 1 for mismatched fixture. stdout: ${result.stdout} stderr: ${result.stderr}`
  ).toBe(1);
  const output = result.stdout + result.stderr;
  expect(output, "Error should name the missing skill path").toMatch(/rust-pro/);
  expect(output, "Error should name the agent").toMatch(/fullstack-dev/);
});

test("consistency-ignore: routing-lint:ignore row skips cross-check exits 0", () => {
  const result = runFixture(path.join(fixturesBase, "consistency-ignore"));
  expect(
    result.status,
    `Expected exit 0 for ignored row. stdout: ${result.stdout} stderr: ${result.stderr}`
  ).toBe(0);
});

test("consistency-multi: row with 2 skills, agent has 1, exits 1 for missing skill", () => {
  const result = runFixture(path.join(fixturesBase, "consistency-multi"));
  expect(
    result.status,
    `Expected exit 1 for multi-skill mismatch. stdout: ${result.stdout} stderr: ${result.stderr}`
  ).toBe(1);
  const output = result.stdout + result.stderr;
  expect(output, "Error should name the missing prompt-engineering skill").toMatch(
    /prompt-engineering/
  );
});

test("consistency-non-crew: non-crew route-to is skipped exits 0", () => {
  const result = runFixture(path.join(fixturesBase, "consistency-non-crew"));
  expect(
    result.status,
    `Expected exit 0 for non-crew agent row. stdout: ${result.stdout} stderr: ${result.stderr}`
  ).toBe(0);
});

test("consistency-empty-block: agent missing Skills-you-consult heading exits 1 with skill named", () => {
  const result = runFixture(path.join(fixturesBase, "consistency-empty-block"));
  expect(
    result.status,
    `Expected exit 1 for agent without skill block. stdout: ${result.stdout} stderr: ${result.stderr}`
  ).toBe(1);
  const output = result.stdout + result.stderr;
  expect(output, "Error should name the missing skill").toMatch(/python-pro/);
  expect(output, "Error should name the agent").toMatch(/fullstack-dev/);
});

test("consistency-refs-collapse: ref-suffix in notes collapses to dir match exits 0", () => {
  const result = runFixture(path.join(fixturesBase, "consistency-refs-collapse"));
  expect(
    result.status,
    `Expected exit 0 for refs-collapse match. stdout: ${result.stdout} stderr: ${result.stderr}`
  ).toBe(0);
});

test("consistency-multi-role: multi-role row fails if any role missing skill exits 1", () => {
  const result = runFixture(path.join(fixturesBase, "consistency-multi-role"));
  expect(
    result.status,
    `Expected exit 1 for multi-role missing skill. stdout: ${result.stdout} stderr: ${result.stderr}`
  ).toBe(1);
  const output = result.stdout + result.stderr;
  expect(output, "Error should name the missing skill").toMatch(/typescript-pro/);
  expect(output, "Error should name the reviewer agent").toMatch(/reviewer/);
});

test("consistency-missing-agent: agent file absent exits 1 with actionable error", () => {
  const result = runFixture(path.join(fixturesBase, "consistency-missing-agent"));
  expect(
    result.status,
    `Expected exit 1 for missing agent file. stdout: ${result.stdout} stderr: ${result.stderr}`
  ).toBe(1);
  const output = result.stdout + result.stderr;
  // Should mention the agent role or the skill in error output
  expect(output, "Error should reference the architect role").toMatch(/architect/);
});

test("consistency-malformed-row: malformed table rows do not crash validator exits 0", () => {
  const result = runFixture(path.join(fixturesBase, "consistency-malformed-row"));
  expect(
    result.status,
    `Expected exit 0 for fixture with malformed rows (well-formed row passes). stdout: ${result.stdout} stderr: ${result.stderr}`
  ).toBe(0);
});
