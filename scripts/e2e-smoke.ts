#!/usr/bin/env node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), "crew-e2e-"));
const repoPath = path.join(rootPath, "sample-repo");
const cliPath = path.resolve("scripts/crew.ts");
const classifyScriptPath = path.resolve("scripts/orchestrate-slice-classify.ts");
const sliceFixturePath = path.resolve("tests/fixtures/slices/split-build-demo.md");
const openapiFixturePath = path.resolve("tests/fixtures/openapi/valid-feat.openapi.yaml");

async function scenarioSplitBuildClassification(sampleRoot: string) {
  const sliceDir = path.join(sampleRoot, "docs", "ai-loop", "slices", "pending");
  await fs.mkdir(sliceDir, { recursive: true });
  const sliceTarget = path.join(sliceDir, "SLICE-901-split-build-demo.md");
  await fs.copyFile(sliceFixturePath, sliceTarget);

  const contractDir = path.join(sampleRoot, "docs", "contracts", "FEAT-DEMO");
  await fs.mkdir(contractDir, { recursive: true });
  await fs.copyFile(openapiFixturePath, path.join(contractDir, "openapi.yaml"));

  const { stdout } = await execFile(process.execPath, [classifyScriptPath, sliceTarget]);
  const json = JSON.parse(stdout);
  if (json.SPLIT_BUILD !== true) {
    throw new Error(`expected SPLIT_BUILD true, got: ${JSON.stringify(json)}`);
  }
  console.log("scenarioSplitBuildClassification: PASS");
}

async function smokeBuildBundle(repoRoot: string): Promise<void> {
  // Create a fresh temp repo so the bundle smoke is isolated from the sample repo.
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "smoke-bundle-"));
  await execFile("git", ["init", "-q"], { cwd: tmp });
  await execFile("git", ["config", "user.email", "smoke@example.com"], { cwd: tmp });
  await execFile("git", ["config", "user.name", "Smoke"], { cwd: tmp });
  await fs.writeFile(path.join(tmp, ".gitignore"), "node_modules\n", "utf8");
  await execFile("git", ["add", "-A"], { cwd: tmp });
  await execFile("git", ["commit", "-q", "-m", "init"], { cwd: tmp });

  await fs.writeFile(path.join(tmp, "a.ts"), "export const a = 1;\n", "utf8");
  const handoffPath = path.join(tmp, "handoff.md");
  await fs.writeFile(handoffPath, "## Handoff body\n\nsmoke\n", "utf8");

  const crewScript = path.join(repoRoot, "scripts", "crew.ts");
  const { stdout } = await execFile(
    process.execPath,
    [
      "--experimental-strip-types",
      crewScript,
      "write-build-bundle",
      "--repo",
      tmp,
      "--slice",
      "SLICE-smoke",
      "--builder",
      "builder",
      "--run",
      "20260608T999999Z",
      "--handoff",
      handoffPath,
      "--files",
      "a.ts",
      "--files-read",
      ""
    ],
    { cwd: repoRoot }
  );

  const printedPath = stdout.trim().split(/\r?\n/).pop() ?? "";
  assert.ok(
    printedPath.endsWith("build-bundle.md"),
    `smoke: bundle path not printed (got: ${JSON.stringify(printedPath)})`
  );

  const expectedDir = path.join(tmp, ".claude", "artifacts", "crew", "bundles", "SLICE-smoke");
  const inExpectedDir = printedPath.startsWith(expectedDir);
  assert.ok(
    inExpectedDir,
    `smoke: bundle not under expected dir ${expectedDir} (got: ${printedPath})`
  );

  const text = await fs.readFile(printedPath, "utf8");
  assert.match(text, /^---\nslice: SLICE-smoke\n/, "smoke: bundle missing slice frontmatter");
  assert.ok(text.includes("## Handoff"), "smoke: bundle missing Handoff section");
  assert.ok(text.includes("## Diff"), "smoke: bundle missing Diff section");
  assert.ok(text.includes("## Files touched"), "smoke: bundle missing Files touched section");

  console.log(`[smoke] build-bundle phase OK (${printedPath})`);
}

async function main() {
  console.log(`Creating sample repo at ${repoPath}`);

  const initResult = await execFile("node", [cliPath, "init", "--repo", repoPath], {
    cwd: path.resolve(".")
  });
  console.log(initResult.stdout.trim());

  const claudePath = path.join(repoPath, "CLAUDE.md");
  const gitignorePath = path.join(repoPath, ".gitignore");
  const settingsPath = path.join(repoPath, ".claude", "settings.json");
  const workflowPath = path.join(repoPath, ".claude", "crew", "workflow.md");
  const protocolPath = path.join(repoPath, ".claude", "crew", "protocol.md");
  const validationsPath = path.join(repoPath, ".claude", "artifacts", "crew", "validations");
  const deploymentsPath = path.join(repoPath, ".claude", "artifacts", "crew", "deployments");
  const claudeMd = await fs.readFile(claudePath, "utf8");
  const gitignore = await fs.readFile(gitignorePath, "utf8");
  const settings = JSON.parse(await fs.readFile(settingsPath, "utf8"));
  const workflowMd = await fs.readFile(workflowPath, "utf8");
  const protocolMd = await fs.readFile(protocolPath, "utf8");

  console.log("\nSmoke check:");
  console.log(`- CLAUDE.md exists: ${claudeMd.length > 0}`);
  console.log(`- .gitignore has Crew block: ${gitignore.includes("# crew:start")}`);
  console.log(`- Harness import present: ${claudeMd.includes("crew:start")}`);
  console.log(
    `- Workflow stays command-loaded: ${!claudeMd.includes("@.claude/crew/workflow.md")}`
  );
  console.log(`- Workflow file exists: ${workflowMd.length > 0}`);
  console.log(`- Protocol file exists: ${protocolMd.length > 0}`);
  console.log(
    `- Validation artifacts dir exists: ${await fs
      .access(validationsPath)
      .then(() => true)
      .catch(() => false)}`
  );
  console.log(
    `- Deployment artifacts dir exists: ${await fs
      .access(deploymentsPath)
      .then(() => true)
      .catch(() => false)}`
  );
  console.log(`- Hook events configured: ${Object.keys(settings.hooks).join(", ")}`);
  console.log(`- Repo path: ${repoPath}`);

  console.log("\nScenario: SPLIT_BUILD classification");
  await scenarioSplitBuildClassification(repoPath);

  const heroCrewRoot = path.resolve(import.meta.dirname, "..");
  console.log("\nScenario: write-build-bundle");
  await smokeBuildBundle(heroCrewRoot);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
