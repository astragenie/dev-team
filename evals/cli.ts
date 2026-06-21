/**
 * evals/cli.ts — entry point for `bun run evals`.
 *
 * Usage:
 *   bun run evals --dry-run --prompt fullstack-dev
 *   bun run evals --live --prompt fullstack-dev [--judge ollama]
 *   bun run evals --dry-run --prompt fullstack-dev --root /path/to/repo
 *
 * SLICE-B2: --live mode added; --dry-run remains the default (safe) mode.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { runEval, findSpecByPromptId } from "./lib/run-eval.ts";
import type { EvalRunResult } from "./lib/run-eval.ts";

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  prompt: string | undefined;
  root: string;
  dryRun: boolean;
  live: boolean;
  judge: string | undefined;
  validate: boolean;
  candidateLive: boolean;
  help: boolean;
}

function consumeNext(argv: string[], i: number): [string | undefined, number] {
  return [argv[i + 1], i + 1];
}

function parseArgs(argv: string[]): CliArgs {
  let prompt: string | undefined;
  let root = process.cwd();
  let dryRun = false;
  let live = false;
  let judge: string | undefined;
  let validate = false;
  let candidateLive = false;
  let help = false;
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i] ?? "";
    if (arg === "--help" || arg === "-h") {
      help = true;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--live") {
      live = true;
    } else if (arg === "--validate") {
      validate = true;
    } else if (arg === "--candidate-live") {
      candidateLive = true;
    } else if (arg === "--judge") {
      [judge, i] = consumeNext(argv, i);
    } else if (arg === "--prompt" || arg === "-p") {
      [prompt, i] = consumeNext(argv, i);
    } else if (arg === "--root") {
      const [v, ni] = consumeNext(argv, i);
      root = v ?? process.cwd();
      i = ni;
    }
    i++;
  }
  return { prompt, root, dryRun, live, judge, validate, candidateLive, help };
}

function printHelp(): void {
  console.log(`
crew-eval — pluggable agent prompt evaluation framework

Usage:
  bun run evals --dry-run --prompt <id> [--root <dir>]
  bun run evals --live --prompt <id> [--judge <provider>] [--root <dir>]
  bun run evals --live --prompt <id> --validate

Options:
  --prompt <id>     eval spec prompt_id to run (e.g. fullstack-dev)
  --dry-run         replay fixture without live judge dispatch (default safe mode)
  --live            use live judge from spec (requires GROQ_API_KEY or GEMINI_API_KEY)
  --validate        force validate_with chain on every test (even when primary passes)
  --candidate-live  dispatch candidate agent via claude -p against fixture input (FEAT-171).
                    When candidate.runner: claude-p set in spec, runs the real agent prompt
                    and evaluates its actual response instead of treating fixture as output.
                    Requires claude CLI on PATH + Pro/Max subscription auth.
  --judge <id>      override judge provider (e.g. ollama, gemini, groq, claude-p, azure, bedrock)
  --root <dir>      repo root (default: cwd)
  --help            show this help

Primary providers (free tier):
  groq              Groq llama-3.3-70b-versatile (requires GROQ_API_KEY)
  gemini            Google Gemini Flash (requires GEMINI_API_KEY)
  ollama            Local Ollama llama3.3 (requires Ollama running at localhost:11434)
  claude-p          claude CLI subscription judge (requires claude CLI installed)
  generic-openai    Any OpenAI-compatible endpoint

Validation tier (fires on disagreement or --validate):
  azure             Azure OpenAI (requires AZURE_OPENAI_API_KEY + AZURE_OPENAI_ENDPOINT)
  bedrock           AWS Bedrock (requires AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY)
`);
}

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

function printResult(result: EvalRunResult): void {
  const { summary, tests } = result;
  const modeTag = result.dryRun ? "dry-run" : "live";
  console.log(`\nEval: ${result.promptId}  [${modeTag}]`);
  for (const t of tests) {
    const icon = t.error ? "ERROR" : t.pass ? "PASS" : "FAIL";
    const disagreeTag = t.disagreement ? "  [DISAGREEMENT]" : "";
    console.log(`  ${icon}  ${t.name} (${t.durationMs}ms)${disagreeTag}`);
    if (t.error) {
      console.log(`    ! ${t.error}`);
    }
    for (const a of t.asserts) {
      const aIcon = a.pass ? "  +" : "  -";
      console.log(`    ${aIcon} [${a.type}] ${a.message}`);
    }
    if (t.validations && t.validations.length > 0) {
      console.log("    validate_with:");
      for (const v of t.validations) {
        const vIcon = v.verdict === "pass" ? "+" : v.verdict === "skipped" ? "~" : "-";
        console.log(`      ${vIcon} [${v.judge}] ${v.verdict}: ${v.rationale}`);
      }
    }
  }
  console.log(
    `\nSummary: ${summary.passed}/${summary.total} passed` +
      (summary.errored > 0 ? `, ${summary.errored} errored` : "")
  );
}

async function writeRunJson(result: EvalRunResult, repoRoot: string): Promise<string> {
  const runsDir = path.join(repoRoot, "evals", "runs");
  await fs.mkdir(runsDir, { recursive: true });
  const ts = result.timestamp.replace(/[:.]/g, "-");
  const filename = `${ts}-${result.promptId}.json`;
  const outPath = path.join(runsDir, filename);
  await fs.writeFile(outPath, JSON.stringify(result, null, 2), "utf8");
  return outPath;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);

  if (args.help) {
    printHelp();
    process.exitCode = 0;
    return;
  }

  // Default to dry-run if neither --dry-run nor --live specified
  const dryRun = !args.live;

  if (!args.prompt) {
    console.error("Error: --prompt <id> is required");
    printHelp();
    process.exitCode = 1;
    return;
  }

  const agentsDir = path.join(args.root, "evals", "agents");
  const specFile = await findSpecByPromptId(args.prompt, agentsDir);

  if (!specFile) {
    console.error(`Error: no eval spec found for prompt_id "${args.prompt}" in ${agentsDir}`);
    process.exitCode = 1;
    return;
  }

  if (!dryRun && args.judge) {
    // --judge override: patch the spec's judge provider at runtime
    // (passed via env so run-eval picks it up via JUDGE_REGISTRY default)
    process.env["CREW_EVAL_JUDGE_OVERRIDE"] = args.judge;
  }

  const result = await runEval({
    specFile,
    repoRoot: args.root,
    dryRun,
    validate: args.validate,
    candidateLive: args.candidateLive
  });
  printResult(result);

  const outPath = await writeRunJson(result, args.root);
  console.log(`\nRun saved: ${outPath}`);

  if (result.summary.failed > 0 || result.summary.errored > 0) {
    process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  console.error("evals cli error:", err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
