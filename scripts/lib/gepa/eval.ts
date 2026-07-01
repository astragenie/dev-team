/**
 * scripts/lib/gepa/eval.ts — SLICE-98
 *
 * /crew:gepa-eval CLI wrapper. Acquires a fileLockManager (agent, "eval")
 * lock, spawns `bun run evals --prompt <agent>` with passed flags, releases
 * the lock on completion (success OR failure).
 *
 * Exit codes:
 *   0 — eval completed (child exit 0)
 *   1 — eval failed (child exit non-zero, or internal error)
 *   2 — bad args OR lock_held_by_other_process
 */

import { spawn } from "node:child_process";
import { join } from "node:path";
import { runWithLock } from "./run-with-lock.ts";

export interface EvalResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface ParsedEvalArgs {
  agent?: string;
  live: boolean;
  judge?: string;
  validate: boolean;
  split?: string;
  invalid?: string;
}

interface ValueFlag {
  flag: "--judge" | "--split";
  errorMessage: string;
  apply: (parsed: ParsedEvalArgs, value: string) => void;
}

const VALUE_FLAGS: readonly ValueFlag[] = [
  {
    flag: "--judge",
    errorMessage: "--judge requires a value",
    apply: (parsed, value) => {
      parsed.judge = value;
    }
  },
  {
    flag: "--split",
    errorMessage: "--split requires N/M",
    apply: (parsed, value) => {
      parsed.split = value;
    }
  }
];

function readValueFlag(args: string[], i: number): string | null {
  const next = args[i + 1];
  if (!next || next.startsWith("--")) return null;
  return next;
}

export function parseEvalArgs(args: string[]): ParsedEvalArgs {
  const parsed: ParsedEvalArgs = { live: false, validate: false };
  let i = 0;
  while (i < args.length) {
    const arg = args[i] ?? "";
    const valueFlag = VALUE_FLAGS.find((v) => v.flag === arg);
    if (valueFlag) {
      const value = readValueFlag(args, i);
      if (value === null) {
        parsed.invalid = valueFlag.errorMessage;
        return parsed;
      }
      valueFlag.apply(parsed, value);
      i += 2;
      continue;
    }
    if (arg === "--live") parsed.live = true;
    else if (arg === "--validate") parsed.validate = true;
    else if (!arg.startsWith("--") && !parsed.agent) parsed.agent = arg;
    i += 1;
  }
  return parsed;
}

export async function runGepaEvalCmd(repoPath: string, args: string[]): Promise<EvalResult> {
  const parsed = parseEvalArgs(args);
  if (parsed.invalid) {
    return { exitCode: 2, stdout: "", stderr: `${parsed.invalid}\n` };
  }
  if (!parsed.agent) {
    return {
      exitCode: 2,
      stdout: "",
      stderr: "usage: gepa-eval <agent> [--live] [--judge <name>] [--validate] [--split N/M]\n"
    };
  }

  const lockRoot = join(repoPath, ".claude", "artifacts", "crew", "gepa", "locks");
  const outcome = await runWithLock({ agent: parsed.agent, phase: "eval", lockRoot }, async () =>
    spawnEvals(repoPath, parsed)
  );

  if (outcome.status === "lock_held") {
    return {
      exitCode: 2,
      stdout: "",
      stderr: `lock_held_by_other_process: agent=${outcome.agent} phase=${outcome.phase}\n`
    };
  }
  if (outcome.status === "error") {
    const message = outcome.error instanceof Error ? outcome.error.message : String(outcome.error);
    return { exitCode: 1, stdout: "", stderr: `${message}\n` };
  }
  return outcome.result;
}

async function spawnEvals(repoPath: string, parsed: ParsedEvalArgs): Promise<EvalResult> {
  const childArgs = ["run", "evals", "--prompt", parsed.agent ?? ""];
  if (parsed.live) childArgs.push("--live");
  else childArgs.push("--dry-run");
  if (parsed.judge) childArgs.push("--judge", parsed.judge);
  if (parsed.validate) childArgs.push("--validate");
  // NOTE: --split is parsed for forward-compat but evals/cli.ts does not yet
  // consume it. Split materialization lands in a follow-up that wires
  // splitTrainHeldout() into the optimizer pipeline.

  return new Promise<EvalResult>((resolve) => {
    let stdout = "";
    let stderr = "";
    const child = spawn("bun", childArgs, { cwd: repoPath, shell: process.platform === "win32" });
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (err) => {
      resolve({ exitCode: 1, stdout, stderr: `${stderr}${err.message}\n` });
    });
    child.on("close", (code) => {
      resolve({ exitCode: code ?? 1, stdout, stderr });
    });
  });
}
