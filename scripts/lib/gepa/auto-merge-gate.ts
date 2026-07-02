/**
 * scripts/lib/gepa/auto-merge-gate.ts — SLICE-106
 *
 * Auto-merge gate: combines the 5 promotion-gate conditions (from SLICE-104's
 * evaluateGate / PromotionPolicy) PLUS:
 *   6. soak_pass — SoakVerdict.status === "passed" (soak already cleared).
 *   7. branch_protection_present — checkBranchProtection.enforced === true.
 *   8. agent_eligible — agent in policy.eligible_agents (deny-by-default).
 *   9. not_champion_frozen — agent NOT in gepa.config.json champion_frozen.
 *   10. not_critical_agent — agent NOT in CRITICAL_AGENT_ALLOWLIST.
 *
 * Priority order (checked left-to-right; all failures collected):
 *   critical-agent check FIRST (per AC-2: "critical-agent allowlist check fires FIRST").
 *
 * When ALL gates pass AND agent is not critical → calls
 *   `gh pr merge --auto --squash <pr_url>`
 *
 * When critical-agent fires → leaves PR as draft, emits
 *   `gepa_critical_agent_draft_pr`, does NOT call gh pr merge.
 *
 * On any gate block → leaves PR as draft, logs gate-verdict.
 *
 * Constraints:
 *   - NEVER `gh pr merge` without going through the gate.
 *   - NEVER `git push --force`.
 *   - NEVER `git reset` (revert uses `git revert` — see gepa-revert command).
 *   - `policy.eligible_agents: []` (empty) = deny all (AC-4).
 */

import { spawnSync } from "node:child_process";
import { join } from "node:path";
import {
  evaluateGate,
  type CandidateMetrics,
  type ChampionMetrics,
  type GatePolicy,
  type PromotionDecision
} from "@astragenie/gepa-core";
import { isCriticalAgent } from "./critical-agent-allowlist.ts";
import {
  emitGepaEvent,
  emitCriticalAgentDraftPrEvent,
  emitOptPromoteEvent,
  emitTailRiskBlockEvent
} from "./observability-events.ts";
import type { OptimizationResult } from "./optimize-runner.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

/** Inputs to the auto-merge gate. */
export interface AutoMergeGateOpts {
  /** Absolute path to the repo root. */
  repoPath: string;
  /** Agent name (e.g. "fullstack-dev"). */
  agent: string;
  /**
   * Optimization result for this cycle — supplies candidate metrics.
   * The winner must be non-null (caller guards this).
   */
  result: OptimizationResult;
  /**
   * Whether the soak phase has passed for this candidate.
   * Comes from evaluateSoak → verdict.status === "passed".
   */
  soakPassed: boolean;
  /**
   * Whether branch protection is enforced on `main`.
   * Comes from checkBranchProtection.enforced.
   */
  branchProtectionPresent: boolean;
  /**
   * Promotion policy including eligible_agents, gate thresholds, and frozen list.
   */
  policy: AutoMergePolicy;
  /**
   * URL of the PR opened by runAutoPr (SLICE-105).
   * Required to call `gh pr merge --auto --squash`.
   */
  prUrl: string;
  /**
   * Champion pass rate on held-out cases — used for the min_pass_delta gate.
   */
  championMetrics: ChampionMetrics;
  /**
   * Optional override for the `gh` binary path (useful for tests).
   */
  ghPath?: string;
}

/**
 * Subset of gepa.config.json `policy` + `champion_frozen` relevant to the gate.
 * Caller constructs this from the loaded GepaConfig.
 */
export interface AutoMergePolicy {
  /** Agents allowed for auto-merge (empty = deny all). */
  eligible_agents: string[];
  /** Agents frozen from further optimization/promotion. */
  champion_frozen: string[];
  /** Gate thresholds (passed through to evaluateGate). */
  gate: GatePolicy;
}

/** Result of evaluateAutoMergeGate. */
export interface AutoMergeGateResult {
  /** True when ALL gates passed and gh pr merge was invoked. */
  eligible: boolean;
  /** False when the PR was left as draft (gate block or critical-agent). */
  merged: boolean;
  /**
   * Reasons the gate was blocked (empty when eligible=true).
   * Includes: "not_pareto_rank_1", "min_pass_delta_not_met", "tail_risk_block",
   *   "cost_regression", "latency_regression", "soak_not_passed",
   *   "branch_protection_missing", "agent_not_eligible", "champion_frozen",
   *   "critical_agent" (always blockedBy[0] when critical-agent fires).
   */
  blockedBy: string[];
  /** Structured promotion decision from the 5-condition gate. */
  gateDecision: PromotionDecision;
  /** True when the PR was left as draft for the human-review queue. */
  draftPr: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractCandidateMetrics(result: OptimizationResult): CandidateMetrics {
  const w = result.winner!;
  return {
    pareto_rank: w.pareto_rank,
    // Held-out pass rate: use the winner's pass flag as a binary 0/1 proxy.
    // More precise metrics require held_out aggregates — stubbed here as per AC-1.
    held_out_pass: w.pass ? 1.0 : 0.0,
    // min case score — use winner score (conservative proxy; AC-3 floor is 0.6).
    min_held_out_case_score: w.score,
    cost_usd_delta: w.cost_usd,
    latency_ms_delta: w.latency_ms
  };
}

function runGhMerge(
  ghPath: string,
  cwd: string,
  prUrl: string
): { ok: boolean; stderr: string; stdout: string } {
  // NEVER git push --force. gh pr merge --auto --squash merges when CI clears.
  const r = spawnSync(ghPath, ["pr", "merge", "--auto", "--squash", prUrl], {
    cwd,
    encoding: "utf8",
    windowsHide: true
  });
  if (r.error) throw r.error;
  return {
    ok: r.status === 0,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? ""
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Build the critical-agent early-return result. */
function criticalAgentResult(opts: AutoMergeGateOpts): AutoMergeGateResult {
  const { repoPath, agent, result, prUrl } = opts;
  emitCriticalAgentDraftPrEvent(repoPath, {
    agent,
    cycle_id: result.cycle_id,
    trial_id: result.winner?.candidate_id,
    pr_url: prUrl,
    pr_draft: true
  });
  process.stdout.write(
    `gepa-auto-merge-gate: critical agent "${agent}" → PR left as draft for human review: ${prUrl}\n`
  );
  const decision: PromotionDecision = {
    eligible: false,
    blockedBy: ["critical_agent"],
    events: ["gepa_critical_agent_draft_pr"],
    detail: {
      pareto_rank: result.winner?.pareto_rank ?? 0,
      held_out_pass: result.winner?.pass ? 1.0 : 0.0,
      champion_held_out_pass: opts.championMetrics.held_out_pass,
      pass_delta: (result.winner?.pass ? 1.0 : 0.0) - opts.championMetrics.held_out_pass,
      min_held_out_case_score: result.winner?.score ?? 0,
      cost_usd_delta: result.winner?.cost_usd ?? 0,
      latency_ms_delta: result.winner?.latency_ms ?? 0
    }
  };
  return {
    eligible: false,
    merged: false,
    blockedBy: ["critical_agent"],
    gateDecision: decision,
    draftPr: true
  };
}

/** Collect additional gate blocks beyond the 5-condition gate. */
function collectExtraGateBlocks(
  agent: string,
  soakPassed: boolean,
  branchProtectionPresent: boolean,
  policy: AutoMergePolicy
): string[] {
  const extra: string[] = [];
  if (!soakPassed) extra.push("soak_not_passed");
  if (!branchProtectionPresent) extra.push("branch_protection_missing");
  if (!policy.eligible_agents.includes(agent)) extra.push("agent_not_eligible");
  if (policy.champion_frozen.includes(agent)) extra.push("champion_frozen");
  return extra;
}

/** Execute gh pr merge and return the gate result. */
function invokeMerge(
  opts: AutoMergeGateOpts,
  gateDecision: PromotionDecision
): AutoMergeGateResult {
  const { repoPath, agent, result, prUrl } = opts;
  const gh = opts.ghPath ?? "gh";
  try {
    const mergeResult = runGhMerge(gh, repoPath, prUrl);
    if (!mergeResult.ok) {
      emitGepaEvent(repoPath, {
        event: "gepa_auto_merge_failed",
        agent,
        cycle_id: result.cycle_id,
        trial_id: result.winner?.candidate_id,
        pr_url: prUrl,
        stderr: mergeResult.stderr
      });
      return {
        eligible: true,
        merged: false,
        blockedBy: ["gh_merge_failed"],
        gateDecision,
        draftPr: false
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emitGepaEvent(repoPath, {
      event: "gepa_auto_merge_error",
      agent,
      cycle_id: result.cycle_id,
      pr_url: prUrl,
      error: message
    });
    return {
      eligible: true,
      merged: false,
      blockedBy: ["gh_merge_error"],
      gateDecision,
      draftPr: false
    };
  }
  emitOptPromoteEvent(repoPath, {
    agent,
    cycle_id: result.cycle_id,
    trial_id: result.winner!.candidate_id,
    pr_url: prUrl
  });
  return { eligible: true, merged: true, blockedBy: [], gateDecision, draftPr: false };
}

/**
 * Evaluate the full auto-merge gate and, when eligible, invoke
 * `gh pr merge --auto --squash`.
 *
 * Critical-agent check fires FIRST per AC-2.
 * Gate blocks are all collected (not short-circuit) so the verdict log is
 * complete for human review.
 *
 * Never throws — all gh errors are captured in the result.
 */
export function evaluateAutoMergeGate(opts: AutoMergeGateOpts): AutoMergeGateResult {
  const { repoPath, agent, result, soakPassed, branchProtectionPresent, policy, prUrl } = opts;

  // ── Gate 0: Critical-agent check FIRST (AC-2) ────────────────────────────
  if (isCriticalAgent(agent)) return criticalAgentResult(opts);

  // ── Gates 1–5: 5-condition promotion gate (evaluateGate from gepa-core) ──
  const candidateMetrics = extractCandidateMetrics(result);
  const gateDecision = evaluateGate(candidateMetrics, opts.championMetrics, policy.gate);
  const blockedBy: string[] = gateDecision.eligible ? [] : [...gateDecision.blockedBy];

  if (!gateDecision.eligible && gateDecision.blockedBy.includes("tail_risk_block")) {
    emitTailRiskBlockEvent(repoPath, {
      agent,
      cycle_id: result.cycle_id,
      trial_id: result.winner?.candidate_id,
      min_held_out_case_score: candidateMetrics.min_held_out_case_score,
      floor: policy.gate.minCaseScoreFloor
    });
  }

  // ── Gates 6–9: soak, branch-protection, eligibility, frozen ──────────────
  blockedBy.push(...collectExtraGateBlocks(agent, soakPassed, branchProtectionPresent, policy));

  // ── Verdict ───────────────────────────────────────────────────────────────
  if (blockedBy.length > 0) {
    emitGepaEvent(repoPath, {
      event: "gepa_auto_merge_gate_block",
      agent,
      cycle_id: result.cycle_id,
      trial_id: result.winner?.candidate_id,
      pr_url: prUrl,
      blocked_by: blockedBy
    });
    return { eligible: false, merged: false, blockedBy, gateDecision, draftPr: true };
  }

  // ── All gates green — invoke gh pr merge ─────────────────────────────────
  return invokeMerge(opts, gateDecision);
}

/**
 * Build an AutoMergePolicy from a GepaConfig (loaded by loadGepaConfig).
 * Extracts policy.eligible_agents, champion_frozen, and gate thresholds.
 */
export function buildAutoMergePolicy(config: {
  policy?: {
    eligible_agents?: string[];
    min_pass_delta?: number;
    min_case_score_floor?: number;
    allow_cost_regression?: boolean;
    allow_latency_regression?: boolean;
  };
  champion_frozen?: string[];
}): AutoMergePolicy {
  const p = config.policy ?? {};
  return {
    eligible_agents: p.eligible_agents ?? [],
    champion_frozen: config.champion_frozen ?? [],
    gate: {
      minPassDelta: p.min_pass_delta ?? 0.05,
      minCaseScoreFloor: p.min_case_score_floor ?? 0.6,
      allowCostRegression: p.allow_cost_regression ?? false,
      allowLatencyRegression: p.allow_latency_regression ?? false
    }
  };
}

// ── Default policy path ────────────────────────────────────────────────────────

export function defaultSoakJsonPath(repoPath: string): string {
  return join(repoPath, ".claude", "artifacts", "crew", "gepa", "soak.json");
}
