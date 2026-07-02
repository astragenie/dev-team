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
import { join } from "node:path";
import { fileStore, dailyCapMeter } from "@astragenie/gepa-core";
import {
  checkStreakHalt,
  incrementStreak,
  resetStreak,
  NO_WINNER_STREAK_HALT
} from "./no-winner-streak-tracker.ts";
import { createAipluginCandidateGenerator } from "./candidate-generator-aiplugin.ts";
import { runOptimize, noopScorer } from "./optimize-runner.ts";

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

export function parseOptimizeArgs(args: string[]): ParsedOptimizeArgs {
  const parsed: ParsedOptimizeArgs = { k: 5, artifactOnly: true };
  const NUMERIC_FLAGS: Record<string, NumericFlagSpec & { key: "budget" | "k" }> = {
    "--budget": { key: "budget", parser: Number, errorLabel: "--budget" },
    "--k": {
      key: "k",
      parser: (s) => Number.parseInt(s, 10),
      requireInt: true,
      errorLabel: "--k"
    }
  };
  let i = 0;
  while (i < args.length) {
    const arg = args[i] ?? "";
    const numeric = NUMERIC_FLAGS[arg];
    if (numeric) {
      const result = parseNumericFlag(args, i, numeric);
      if (result.invalid !== undefined) {
        parsed.invalid = result.invalid;
        return parsed;
      }
      parsed[numeric.key] = result.value as number;
      i += 2;
      continue;
    }
    if (arg === "--artifact-only") {
      parsed.artifactOnly = true;
      i++;
      continue;
    }
    if (!arg.startsWith("--") && !parsed.agent) {
      parsed.agent = arg;
    }
    i++;
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

  // Run the optimization cycle.
  const result = await runOptimize({
    repoPath,
    agent,
    k,
    budgetUsd: budget,
    failingTrials,
    generator,
    scorer: noopScorer(),
    meter
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
