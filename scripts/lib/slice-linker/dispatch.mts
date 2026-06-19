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
 * Golden trace (regular, code-change slice):
 *   [
 *     { role: "builder",   agent: "crew:fullstack-dev", parallel: 1, gate: "none" },
 *     { role: "reviewer",  agent: "crew:inspector",     parallel: 2, gate: "all_pass" },
 *     { role: "validator", agent: "crew:verifier",      parallel: 1, gate: "blocking" }
 *   ]
 */
import {
  loadWorkflowConfig,
  expandWorkflow,
  UnsupportedSkipExpressionError
} from "../workflow-config.ts";

// ── Types ──────────────────────────────────────────────────────────────────────

export type GatePolicy = "all_pass" | "blocking" | "advisory" | "none" | "skipped";

export interface DispatchPhase {
  role: string;
  agent: string;
  parallel: number;
  gate: GatePolicy;
  skipReason?: string;
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

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Builds an ordered dispatch phase plan from the declarative workflow YAML.
 *
 * @param opts.repoRoot      Absolute path to the repo root (where .claude/ lives).
 * @param opts.sliceWorkflow Named workflow key from slice frontmatter, or
 *                           undefined to use config.default_workflow.
 * @param opts.changedFiles  List of file paths changed in this slice (used to
 *                           evaluate skip_when expressions).
 *
 * @returns Ordered array of DispatchPhase objects. Skipped phases have
 *          gate === "skipped" and a skipReason set.
 */
export async function planDispatch(opts: {
  repoRoot: string;
  sliceWorkflow?: string;
  changedFiles: string[];
}): Promise<DispatchPhase[]> {
  const { repoRoot, sliceWorkflow, changedFiles } = opts;

  const config = await loadWorkflowConfig(repoRoot);
  const workflow = expandWorkflow(config, sliceWorkflow);

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

    const dispatchPhase: DispatchPhase = {
      role: phase.role,
      agent: phase.agent,
      parallel: phase.parallel ?? 1,
      gate
    };

    if (skipReason !== undefined) {
      dispatchPhase.skipReason = skipReason;
    }

    phases.push(dispatchPhase);
  }

  return phases;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function resolveGatePolicy(policy: "all_pass" | "blocking" | "advisory" | undefined): GatePolicy {
  if (policy === undefined) return "none";
  return policy;
}
