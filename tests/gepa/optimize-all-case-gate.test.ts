/**
 * tests/gepa/optimize-all-case-gate.test.ts — FEAT-192 SLICE-B AC-4
 *
 * Covers the per-candidate all-case promotion gate added to
 * `optimize-runner.ts::determineWinner` (the highest-risk hunk in SLICE-B,
 * shared by every agent's optimize cycle):
 *
 *   - A candidate that passes one eval case but FAILS another must NOT be
 *     selected as a promotable winner, even if its best-case trial is rank 1
 *     in the global Pareto (the pre-SLICE-B bug — FEAT-192 backlog note).
 *   - A candidate that passes EVERY eval case IS selected as winner.
 *   - The existing no-candidate / no-winner path (SLICE-105 guard) must
 *     still hold: `winner` stays populated as a diagnostic even when the
 *     gate blocks promotion, and auto-PR must never fire for a blocked
 *     candidate.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Candidate, CandidateGenerator, EvalCase, Scorer } from "@astragenie/gepa-core";
import { runOptimize } from "../../scripts/lib/gepa/optimize-runner.ts";

function makeRepo(): string {
  const repoPath = mkdtempSync(join(tmpdir(), "opt-all-case-gate-"));
  const agentsDir = join(repoPath, "agents");
  mkdirSync(agentsDir, { recursive: true });
  writeFileSync(join(agentsDir, "fullstack-dev.md"), "# Champion\nBody.\n", "utf8");
  return repoPath;
}

function makeSingleCandidateGenerator(candidateBody: string, dir: string): CandidateGenerator {
  return {
    async generate(_championPath, _failingTrials, _k) {
      const promptPath = join(dir, "candidate-cand-1.md");
      writeFileSync(promptPath, candidateBody, "utf8");
      const candidate: Candidate = {
        id: "cand-1",
        agent: "fullstack-dev",
        prompt_path: promptPath,
        prompt_hash: "hash-cand-1",
        prompt_size_lines: candidateBody.split("\n").length,
        derived_from_trials: [],
        generator_cost_usd: 0,
        created_at: new Date().toISOString()
      };
      return [candidate];
    }
  };
}

/** Scorer whose pass/fail result is keyed by eval case id — lets one candidate pass some cases and fail others. */
function makeScorerByCase(passByCaseId: Record<string, boolean>): Scorer {
  return {
    async score(_agentRun, evalCase) {
      const pass = passByCaseId[evalCase.id] ?? false;
      return {
        pass,
        score: pass ? 0.9 : 0.2,
        cost_usd: 0.001,
        latency_ms: 100,
        rationale: pass ? `${evalCase.id}: passed` : `${evalCase.id}: failed`
      };
    }
  };
}

function writeGhCallSpy(dir: string, callLog: string): string {
  mkdirSync(dir, { recursive: true });
  const shimMjs = join(dir, "gh-spy.mjs");
  const script = [
    `import { appendFileSync } from "node:fs";`,
    `appendFileSync(${JSON.stringify(callLog)}, JSON.stringify(process.argv.slice(2)) + "\\n");`,
    `process.exit(0);`
  ].join("\n");
  writeFileSync(shimMjs, script, "utf8");
  if (process.platform === "win32") {
    const cmdPath = join(dir, "gh.cmd");
    writeFileSync(cmdPath, `@node "${shimMjs}" %*\r\n`, "utf8");
    return cmdPath;
  }
  const shPath = join(dir, "gh");
  writeFileSync(shPath, `#!/bin/sh\nexec node "${shimMjs}" "$@"\n`, { mode: 0o755 });
  return shPath;
}

const CASES: EvalCase[] = [
  { id: "case-1", held_out: false, input: "prompt-1", expected_output: "output-1" },
  { id: "case-2", held_out: false, input: "prompt-2", expected_output: "output-2" }
];

describe("determineWinner — AC-4 per-candidate all-case promotion gate", () => {
  test("candidate passing case-1 but FAILING case-2 is NOT selected as winner", async () => {
    const repoPath = makeRepo();
    const generator = makeSingleCandidateGenerator("# Candidate\nDifferent body.\n", repoPath);
    const scorer = makeScorerByCase({ "case-1": true, "case-2": false });

    const callLog = join(repoPath, "gh-calls.txt");
    const ghPath = writeGhCallSpy(join(repoPath, "bin"), callLog);

    const result = await runOptimize({
      repoPath,
      agent: "fullstack-dev",
      k: 1,
      budgetUsd: 1,
      failingTrials: [],
      generator,
      scorer,
      cases: CASES,
      artifactOnly: false,
      ghPath
    });

    expect(result).not.toBeNull();
    if (!result) return;

    // Two trials were produced (one per case) for the same candidate.
    expect(result.trials).toHaveLength(2);
    // The gate must block promotion even though the case-1 trial can be
    // rank 1 in the global Pareto — the SAME candidate fails case-2.
    expect(result.no_winner).toBe(true);
    // `winner` stays populated as a diagnostic (SLICE-105 pattern) — it is
    // `no_winner` that gates promotion, not `winner !== null`.
    expect(result.winner).not.toBeNull();
    // Auto-PR must never fire for a candidate that fails the all-case gate.
    expect(result.auto_pr).toBeUndefined();
    expect(existsSync(callLog)).toBe(false);
  });

  test("candidate passing EVERY eval case IS selected as winner", async () => {
    const repoPath = makeRepo();
    const generator = makeSingleCandidateGenerator("# Candidate\nDifferent body.\n", repoPath);
    const scorer = makeScorerByCase({ "case-1": true, "case-2": true });

    const result = await runOptimize({
      repoPath,
      agent: "fullstack-dev",
      k: 1,
      budgetUsd: 1,
      failingTrials: [],
      generator,
      scorer,
      cases: CASES,
      // artifactOnly stays default(true) here — this test asserts the
      // determineWinner outcome, not the auto-PR side effect.
      artifactOnly: true
    });

    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.trials).toHaveLength(2);
    expect(result.no_winner).toBe(false);
    expect(result.winner).not.toBeNull();
    // winner.candidate_id is actually the winning TRIAL's id downstream
    // (auto-pr.ts / auto-merge-gate.ts both read it as `trialId` /
    // `trial_id` — pre-existing naming, not introduced by this slice).
    // Identify the winning candidate via prompt_path instead.
    expect(result.winner?.prompt_path).toBe(join(repoPath, "candidate-cand-1.md"));
  });

  test("ADVERSARIAL: rank-1 candidate fails a case; the search finds a lower-ranked, fully-passing candidate as winner", async () => {
    // This is the regression test for the review HIGH finding: the gate must
    // SEARCH `ranked`, not just gate-check `rank1[0]`. cand-fail's case-1
    // trial is deliberately built to Pareto-DOMINATE every cand-pass trial
    // (higher score, lower cost, lower latency) so it lands at rank 1 —
    // exactly the AC-3 shape, where a real fix can raise cost/latency and
    // rank below a candidate that only "won" by failing to be evaluated on
    // every case. A naive `rank1[0]` pick returns no_winner:true here even
    // though cand-pass is a fully valid winner.
    const repoPath = makeRepo();
    const failPath = join(repoPath, "candidate-fail.md");
    const passPath = join(repoPath, "candidate-pass.md");

    const generator: CandidateGenerator = {
      async generate() {
        writeFileSync(failPath, "# Fails one case\nWins case-1 big, bombs case-2.\n", "utf8");
        writeFileSync(passPath, "# Passes every case\nModest but consistent scores.\n", "utf8");
        const failCandidate: Candidate = {
          id: "cand-fail",
          agent: "fullstack-dev",
          prompt_path: failPath,
          prompt_hash: "hash-fail",
          prompt_size_lines: 2,
          derived_from_trials: [],
          generator_cost_usd: 0,
          created_at: new Date().toISOString()
        };
        const passCandidate: Candidate = {
          id: "cand-pass",
          agent: "fullstack-dev",
          prompt_path: passPath,
          prompt_hash: "hash-pass",
          prompt_size_lines: 2,
          derived_from_trials: [],
          generator_cost_usd: 0,
          created_at: new Date().toISOString()
        };
        return [failCandidate, passCandidate];
      }
    };

    // cand-fail: case-1 is excellent (score 0.99, cheap, fast) — dominates
    // every cand-pass trial — but case-2 fails outright (score 0.1).
    // cand-pass: modest but consistent (score 0.5, pricier, slower) on both
    // cases — never rank 1, but the only candidate passing every case.
    const scorer: Scorer = {
      async score(agentRun, evalCase) {
        const isFail = agentRun.candidate_prompt_path.includes("candidate-fail");
        if (isFail) {
          const pass = evalCase.id === "case-1";
          return {
            pass,
            score: pass ? 0.99 : 0.1,
            cost_usd: 0.001,
            latency_ms: 100,
            rationale: pass ? "case-1: excellent" : "case-2: bombed"
          };
        }
        return {
          pass: true,
          score: 0.5,
          cost_usd: 0.01,
          latency_ms: 200,
          rationale: `${evalCase.id}: passed`
        };
      }
    };

    const result = await runOptimize({
      repoPath,
      agent: "fullstack-dev",
      k: 2,
      budgetUsd: 1,
      failingTrials: [],
      generator,
      scorer,
      cases: CASES,
      // artifactOnly stays true — this test isolates determineWinner's
      // search behavior via runOptimize's public surface, not the auto-PR
      // git/gh subprocess path (covered separately by the SLICE-105 guard).
      artifactOnly: true
    });

    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.trials).toHaveLength(4);
    // Sanity check that this scenario IS adversarial: cand-fail's case-1
    // trial really is the sole global rank-1 (a naive `rank1[0]` pick would
    // land on it).
    const rank1Trials = result.trials.filter((t) => t.pareto_rank === 1);
    expect(rank1Trials).toHaveLength(1);
    expect(rank1Trials[0]?.candidate_prompt_hash).toBe("hash-fail");

    // The search must skip the ineligible rank-1 candidate and select the
    // lower-ranked, fully-passing candidate instead.
    expect(result.no_winner).toBe(false);
    expect(result.winner).not.toBeNull();
    expect(result.winner?.prompt_path).toBe(passPath);
  });
});
