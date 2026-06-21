/**
 * evals/cli.ts — entry point for `bun run evals`.
 *
 * Usage:
 *   bun run evals --dry-run --prompt fullstack-dev
 *   bun run evals --dry-run --prompt fullstack-dev --root /path/to/repo
 *
 * SLICE-B1: --dry-run only. Live judge dispatch errors with guidance.
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
  help: boolean;
}

function consumeNext(argv: string[], i: number): [string | undefined, number] {
  return [argv[i + 1], i + 1];
}

function parseArgs(argv: string[]): CliArgs {
  let prompt: string | undefined;
  let root = process.cwd();
  let dryRun = false;
  let help = false;
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i] ?? "";
    if (arg === "--help" || arg === "-h") {
      help = true;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--prompt" || arg === "-p") {
      [prompt, i] = consumeNext(argv, i);
    } else if (arg === "--root") {
      const [v, ni] = consumeNext(argv, i);
      root = v ?? process.cwd();
      i = ni;
    }
    i++;
  }
  return { prompt, root, dryRun, help };
}

function printHelp(): void {
  console.log(`
crew-eval — pluggable agent prompt evaluation framework

Usage:
  bun run evals --dry-run --prompt <id> [--root <dir>]

Options:
  --prompt <id>   eval spec prompt_id to run (e.g. fullstack-dev)
  --dry-run       replay fixture without live dispatch (SLICE-B1 only mode)
  --root <dir>    repo root (default: cwd)
  --help          show this help

Note: live judge dispatch ships in SLICE-B2.
`);
}

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

function printResult(result: EvalRunResult): void {
  const { summary, tests } = result;
  console.log(`\nEval: ${result.promptId}  [dry-run=${result.dryRun}]`);
  for (const t of tests) {
    const icon = t.pass ? "PASS" : "FAIL";
    console.log(`  ${icon}  ${t.name} (${t.durationMs}ms)`);
    for (const a of t.asserts) {
      const aIcon = a.pass ? "  ✓" : "  ✗";
      console.log(`    ${aIcon} [${a.type}] ${a.message}`);
    }
  }
  console.log(`\nSummary: ${summary.passed}/${summary.total} passed`);
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

  if (!args.dryRun) {
    console.error("Error: live judge dispatch ships in SLICE-B2 — pass --dry-run");
    process.exitCode = 1;
    return;
  }

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

  const result = await runEval({ specFile, repoRoot: args.root, dryRun: true });
  printResult(result);

  const outPath = await writeRunJson(result, args.root);
  console.log(`\nRun saved: ${outPath}`);

  if (result.summary.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  console.error("evals cli error:", err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
