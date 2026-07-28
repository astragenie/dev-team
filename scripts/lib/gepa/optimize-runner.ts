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
import { evaluateAutoMergeGate, type AutoMergePolicy } from "./auto-merge-gate.ts";
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
  /**
   * Which candidate generation mode this run used — `"live"` when
   * `GEPA_LIVE_GENERATOR=1` dispatched a real aiplugin-dev rewrite,
   * `"synthetic"` when it fell back to the default deterministic string
   * mutation (no LLM call, no reflective rewrite). W5 honesty pass
   * (astragenie/runner-plugin#525 §4.3) — makes the mode a durable, visible
   * fact in run history instead of an env-var side effect nobody can see
   * after the fact.
   */
  generator_mode: "synthetic" | "live";
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
  /**
   * Optional auto-merge policy. When provided (and artifactOnly=false),
   * `evaluateAutoMergeGate` is called after a successful auto-PR to decide
   * whether to invoke `gh pr merge --auto --squash`.
   *
   * When omitted, the auto-merge gate is skipped (PR stays as draft).
   */
  autoMergePolicy?: AutoMergePolicy;
  /**
   * Whether the soak phase has passed for the winning candidate.
   * Passed to `evaluateAutoMergeGate` as the `soakPassed` condition.
   * Defaults to false (soak not yet complete — no auto-merge).
   */
  soakPassed?: boolean;
  /**
   * Whether branch protection is enforced on `main`.
   * Passed to `evaluateAutoMergeGate`. Defaults to false.
   */
  branchProtectionPresent?: boolean;
  /**
   * Champion metrics for the min_pass_delta gate.
   * Defaults to { held_out_pass: 0 } (conservative).
   */
  championHeldOutPass?: number;
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

// ── Generator-mode honesty (W5, astragenie/runner-plugin#525 §4.3) ─────────

/**
 * Read the SAME env var candidate-generator-aiplugin.ts gates its live
 * dispatch path on, so the reported mode always matches what the default
 * generator actually did. Read at call-time (not module load) so tests can
 * toggle the flag freely.
 */
function currentGeneratorMode(): "synthetic" | "live" {
  return process.env["GEPA_LIVE_GENERATOR"] === "1" ? "live" : "synthetic";
}

/**
 * Print a loud, impossible-to-miss warning at run start when this cycle is
 * about to run in synthetic mode, so a synthetic run is never mistaken for a
 * real reflective-rewrite cycle from console output alone.
 */
function warnIfSynthetic(mode: "synthetic" | "live"): void {
  if (mode !== "synthetic") return;
  console.warn(
    "[gepa-optimize] SYNTHETIC MODE: this run will NOT reflectively rewrite prompts " +
      "(deterministic string mutation only, no LLM call). Set GEPA_LIVE_GENERATOR=1 " +
      "for a real aiplugin-dev-dispatched rewrite."
  );
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

/**
 * AC-4 per-candidate all-case promotion gate: true only when EVERY trial
 * recorded for `candidatePromptHash` has `score.pass === true`. `ranked` may
 * contain multiple trials per candidate (one per eval case) — a candidate
 * that wins one case's global Pareto slot while silently failing another
 * case must NOT be eligible, even though its best-case trial can still be
 * rank 1. A candidate with zero trials is not eligible (defensive — should
 * not occur since `ranked` is derived from `candidates`).
 */
function candidateAllCasesPass(
  ranked: (Trial & { pareto_rank: number | null })[],
  candidatePromptHash: string
): boolean {
  const trialsForCandidate = ranked.filter((t) => t.candidate_prompt_hash === candidatePromptHash);
  if (trialsForCandidate.length === 0) return false;
  return trialsForCandidate.every((t) => t.score.pass);
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

  // AC-4 (review fix): the all-case gate must SEARCH `ranked` — not just
  // inspect the global rank-1 trial. `ranked` is already sorted by Pareto
  // rank ascending, then the default tiebreaker within each rank, so the
  // FIRST trial whose candidate passes every eval case it was scored
  // against is the best eligible winner. A real fix can raise cost/latency
  // relative to a candidate that only "wins" one case, which drops it below
  // rank 1 in the pass>score>-cost>-latency ordering — restricting the gate
  // to rank1[0] would then spuriously report no_winner even though a lower
  // -ranked, fully-passing candidate exists (FEAT-192 SLICE-B review HIGH
  // finding; this is exactly the AC-3 money-test shape).
  const eligible = ranked.find((t) => candidateAllCasesPass(ranked, t.candidate_prompt_hash));

  // `winnerTrial` falls back to the rank-1 trial when nothing is eligible —
  // `winner` stays populated as a diagnostic either way (SLICE-105 pattern)
  // so callers keep visibility into "what almost won"; the actual promotion
  // gate (auto-PR) reads `no_winner`, not `winner !== null`.
  const winnerTrial = eligible ?? best;
  const matchingCandidate = candidates.find(
    (c) => c.prompt_hash === winnerTrial.candidate_prompt_hash
  );
  const winner: OptimizationResult["winner"] = {
    candidate_id: winnerTrial.id,
    pareto_rank: winnerTrial.pareto_rank ?? 1,
    score: winnerTrial.score.score,
    pass: winnerTrial.score.pass,
    cost_usd: winnerTrial.score.cost_usd,
    latency_ms: winnerTrial.score.latency_ms,
    prompt_path: matchingCandidate?.prompt_path ?? winnerTrial.candidate_prompt_path ?? ""
  };

  // eligible's every trial passes by construction (candidateAllCasesPass),
  // so noWinner reduces to "did the search find anything eligible at all".
  return { winner, noWinner: !eligible };
}

function writeArtifact(repoPath: string, runId: string, result: OptimizationResult): string {
  const artifactPath = optArtifactPath(repoPath, runId);
  const artifactDir = join(repoPath, ".claude", "artifacts", "crew", "gepa", "opt");
  if (!existsSync(artifactDir)) mkdirSync(artifactDir, { recursive: true });
  writeFileSync(artifactPath, JSON.stringify(result, null, 2), "utf8");
  return artifactPath;
}

function maybeRunAutoMergeGate(
  opts: RunOptimizeOpts,
  result: OptimizationResult,
  prUrl: string
): void {
  if (!opts.autoMergePolicy) return;
  evaluateAutoMergeGate({
    repoPath: opts.repoPath,
    agent: opts.agent,
    result,
    soakPassed: opts.soakPassed ?? false,
    branchProtectionPresent: opts.branchProtectionPresent ?? false,
    policy: opts.autoMergePolicy,
    prUrl,
    championMetrics: { held_out_pass: opts.championHeldOutPass ?? 0 },
    ...(opts.ghPath !== undefined ? { ghPath: opts.ghPath } : {})
  });
}

function runAutoPrAndGate(
  opts: RunOptimizeOpts,
  result: OptimizationResult,
  artifactPath: string
): void {
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
  // Auto-merge gate: called AFTER auto-pr creates the PR.
  if (prResult.pr_opened && prResult.pr_url) {
    maybeRunAutoMergeGate(opts, result, prResult.pr_url);
  }
}

function tryAutoPr(opts: RunOptimizeOpts, result: OptimizationResult, artifactPath: string): void {
  try {
    runAutoPrAndGate(opts, result, artifactPath);
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
  // gepa-core 0.10.x: acquire() returns Result<handle|null, never> (DEC-002).
  // ok is always true; value === null means another process holds the lock.
  const lockResult = await fileLockManager(lockRoot).acquire(agent, "optimize");
  const lock = lockResult.ok ? lockResult.value : null;
  if (lock === null) return null; // Another process holds the lock.

  try {
    const generatorMode = currentGeneratorMode();
    warnIfSynthetic(generatorMode);

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
      generator_mode: generatorMode,
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
