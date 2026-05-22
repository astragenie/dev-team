#!/usr/bin/env node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), "crew-e2e-"));
const repoPath = path.join(rootPath, "sample-repo");
const cliPath = path.resolve("scripts/crew.mjs");

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
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
