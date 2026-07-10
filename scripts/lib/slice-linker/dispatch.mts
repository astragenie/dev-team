/**
 * Reference dispatcher for the autonomous-loop slice-linker.
 *
 * FEAT-166 SLICE-78 — zero-behavior-change refactor.
 *
 * `planDispatch` replaces the hard-coded phase sequence in the loop plugin's
 * src/scripts/lib/slice-linker/dispatch.mts with a declarative YAML-driven
 * plan. This file is the hero-crew reference implementation; the loop plugin
 * vendors it by import path.
 *
 * CONTRACT: planDispatch is a PURE PLAN GENERATOR — no side effects, no
 * Agent tool calls. The loop plugin owns the actual subagent runtime calls.
 *
 * Golden trace (regular, fullstack default, code-change slice):
 *   [
 *     {
 *       role: "builder",
 *       agent: "crew:fullstack-dev",
 *       parallel: 1,
 *       gate: "none",
 *       routing: { resolved_by: "default" }
 *     },
 *     {
 *       role: "reviewer",
 *       agent: "",
 *       parallel: 1,
 *       gate: "all_pass",
 *       parallel_dispatch: {
 *         group: ["crew:reviewer", "crew:reviewer", "crew:verifier"],
 *         policy: "wait_for_all",
 *         halt_on: "any_FAIL"
 *       },
 *       aggregation: { halt_on_any_FAIL: true, wait_for_all: true }
 *     }
 *   ]
 */
import {
  loadWorkflowConfig,
  expandWorkflow,
  UnsupportedSkipExpressionError,
  type WorkflowPhase
} from "../workflow-config.ts";
import { parseMemoryConfig, resolveEffectiveConfig } from "@astragenie/memory-provider";

// ── Soak dispatcher hook (FEAT-183 S7 / SLICE-104) ────────────────────────────
//
// Re-exported so the loop orchestrator can import the soak hook from the same
// module that produces the dispatch plan. The loop orchestrator calls
// evaluateSoakHook(opts) BEFORE invoking the builder subagent for a slice phase.
// If the result is "early_revert" or "insufficient_traffic", the orchestrator
// deletes the soak pointer and falls back to the main champion path.
// If the result is "soak_use", the orchestrator steers the builder's
// --prompt flag to champion_path.
//
// The hook is intentionally synchronous (no async I/O) so it adds <1ms to
// the hot dispatch path. File reads are bounded to a single readFileSync on
// soak.json; malformed files fall back to { status: "error" } silently.
export {
  evaluateSoakHook,
  type SoakDispatchOpts,
  type SoakHookResult,
  type SoakHookStatus,
  type SoakEntry,
  type SoakMap
} from "../gepa/soak-dispatcher-hook.ts";

// ── Types ──────────────────────────────────────────────────────────────────────

export type GatePolicy = "all_pass" | "blocking" | "advisory" | "none" | "skipped";

/**
 * Parallel dispatch group — ONE Agent message with N tool calls.
 * Field names match post-builder-fanout.mts FanoutResult for cross-repo parity.
 * PARALLEL_DISPATCH_CONTRACT v1.
 */
export interface ParallelDispatchGroup {
  group: string[];
  policy: "wait_for_all";
  halt_on: "any_FAIL";
}

/**
 * Aggregation semantics for a parallel group.
 * Field names match post-builder-fanout.mts FanoutResult.aggregation.
 */
export interface DispatchAggregation {
  halt_on_any_FAIL: boolean;
  wait_for_all: boolean;
}

/**
 * Routing result attached to builder phases that used tag-based routing.
 * Lets the orchestrator log which variant was selected and why.
 */
export interface RoutingResult {
  resolved_by: "tag" | "default";
  matched_tag?: string;
}

/**
 * Recall-scoping hint for the runtime consumer (S3b, the loop-plugin
 * orchestrator) — NOT the recall block itself. planDispatch stays a pure
 * plan generator (no side effects, no I/O to the memory store); the
 * consumer calls scripts/lib/memory/inject-recall.ts's injectRecall() with
 * these values at the actual dispatch call.
 */
export interface DispatchMemoryHint {
  tags: string[];
  /** Absent on parallel_dispatch phases (multiple agents, no single scope). */
  agent?: string;
}

export interface DispatchPhase {
  role: string;
  /** Resolved agent ref for single-agent phases. Empty string for parallel_dispatch phases. */
  agent: string;
  parallel: number;
  gate: GatePolicy;
  skipReason?: string;
  /** Present on phases that fan out to multiple agents in one Agent message. */
  parallel_dispatch?: ParallelDispatchGroup;
  /** Aggregation contract for parallel_dispatch phases. */
  aggregation?: DispatchAggregation;
  /** Present on builder phases with routing. */
  routing?: RoutingResult;
  /**
   * Deployer-phase runtime hint: orchestrator must block on user input before
   * invoking the agent. Propagated verbatim from the YAML phase definition.
   */
  require_user_approval?: boolean;
  /**
   * FEAT-188 S3a — present only when `opts.memoryConfig` resolves to
   * recall-enabled. Absent otherwise, so existing golden dispatch-trace
   * fixtures (memory not configured) stay byte-identical.
   */
  memory?: DispatchMemoryHint;
}

// ── skip_when evaluation (v1, narrowly scoped) ─────────────────────────────────

const CHANGED_FILES_MATCHES_RE = /^changed_files\s+matches\s+"(.+)"$/;

/**
 * Evaluates a `skip_when` expression against the provided changed file paths.
 *
 * Supported expression form (v1 only):
 *   changed_files matches "<regex>"
 *
 * Returns true when ALL changed files match the regex (i.e. the phase should
 * be skipped). Returns false when at least one file does NOT match.
 *
 * @throws UnsupportedSkipExpressionError for any other expression syntax
 */
function evaluateSkipWhen(expression: string, changedFiles: string[]): boolean {
  const m = CHANGED_FILES_MATCHES_RE.exec(expression.trim());
  if (m === null || m[1] === undefined) {
    throw new UnsupportedSkipExpressionError(expression);
  }

  const pattern = new RegExp(m[1]);

  // Skip when ALL changed files match the pattern
  return changedFiles.length > 0 && changedFiles.every((f) => pattern.test(f));
}

// ── Tag routing ────────────────────────────────────────────────────────────────

/**
 * Resolves the builder agent from a routing config and a slice's tag set.
 *
 * Replicates the pickBuilderVariant logic from the loop plugin's dispatch.mts
 * (FEAT-190 / SLICE-104-105) but driven by the declarative YAML tag_routes map.
 *
 * Resolution order:
 *   1. Exact tag match in tag_routes (first matching tag wins)
 *   2. routing.default
 */
function resolveRouting(
  routing: NonNullable<WorkflowPhase["routing"]>,
  sliceTags: string[]
): { agent: string; parallel_dispatch?: ParallelDispatchGroup; routing: RoutingResult } {
  const tagRoutes = routing.tag_routes ?? {};

  for (const tag of sliceTags) {
    const routeValue = tagRoutes[tag];
    if (routeValue === undefined) continue;

    if (typeof routeValue === "string") {
      return {
        agent: routeValue,
        routing: { resolved_by: "tag", matched_tag: tag }
      };
    }
    // parallel_dispatch branch
    if (
      typeof routeValue === "object" &&
      "parallel_dispatch" in routeValue &&
      routeValue.parallel_dispatch !== undefined
    ) {
      const pd = routeValue.parallel_dispatch;
      return {
        agent: "",
        parallel_dispatch: {
          group: pd.group,
          policy: pd.policy,
          halt_on: pd.halt_on
        },
        routing: { resolved_by: "tag", matched_tag: tag }
      };
    }
  }

  // Default fallback
  return {
    agent: routing.default,
    routing: { resolved_by: "default" }
  };
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Builds an ordered dispatch phase plan from the declarative workflow YAML.
 *
 * @param opts.repoRoot      Absolute path to the repo root (where .claude/ lives).
 * @param opts.sliceWorkflow Named workflow key from slice frontmatter, or
 *                           undefined to use config.default_workflow.
 * @param opts.changedFiles  List of file paths changed in this slice (used to
 *                           evaluate skip_when expressions).
 * @param opts.sliceTags     Tags from the slice frontmatter (used for builder
 *                           variant routing via routing.tag_routes).
 * @param opts.memoryConfig  Raw `memory` config block (FEAT-188 unified
 *                           schema). When omitted, or when it resolves to
 *                           recall-disabled (provider:"none" or
 *                           recall.enabled:false), no `memory` hint is
 *                           attached to any phase — existing golden dispatch
 *                           traces stay byte-identical (AC: highest-risk
 *                           regression property).
 *
 * @returns Ordered array of DispatchPhase objects. Skipped phases have
 *          gate === "skipped" and a skipReason set.
 */
export async function planDispatch(opts: {
  repoRoot: string;
  sliceWorkflow?: string;
  changedFiles: string[];
  sliceTags?: string[];
  memoryConfig?: unknown;
}): Promise<DispatchPhase[]> {
  const { repoRoot, sliceWorkflow, changedFiles, sliceTags = [], memoryConfig } = opts;

  const config = await loadWorkflowConfig(repoRoot);
  const workflow = expandWorkflow(config, sliceWorkflow);

  const memoryHintEnabled =
    memoryConfig !== undefined &&
    resolveEffectiveConfig(parseMemoryConfig(memoryConfig)).recallEnabled;

  const phases: DispatchPhase[] = [];

  for (const phase of workflow.phases) {
    let gate: GatePolicy;
    let skipReason: string | undefined;

    // Evaluate skip_when before determining gate policy
    if (phase.skip_when !== undefined) {
      const skip = evaluateSkipWhen(phase.skip_when, changedFiles);
      if (skip) {
        gate = "skipped";
        skipReason = phase.skip_when;
      } else {
        gate = resolveGatePolicy(phase.gate?.policy);
      }
    } else {
      gate = resolveGatePolicy(phase.gate?.policy);
    }

    // Build the dispatch phase from YAML phase definition
    const dispatchPhase = buildDispatchPhase(phase, gate, sliceTags);

    if (skipReason !== undefined) {
      dispatchPhase.skipReason = skipReason;
    }

    if (memoryHintEnabled) {
      dispatchPhase.memory = dispatchPhase.agent
        ? { tags: sliceTags, agent: dispatchPhase.agent }
        : { tags: sliceTags };
    }

    phases.push(dispatchPhase);
  }

  return phases;
}

/**
 * Constructs a DispatchPhase from a parsed WorkflowPhase YAML node.
 * Handles the three phase shapes:
 *   1. routing phase (builder with tag_routes)
 *   2. parallel_dispatch phase (reviewer+validator fanout)
 *   3. plain agent phase (legacy / simple)
 */
function buildDispatchPhase(
  phase: WorkflowPhase,
  gate: GatePolicy,
  sliceTags: string[]
): DispatchPhase {
  // Shape 1: routing (builder phase with tag_routes)
  if (phase.routing !== undefined) {
    const resolved = resolveRouting(phase.routing, sliceTags);
    const dispatchPhase: DispatchPhase = {
      role: phase.role,
      agent: resolved.agent,
      parallel: resolved.parallel_dispatch ? resolved.parallel_dispatch.group.length : 1,
      gate,
      routing: resolved.routing
    };
    if (resolved.parallel_dispatch !== undefined) {
      dispatchPhase.parallel_dispatch = resolved.parallel_dispatch;
    }
    return dispatchPhase;
  }

  // Shape 2: parallel_dispatch (fanout — reviewer-A + reviewer-B + validator)
  if (phase.parallel_dispatch !== undefined) {
    const pd = phase.parallel_dispatch;
    const agg = phase.aggregation;
    const dispatchPhase: DispatchPhase = {
      role: phase.role,
      agent: "",
      parallel: pd.group.length,
      gate,
      parallel_dispatch: {
        group: pd.group,
        policy: pd.policy,
        halt_on: pd.halt_on
      }
    };
    if (agg !== undefined) {
      dispatchPhase.aggregation = {
        halt_on_any_FAIL: agg.halt_on_any_FAIL ?? false,
        wait_for_all: agg.wait_for_all ?? false
      };
    }
    return dispatchPhase;
  }

  // Shape 3: plain agent phase
  const plain: DispatchPhase = {
    role: phase.role,
    agent: phase.agent ?? "",
    parallel: phase.parallel ?? 1,
    gate
  };
  if (phase.require_user_approval === true) {
    plain.require_user_approval = true;
  }
  return plain;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function resolveGatePolicy(policy: "all_pass" | "blocking" | "advisory" | undefined): GatePolicy {
  if (policy === undefined) return "none";
  return policy;
}
