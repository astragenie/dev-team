#!/usr/bin/env node

// Workflow YAML CI gate — FEAT-166 SLICE-78
//
// Validates .claude/workflows.yaml (or a --config override) against:
//   1. Zod schema
//   2. Phase order: builder(0) → reviewer/reviewer_validator(1) → validator(2) → deployer(3)
//   3. Parallelism cap: every parallel value ≤ 4
//   4. Agent existence: every agent: crew:<name> resolves to agents/<name>.md
//   5. Default workflow exists: config.default_workflow key must be in workflows
//
// Stderr observability (DEC-024): one grep-able line per failure:
//   VALIDATE-WORKFLOWS error: <workflow> <phase-index> <reason>
//
// Success: stdout "Workflows OK: <N> workflow(s) validated"
// Failure: process.exitCode = 1

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import {
  WorkflowConfigSchema,
  WorkflowConfigParseError,
  WorkflowConfigShapeError,
  type WorkflowConfig
} from "./lib/workflow-config.ts";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AGENTS_ROOT = path.join(REPO_ROOT, "agents");

// Role precedence map for phase-order validation
const ROLE_PRECEDENCE: Record<string, number> = {
  builder: 0,
  reviewer: 1,
  reviewer_validator: 1,
  validator: 2,
  deployer: 3
};

function parseArgs(): { configPath: string | null } {
  const args = process.argv.slice(2);
  const configIdx = args.indexOf("--config");
  if (configIdx !== -1 && args[configIdx + 1] !== undefined) {
    return { configPath: args[configIdx + 1] as string };
  }
  return { configPath: null };
}

async function loadConfig(filePath: string): Promise<WorkflowConfig> {
  const raw = await fs.readFile(filePath, "utf8");
  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (err) {
    throw new WorkflowConfigParseError(err instanceof Error ? err.message : String(err));
  }
  const result = WorkflowConfigSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `[${i.path.join(".")}] ${i.message}`).join("; ");
    throw new WorkflowConfigShapeError(issues);
  }
  return result.data;
}

async function agentFileExists(agentRef: string): Promise<boolean> {
  const match = /^crew:(.+)$/.exec(agentRef);
  if (match === null || match[1] === undefined) return false;
  const agentName = match[1];
  const filePath = path.join(AGENTS_ROOT, `${agentName}.md`);
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function validateConfig(config: WorkflowConfig): Promise<string[]> {
  const errors: string[] = [];

  // 5. Default workflow exists
  if (!(config.default_workflow in config.workflows)) {
    errors.push(
      `VALIDATE-WORKFLOWS error: (config) (default) ` +
        `default_workflow "${config.default_workflow}" not found in workflows`
    );
  }

  for (const [workflowName, workflow] of Object.entries(config.workflows)) {
    errors.push(...(await validateWorkflow(workflowName, workflow)));
  }

  return errors;
}

async function validateWorkflow(
  workflowName: string,
  workflow: WorkflowConfig["workflows"][string]
): Promise<string[]> {
  const errors: string[] = [];
  let lastPrecedence = -1;

  for (let i = 0; i < workflow.phases.length; i++) {
    const phase = workflow.phases[i];
    if (phase === undefined) continue;

    // 2. Phase order check
    const precedence = ROLE_PRECEDENCE[phase.role] ?? -1;
    if (precedence < lastPrecedence) {
      errors.push(
        `VALIDATE-WORKFLOWS error: ${workflowName} ${i} ` +
          `phase order violation: "${phase.role}" (precedence ${precedence}) ` +
          `follows a phase with precedence ${lastPrecedence}`
      );
    }
    lastPrecedence = Math.max(lastPrecedence, precedence);

    // 3. Parallelism cap
    if (phase.parallel !== undefined && phase.parallel > 4) {
      errors.push(
        `VALIDATE-WORKFLOWS error: ${workflowName} ${i} ` +
          `parallelism cap exceeded: parallel=${phase.parallel} (max 4)`
      );
    }

    // 4. Agent existence
    if (phase.agent.startsWith("crew:")) {
      const exists = await agentFileExists(phase.agent);
      if (!exists) {
        errors.push(
          `VALIDATE-WORKFLOWS error: ${workflowName} ${i} ` +
            `agent "${phase.agent}" not found (missing agents/${phase.agent.slice(5)}.md)`
        );
      }
    }
  }

  return errors;
}

async function main(): Promise<void> {
  const { configPath } = parseArgs();

  // Resolve the config file path — either the --config override or default location
  const filePath =
    configPath !== null
      ? path.resolve(configPath)
      : path.join(REPO_ROOT, ".claude", "workflows.yaml");

  const config = await loadConfig(filePath);
  const errors = await validateConfig(config);

  if (errors.length > 0) {
    for (const err of errors) {
      process.stderr.write(err + "\n");
    }
    process.exitCode = 1;
    return;
  }

  const workflowCount = Object.keys(config.workflows).length;
  process.stdout.write(`Workflows OK: ${workflowCount} workflow(s) validated\n`);
}

await main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`VALIDATE-WORKFLOWS error: (fatal) (0) ${message}\n`);
  process.exitCode = 1;
});
