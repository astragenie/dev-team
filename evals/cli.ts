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
import { parse as parseYaml } from "yaml";
import { runEval, findSpecByPromptId } from "./lib/run-eval.ts";
import type { EvalRunResult, EvalSpecBudget } from "./lib/run-eval.ts";
import type { BudgetMeter } from "@astragenie/gepa-core";
import { createDailyCapMeter, passthroughMeter } from "./lib/meter.ts";

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
  diffPaths: [string, string] | null;
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
  let diffPaths: [string, string] | null = null;
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
    } else if (arg === "--diff") {
      const [pathA, ni1] = consumeNext(argv, i);
      const [pathB, ni2] = consumeNext(argv, ni1);
      if (pathA && pathB) diffPaths = [pathA, pathB];
      i = ni2;
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
  return { prompt, root, dryRun, live, judge, validate, candidateLive, help, diffPaths };
}

function printHelp(): void {
  console.log(`
crew-eval — pluggable agent prompt evaluation framework

Usage:
  bun run evals --dry-run --prompt <id> [--root <dir>]
  bun run evals --live --prompt <id> [--judge <provider>] [--root <dir>]
  bun run evals --live --prompt <id> --validate
  bun run evals --diff <runA.json> <runB.json>     # FEAT-175 side-by-side compare

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

function fmtDur(t: { durationSec?: number; durationMs: number }): string {
  const sec = t.durationSec ?? Math.round((t.durationMs / 1000) * 10) / 10;
  return `${sec}s`;
}

function printResult(result: EvalRunResult): void {
  const { summary, tests } = result;
  const modeTag = result.dryRun ? "dry-run" : "live";
  const meta = [
    result.promptVersion ? `v${result.promptVersion}` : null,
    result.gitSha ? `git:${result.gitSha}` : null,
    result.judgeId ? `judge:${result.judgeId}` : null
  ]
    .filter(Boolean)
    .join("  ");
  console.log(`\nEval: ${result.promptId}  [${modeTag}]${meta ? `  (${meta})` : ""}`);
  for (const t of tests) {
    const icon = t.error ? "ERROR" : t.pass ? "PASS" : "FAIL";
    const disagreeTag = t.disagreement ? "  [DISAGREEMENT]" : "";
    console.log(`  ${icon}  ${t.name} (${fmtDur(t)})${disagreeTag}`);
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
  const totalLine = result.totalDurationSec ? ` in ${result.totalDurationSec}s` : "";
  console.log(
    `\nSummary: ${summary.passed}/${summary.total} passed${
      summary.errored > 0 ? `, ${summary.errored} errored` : ""
    }${totalLine}`
  );
}

// FEAT-175: side-by-side diff of two run artifacts.
async function printDiff(pathA: string, pathB: string): Promise<void> {
  const [rawA, rawB] = await Promise.all([
    fs.readFile(pathA, "utf8"),
    fs.readFile(pathB, "utf8")
  ]);
  const a = JSON.parse(rawA) as EvalRunResult;
  const b = JSON.parse(rawB) as EvalRunResult;

  console.log(
    `\nDiff: ${path.basename(pathA)}  →  ${path.basename(pathB)}\nprompt: ${a.promptId}  ${a.promptVersion ?? "-"} → ${b.promptVersion ?? "-"}  ${a.gitSha ?? "-"} → ${b.gitSha ?? "-"}\n`
  );

  const byName = new Map<string, { a?: (typeof a.tests)[number]; b?: (typeof b.tests)[number] }>();
  for (const t of a.tests) byName.set(t.name, { a: t });
  for (const t of b.tests) {
    const cur = byName.get(t.name) ?? {};
    cur.b = t;
    byName.set(t.name, cur);
  }

  const verdict = (t: (typeof a.tests)[number] | undefined): string =>
    !t ? "----" : t.error ? "ERR " : t.pass ? "PASS" : "FAIL";

  let flips = 0;
  console.log(`  ${"test".padEnd(36)}  A     B     Δ`);
  console.log(`  ${"-".repeat(36)}  ----  ----  ---`);
  for (const [name, { a: ta, b: tb }] of byName) {
    const va = verdict(ta);
    const vb = verdict(tb);
    const flip = va !== vb ? (vb === "PASS" ? " 🠅" : vb === "FAIL" ? " 🠇" : " *") : "";
    if (flip) flips++;
    console.log(`  ${name.padEnd(36)}  ${va}  ${vb}  ${flip}`);
  }
  const sumA = a.summary;
  const sumB = b.summary;
  console.log(
    `\n  Summary A: ${sumA.passed}/${sumA.total}  total ${a.totalDurationSec ?? "?"}s`
  );
  console.log(`  Summary B: ${sumB.passed}/${sumB.total}  total ${b.totalDurationSec ?? "?"}s`);
  console.log(`  Flips:     ${flips}`);
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
// SLICE-111 (FEAT-186 S2): budget meter resolution helpers
// ---------------------------------------------------------------------------

/**
 * Read the budget block from a spec YAML file.
 * Returns undefined if the file cannot be parsed or the block is absent.
 */
async function readBudgetBlock(specFile: string): Promise<EvalSpecBudget | undefined> {
  try {
    const raw = await fs.readFile(specFile, "utf8");
    const spec = parseYaml(raw) as { budget?: EvalSpecBudget };
    return spec.budget;
  } catch {
    return undefined;
  }
}

/**
 * Resolve a BudgetMeter for the current eval run.
 *
 * Priority:
 *   1. YAML `budget.daily_cap_usd` block in the spec file.
 *   2. `GEPA_DAILY_CAP_USD` env var (only if YAML block absent).
 *   3. No cap → passthrough meter (AC-4: fixture replays byte-for-byte identical).
 */
async function resolveMeter(
  specFile: string,
  promptId: string,
  repoRoot: string
): Promise<BudgetMeter> {
  const budget = await readBudgetBlock(specFile);

  if (budget !== undefined && typeof budget.daily_cap_usd === "number") {
    const persistPath =
      budget.persist_path ??
      path.join(repoRoot, ".claude", "state", `gepa-meter-${promptId}.json`);
    const meterOpts: Parameters<typeof createDailyCapMeter>[0] = {
      capUsd: budget.daily_cap_usd,
      persistPath,
    };
    if (budget.provider_ceilings !== undefined) {
      meterOpts.providerCeilings = budget.provider_ceilings;
    }
    return createDailyCapMeter(meterOpts);
  }

  // Env var fallback — only when no YAML budget block.
  const envCap = process.env["GEPA_DAILY_CAP_USD"];
  if (envCap !== undefined) {
    const capUsd = Number(envCap);
    if (Number.isFinite(capUsd) && capUsd > 0) {
      const envPath =
        process.env["GEPA_METER_PERSIST_PATH"] ??
        path.join(repoRoot, ".claude", "state", "gepa-meter.json");
      return createDailyCapMeter({ capUsd, persistPath: envPath });
    }
  }

  // No budget configured → passthrough (no cap).
  return passthroughMeter();
}

/**
 * Extract provider_ceilings from the spec YAML budget block (if present).
 * Returns undefined when absent — withBudget will use DEFAULT_PROVIDER_CEILINGS.
 */
async function resolveProviderCeilingsFromSpec(
  specFile: string
): Promise<Record<string, number> | undefined> {
  const budget = await readBudgetBlock(specFile);
  return budget?.provider_ceilings;
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

  // FEAT-175: --diff <runA.json> <runB.json> side-by-side compare
  if (args.diffPaths) {
    const [a, b] = args.diffPaths;
    await printDiff(a, b);
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

  // SLICE-111 (FEAT-186 S2): resolve budget meter from YAML budget block or env fallback.
  const meter = await resolveMeter(specFile, args.prompt, args.root);
  const providerCeilings = await resolveProviderCeilingsFromSpec(specFile);

  // exactOptionalPropertyTypes: only include optional fields when defined.
  const runEvalOpts: Parameters<typeof runEval>[0] = {
    specFile,
    repoRoot: args.root,
    dryRun,
    validate: args.validate,
    candidateLive: args.candidateLive,
    meter,
  };
  if (providerCeilings !== undefined) {
    runEvalOpts.providerCeilings = providerCeilings;
  }

  const result = await runEval(runEvalOpts);
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
