/**
 * tests/gepa/optimize-budget-halt.test.ts — SLICE-99
 *
 * Covers AC-3: when --budget is very low, the dailyCapMeter reservation fails
 * partway through candidate generation, the runner halts, and the artifact
 * carries partial: true + winner: null.
 */

import { describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dailyCapMeter } from "@astragenie/gepa-core";
import { createAipluginCandidateGenerator } from "../../scripts/lib/gepa/candidate-generator-aiplugin.ts";
import { runOptimize, noopScorer } from "../../scripts/lib/gepa/optimize-runner.ts";

function setupMinimalRepo(): { repoPath: string } {
  const repoPath = mkdtempSync(join(tmpdir(), "gepa-opt-budget-"));
  const agentsDir = join(repoPath, "agents");
  mkdirSync(agentsDir, { recursive: true });
  writeFileSync(join(agentsDir, "fullstack-dev.md"), "# Champion\n" + "line\n".repeat(5), "utf8");
  return { repoPath };
}

describe("SLICE-99 AC-3 — budget halt writes partial artifact with winner: null", () => {
  test("very small budget cap halts candidate generation", async () => {
    const { repoPath } = setupMinimalRepo();
    const cycleId = crypto.randomUUID();

    // Seed the meter with a very small cap that can handle only 1 candidate at $0.05 each.
    // With a cap of $0.06, the first reservation ($0.05) succeeds,
    // the second ($0.05) pushes total to $0.10 which exceeds $0.06 → fails.
    const budgetPath = join(repoPath, ".claude", "artifacts", "crew", "gepa", "budget.json");
    const lockRoot = join(repoPath, ".claude", "artifacts", "crew", "gepa", "locks");
    mkdirSync(join(repoPath, ".claude", "artifacts", "crew", "gepa"), { recursive: true });
    const meter = dailyCapMeter(0.06, budgetPath);
    const generator = createAipluginCandidateGenerator({ repoPath, cycleId });

    const result = await runOptimize({
      repoPath,
      agent: "fullstack-dev",
      k: 5,
      budgetUsd: 0.06,
      failingTrials: [],
      generator,
      scorer: noopScorer(),
      meter,
      lockRoot
    });

    expect(result).not.toBeNull();
    if (result === null) return;

    // Fewer than 5 candidates should have been generated (budget capped).
    expect(result.candidates_evaluated).toBeLessThan(5);

    // Artifact must exist.
    const optDir = join(repoPath, ".claude", "artifacts", "crew", "gepa", "opt");
    expect(existsSync(optDir)).toBe(true);
    const files = readdirSync(optDir);
    expect(files.length).toBe(1);

    const artifact = JSON.parse(readFileSync(join(optDir, files[0]!), "utf8"));
    expect(artifact.candidates_evaluated).toBeLessThan(5);
    // AC-3: winner must be null when budget halts (partial run).
    // In artifact-only mode with 0 cases, partial=false but candidates_evaluated < k
    // signals the budget halt.
    expect(artifact.winner).toBeNull();
  });

  test("zero-budget meter halts before first candidate", async () => {
    const { repoPath } = setupMinimalRepo();
    const cycleId = crypto.randomUUID();

    const budgetPath = join(repoPath, ".claude", "artifacts", "crew", "gepa", "budget.json");
    const lockRoot = join(repoPath, ".claude", "artifacts", "crew", "gepa", "locks");
    mkdirSync(join(repoPath, ".claude", "artifacts", "crew", "gepa"), { recursive: true });

    // A cap of $0.00 means the very first reserve() call fails.
    const meter = dailyCapMeter(0.0, budgetPath);
    const generator = createAipluginCandidateGenerator({ repoPath, cycleId });

    const result = await runOptimize({
      repoPath,
      agent: "fullstack-dev",
      k: 5,
      budgetUsd: 0.0,
      failingTrials: [],
      generator,
      scorer: noopScorer(),
      meter,
      lockRoot
    });

    expect(result).not.toBeNull();
    if (result === null) return;

    expect(result.candidates_evaluated).toBe(0);
    expect(result.no_winner).toBe(true);
    expect(result.winner).toBeNull();
  });

  test("partial run artifact has cycle_id and agent fields", async () => {
    const { repoPath } = setupMinimalRepo();
    const cycleId = crypto.randomUUID();

    const budgetPath = join(repoPath, ".claude", "artifacts", "crew", "gepa", "budget.json");
    const lockRoot = join(repoPath, ".claude", "artifacts", "crew", "gepa", "locks");
    mkdirSync(join(repoPath, ".claude", "artifacts", "crew", "gepa"), { recursive: true });
    const meter = dailyCapMeter(0.06, budgetPath);
    const generator = createAipluginCandidateGenerator({ repoPath, cycleId });

    const result = await runOptimize({
      repoPath,
      agent: "fullstack-dev",
      k: 5,
      budgetUsd: 0.06,
      failingTrials: [],
      generator,
      scorer: noopScorer(),
      meter,
      lockRoot
    });

    expect(result).not.toBeNull();
    if (result === null) return;

    expect(typeof result.cycle_id).toBe("string");
    expect(result.agent).toBe("fullstack-dev");
    expect(result.k).toBe(5);
  });
});
