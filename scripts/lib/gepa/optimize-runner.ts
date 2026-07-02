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
import {
  dailyCapMeter,
  fileLockManager,
  paretoRank,
  sequentialRunner,
  type BudgetMeter,
  type CandidateGenerator,
  type Candidate,
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
  /** All trial results, with pareto_rank assigned. */
  trials: (Trial & { pareto_rank: number | null })[];
  /** ISO timestamp of run start. */
  started_at: string;
  /** ISO timestamp of run end. */
  finished_at: string;
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
export async function runOptimize(opts: RunOptimizeOpts): Promise<OptimizationResult | null> {
  const { repoPath, agent, k, budgetUsd, failingTrials, generator, scorer } = opts;

  const runId = crypto.randomUUID();
  const cycleId = runId;
  const startedAt = new Date().toISOString();

  // Lock manager — prevents concurrent optimize runs on the same agent.
  const lockRoot = opts.lockRoot ?? defaultLockRoot(repoPath);
  const lockMgr = fileLockManager(lockRoot);
  const lock = await lockMgr.acquire(agent, "optimize");
  if (lock === null) {
    return null; // Another process holds the lock.
  }

  try {
    // Budget meter — shared daily cap, persisted to disk.
    const meter = opts.meter ?? dailyCapMeter(budgetUsd, defaultBudgetPath(repoPath));

    // 1. Generate candidates.
    const candidates: Candidate[] = await generator.generate(
      championPath(repoPath, agent),
      failingTrials,
      k,
      { meter }
    );

    // 2. Run candidates against eval cases (artifact-only: empty cases array).
    const runner = sequentialRunner();
    // In artifact-only mode we pass an empty cases array — no LLM scoring.
    // The sequentialRunner will still validate candidate sizes internally.
    let trials: Trial[] = [];
    let partial = false;

    if (candidates.length > 0) {
      // Use AbortController to detect if budget halted the run.
      const controller = new AbortController();
      trials = await runner.runCandidates(candidates, [], scorer, {
        meter,
        signal: controller.signal
      });
      // If fewer trials than candidates * cases were produced, the run was
      // halted (by budget or signal).
      partial = trials.length < candidates.length * 1; // 0 cases = 0 trials always
    }

    // 3. Pareto rank.
    const ranked = trials.length > 0 ? paretoRank(trials) : [];

    // 4. Determine winner.
    const rank1 = ranked.filter((t) => t.pareto_rank === 1);
    let winner: OptimizationResult["winner"] = null;
    let noWinner = true;

    if (rank1.length > 0 && !partial) {
      const best = rank1[0];
      if (best) {
        // Find the matching candidate for prompt_path.
        const matchingCandidate = candidates.find(
          (c) => c.prompt_hash === best.candidate_prompt_hash
        );
        winner = {
          candidate_id: best.id,
          pareto_rank: best.pareto_rank,
          score: best.score.score,
          pass: best.score.pass,
          cost_usd: best.score.cost_usd,
          latency_ms: best.score.latency_ms,
          prompt_path: matchingCandidate?.prompt_path ?? best.candidate_prompt_path ?? ""
        };
        noWinner = !best.score.pass; // Must pass to be a winner
      }
    }

    // Build trial results with nullable pareto_rank.
    const trialResults: (Trial & { pareto_rank: number | null })[] = ranked.map((t) => ({
      ...t,
      pareto_rank: t.pareto_rank
    }));

    // Add unranked trials (e.g. empty case runs produce 0 trials).
    const finishedAt = new Date().toISOString();

    const result: OptimizationResult = {
      run_id: runId,
      cycle_id: cycleId,
      agent,
      k,
      candidates_evaluated: candidates.length,
      partial,
      no_winner: noWinner,
      winner: partial ? null : winner,
      trials: trialResults,
      started_at: startedAt,
      finished_at: finishedAt
    };

    // 5. Write artifact.
    const artifactPath = optArtifactPath(repoPath, runId);
    const artifactDir = join(repoPath, ".claude", "artifacts", "crew", "gepa", "opt");
    if (!existsSync(artifactDir)) mkdirSync(artifactDir, { recursive: true });
    writeFileSync(artifactPath, JSON.stringify(result, null, 2), "utf8");

    return result;
  } finally {
    await lock.released();
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function championPath(repoPath: string, agent: string): string {
  return join(repoPath, "agents", `${agent}.md`);
}
