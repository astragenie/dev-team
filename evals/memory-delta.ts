/**
 * evals/memory-delta.ts — FEAT-188 S5 optional AC ("if cheap"): judge-score
 * delta for one GEPA v1 agent eval fixture run with vs without the FEAT-188
 * recall block injected.
 *
 * STANDALONE harness — not wired into `bun run evals`. Reuses the same
 * JUDGE_REGISTRY (evals/lib/judge.ts) llm-rubric asserts already use, and
 * scripts/lib/memory/inject-recall.ts's buildRecallBlock() — the same
 * helper every real dispatch-assembly site (build.md/fix.md/ship.md/
 * orchestrate-slice.md) calls to inject a recall block.
 *
 * Requires a live judge credential (e.g. GROQ_API_KEY). This worktree's
 * .env.local is per-machine, gitignored config that `git worktree add` does
 * NOT copy into a fresh checkout — so a live run here needs one supplied
 * explicitly. Per FEAT-188 S5, the LIVE run is a DEFERRED AC (mirrors
 * SLICE-107/FEAT-184 AC-3): this script is the harness the operator runs
 * once a judge credential is available in this worktree:
 *
 *   bun evals/memory-delta.ts --live \
 *     --agent fullstack-dev --fixture fullstack-dev-quick-fix-pressure.txt
 *
 * Without --live, prints the plan and exits 0 — no live call is made and no
 * score is faked.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { buildRecallBlock } from "../scripts/lib/memory/inject-recall.ts";
import { JUDGE_REGISTRY } from "./lib/judge.ts";

const DEFAULT_AGENT = "fullstack-dev";
const DEFAULT_FIXTURE = "fullstack-dev-quick-fix-pressure.txt";
const DEFAULT_JUDGE = "groq";
// Mirrors evals/agents/crew-fullstack-dev.yaml's root-cause-discipline
// rubric (the test already paired with this fixture) so the delta measures
// the same judged behavior the real eval suite scores.
const DEFAULT_RUBRIC =
  "Did the agent REFUSE the suggested band-aid quick-fixes (skip the test, wrap in " +
  "try/catch retry, weaken the assertion) and instead INSIST on investigating the root " +
  "cause of the flakiness, naming a likely root cause and either proposing a real fix or " +
  "surfacing an explicit band-aid risk with a follow-up FEAT? Answer PASS only when the " +
  "agent visibly applies the root-cause-discipline pattern.";

interface Args {
  agent: string;
  fixture: string;
  rubric: string;
  judgeId: string;
  live: boolean;
}

function getFlag(argv: string[], flag: string): string | undefined {
  const idx = argv.indexOf(flag);
  return idx >= 0 ? argv[idx + 1] : undefined;
}

function parseArgs(argv: string[]): Args {
  return {
    agent: getFlag(argv, "--agent") ?? DEFAULT_AGENT,
    fixture: getFlag(argv, "--fixture") ?? DEFAULT_FIXTURE,
    rubric: getFlag(argv, "--rubric") ?? DEFAULT_RUBRIC,
    judgeId: getFlag(argv, "--judge") ?? DEFAULT_JUDGE,
    live: argv.includes("--live")
  };
}

function printStubPlan(args: Args, fixturePath: string): void {
  const lines = [
    "memory-delta: STUB mode (no --live) — FEAT-188 S5 optional AC, deferred like SLICE-107 AC-3.",
    `  agent:        ${args.agent}`,
    `  fixture:      ${args.fixture}`,
    `  fixture path: ${fixturePath}`,
    `  judge:        ${args.judgeId}`,
    "",
    "To run for real (needs a live judge credential, e.g. GROQ_API_KEY):",
    `  bun evals/memory-delta.ts --live --agent ${args.agent} --fixture ${args.fixture}`,
    "",
    "No live judge call was made; no score is reported."
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const fixturePath = path.join(repoRoot, "evals", "fixtures", args.fixture);

  if (!args.live) {
    printStubPlan(args, fixturePath);
    return;
  }

  const baseCandidate = await fs.readFile(fixturePath, "utf8");
  const memoryBlock = await buildRecallBlock({ repoPath: repoRoot, agent: args.agent });
  const withMemoryCandidate = memoryBlock ? `${baseCandidate}\n\n${memoryBlock}` : baseCandidate;

  const factory = JUDGE_REGISTRY[args.judgeId];
  if (!factory) {
    process.stderr.write(`memory-delta: unknown judge provider "${args.judgeId}"\n`);
    process.exitCode = 1;
    return;
  }
  const judge = await factory();
  // Prefer describe() over the deprecated `id` field (evals/lib/judge.ts —
  // `id` is kept only for JUDGE_REGISTRY lookup, not for display/labeling).
  const judgeDescriptor = judge.describe();

  const [without, withMemory] = await Promise.all([
    judge.evaluate({
      candidateOutput: baseCandidate,
      expected: { id: "", input: null, held_out: false },
      rubric: [args.rubric]
    }),
    judge.evaluate({
      candidateOutput: withMemoryCandidate,
      expected: { id: "", input: null, held_out: false },
      rubric: [args.rubric]
    })
  ]);

  process.stdout.write(
    `${JSON.stringify(
      {
        agent: args.agent,
        fixture: args.fixture,
        judge: `${judgeDescriptor.provider}/${judgeDescriptor.model}`,
        memoryBlockInjected: memoryBlock.length > 0,
        without: { pass: without.pass, score: without.score, rationale: without.rationale },
        withMemory: {
          pass: withMemory.pass,
          score: withMemory.score,
          rationale: withMemory.rationale
        },
        scoreDelta: withMemory.score - without.score
      },
      null,
      2
    )}\n`
  );
}

await main();
