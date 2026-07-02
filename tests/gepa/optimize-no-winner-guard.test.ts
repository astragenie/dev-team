/**
 * tests/gepa/optimize-no-winner-guard.test.ts — SLICE-105 regression guard
 *
 * Covers the HIGH inspector finding on PR #147:
 *
 *   `determineWinner` can return { winner: <non-null object>, noWinner: true }
 *   when the top rank-1 candidate has `pass=false` (dominated on other axes but
 *   never actually passed the eval). The auto-PR guard MUST refuse to fire in
 *   that case — opening a promotion PR for a failing candidate would silently
 *   ship a regression.
 *
 * This test invokes runOptimize with artifactOnly=false, a generator that
 * returns one candidate, and a scorer that always returns pass=false. It then
 * asserts:
 *   - result.winner is non-null (rank-1 exists),
 *   - result.no_winner === true (because pass=false),
 *   - result.auto_pr is undefined (auto-PR guard blocked the flow).
 */

import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Candidate, CandidateGenerator, Scorer } from "@astragenie/gepa-core";
import { runOptimize } from "../../scripts/lib/gepa/optimize-runner.ts";

function makeRepo(): string {
  const repoPath = mkdtempSync(join(tmpdir(), "opt-no-winner-guard-"));
  const agentsDir = join(repoPath, "agents");
  mkdirSync(agentsDir, { recursive: true });
  writeFileSync(join(agentsDir, "fullstack-dev.md"), "# Champion\nBody.\n", "utf8");
  return repoPath;
}

function makeGenerator(candidateBody: string, dir: string): CandidateGenerator {
  return {
    async generate(_championPath, _failingTrials, _k) {
      // Write candidate body to a real file — sequentialRunner.runCandidates
      // calls validateCandidateSize which reads the file at prompt_path.
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

function makeAlwaysFailScorer(): Scorer {
  return {
    async score() {
      return {
        pass: false,
        score: 0.4,
        cost_usd: 0.001,
        latency_ms: 100,
        rationale: "always-fail scorer for guard test"
      };
    }
  };
}

// Write a `gh` shim that records every call to a log file. If the guard
// blocks tryAutoPr correctly, this file must not exist after runOptimize
// completes (nothing tried to invoke gh). If the guard is broken, runAutoPr
// fires and calls `gh auth status` first — the log file appears.
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

describe("runOptimize — SLICE-105 no_winner guard", () => {
  test("winner exists BUT pass=false + artifactOnly=false → auto-PR is NOT called", async () => {
    const repoPath = makeRepo();
    const generator = makeGenerator("# Candidate\nDifferent body.\n", repoPath);
    const scorer = makeAlwaysFailScorer();

    // Provide one eval case so scoring runs and Pareto rank fires.
    const cases = [{ id: "case-1", held_out: false, input: "prompt", expected_output: "output" }];

    // Install a gh spy — if the guard breaks, runAutoPr fires and
    // `gh auth status` is the first side effect. The spy records to callLog;
    // its absence proves the guard held.
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
      cases,
      artifactOnly: false,
      ghPath
    });

    expect(result).not.toBeNull();
    if (!result) return;
    // Rank-1 winner exists (only candidate scored, so it's non-dominated).
    expect(result.winner).not.toBeNull();
    // But because pass=false, no_winner must still be true.
    expect(result.no_winner).toBe(true);
    // auto_pr must remain undefined — the guard held.
    expect(result.auto_pr).toBeUndefined();
    // Strongest assertion: gh was never even invoked. If tryAutoPr had fired,
    // `checkGhAuth` would have run `gh auth status` first and the spy log
    // would exist.
    expect(existsSync(callLog)).toBe(false);
  });
});
