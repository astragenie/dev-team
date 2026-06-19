/**
 * Workflow configuration loader and schema for .claude/workflows.yaml.
 *
 * FEAT-166 SLICE-78 — declarative workflow YAML, regular only.
 *
 * Exports:
 *   WorkflowConfigSchema, WorkflowPhaseSchema — Zod schemas
 *   WorkflowConfig, WorkflowDefinition, WorkflowPhase — derived types
 *   loadWorkflowConfig(repoRoot) — reads + validates .claude/workflows.yaml
 *   expandWorkflow(config, name?) — returns named (or default) workflow
 *
 * TODO (SLICE-B): ${env} substitution in YAML values.
 * TODO (SLICE-B): quick / spike / release workflows.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

// ── Typed errors ───────────────────────────────────────────────────────────────

export class WorkflowConfigNotFoundError extends Error {
  readonly searchedPath: string;
  constructor(searchedPath: string) {
    super(`Workflow config not found: ${searchedPath}`);
    this.name = "WorkflowConfigNotFoundError";
    this.searchedPath = searchedPath;
  }
}

export class WorkflowConfigParseError extends Error {
  constructor(message: string) {
    super(`Workflow config YAML parse error: ${message}`);
    this.name = "WorkflowConfigParseError";
  }
}

export class WorkflowConfigShapeError extends Error {
  constructor(message: string) {
    super(`Workflow config shape error: ${message}`);
    this.name = "WorkflowConfigShapeError";
  }
}

export class UnknownWorkflowError extends Error {
  readonly availableWorkflows: string[];
  constructor(name: string, availableWorkflows: string[]) {
    super(`Unknown workflow "${name}". Available: ${availableWorkflows.join(", ")}`);
    this.name = "UnknownWorkflowError";
    this.availableWorkflows = availableWorkflows;
  }
}

export class UnsupportedSkipExpressionError extends Error {
  constructor(expression: string) {
    super(
      `Unsupported skip_when expression: "${expression}". ` +
        "Only 'changed_files matches \"<regex>\"' is supported in v1."
    );
    this.name = "UnsupportedSkipExpressionError";
  }
}

// ── Zod schemas ────────────────────────────────────────────────────────────────

export const WorkflowPhaseSchema = z.object({
  role: z.enum(["builder", "reviewer", "reviewer_validator", "validator", "deployer"]),
  agent: z.string().min(1),
  parallel: z.number().int().min(1).max(4).optional(),
  emit: z.enum(["handoff"]).optional(),
  trigger: z
    .object({
      on: z.string(),
      from: z.string()
    })
    .optional(),
  gate: z
    .object({
      policy: z.enum(["all_pass", "blocking", "advisory"]),
      fail_action: z.enum(["route_to_fix"]).optional()
    })
    .optional(),
  skip_when: z.string().optional(),
  require_user_approval: z.boolean().optional()
});

const WorkflowDefinitionSchema = z.object({
  description: z.string().optional(),
  phases: z.array(WorkflowPhaseSchema).min(1)
});

export const WorkflowConfigSchema = z.object({
  version: z.literal(1),
  default_workflow: z.string().min(1),
  workflows: z.record(z.string(), WorkflowDefinitionSchema)
});

// ── Derived types ──────────────────────────────────────────────────────────────

export type WorkflowConfig = z.infer<typeof WorkflowConfigSchema>;
export type WorkflowDefinition = WorkflowConfig["workflows"][string];
export type WorkflowPhase = WorkflowDefinition["phases"][number];

// ── API ────────────────────────────────────────────────────────────────────────

/**
 * Reads and validates `.claude/workflows.yaml` under `repoRoot`.
 *
 * @throws WorkflowConfigNotFoundError when the file is absent
 * @throws WorkflowConfigParseError when YAML is invalid
 * @throws WorkflowConfigShapeError when Zod validation fails
 */
export async function loadWorkflowConfig(repoRoot: string): Promise<WorkflowConfig> {
  const filePath = path.join(repoRoot, ".claude", "workflows.yaml");

  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new WorkflowConfigNotFoundError(filePath);
    }
    throw err;
  }

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

/**
 * Returns the named workflow, or the default workflow when `name` is
 * undefined or empty.
 *
 * @throws UnknownWorkflowError when `name` is given but not found
 */
export function expandWorkflow(config: WorkflowConfig, name?: string): WorkflowDefinition {
  const key = name && name.length > 0 ? name : config.default_workflow;
  const available = Object.keys(config.workflows);

  const workflow = config.workflows[key];
  if (workflow === undefined) {
    throw new UnknownWorkflowError(key, available);
  }

  return workflow;
}
