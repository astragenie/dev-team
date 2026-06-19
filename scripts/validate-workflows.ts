#!/usr/bin/env node

// Workflow YAML CI gate — FEAT-166 SLICE-78 + SLICE-82
//
// Validates .claude/workflows.yaml (or a --config override) against:
//   1. Zod schema
//   2. Phase order: builder(0) → reviewer/reviewer_validator(1) → validator(2) → deployer(3)
//   3. Parallelism cap: every parallel value ≤ 4; parallel_dispatch group 2–8
//   4. Agent existence: every agent ref resolves to agents/<name>.md
//      — covers: phase.agent, routing.default, routing.tag_routes values,
//        parallel_dispatch.group members, routing tag_routes nested parallel_dispatch
//   5. Default workflow exists: config.default_workflow key must be in workflows
//   6. routing.tag_routes refs: every string value is a valid agent ref
//   7. parallel_dispatch group: group must have at least 2 members
//   8. (SLICE-82) release user-approval invariant: `release` workflow deployer phase
//      must have require_user_approval: true
//   9. (SLICE-82) circular workflow routing: detect cycles in workflow:* tag_route refs
//  10. (SLICE-82) workflow-name format: keys must match /^[a-z][a-z0-9_-]*$/
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

type Phase = WorkflowConfig["workflows"][string]["phases"][number];

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
  const filePath = path.join(AGENTS_ROOT, `${match[1]}.md`);
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Returns an error string when the agent file does not exist, or null. */
async function checkAgentRef(
  agentRef: string,
  workflowName: string,
  phaseIndex: number,
  context: string
): Promise<string | null> {
  if (!agentRef.startsWith("crew:")) return null;
  const exists = await agentFileExists(agentRef);
  if (exists) return null;
  return (
    `VALIDATE-WORKFLOWS error: ${workflowName} ${phaseIndex} ` +
    `${context}: agent "${agentRef}" not found (missing agents/${agentRef.slice(5)}.md)`
  );
}

/** Validate one agent ref and return a single-element array or empty array. */
async function agentErrors(
  ref: string,
  workflow: string,
  idx: number,
  ctx: string
): Promise<string[]> {
  const err = await checkAgentRef(ref, workflow, idx, ctx);
  return err ? [err] : [];
}

/** Check all agents in a group array. */
async function checkGroupRefs(
  group: string[],
  workflow: string,
  idx: number,
  prefix: string
): Promise<string[]> {
  const results = await Promise.all(
    group.map((ref) => agentErrors(ref, workflow, idx, `${prefix} member "${ref}"`))
  );
  return results.flat();
}

/** Check agents inside a nested tag-route parallel_dispatch. */
async function checkNestedPd(
  pd: { group: string[] },
  tag: string,
  workflow: string,
  idx: number
): Promise<string[]> {
  const ctx = `routing.tag_routes["${tag}"].parallel_dispatch group`;
  const sizeErr =
    pd.group.length < 2
      ? [`VALIDATE-WORKFLOWS error: ${workflow} ${idx} ${ctx} must have at least 2 members`]
      : [];
  return [...sizeErr, ...(await checkGroupRefs(pd.group, workflow, idx, ctx))];
}

/** Check all agent refs in a routing config (default + tag_routes). */
async function checkRoutingRefs(
  routing: NonNullable<Phase["routing"]>,
  workflow: string,
  idx: number
): Promise<string[]> {
  const checks: Promise<string[]>[] = [
    agentErrors(routing.default, workflow, idx, "routing.default")
  ];
  for (const [tag, val] of Object.entries(routing.tag_routes ?? {})) {
    if (typeof val === "string") {
      checks.push(agentErrors(val, workflow, idx, `routing.tag_routes["${tag}"]`));
    } else if (
      typeof val === "object" &&
      val !== null &&
      "parallel_dispatch" in val &&
      val.parallel_dispatch !== undefined
    ) {
      checks.push(checkNestedPd(val.parallel_dispatch, tag, workflow, idx));
    }
  }
  return (await Promise.all(checks)).flat();
}

/** Check all agent refs in a phase. */
async function checkPhaseRefs(phase: Phase, workflow: string, idx: number): Promise<string[]> {
  const checks: Promise<string[]>[] = [];
  if (phase.agent !== undefined) {
    checks.push(agentErrors(phase.agent, workflow, idx, "agent"));
  }
  if (phase.parallel_dispatch !== undefined) {
    checks.push(
      checkGroupRefs(phase.parallel_dispatch.group, workflow, idx, "parallel_dispatch group")
    );
  }
  if (phase.routing !== undefined) {
    checks.push(checkRoutingRefs(phase.routing, workflow, idx));
  }
  return (await Promise.all(checks)).flat();
}

/** Return structural errors for a single phase (synchronous). */
function phaseStructureErrors(
  phase: Phase,
  workflow: string,
  idx: number,
  lastPrec: number
): string[] {
  const errs: string[] = [];
  const prec = ROLE_PRECEDENCE[phase.role] ?? -1;
  if (prec < lastPrec) {
    errs.push(
      `VALIDATE-WORKFLOWS error: ${workflow} ${idx} ` +
        `phase order violation: "${phase.role}" (precedence ${prec}) ` +
        `follows a phase with precedence ${lastPrec}`
    );
  }
  if (phase.parallel !== undefined && phase.parallel > 4) {
    errs.push(
      `VALIDATE-WORKFLOWS error: ${workflow} ${idx} ` +
        `parallelism cap exceeded: parallel=${phase.parallel} (max 4)`
    );
  }
  if (phase.parallel_dispatch !== undefined) {
    const size = phase.parallel_dispatch.group.length;
    if (size < 2) {
      errs.push(
        `VALIDATE-WORKFLOWS error: ${workflow} ${idx} ` +
          `parallel_dispatch group must have at least 2 members (got ${size})`
      );
    } else if (size > 8) {
      errs.push(
        `VALIDATE-WORKFLOWS error: ${workflow} ${idx} ` +
          `parallel_dispatch group size cap exceeded: ${size} (max 8)`
      );
    }
  }
  return errs;
}

async function validateWorkflow(
  workflowName: string,
  workflow: WorkflowConfig["workflows"][string]
): Promise<string[]> {
  // Pass 1: structural checks (sequential to maintain precedence state)
  const structuralErrors: string[] = [];
  let lastPrecedence = -1;
  for (let i = 0; i < workflow.phases.length; i++) {
    const phase = workflow.phases[i];
    if (phase === undefined) continue;
    const errs = phaseStructureErrors(phase, workflowName, i, lastPrecedence);
    structuralErrors.push(...errs);
    lastPrecedence = Math.max(lastPrecedence, ROLE_PRECEDENCE[phase.role] ?? -1);
  }

  // Pass 2: agent-existence checks (parallelised across phases)
  const agentCheckResults = await Promise.all(
    workflow.phases.map((phase, i) =>
      phase !== undefined ? checkPhaseRefs(phase, workflowName, i) : Promise.resolve([])
    )
  );

  return [...structuralErrors, ...agentCheckResults.flat()];
}

// ── SLICE-82 checks ────────────────────────────────────────────────────────────

const WORKFLOW_NAME_RE = /^[a-z][a-z0-9_-]*$/;

/**
 * 10. Workflow-name format: every workflow key must match /^[a-z][a-z0-9_-]*$/.
 */
function checkWorkflowNames(config: WorkflowConfig): string[] {
  const errors: string[] = [];
  for (const key of Object.keys(config.workflows)) {
    if (!WORKFLOW_NAME_RE.test(key)) {
      errors.push(
        `VALIDATE-WORKFLOWS error: (config) (name) workflow name "${key}" must match /^[a-z][a-z0-9_-]*$/`
      );
    }
  }
  return errors;
}

/**
 * 8. release user-approval invariant: if the workflow named "release" contains
 * a phase with role "deployer", that phase MUST have require_user_approval: true.
 */
function checkReleaseUserApproval(config: WorkflowConfig): string[] {
  const releaseWorkflow = config.workflows["release"];
  if (releaseWorkflow === undefined) return [];

  const errors: string[] = [];
  for (let i = 0; i < releaseWorkflow.phases.length; i++) {
    const phase = releaseWorkflow.phases[i];
    if (phase === undefined) continue;
    if (phase.role === "deployer" && phase.require_user_approval !== true) {
      errors.push(
        `VALIDATE-WORKFLOWS error: release ${i} deployer phase missing require_user_approval: true`
      );
    }
  }
  return errors;
}

/** Collects workflow:* routing targets from a single workflow's phases. */
function collectWorkflowTargets(wf: WorkflowConfig["workflows"][string]): Set<string> {
  const targets = new Set<string>();
  for (const phase of wf.phases) {
    if (phase.routing?.tag_routes === undefined) continue;
    for (const val of Object.values(phase.routing.tag_routes)) {
      if (typeof val === "string" && val.startsWith("workflow:")) {
        targets.add(val.slice("workflow:".length));
      }
    }
  }
  return targets;
}

/**
 * Builds the workflow→workflow adjacency list from `workflow:` prefixed tag_route values.
 * Used by checkCircularRouting.
 */
function buildRoutingAdjacency(config: WorkflowConfig): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();
  for (const [wfName, wf] of Object.entries(config.workflows)) {
    adjacency.set(wfName, collectWorkflowTargets(wf));
  }
  return adjacency;
}

/**
 * DFS walk for cycle detection. Mutates visited/inStack/stackPath/errors in-place.
 * Extracted from checkCircularRouting to keep each function under the complexity cap.
 */
function walkRoutingGraph(
  node: string,
  adjacency: Map<string, Set<string>>,
  visited: Set<string>,
  inStack: Set<string>,
  stackPath: string[],
  errors: string[]
): void {
  if (inStack.has(node)) {
    const cycleStart = stackPath.indexOf(node);
    const cycle = [...stackPath.slice(cycleStart), node];
    errors.push(
      `VALIDATE-WORKFLOWS error: (config) (routing) cycle detected: ${cycle.join(" -> ")}`
    );
    return;
  }
  if (visited.has(node)) return;

  visited.add(node);
  inStack.add(node);
  stackPath.push(node);

  for (const neighbor of adjacency.get(node) ?? new Set<string>()) {
    walkRoutingGraph(neighbor, adjacency, visited, inStack, stackPath, errors);
  }

  stackPath.pop();
  inStack.delete(node);
}

/**
 * 9. Circular workflow routing: detect cycles in workflow:* tag_route refs.
 *
 * Forward-compat stub — no real workflow routes to another today.
 * Wired and tested via tests/fixtures/workflows/circular-routing.yaml.
 */
function checkCircularRouting(config: WorkflowConfig): string[] {
  const adjacency = buildRoutingAdjacency(config);
  const errors: string[] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const stackPath: string[] = [];

  for (const node of adjacency.keys()) {
    if (!visited.has(node)) {
      walkRoutingGraph(node, adjacency, visited, inStack, stackPath, errors);
    }
  }

  return errors;
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

  // 10. Workflow-name format (SLICE-82)
  errors.push(...checkWorkflowNames(config));

  // 8. release user-approval invariant (SLICE-82)
  errors.push(...checkReleaseUserApproval(config));

  // 9. Circular workflow routing (SLICE-82)
  errors.push(...checkCircularRouting(config));

  const perWorkflow = await Promise.all(
    Object.entries(config.workflows).map(([name, wf]) => validateWorkflow(name, wf))
  );
  return [...errors, ...perWorkflow.flat()];
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
