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

  test("two candidates: one all-pass, one partial-pass -> the all-pass candidate wins", async () => {
    const repoPath = makeRepo();
    const generator: CandidateGenerator = {
      async generate() {
        const goodPath = join(repoPath, "candidate-good.md");
        const badPath = join(repoPath, "candidate-partial.md");
        writeFileSync(goodPath, "# Good candidate\nPasses everything.\n", "utf8");
        writeFileSync(badPath, "# Partial candidate\nPasses only one case.\n", "utf8");
        const good: Candidate = {
          id: "cand-good",
          agent: "fullstack-dev",
          prompt_path: goodPath,
          prompt_hash: "hash-good",
          prompt_size_lines: 2,
          derived_from_trials: [],
          generator_cost_usd: 0,
          created_at: new Date().toISOString()
        };
        const partial: Candidate = {
          id: "cand-partial",
          agent: "fullstack-dev",
          prompt_path: badPath,
          prompt_hash: "hash-partial",
          prompt_size_lines: 2,
          derived_from_trials: [],
          generator_cost_usd: 0,
          created_at: new Date().toISOString()
        };
        return [good, partial];
      }
    };

    // Scorer: "hash-good" passes both cases; "hash-partial" passes only case-1.
    const scorer: Scorer = {
      async score(agentRun, evalCase) {
        const isGood = agentRun.candidate_prompt_path.includes("candidate-good");
        const pass = isGood || evalCase.id === "case-1";
        return {
          pass,
          score: isGood ? 0.95 : 0.9,
          cost_usd: 0.001,
          latency_ms: 100,
          rationale: "scored"
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
      artifactOnly: true
    });

    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.trials).toHaveLength(4);
    expect(result.no_winner).toBe(false);
    expect(result.winner).not.toBeNull();
    // The partial candidate fails the all-case gate even though its
    // case-1 trial alone might otherwise be competitive; only the
    // all-pass candidate can win.
    expect(result.winner?.prompt_path).toBe(join(repoPath, "candidate-good.md"));
  });
});
