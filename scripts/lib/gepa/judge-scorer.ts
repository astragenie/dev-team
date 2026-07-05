/**
 * scripts/lib/gepa/judge-scorer.ts — FEAT-192 SLICE-C
 *
 * Judge-backed Scorer adapter: implements the gepa-core `Scorer` interface
 * (`score(run, expected) -> ScoreResult`) by (1) dispatching the candidate
 * agent against the eval case's fixture input via the SLICE-A primitives in
 * evals/lib/candidate-dispatch.ts, then (2) judging the captured response
 * against the case's rubric via the evals/lib/judge.ts JUDGE_REGISTRY,
 * trying an ordered fallback chain (default: groq/llama-3.3-70b-versatile
 * primary, gemini fallback) — the same fallback-chain shape evals/lib/run-eval.ts
 * uses for live eval runs.
 *
 * This is the gap SLICE-99 left as `noopScorer()` in gepa-optimize-cmd.ts.
 * Without this adapter, /crew:gepa-optimize can only ever run artifact-only:
 * candidates are generated but never actually scored against a real eval
 * case, so no AC can prove a rewrite improves anything (proving that is
 * SLICE-D's job — this slice only builds the harness that makes it provable).
 *
 * gepa-core's own `sequentialRunner` builds a placeholder `AgentRun` with
 * `raw_output: null` and hands it straight to `Scorer.score()` (see
 * runner/sequential-runner.js) — the runner does NOT dispatch the candidate
 * itself. That means dispatch is this Scorer's job, not the runner's: `run`
 * only carries `candidate_prompt_path` + `case_id`; the actual candidate
 * output is produced here, per trial.
 */

import type { AgentRun, EvalCase, LLMJudge, ScoreResult, Scorer } from "@astragenie/gepa-core";
import { dispatchCandidate } from "../../../evals/lib/candidate-dispatch.ts";
import { JUDGE_REGISTRY } from "../../../evals/lib/judge.ts";

// ── DI seam (pattern-matches candidate-generator-aiplugin.ts's *Deps seams) ──

/** Minimal shape judge-scorer needs from a dispatch call. */
export interface JudgeScorerDispatchResult {
  candidateOutput: string;
}

export interface JudgeScorerDispatchOptions {
  agentPromptPath: string;
  fixtureContent: string;
  model?: string;
  timeoutMs?: number;
}

export interface JudgeChainEntry {
  provider: string;
  model?: string;
}

/**
 * Test seam: override candidate dispatch and judge-chain resolution so unit
 * tests never spawn `claude -p` or hit a live LLM.
 */
export interface JudgeScorerDeps {
  dispatch(opts: JudgeScorerDispatchOptions): Promise<JudgeScorerDispatchResult>;
  /**
   * Resolve the ordered judge chain into constructed LLMJudge instances.
   * Construction failures (e.g. unknown provider) are reported in `errors`
   * and simply excluded from `judges` — the caller tries whatever resolved,
   * in order, at evaluate() time.
   */
  resolveJudgeChain(chain: JudgeChainEntry[]): Promise<{ judges: LLMJudge[]; errors: string[] }>;
}

/** Default fallback chain when the caller does not supply one. */
export const DEFAULT_JUDGE_CHAIN: JudgeChainEntry[] = [
  { provider: "groq", model: "llama-3.3-70b-versatile" },
  { provider: "gemini" }
];

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function defaultResolveJudgeChain(
  chain: JudgeChainEntry[]
): Promise<{ judges: LLMJudge[]; errors: string[] }> {
  const judges: LLMJudge[] = [];
  const errors: string[] = [];
  for (const entry of chain) {
    const factory = JUDGE_REGISTRY[entry.provider];
    if (!factory) {
      errors.push(`unknown judge provider: ${entry.provider}`);
      continue;
    }
    try {
      const cfg = entry.model !== undefined ? { model: entry.model } : undefined;
      judges.push(await factory(cfg));
    } catch (err) {
      errors.push(`${entry.provider}: ${errMessage(err)}`);
    }
  }
  return { judges, errors };
}

const defaultDeps: JudgeScorerDeps = {
  dispatch: dispatchCandidate,
  resolveJudgeChain: defaultResolveJudgeChain
};

export interface JudgeScorerOpts {
  /** Candidate model override, forwarded to dispatchCandidate. */
  model?: string;
  /** Per-dispatch timeout override, forwarded to dispatchCandidate. */
  timeoutMs?: number;
  /** Primary + fallback judge chain. Default: groq/llama-3.3-70b-versatile -> gemini. */
  judgeChain?: JudgeChainEntry[];
  /** Test seam — partial override; unset members fall back to the real implementation. */
  deps?: Partial<JudgeScorerDeps>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** EvalCase.input is `unknown` — dispatch needs a string fixture body. */
function toFixtureContent(input: unknown): string {
  if (typeof input === "string") return input;
  if (input === undefined || input === null) return "";
  try {
    return JSON.stringify(input);
  } catch {
    return String(input);
  }
}

function failResult(startedAt: number, rationale: string): ScoreResult {
  return { pass: false, score: 0, cost_usd: 0, latency_ms: Date.now() - startedAt, rationale };
}

// ── Scorer factory ───────────────────────────────────────────────────────────

/**
 * Build a judge-backed Scorer. `run.candidate_prompt_path` (set by
 * `sequentialRunner` from `Candidate.prompt_path`) points at the candidate's
 * prompt file on disk; `expected` (the EvalCase) carries the fixture input
 * and rubric to score against.
 *
 * Never throws: dispatch failures and judge failures (construction-time or
 * evaluate()-time — including "primary throws, fallback picks up") degrade
 * to a `pass:false` ScoreResult with a diagnostic rationale, so the trial
 * corpus always retains a row (mirrors rubricScorer's contract in gepa-core).
 * `rationale` on the success path is the judge's FULL rationale, unmodified —
 * the candidate generator threads it verbatim into the next rewrite prompt.
 */
export function createJudgeScorer(opts: JudgeScorerOpts = {}): Scorer {
  const judgeChain = opts.judgeChain ?? DEFAULT_JUDGE_CHAIN;
  const deps: JudgeScorerDeps = { ...defaultDeps, ...opts.deps };

  return {
    async score(run: AgentRun, expected: EvalCase): Promise<ScoreResult> {
      const startedAt = Date.now();

      if (!run.candidate_prompt_path) {
        return failResult(startedAt, "dispatch_failed: candidate_prompt_path is empty");
      }

      let candidateOutput: string;
      try {
        const dispatchOpts: JudgeScorerDispatchOptions = {
          agentPromptPath: run.candidate_prompt_path,
          fixtureContent: toFixtureContent(expected.input)
        };
        if (opts.model !== undefined) dispatchOpts.model = opts.model;
        if (opts.timeoutMs !== undefined) dispatchOpts.timeoutMs = opts.timeoutMs;
        const dispatched = await deps.dispatch(dispatchOpts);
        candidateOutput = dispatched.candidateOutput;
      } catch (err) {
        return failResult(startedAt, `dispatch_failed: ${errMessage(err)}`);
      }

      const { judges, errors } = await deps.resolveJudgeChain(judgeChain);
      const chainErrors = [...errors];
      const rubric = expected.rubric ?? [];

      for (const judge of judges) {
        try {
          const result = await judge.evaluate({
            candidateOutput,
            expected,
            rubric,
            context: { promptId: run.agent }
          });
          return {
            pass: result.pass,
            score: result.score,
            cost_usd: result.cost_usd,
            latency_ms: Date.now() - startedAt,
            rationale: result.rationale
          };
        } catch (err) {
          chainErrors.push(`${judge.describe().provider}: ${errMessage(err)}`);
        }
      }

      return failResult(
        startedAt,
        `judge_unavailable: ${chainErrors.join("; ") || "no judges resolved"}`
      );
    }
  };
}
