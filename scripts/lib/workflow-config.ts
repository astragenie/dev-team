/**
 * Workflow configuration loader and schema for .claude/workflows.yaml.
 *
 * FEAT-166 SLICE-78 — declarative workflow YAML, regular only.
 *
 * Exports:
 *   WorkflowConfigSchema, WorkflowPhaseSchema — Zod schemas
 *   ParallelDispatchSchema, RoutingSchema, AggregationSchema — nested schemas
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

/**
 * Aggregation semantics for a phase group. Field names match the loop runtime
 * (post-builder-fanout.mts FanoutResult.aggregation) so a future SLICE-B
 * vendoring step can drop in without re-keying.
 */
export const AggregationSchema = z.object({
  halt_on_any_FAIL: z.boolean().optional(),
  wait_for_all: z.boolean().optional()
});

/**
 * Parallel dispatch group — one Agent message, N tool calls.
 * Matches PARALLEL_DISPATCH_CONTRACT v1 semantics from the loop runtime.
 *
 * Fields:
 *   group   — ordered list of agent refs dispatched in a single message
 *   policy  — wait_for_all: orchestrator waits for every artifact before continuing
 *   halt_on — any_FAIL: any FAIL in the group halts the slice
 */
export const ParallelDispatchSchema = z.object({
  group: z.array(z.string().min(1)).min(2),
  policy: z.literal("wait_for_all"),
  halt_on: z.literal("any_FAIL")
});

/**
 * Tag-based routing for the builder phase. Replicates the slice-tag dispatch
 * logic in loop dispatch.mts:pickBuilderVariant (FEAT-190 / SLICE-104-105).
 *
 * tag_routes keys map slice frontmatter tags to agent refs or parallel groups.
 * `default` is required and is used when no tag matches.
 */
const TagRouteValueSchema = z.union([
  z.string().min(1),
  z.object({ parallel_dispatch: ParallelDispatchSchema })
]);

export const RoutingSchema = z.object({
  tag_routes: z.record(z.string(), TagRouteValueSchema).optional(),
  default: z.string().min(1)
});

export const WorkflowPhaseSchema = z
  .object({
    role: z.enum(["builder", "reviewer", "reviewer_validator", "validator", "deployer"]),
    // agent is optional when routing is present (routing.default fulfils agent resolution)
    agent: z.string().min(1).optional(),
    routing: RoutingSchema.optional(),
    parallel_dispatch: ParallelDispatchSchema.optional(),
    parallel: z.number().int().min(1).max(4).optional(),
    aggregation: AggregationSchema.optional(),
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
  })
  .refine(
    (data) =>
      data.agent !== undefined ||
      data.routing !== undefined ||
      data.parallel_dispatch !== undefined,
    { message: "Phase must specify at least one of: agent, routing, or parallel_dispatch" }
  );

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
export type ParallelDispatch = z.infer<typeof ParallelDispatchSchema>;
export type Routing = z.infer<typeof RoutingSchema>;
export type Aggregation = z.infer<typeof AggregationSchema>;

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
