/**
 * scripts/lib/gepa/gepa-optimize-cmd.ts — SLICE-99
 *
 * CLI entry point for /crew:gepa-optimize and /crew:gepa-resume subcommands.
 *
 * /crew:gepa-optimize <agent> --budget <usd> [--k <int>] [--artifact-only]
 *   - Checks no-winner streak; exits non-zero (exit 3) if streak >= 3.
 *   - Loads failing trials from .claude/artifacts/crew/gepa/trials/<agent>.jsonl
 *   - Runs optimization cycle via optimize-runner.ts
 *   - Logs gepa_no_winner_streak event if no_winner result increments to 3.
 *
 * /crew:gepa-resume <agent>
 *   - Clears the no-winner streak for the agent.
 *   - Next /crew:gepa-optimize call will proceed normally.
 *
 * Exit codes:
 *   0 — cycle completed (winner or clean no-winner)
 *   1 — internal error
 *   2 — bad args / lock held
 *   3 — no_winner_streak >= 3 (blocked)
 */

import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { parse as parseYaml } from "yaml";
import {
  fileStore,
  dailyCapMeter,
  type EvalCase,
  type Scorer,
  type Trial
} from "@astragenie/gepa-core";
import {
  checkStreakHalt,
  incrementStreak,
  resetStreak,
  NO_WINNER_STREAK_HALT
} from "./no-winner-streak-tracker.ts";
import { createAipluginCandidateGenerator } from "./candidate-generator-aiplugin.ts";
import { runOptimize, noopScorer } from "./optimize-runner.ts";
import { createJudgeScorer, DEFAULT_JUDGE_CHAIN, type JudgeChainEntry } from "./judge-scorer.ts";
import { splitTrainHeldout, parseSplitFlag, type SplitOpts } from "./split-train-heldout.ts";

// ── Types ───────────────────────────────────────────────────────────────────

export interface OptimizeCmdResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

// ── CLI arg parser ───────────────────────────────────────────────────────────

export interface ParsedOptimizeArgs {
  agent?: string;
  budget?: number;
  k: number;
  artifactOnly: boolean;
  /** SLICE-C: train/heldOut split for eval cases loaded from evals/agents/. */
  split?: SplitOpts;
  invalid?: string;
}

interface NumericFlagSpec {
  parser: (s: string) => number;
  requireInt?: boolean;
  errorLabel: string;
}

function parseNumericFlag(
  args: string[],
  i: number,
  spec: NumericFlagSpec
): { value?: number; invalid?: string } {
  const val = args[i + 1];
  if (!val || val.startsWith("--")) {
    return { invalid: `${spec.errorLabel} requires a value` };
  }
  const num = spec.parser(val);
  if (Number.isNaN(num) || num <= 0) {
    const kind = spec.requireInt ? "positive integer" : "positive number";
    return { invalid: `${spec.errorLabel} must be a ${kind}` };
  }
  return { value: num };
}

/**
 * Handles the `--split` flag: mutates `parsed` in place and returns `true`
 * when parsing must halt (an invalid value was set). Fully self-contained
 * (including the invalid-value branch) so parseOptimizeArgs only pays one
 * branch for the whole flag, keeping its cognitive complexity in budget.
 */
function applySplitFlag(args: string[], i: number, parsed: ParsedOptimizeArgs): boolean {
  const val = args[i + 1];
  if (!val || val.startsWith("--")) {
    parsed.invalid = "--split requires a value";
    return true;
  }
  const splitOpts = parseSplitFlag(val);
  if (!splitOpts) {
    parsed.invalid = "--split must be formatted as train/heldOut (e.g. 8/2)";
    return true;
  }
  parsed.split = splitOpts;
  return false;
}

const NUMERIC_FLAGS: Record<string, NumericFlagSpec & { key: "budget" | "k" }> = {
  "--budget": { key: "budget", parser: Number, errorLabel: "--budget" },
  "--k": {
    key: "k",
    parser: (s) => Number.parseInt(s, 10),
    requireInt: true,
    errorLabel: "--k"
  }
};

/**
 * Consume one arg (and any value it takes) at index `i`, mutating `parsed`.
 * Returns the number of positions to advance `i` by. Extracted out of the
 * while loop in parseOptimizeArgs so each flag's branch (and any nested
 * invalid-value branch) is counted in ITS OWN function's cognitive
 * complexity budget rather than stacking on top of the loop's nesting.
 */
function consumeOptimizeArg(args: string[], i: number, parsed: ParsedOptimizeArgs): number {
  const arg = args[i] ?? "";
  const numeric = NUMERIC_FLAGS[arg];
  if (numeric) {
    const result = parseNumericFlag(args, i, numeric);
    if (result.invalid !== undefined) {
      parsed.invalid = result.invalid;
      return 1;
    }
    parsed[numeric.key] = result.value as number;
    return 2;
  }
  if (arg === "--artifact-only") {
    parsed.artifactOnly = true;
    return 1;
  }
  if (arg === "--split") {
    return applySplitFlag(args, i, parsed) ? 1 : 2;
  }
  if (!arg.startsWith("--") && !parsed.agent) {
    parsed.agent = arg;
  }
  return 1;
}

export function parseOptimizeArgs(args: string[]): ParsedOptimizeArgs {
  const parsed: ParsedOptimizeArgs = { k: 5, artifactOnly: true };
  let i = 0;
  while (i < args.length && parsed.invalid === undefined) {
    i += consumeOptimizeArg(args, i, parsed);
  }
  return parsed;
}

// ── Events log ──────────────────────────────────────────────────────────────

const EVENTS_LOG_PATH = ".claude/logs/events.jsonl";

function logEvent(repoPath: string, event: Record<string, unknown>): void {
  try {
    const dir = join(repoPath, ".claude", "logs");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const line = `${JSON.stringify({ ts: new Date().toISOString(), ...event })}\n`;
    appendFileSync(join(repoPath, EVENTS_LOG_PATH), line, { flag: "a" });
  } catch {
    // Event log write must never propagate.
  }
}

// ── Eval case loading for the judge-backed scorer (FEAT-192 SLICE-C) ────────
//
// `evals/agents/crew-<agent>.yaml` is the same spec evals/cli.ts runs
// against — reusing it here means the GEPA optimize cycle scores candidates
// against the SAME rubrics the agent is graded on day-to-day, not a bespoke
// second corpus. Absence of a spec (or a spec with zero usable fixtures)
// degrades byte-identical to the pre-SLICE-C behavior: noopScorer, no
// `cases`, artifact-only.

interface OptimizeEvalAssertSpec {
  type: string;
  rubric?: string;
  value?: string;
}

interface OptimizeEvalTestSpec {
  name: string;
  fixture?: string;
  assert?: OptimizeEvalAssertSpec[];
}

interface OptimizeEvalSpec {
  judge?: {
    provider: string;
    model?: string;
    fallback?: Array<{ provider: string; model?: string }>;
  };
  tests?: OptimizeEvalTestSpec[];
}

async function readFixtureText(repoPath: string, fixtureRef: string): Promise<string | null> {
  const normalized = fixtureRef.startsWith("file://")
    ? fixtureRef.slice("file://".length)
    : fixtureRef;
  const abs = isAbsolute(normalized) ? normalized : join(repoPath, normalized);
  try {
    return await readFile(abs, "utf8");
  } catch {
    return null;
  }
}

function extractRubrics(test: OptimizeEvalTestSpec): string[] {
  return (test.assert ?? [])
    .filter((a) => a.type === "llm-rubric" && (a.rubric ?? a.value) !== undefined)
    .map((a) => a.rubric ?? a.value ?? "");
}

async function buildEvalCases(repoPath: string, spec: OptimizeEvalSpec): Promise<EvalCase[]> {
  const cases: EvalCase[] = [];
  for (const test of spec.tests ?? []) {
    if (!test.fixture) continue;
    const text = await readFixtureText(repoPath, test.fixture);
    if (text === null) continue;
    cases.push({ id: test.name, input: text, rubric: extractRubrics(test), held_out: false });
  }
  return cases;
}

/** Sensible default when --split is not given: ~1/3 held out, rest train. */
function defaultSplitFor(caseCount: number): SplitOpts {
  const heldOut = Math.max(1, Math.round(caseCount / 3));
  return { train: Math.max(0, caseCount - heldOut), heldOut };
}

function judgeChainFromSpec(spec: OptimizeEvalSpec): JudgeChainEntry[] {
  if (!spec.judge) return DEFAULT_JUDGE_CHAIN;
  const primary: JudgeChainEntry = { provider: spec.judge.provider };
  if (spec.judge.model !== undefined) primary.model = spec.judge.model;
  const chain: JudgeChainEntry[] = [primary];
  for (const fb of spec.judge.fallback ?? []) {
    const entry: JudgeChainEntry = { provider: fb.provider };
    if (fb.model !== undefined) entry.model = fb.model;
    chain.push(entry);
  }
  return chain;
}

/**
 * Cold-start bootstrap: when the trial store has NO failing trials yet (a
 * brand-new agent, or one that has never run through /crew:gepa-optimize),
 * the candidate generator has nothing to react to. Seed synthetic Trial rows
 * from the TRAIN split's eval cases — no score.rationale from a real judge
 * run against the champion here (that would double the live-scoring surface
 * this slice already adds via the heldOut cases), but the case input still
 * gives the rewriter real scenarios to consider instead of nothing at all.
 * This is what "wires" splitTrainHeldout's train tranche to a caller — the
 * heldOut tranche is the one that actually scores candidates (the AC-3
 * signal); train only fires when there is no other failing-trial context.
 */
function buildTrainSeedTrials(agent: string, trainCases: EvalCase[]): Trial[] {
  const now = new Date().toISOString();
  return trainCases.map((c) => ({
    id: crypto.randomUUID(),
    agent,
    phase: "build",
    candidate_prompt_hash: "champion-cold-start",
    candidate_prompt_path: null,
    input: c.input,
    output: null,
    score: {
      pass: false,
      score: 0,
      cost_usd: 0,
      latency_ms: 0,
      rationale: "seeded from train-split eval case (no historical failing trial yet)"
    },
    source: "eval",
    pareto_rank: null,
    created_at: now
  }));
}

export interface OptimizeEvalCasesResult {
  /** Held-out cases — passed to runOptimize's `cases`; these score candidates. */
  heldOut: EvalCase[];
  /** Cold-start-only trial seeds derived from the train split (see buildTrainSeedTrials). */
  trainSeedTrials: Trial[];
  /** Judge fallback chain derived from the spec's `judge` block. */
  judgeChain: JudgeChainEntry[];
}

/**
 * Load + split eval cases for `agent` from `evals/agents/crew-<agent>.yaml`.
 * Returns null when the spec is absent, unparseable, or has zero fixtures
 * that actually load — callers must degrade to noopScorer/no-cases in that
 * case (do NOT throw; a missing eval spec is a normal, common state).
 */
export async function loadEvalCasesForOptimize(
  repoPath: string,
  agent: string,
  split?: SplitOpts
): Promise<OptimizeEvalCasesResult | null> {
  const specPath = join(repoPath, "evals", "agents", `crew-${agent}.yaml`);
  let raw: string;
  try {
    raw = await readFile(specPath, "utf8");
  } catch {
    return null;
  }

  let spec: OptimizeEvalSpec;
  try {
    spec = parseYaml(raw) as OptimizeEvalSpec;
  } catch {
    return null;
  }

  const allCases = await buildEvalCases(repoPath, spec);
  if (allCases.length === 0) return null;

  const splitOpts = split ?? defaultSplitFor(allCases.length);
  const { train, heldOut } = splitTrainHeldout(allCases, splitOpts);

  return {
    heldOut: heldOut.map((c) => ({ ...c, held_out: true })),
    trainSeedTrials: buildTrainSeedTrials(agent, train),
    judgeChain: judgeChainFromSpec(spec)
  };
}

/** noopScorer when no cases resolved; judge-backed scorer otherwise. */
export function selectScorer(hasCases: boolean, judgeChain: JudgeChainEntry[]): Scorer {
  return hasCases ? createJudgeScorer({ judgeChain }) : noopScorer();
}

/** Resolved inputs for the `runOptimize({ scorer, cases, failingTrials })` call. */
interface ResolvedOptimizeInputs {
  scorer: Scorer;
  cases?: EvalCase[];
  failingTrials: Trial[];
}

/**
 * Decide scorer + cases + effective failingTrials for one optimize cycle.
 * Extracted out of runGepaOptimizeCmd to keep its cognitive complexity in
 * budget (FEAT-192 SLICE-C).
 */
async function resolveOptimizeInputs(
  repoPath: string,
  agent: string,
  split: SplitOpts | undefined,
  failingTrials: Trial[]
): Promise<ResolvedOptimizeInputs> {
  const evalCases = await loadEvalCasesForOptimize(repoPath, agent, split);
  const heldOutCases = evalCases?.heldOut ?? [];
  const hasCases = heldOutCases.length > 0;
  const judgeChain = evalCases?.judgeChain ?? DEFAULT_JUDGE_CHAIN;
  const trainSeedTrials = evalCases?.trainSeedTrials ?? [];
  const effectiveFailingTrials =
    failingTrials.length === 0 && trainSeedTrials.length > 0 ? trainSeedTrials : failingTrials;

  return {
    scorer: selectScorer(hasCases, judgeChain),
    failingTrials: effectiveFailingTrials,
    ...(hasCases ? { cases: heldOutCases } : {})
  };
}

// ── Command handlers ─────────────────────────────────────────────────────────

export async function runGepaOptimizeCmd(
  repoPath: string,
  args: string[]
): Promise<OptimizeCmdResult> {
  const parsed = parseOptimizeArgs(args);

  if (parsed.invalid) {
    return { exitCode: 2, stdout: "", stderr: `${parsed.invalid}\n` };
  }

  if (!parsed.agent) {
    return {
      exitCode: 2,
      stdout: "",
      stderr:
        "usage: gepa-optimize <agent> --budget <usd> [--k <int>] [--artifact-only] [--repo <path>]\n"
    };
  }

  if (parsed.budget === undefined) {
    return { exitCode: 2, stdout: "", stderr: "--budget is required\n" };
  }

  const { agent, budget, k } = parsed;

  // Check no-winner streak BEFORE generating candidates.
  const streakCheck = checkStreakHalt(agent, { repoPath });
  if (streakCheck.halted) {
    return {
      exitCode: 3,
      stdout: "",
      stderr: `no_winner_streak: ${streakCheck.streak} — run /crew:gepa-resume ${agent} to retry\n`
    };
  }

  // Load failing trials from the trial store.
  const trialsRoot = join(repoPath, ".claude", "artifacts", "crew", "gepa", "trials");
  const store = fileStore(trialsRoot);
  const failingTrials = await store.recall({
    agent,
    failuresOnly: true,
    limit: 50
  });

  // Build cycle ID (used as the candidates subdirectory name).
  const cycleId = crypto.randomUUID();

  // Budget meter persisted to disk.
  const budgetPath = join(repoPath, ".claude", "artifacts", "crew", "gepa", "budget.json");
  const meter = dailyCapMeter(budget, budgetPath);

  // Candidate generator.
  const generator = createAipluginCandidateGenerator({ repoPath, cycleId });

  // FEAT-192 SLICE-C: load real eval cases (if a spec exists for this agent)
  // and swap in the judge-backed scorer. No spec / no fixtures both degrade
  // to the pre-SLICE-C artifact-only path (noopScorer, no `cases`).
  const resolvedInputs = await resolveOptimizeInputs(repoPath, agent, parsed.split, failingTrials);

  // Run the optimization cycle.
  const result = await runOptimize({
    repoPath,
    agent,
    k,
    budgetUsd: budget,
    generator,
    meter,
    ...resolvedInputs
  });

  if (result === null) {
    return {
      exitCode: 2,
      stdout: "",
      stderr: `lock_held_by_other_process: agent=${agent} phase=optimize\n`
    };
  }

  // Update no-winner streak.
  if (result.no_winner || result.winner === null) {
    const newStreak = incrementStreak(agent, { repoPath });
    logEvent(repoPath, {
      event: "gepa_no_winner_streak",
      agent,
      streak: newStreak,
      run_id: result.run_id,
      cycle_id: result.cycle_id
    });
    if (newStreak >= NO_WINNER_STREAK_HALT) {
      // Log the halt event.
      logEvent(repoPath, {
        event: "gepa_no_winner_streak_halt",
        agent,
        streak: newStreak
      });
    }
  } else {
    // Winner found — reset streak.
    resetStreak(agent, { repoPath });
  }

  const lines: string[] = [
    `gepa-optimize: cycle complete`,
    `  run_id: ${result.run_id}`,
    `  agent: ${result.agent}`,
    `  k: ${result.k}`,
    `  candidates_evaluated: ${result.candidates_evaluated}`,
    `  partial: ${result.partial}`,
    `  no_winner: ${result.no_winner}`,
    result.winner
      ? `  winner: ${result.winner.candidate_id} (rank=${result.winner.pareto_rank} score=${result.winner.score.toFixed(3)})`
      : "  winner: null"
  ];

  return { exitCode: 0, stdout: `${lines.join("\n")}\n`, stderr: "" };
}

export async function runGepaResumeCmd(
  repoPath: string,
  positionals: string[]
): Promise<OptimizeCmdResult> {
  const agent = positionals[0];
  if (!agent || agent.startsWith("--")) {
    return {
      exitCode: 2,
      stdout: "",
      stderr: "usage: gepa-resume <agent> [--repo <path>]\n"
    };
  }

  resetStreak(agent, { repoPath });
  logEvent(repoPath, {
    event: "gepa_resume",
    agent
  });

  return {
    exitCode: 0,
    stdout: `gepa-resume: streak cleared for agent ${agent}\n`,
    stderr: ""
  };
}
