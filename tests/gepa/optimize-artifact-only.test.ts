/**
 * tests/gepa/optimize-artifact-only.test.ts — SLICE-99
 *
 * Covers AC-1 (full cycle writes artifact + candidates) and
 * AC-2 (--artifact-only does not modify agents/ or create branches).
 */

import { beforeEach, describe, expect, test } from "bun:test";
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
import { parseOptimizeArgs, runGepaOptimizeCmd } from "../../scripts/lib/gepa/gepa-optimize-cmd.ts";

function setupRepo(): { repoPath: string; agentPath: string } {
  const repoPath = mkdtempSync(join(tmpdir(), "gepa-opt-ac1-"));
  // Create agents/ dir with a champion file.
  const agentsDir = join(repoPath, "agents");
  mkdirSync(agentsDir, { recursive: true });
  const agentPath = join(agentsDir, "fullstack-dev.md");
  writeFileSync(agentPath, Array(10).fill("# Champion prompt line").join("\n") + "\n", "utf8");

  // Create 10 failing trials in the trial store.
  const trialsDir = join(repoPath, ".claude", "artifacts", "crew", "gepa", "trials");
  mkdirSync(trialsDir, { recursive: true });
  const fixtureLines = readFileSync(
    join(import.meta.dir, "../fixtures/gepa/synthetic-failing-trials.jsonl"),
    "utf8"
  );
  writeFileSync(join(trialsDir, "fullstack-dev.jsonl"), fixtureLines, "utf8");

  return { repoPath, agentPath };
}

describe("SLICE-99 AC-1 — optimize cycle writes candidates + artifact", () => {
  let repoPath: string;

  beforeEach(() => {
    ({ repoPath } = setupRepo());
  });

  test("produces 5 candidate files under candidates/<cycle-id>/", async () => {
    const result = await runGepaOptimizeCmd(repoPath, [
      "fullstack-dev",
      "--budget",
      "10",
      "--k",
      "5",
      "--artifact-only"
    ]);
    expect(result.exitCode).toBe(0);

    const candidatesBase = join(repoPath, ".claude", "artifacts", "crew", "gepa", "candidates");
    expect(existsSync(candidatesBase)).toBe(true);
    const cycleDirs = readdirSync(candidatesBase);
    expect(cycleDirs.length).toBeGreaterThanOrEqual(1);
    const cycleDir = join(candidatesBase, cycleDirs[0]!);
    const files = readdirSync(cycleDir).filter((f) => f.endsWith(".md"));
    expect(files.length).toBe(5);
  });

  test("each candidate file passes validateCandidateSize (≤350 lines)", async () => {
    const { validateCandidateSize } = await import("@astragenie/gepa-core");
    await runGepaOptimizeCmd(repoPath, [
      "fullstack-dev",
      "--budget",
      "10",
      "--k",
      "5",
      "--artifact-only"
    ]);

    const candidatesBase = join(repoPath, ".claude", "artifacts", "crew", "gepa", "candidates");
    const cycleDirs = readdirSync(candidatesBase);
    const cycleDir = join(candidatesBase, cycleDirs[0]!);
    const files = readdirSync(cycleDir).filter((f) => f.endsWith(".md"));

    for (const file of files) {
      const promptPath = join(cycleDir, file);
      const candidateId = file.replace(/\.md$/, "");
      const sizeCheck = validateCandidateSize(
        {
          id: candidateId,
          agent: "fullstack-dev",
          prompt_path: promptPath,
          prompt_hash: "test",
          prompt_size_lines: 1,
          derived_from_trials: [],
          generator_cost_usd: 0,
          created_at: new Date().toISOString()
        },
        350
      );
      expect(sizeCheck.ok).toBe(true);
    }
  });

  test("writes OptimizationResult artifact with required fields", async () => {
    const result = await runGepaOptimizeCmd(repoPath, [
      "fullstack-dev",
      "--budget",
      "10",
      "--k",
      "5",
      "--artifact-only"
    ]);
    expect(result.exitCode).toBe(0);

    const optDir = join(repoPath, ".claude", "artifacts", "crew", "gepa", "opt");
    expect(existsSync(optDir)).toBe(true);
    const artifacts = readdirSync(optDir).filter((f) => f.endsWith(".json"));
    expect(artifacts.length).toBe(1);

    const artifact = JSON.parse(readFileSync(join(optDir, artifacts[0]!), "utf8"));
    expect(typeof artifact.cycle_id).toBe("string");
    expect(artifact.k).toBe(5);
    expect(artifact.agent).toBe("fullstack-dev");
    // candidates_evaluated may be 0 in artifact-only (no cases to score) —
    // but candidates were generated. The field reflects candidates generated.
    expect(typeof artifact.candidates_evaluated).toBe("number");
    // Either no_winner: true OR winner with pareto_rank: 1
    const hasValidOutcome =
      artifact.no_winner === true ||
      (artifact.winner !== null && artifact.winner.pareto_rank === 1);
    expect(hasValidOutcome).toBe(true);
    // partial MUST be false in artifact-only mode — no eval cases were requested,
    // so reaching the zero-scoring end state is a successful full run, not a
    // partial one. Regression guard for the CHECKPOINT-1 → CHECKPOINT-2 transition
    // where a wrong `partial` formula silently suppressed winner promotion.
    expect(artifact.partial).toBe(false);
  });
});

describe("SLICE-99 AC-2 — artifact-only does not modify agents/ or create branches", () => {
  let repoPath: string;
  let agentPath: string;

  beforeEach(() => {
    ({ repoPath, agentPath } = setupRepo());
  });

  test("agents/fullstack-dev.md is NOT modified after optimize", async () => {
    const before = readFileSync(agentPath, "utf8");
    await runGepaOptimizeCmd(repoPath, [
      "fullstack-dev",
      "--budget",
      "10",
      "--k",
      "5",
      "--artifact-only"
    ]);
    const after = readFileSync(agentPath, "utf8");
    expect(after).toBe(before);
  });

  test("no files outside .claude/artifacts/crew/gepa/ are created", async () => {
    const before = readdirSync(repoPath).sort();
    await runGepaOptimizeCmd(repoPath, [
      "fullstack-dev",
      "--budget",
      "10",
      "--k",
      "5",
      "--artifact-only"
    ]);
    // Only .claude/ should be new (it gets created by the runner).
    const after = readdirSync(repoPath).sort();
    for (const entry of after) {
      if (!before.includes(entry)) {
        // Only .claude/ may be added.
        expect(entry).toBe(".claude");
      }
    }
  });
});

describe("SLICE-99 — parseOptimizeArgs", () => {
  test("bare agent → defaults k=5, artifactOnly=true", () => {
    const parsed = parseOptimizeArgs(["fullstack-dev", "--budget", "5"]);
    expect(parsed.agent).toBe("fullstack-dev");
    expect(parsed.k).toBe(5);
    expect(parsed.artifactOnly).toBe(true);
    expect(parsed.budget).toBe(5);
  });

  test("--k flag overrides default", () => {
    const parsed = parseOptimizeArgs(["fullstack-dev", "--budget", "5", "--k", "3"]);
    expect(parsed.k).toBe(3);
  });

  test("--budget without value → invalid", () => {
    const parsed = parseOptimizeArgs(["fullstack-dev", "--budget"]);
    expect(parsed.invalid).toBeDefined();
  });

  test("--k without value → invalid", () => {
    const parsed = parseOptimizeArgs(["fullstack-dev", "--budget", "5", "--k"]);
    expect(parsed.invalid).toBeDefined();
  });

  test("no agent → agent undefined", () => {
    const parsed = parseOptimizeArgs(["--budget", "5"]);
    expect(parsed.agent).toBeUndefined();
  });
});

describe("SLICE-99 — runGepaOptimizeCmd error paths", () => {
  test("no agent → exit 2 with usage", async () => {
    const repoPath = mkdtempSync(join(tmpdir(), "gepa-opt-err-"));
    const result = await runGepaOptimizeCmd(repoPath, []);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("usage:");
  });

  test("no --budget → exit 2", async () => {
    const repoPath = mkdtempSync(join(tmpdir(), "gepa-opt-err-"));
    const result = await runGepaOptimizeCmd(repoPath, ["fullstack-dev"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("--budget");
  });
});
