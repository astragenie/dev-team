// corpus-optimize.ts — FEAT-193 S3 (feed-to-optimize bridge).
//
// The human-gated hand-off from the analyze digest to a real optimize cycle.
// AC-9 discipline: report GENERATION never reaches this module — `reportCorpus`
// / `gepa-corpus-report` have no optimize import. Only a human explicitly
// typing `crew gepa-corpus-optimize <agent> --budget <usd>` reaches here. That
// explicit invocation IS the human gate the FEAT requires ("Analyze-before-
// adjust is a required human gate — never blind auto-promote").
//
// The bridge does two things, in order:
//   1. Renders the analyze digest for <agent> (delegates to gepa-corpus-report)
//      so the operator sees WHY they are optimizing, in the same output.
//   2. Feeds the aggregated hub corpus into ONE gepa-optimize cycle — the SAME
//      trial store `gepa-corpus-sync` writes into and `store.recall` reads. The
//      cycle is forced ARTIFACT-ONLY: a candidate is generated + judge-scored
//      and written to an opt artifact, but NEVER auto-promoted / PR'd.
//      Promotion stays a further explicit human step (manual PR /
//      champion-provenance — aiplugin-dev v1.2.4). This is why AC-10
//      (champion-provenance-writer / validate-agents fix) had to land first:
//      the moment a human acts on this bridge's output and promotes, the
//      provenance-written agent must still pass validate-agents.
//
// Both delegates are injectable so tests exercise the composition + the
// artifact-only guarantee without standing up a live judge (mirrors
// corpus-report's `recallLessons` seam).

import type { CorpusReportCmdResult } from "./corpus-report.ts";
import type { OptimizeCmdResult } from "./gepa-optimize-cmd.ts";

export interface CorpusOptimizeDeps {
  /** Render the analyze digest (defaults to gepa-corpus-report). */
  report?: (repoPath: string, rawArgs: string[]) => Promise<CorpusReportCmdResult>;
  /** Run one optimize cycle (defaults to gepa-optimize). */
  optimize?: (repoPath: string, rawArgs: string[]) => Promise<OptimizeCmdResult>;
}

export interface CorpusOptimizeCmdResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

interface ParsedArgs {
  agent?: string;
  budget?: string;
  k?: string;
}

function parseArgs(rawArgs: string[]): ParsedArgs {
  const parsed: ParsedArgs = {};
  for (let i = 0; i < rawArgs.length; i += 1) {
    const a = rawArgs[i];
    const next = rawArgs[i + 1];
    if (a === "--budget" && next) {
      parsed.budget = next;
      i += 1;
    } else if (a === "--k" && next) {
      parsed.k = next;
      i += 1;
    } else if (a && !a.startsWith("--") && !parsed.agent) {
      parsed.agent = a;
    }
  }
  return parsed;
}

// No `--json`: this command is an inherently human-facing COMPOSITE (analyze
// digest + optimize summary). A single valid-JSON envelope would have to embed
// the optimize CLI's plain-text stdout as a string, which is more confusing
// than useful — the machine-readable surfaces already exist separately
// (`gepa-corpus-report --json`, and the on-disk opt artifact). Review MEDIUM-1:
// do not advertise a `--json` that only JSONs one fragment.
const USAGE = "usage: gepa-corpus-optimize <agent> --budget <usd> [--k <int>] [--repo <path>]\n";

/**
 * CLI entry (`crew gepa-corpus-optimize <agent> --budget <usd>`). The
 * human-gated analyze→optimize bridge. Never throws — the optimize cycle's
 * exit code is the bridge's exit code (the digest is advisory). Always forces
 * `--artifact-only`: this command can NEVER promote a candidate on its own.
 */
export async function runCorpusOptimizeCmd(
  repoPath: string,
  rawArgs: string[],
  deps: CorpusOptimizeDeps = {}
): Promise<CorpusOptimizeCmdResult> {
  const { agent, budget, k } = parseArgs(rawArgs);

  if (!agent) return { stdout: "", stderr: USAGE, exitCode: 2 };
  if (!budget) {
    return {
      stdout: "",
      stderr: "--budget is required (feed-to-optimize spends real judge tokens)\n",
      exitCode: 2
    };
  }

  const report =
    deps.report ?? (async (r, a) => (await import("./corpus-report.ts")).runCorpusReportCmd(r, a));
  const optimize =
    deps.optimize ??
    (async (r, a) => (await import("./gepa-optimize-cmd.ts")).runGepaOptimizeCmd(r, a));

  // Make the "Never throws" contract real (review MEDIUM-2): a trial-store read
  // or judge-scorer error inside a delegate surfaces as a non-zero exitCode +
  // stderr, never an unhandled rejection a library caller has to catch.
  try {
    // Step 1 — analyze gate: render the digest for this agent FIRST.
    const digest = await report(repoPath, [agent]);

    // Step 2 — feed the aggregated hub corpus into one artifact-only cycle.
    // `--artifact-only` is passed EXPLICITLY (not left to the optimize default)
    // so this bridge stays promote-free even if that default ever changes.
    const optArgs = [agent, "--budget", budget];
    if (k) optArgs.push("--k", k);
    optArgs.push("--artifact-only");
    const opt = await optimize(repoPath, optArgs);

    const header =
      "gepa-corpus-optimize: analyze digest → artifact-only optimize (no auto-promote)\n";
    const separator = "\n— optimize cycle (artifact-only; promote is a further human step) —\n";
    return {
      stdout: `${header}${digest.stdout}${separator}${opt.stdout}`,
      stderr: `${digest.stderr}${opt.stderr}`,
      exitCode: opt.exitCode
    };
  } catch (err) {
    return {
      stdout: "",
      stderr: `gepa-corpus-optimize failed: ${(err as Error).message}\n`,
      exitCode: 1
    };
  }
}
