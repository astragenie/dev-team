/**
 * scripts/lib/gepa/optimize-runner.ts — SLICE-99
 *
 * Optimization runner for /crew:gepa-optimize. Implements the GEPA Phase 3
 * "Optimize" loop using primitives from @astragenie/gepa-core.
 *
 * Note: gepa-core 0.6.0 does NOT export a top-level `runOptimization` fn.
 * This module composes the available primitives directly:
 *   - CandidateGenerator.generate → K candidate files
 *   - sequentialRunner.runCandidates → Trial[] per candidate
 *   - paretoRank → ranked trials
 *   - dailyCapMeter → budget enforcement
 *   - fileLockManager → dedupe concurrent runs on the same agent
 *
 * The optimization result JSON is written to:
 *   .claude/artifacts/crew/gepa/opt/<run-id>.json
 *
 * Winner selection: Pareto rank-1 candidate with best tiebreaker
 * (pass > score > -cost > -latency > trial_id asc).
 * If all candidates are dominated by each other or by the champion,
 * `no_winner: true` is set and no promotion is performed.
 *
 * `partial: true` is set when the budget meter halted candidate runs
 * mid-cycle; such runs are ineligible for promotion (winner: null).
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runAutoPr, printManualCommands, GhAuthError, type AutoPrResult } from "./auto-pr.ts";
import { GhAbsentError } from "./branch-protection-check.ts";
import {
  dailyCapMeter,
  fileLockManager,
  paretoRank,
  sequentialRunner,
  type BudgetMeter,
  type CandidateGenerator,
  type Candidate,
  type EvalCase,
  type Trial
} from "@astragenie/gepa-core";
import type { Scorer } from "@astragenie/gepa-core";

// ── Types ───────────────────────────────────────────────────────────────────

export interface OptimizationResult {
  /** Unique ID for this optimization run. */
  run_id: string;
  /** Cycle ID used to scope candidate files. Same as run_id in this slice. */
  cycle_id: string;
  /** Agent that was optimized. */
  agent: string;
  /** Number of candidates requested. */
  k: number;
  /** Number of candidates successfully scored (may be < k if oversized or budget-halted). */
  candidates_evaluated: number;
  /**
   * True when the budget cap halted scoring mid-cycle.
   * A partial run is ineligible for promotion (winner: null).
   */
  partial: boolean;
  /**
   * True when no candidate achieves Pareto rank 1 better than the champion,
   * or when all candidates were oversized / budget-halted.
   */
  no_winner: boolean;
  /**
   * Winner information when a Pareto rank-1 winner is found.
   * null on partial runs or when no_winner is true.
   */
  winner: {
    candidate_id: string;
    pareto_rank: number;
    score: number;
    pass: boolean;
    cost_usd: number;
    latency_ms: number;
    prompt_path: string;
  } | null;
  /**
   * True when the winner's prompt content is identical to the current champion
   * (defensive no-op guard). No PR is opened in this case.
   */
  no_op_promotion?: boolean;
  /** All trial results, with pareto_rank assigned. */
  trials: (Trial & { pareto_rank: number | null })[];
  /** ISO timestamp of run start. */
  started_at: string;
  /** ISO timestamp of run end. */
  finished_at: string;
  /**
   * Auto-PR result when promotion was attempted.
   * undefined when artifact-only mode was active or no winner found.
   */
  auto_pr?: AutoPrResult;
}

export interface RunOptimizeOpts {
  /** Absolute path to repo root. */
  repoPath: string;
  /** Agent to optimize (e.g. "fullstack-dev"). */
  agent: string;
  /** Number of candidates to generate. */
  k: number;
  /**
   * Budget cap in USD for this optimization run.
   * Uses dailyCapMeter persisted to .claude/artifacts/crew/gepa/budget.json.
   */
  budgetUsd: number;
  /** Failing trials to pass to the CandidateGenerator. */
  failingTrials: Trial[];
  /** Candidate generator (injected for testability). */
  generator: CandidateGenerator;
  /**
   * Scorer for candidate trials (injected for testability).
   * In artifact-only mode, a no-op scorer is used.
   */
  scorer: Scorer;
  /**
   * Optional budget meter override (for tests).
   * When not provided, uses dailyCapMeter with the default persist path.
   */
  meter?: BudgetMeter;
  /**
   * Optional lock root override (for tests).
   */
  lockRoot?: string;
  /**
   * Optional eval cases to score candidates against.
   * When omitted (artifact-only mode), no LLM scoring runs and `partial` stays
   * false. When provided, `partial: true` is set if the run halted before
   * completing candidates.length * cases.length trials (budget or signal).
   */
  cases?: EvalCase[];
  /**
   * When true (default false), skip the auto-PR step even when a winner is found.
   * Use for dry-run cycles or when the caller will handle promotion separately.
   */
  artifactOnly?: boolean;
  /**
   * Optional override for the `gh` binary path (useful for tests).
   */
  ghPath?: string;
  /**
   * Optional override for the `git` binary path (useful for tests).
   */
  gitPath?: string;
  /**
   * Optional repo override (owner/name) for the branch-protection check.
   */
  repo?: string;
}

// ── Default paths ───────────────────────────────────────────────────────────

function defaultBudgetPath(repoPath: string): string {
  return join(repoPath, ".claude", "artifacts", "crew", "gepa", "budget.json");
}

function defaultLockRoot(repoPath: string): string {
  return join(repoPath, ".claude", "artifacts", "crew", "gepa", "locks");
}

function optArtifactPath(repoPath: string, runId: string): string {
  return join(repoPath, ".claude", "artifacts", "crew", "gepa", "opt", `${runId}.json`);
}

// ── No-op scorer for artifact-only mode ────────────────────────────────────

/** A scorer that returns a deterministic pass=false result without LLM calls. */
export function noopScorer(): Scorer {
  return {
    async score() {
      return {
        pass: false,
        score: 0,
        cost_usd: 0,
        latency_ms: 0,
        rationale: "artifact-only: no scoring"
      };
    }
  };
}

// ── Core optimization run ───────────────────────────────────────────────────

/**
 * Run one optimization cycle for `agent`.
 *
 * Steps:
 *   1. Acquire fileLock(agent, "optimize") — exit if held.
 *   2. CandidateGenerator.generate → K candidate files.
 *   3. sequentialRunner.runCandidates → Trial[].
 *   4. paretoRank → ranked trials.
 *   5. Write OptimizationResult JSON artifact.
 *   6. Release lock.
 *
 * Returns null if the lock is held by another process.
 */
async function scoreCandidates(
  candidates: Candidate[],
  cases: EvalCase[],
  scorer: Scorer,
  meter: BudgetMeter
): Promise<{ trials: Trial[]; partial: boolean }> {
  if (candidates.length === 0) return { trials: [], partial: false };
  const runner = sequentialRunner();
  const controller = new AbortController();
  const trials = await runner.runCandidates(candidates, cases, scorer, {
    meter,
    signal: controller.signal
  });
  // partial = true ONLY when eval cases were requested but not all trials
  // completed (budget cap or signal halt). Empty-cases artifact-only mode
  // is NOT partial — the run reached its intended zero-scoring end state.
  const partial = cases.length > 0 && trials.length < candidates.length * cases.length;
  return { trials, partial };
}

function determineWinner(
  ranked: (Trial & { pareto_rank: number | null })[],
  candidates: Candidate[],
  partial: boolean
): { winner: OptimizationResult["winner"]; noWinner: boolean } {
  if (partial) return { winner: null, noWinner: true };
  const rank1 = ranked.filter((t) => t.pareto_rank === 1);
  const best = rank1[0];
  if (!best) return { winner: null, noWinner: true };

  const matchingCandidate = candidates.find((c) => c.prompt_hash === best.candidate_prompt_hash);
  const winner: OptimizationResult["winner"] = {
    candidate_id: best.id,
    pareto_rank: best.pareto_rank ?? 1,
    score: best.score.score,
    pass: best.score.pass,
    cost_usd: best.score.cost_usd,
    latency_ms: best.score.latency_ms,
    prompt_path: matchingCandidate?.prompt_path ?? best.candidate_prompt_path ?? ""
  };
  return { winner, noWinner: !best.score.pass };
}

function writeArtifact(repoPath: string, runId: string, result: OptimizationResult): string {
  const artifactPath = optArtifactPath(repoPath, runId);
  const artifactDir = join(repoPath, ".claude", "artifacts", "crew", "gepa", "opt");
  if (!existsSync(artifactDir)) mkdirSync(artifactDir, { recursive: true });
  writeFileSync(artifactPath, JSON.stringify(result, null, 2), "utf8");
  return artifactPath;
}

function tryAutoPr(opts: RunOptimizeOpts, result: OptimizationResult, artifactPath: string): void {
  try {
    const prResult = runAutoPr({
      repoPath: opts.repoPath,
      agent: opts.agent,
      result,
      ...(opts.ghPath !== undefined ? { ghPath: opts.ghPath } : {}),
      ...(opts.gitPath !== undefined ? { gitPath: opts.gitPath } : {}),
      ...(opts.repo !== undefined ? { repo: opts.repo } : {})
    });
    result.auto_pr = prResult;
    if (prResult.no_op_promotion) result.no_op_promotion = true;
    writeFileSync(artifactPath, JSON.stringify(result, null, 2), "utf8");
  } catch (err) {
    if (err instanceof GhAbsentError || err instanceof GhAuthError) {
      // gh absent or not authenticated — print manual commands, non-fatal to
      // the optimization result (artifact is still written).
      printManualCommands({ agent: opts.agent, result, reason: err.message });
    } else {
      throw err;
    }
  }
}

export async function runOptimize(opts: RunOptimizeOpts): Promise<OptimizationResult | null> {
  const { repoPath, agent, k, budgetUsd, failingTrials, generator, scorer } = opts;

  const runId = crypto.randomUUID();
  const startedAt = new Date().toISOString();

  const lockRoot = opts.lockRoot ?? defaultLockRoot(repoPath);
  const lock = await fileLockManager(lockRoot).acquire(agent, "optimize");
  if (lock === null) return null; // Another process holds the lock.

  try {
    const meter = opts.meter ?? dailyCapMeter(budgetUsd, defaultBudgetPath(repoPath));
    const cases = opts.cases ?? [];

    const candidates: Candidate[] = await generator.generate(
      championPath(repoPath, agent),
      failingTrials,
      k,
      { meter }
    );

    const { trials, partial } = await scoreCandidates(candidates, cases, scorer, meter);
    const ranked = trials.length > 0 ? paretoRank(trials) : [];
    const { winner, noWinner } = determineWinner(ranked, candidates, partial);

    const trialResults: (Trial & { pareto_rank: number | null })[] = ranked.map((t) => ({
      ...t,
      pareto_rank: t.pareto_rank
    }));

    const result: OptimizationResult = {
      run_id: runId,
      cycle_id: runId,
      agent,
      k,
      candidates_evaluated: candidates.length,
      partial,
      no_winner: noWinner,
      winner: partial ? null : winner,
      trials: trialResults,
      started_at: startedAt,
      finished_at: new Date().toISOString()
    };

    const artifactPath = writeArtifact(repoPath, runId, result);

    const artifactOnly = opts.artifactOnly ?? true;
    // Auto-PR guard MUST include !no_winner: determineWinner may return a
    // non-null winner object AND noWinner=true when the top rank-1 candidate
    // has pass=false (dominated on other axes but never actually passed the
    // eval). Opening a promotion PR for a failing candidate would silently
    // ship a regression. All three flags must clear before promotion.
    if (!artifactOnly && result.winner !== null && !result.no_winner && !result.partial) {
      tryAutoPr(opts, result, artifactPath);
    }

    return result;
  } finally {
    await lock.released();
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function championPath(repoPath: string, agent: string): string {
  return join(repoPath, "agents", `${agent}.md`);
}
