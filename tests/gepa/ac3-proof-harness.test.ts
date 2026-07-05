/**
 * tests/gepa/ac3-proof-harness.test.ts — FEAT-192 SLICE-D
 *
 * Closes the HIGH provability gap the SLICE-C review surfaced
 * (.claude/artifacts/crew/reviews/20260705T133940Z-review-result-feat-192-slice-c-review.md):
 * against the REAL `evals/agents/crew-aiplugin-dev.yaml`, the default split
 * drops the AC-3 money case (`respects-350-line-cap`) into `train`, where it
 * is never scored — so a naive `/crew:gepa-optimize aiplugin-dev` can never
 * prove AC-3. Fixing the split alone (`--split 0/3`, all 3 cases heldOut)
 * creates a SECOND gap: it empties `train`, zeroing the cold-start
 * `trainSeedTrials`, so on the true cold start that exists today (no
 * aiplugin-dev trial history) `dispatchRewriter` gets zero failing-trial
 * context for its first candidate.
 *
 * This file proves, entirely offline (no live LLM, no live `claude -p`):
 *  1. `--split 0/3` against the REAL yaml routes every case — including
 *     `respects-350-line-cap` — into `heldOut`/`cases` (the regression test
 *     the SLICE-C review said was missing; SLICE-C's own tests used a
 *     synthetic case-a/b/c fixture and never checked real case placement).
 *  2. `resolveOptimizeInputs`'s cold-start heldOut-seed fallback gives
 *     `dispatchRewriter` real failing-trial context (incl. a rationale
 *     carrying the `respects-350-line-cap` rubric) when both `train` and
 *     trial history are empty — and does NOT fire when either already has
 *     content, so no existing agent's default-split behavior regresses.
 *  3. End-to-end plumbing (generate -> dispatch -> judge -> score -> rank ->
 *     determineWinner) with INJECTED mock dispatch + mock judge: a champion
 *     failing `respects-350-line-cap`, given that failing trial as context,
 *     produces (via the mocked `dispatchRewriter`) a candidate that the
 *     mocked judge scores as passing all 3 cases, and `determineWinner`
 *     selects it as winner via the SLICE-B all-case gate.
 *
 * The live AC-3 run (real Groq/Gemini judge, real `claude -p` dispatch) is
 * the operator's gated next step once GROQ_API_KEY is available — see the
 * SLICE-D handoff for the exact command.
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  Candidate,
  CandidateGenerator,
  EvalCase,
  LLMJudge,
  Trial
} from "@astragenie/gepa-core";
import {
  loadEvalCasesForOptimize,
  resolveOptimizeInputs
} from "../../scripts/lib/gepa/gepa-optimize-cmd.ts";
import {
  createAipluginCandidateGenerator,
  type RewriteDispatchDeps
} from "../../scripts/lib/gepa/candidate-generator-aiplugin.ts";
import { createJudgeScorer } from "../../scripts/lib/gepa/judge-scorer.ts";
import { runOptimize } from "../../scripts/lib/gepa/optimize-runner.ts";

// Real repo root — the yaml + fixtures under test are the ACTUAL AC-3 spec,
// not a synthetic fixture (that substitution is exactly what the SLICE-C
// review flagged as the missing regression test).
const REPO_ROOT = join(import.meta.dir, "../..");
const AC3_AGENT = "aiplugin-dev";
const AC3_MONEY_CASE = "respects-350-line-cap";
const AC3_ALL_CASE_IDS = [
  "identity-anchor-holds",
  "refuses-orchestrator-role",
  "respects-350-line-cap"
].sort();

describe("FEAT-192 SLICE-D — score-all-cases split against the REAL aiplugin-dev eval yaml", () => {
  test("--split 0/3 routes every real case (incl. respects-350-line-cap) into heldOut/cases", async () => {
    const result = await loadEvalCasesForOptimize(REPO_ROOT, AC3_AGENT, { train: 0, heldOut: 3 });

    expect(result).not.toBeNull();
    if (!result) return;

    const ids = result.heldOut.map((c) => c.id).sort();
    expect(ids).toEqual(AC3_ALL_CASE_IDS);
    expect(result.heldOut.every((c) => c.held_out)).toBe(true);
    // Forcing all 3 into heldOut empties train — this is the second-order
    // interaction the seeding fallback (below) exists to solve.
    expect(result.trainSeedTrials).toHaveLength(0);
  });

  test("sanity regression: default split (no --split) still drops the money case into train", async () => {
    // Documents WHY SLICE-D standardizes on --split 0/3 for the AC-3 proof —
    // if this ever stops being true (e.g. a 4th case is added and rebalances
    // defaultSplitFor), the naive invocation might start working and this
    // assertion should be revisited, not silently left stale.
    const result = await loadEvalCasesForOptimize(REPO_ROOT, AC3_AGENT);

    expect(result).not.toBeNull();
    if (!result) return;

    const heldOutIds = result.heldOut.map((c) => c.id);
    expect(heldOutIds).not.toContain(AC3_MONEY_CASE);
  });
});

describe("FEAT-192 SLICE-D — cold-start heldOut-seed fallback (resolveOptimizeInputs)", () => {
  test("train:0 + no trial history -> seeds failing-trial context from heldOut cases", async () => {
    const resolved = await resolveOptimizeInputs(
      REPO_ROOT,
      AC3_AGENT,
      { train: 0, heldOut: 3 },
      []
    );

    expect(resolved.cases).toHaveLength(3);
    // One seeded trial per heldOut case — dispatchRewriter never sees zero
    // failing-trial context on this cold start.
    expect(resolved.failingTrials).toHaveLength(3);

    const capTrial = resolved.failingTrials.find((t) =>
      t.score.rationale?.includes(AC3_MONEY_CASE)
    );
    expect(capTrial).toBeDefined();
    expect(capTrial?.score.pass).toBe(false);
    // The seeded rationale carries the case's own rubric — for the money
    // case that rubric names the 350-line cap and the push-to-skill fix —
    // real reflection fuel, not a fabricated failure narrative.
    expect(capTrial?.score.rationale).toContain("350");
  });

  test("real trial history takes priority over the heldOut-seed fallback", async () => {
    const historicalTrial: Trial = {
      id: "historical-trial-1",
      agent: AC3_AGENT,
      phase: "build",
      candidate_prompt_hash: "champion-real",
      candidate_prompt_path: null,
      input: "real captured input",
      output: "real captured output",
      score: {
        pass: false,
        score: 0.1,
        cost_usd: 0.01,
        latency_ms: 500,
        rationale: "real failure"
      },
      source: "eval",
      pareto_rank: null,
      created_at: new Date().toISOString()
    };

    const resolved = await resolveOptimizeInputs(REPO_ROOT, AC3_AGENT, { train: 0, heldOut: 3 }, [
      historicalTrial
    ]);

    expect(resolved.failingTrials).toEqual([historicalTrial]);
  });

  test("regression guard: default split (non-empty train) never triggers the heldOut-seed fallback", async () => {
    const resolved = await resolveOptimizeInputs(REPO_ROOT, AC3_AGENT, undefined, []);

    expect(resolved.failingTrials.length).toBeGreaterThan(0);
    // Every seed trial should carry the pre-existing SLICE-C train-seed
    // marker, never the SLICE-D heldOut-seed marker — proves this slice adds
    // a fallback tier without altering the SLICE-C default-path behavior.
    expect(
      resolved.failingTrials.every((t) => t.score.rationale?.includes("seeded from train-split"))
    ).toBe(true);
  });
});

describe("FEAT-192 SLICE-D — offline end-to-end proof (mock judge + mock dispatch, zero live LLM)", () => {
  test(
    "champion fails respects-350-line-cap -> dispatchRewriter (mocked) candidate passes all 3 " +
      "mock-scored cases -> determineWinner selects it via the all-case gate",
    async () => {
      const repoPath = mkdtempSync(join(tmpdir(), "gepa-d-e2e-"));
      const agentsDir = join(repoPath, "agents");
      mkdirSync(agentsDir, { recursive: true });

      const championContent = [
        "# aiplugin-dev (test champion)",
        "",
        "## Identity anchor",
        "You are aiplugin-dev, a Claude Code plugin specialist. You author agents, skills, and commands.",
        "",
        "## Scope",
        "Builder only. No orchestration."
      ].join("\n");
      writeFileSync(join(agentsDir, `${AC3_AGENT}.md`), championContent, "utf8");

      const cases: EvalCase[] = [
        { id: "identity-anchor-holds", held_out: true, input: "scenario 1", rubric: ["r1"] },
        { id: "refuses-orchestrator-role", held_out: true, input: "scenario 2", rubric: ["r2"] },
        {
          id: AC3_MONEY_CASE,
          held_out: true,
          input: "scenario 3",
          rubric: ["flag the 350-line cap and push detail to a skill"]
        }
      ];

      // Seed the champion's known failure on the money case — what a real
      // champion baseline eval would produce; here supplied directly as
      // `failingTrials` so the test proves the generator/scorer wiring
      // without depending on the cold-start seed fallback above.
      const failingTrial: Trial = {
        id: "trial-baseline-350-cap",
        agent: AC3_AGENT,
        phase: "build",
        candidate_prompt_hash: "champion-baseline",
        candidate_prompt_path: null,
        input: "scenario 3",
        output: "champion inlined everything instead of pushing detail to a skill",
        score: {
          pass: false,
          score: 0,
          cost_usd: 0,
          latency_ms: 0,
          rationale:
            "champion did not flag the 350-line cap and inlined all procedural detail instead of pushing it to a skill"
        },
        source: "eval",
        pareto_rank: null,
        created_at: new Date().toISOString()
      };

      // SLICE-A DI seam: mocked rewrite dispatch. Never spawns `claude -p`.
      // Returns a fenced-block response (AC-7 contract) containing a
      // minimally-revised champion that keeps the identity anchor intact.
      const rewriteDeps: RewriteDispatchDeps = {
        async runSubprocess() {
          const revised = [
            championContent,
            "",
            "## Scope note",
            "Prompts over 350 lines push procedural detail into a skill instead of inlining it."
          ].join("\n");
          return JSON.stringify({ type: "result", result: `\`\`\`\n${revised}\n\`\`\`` });
        }
      };

      const capturedCandidates: Candidate[] = [];
      const cycleId = "e2e-cycle";
      process.env["GEPA_LIVE_GENERATOR"] = "1";
      try {
        const realGenerator = createAipluginCandidateGenerator({ repoPath, cycleId, rewriteDeps });
        // Spy wrapper — captures the generator's own Candidate output (for the
        // derived_from_trials provenance assertion) without altering behavior.
        const generator: CandidateGenerator = {
          async generate(championPath, trials, k, genOpts) {
            const produced = await realGenerator.generate(championPath, trials, k, genOpts);
            capturedCandidates.push(...produced);
            return produced;
          }
        };

        // SLICE-C DI seam: mocked judge chain + mocked candidate dispatch.
        // Never hits Groq/Gemini. Judge passes every case, proving that once
        // scored, a fixed rewrite clears the all-case promotion gate.
        const dispatchedPaths: string[] = [];
        const mockJudge: LLMJudge = {
          describe: () => ({ provider: "mock", model: "mock-judge" }),
          async evaluate({ expected }) {
            return {
              pass: true,
              score: 0.95,
              rubricScores: {},
              rationale: `${expected.id}: mock pass`,
              cost_usd: 0,
              latency_ms: 5
            };
          }
        };
        const scorer = createJudgeScorer({
          deps: {
            async dispatch(opts) {
              dispatchedPaths.push(opts.agentPromptPath);
              return { candidateOutput: "mock candidate output" };
            },
            async resolveJudgeChain() {
              return { judges: [mockJudge], errors: [] };
            }
          }
        });

        const result = await runOptimize({
          repoPath,
          agent: AC3_AGENT,
          k: 1,
          budgetUsd: 1,
          failingTrials: [failingTrial],
          generator,
          scorer,
          cases,
          artifactOnly: true
        });

        expect(result).not.toBeNull();
        if (!result) return;

        expect(result.candidates_evaluated).toBe(1);
        expect(result.trials).toHaveLength(3);
        expect(dispatchedPaths).toHaveLength(3);
        // The all-case gate (SLICE-B): every one of the 3 cases passed for
        // the single candidate -> selected as winner, no_winner:false.
        expect(result.no_winner).toBe(false);
        expect(result.winner).not.toBeNull();
        expect(result.winner?.pass).toBe(true);

        // Provenance (AC-3 requirement): the produced candidate traces back
        // to the input failing trial.
        expect(capturedCandidates).toHaveLength(1);
        expect(capturedCandidates[0]?.derived_from_trials).toEqual([failingTrial.id]);

        const candidateFiles = readdirSync(
          join(repoPath, ".claude", "artifacts", "crew", "gepa", "candidates", cycleId)
        );
        expect(candidateFiles).toHaveLength(1);
      } finally {
        delete process.env["GEPA_LIVE_GENERATOR"];
      }
    }
  );
});
