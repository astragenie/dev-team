/**
 * tests/gepa/generator-mode-honesty.test.ts — W5 honesty pass
 * (astragenie/runner-plugin#525 §4.3).
 *
 * Candidate generation defaults to deterministic string mutation (no LLM
 * call, no reflective rewrite) unless `GEPA_LIVE_GENERATOR=1`. That default
 * was silent: nothing in the run's console output or its artifact told an
 * operator which mode a given cycle actually used. This covers the fix:
 *   - `runOptimize` prints a loud one-line synthetic-mode warning naming the
 *     env var, at run start, whenever GEPA_LIVE_GENERATOR is not "1".
 *   - No warning is printed when GEPA_LIVE_GENERATOR=1.
 *   - `OptimizationResult.generator_mode` records which mode the run used,
 *     so history (the opt artifact) shows it after the fact — not just a
 *     transient env-var side effect.
 *   - The default (synthetic-unless-opted-in) itself is UNCHANGED by this
 *     pass; these tests do not toggle that default, only its visibility.
 */

import { describe, expect, test, afterEach, beforeEach } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Candidate, CandidateGenerator, Scorer } from "@astragenie/gepa-core";
import { runOptimize } from "../../scripts/lib/gepa/optimize-runner.ts";

const ORIGINAL_FLAG = process.env["GEPA_LIVE_GENERATOR"];

afterEach(() => {
  if (ORIGINAL_FLAG === undefined) delete process.env["GEPA_LIVE_GENERATOR"];
  else process.env["GEPA_LIVE_GENERATOR"] = ORIGINAL_FLAG;
});

function makeRepo(): string {
  const repoPath = mkdtempSync(join(tmpdir(), "opt-generator-mode-"));
  const agentsDir = join(repoPath, "agents");
  mkdirSync(agentsDir, { recursive: true });
  writeFileSync(join(agentsDir, "fullstack-dev.md"), "# Champion\nBody.\n", "utf8");
  return repoPath;
}

function makeNoopGenerator(): CandidateGenerator {
  return {
    async generate(): Promise<Candidate[]> {
      return [];
    }
  };
}

function makeNoopScorer(): Scorer {
  return {
    async score() {
      return { pass: false, score: 0, cost_usd: 0, latency_ms: 0, rationale: "unused" };
    }
  };
}

describe("runOptimize — generator_mode honesty", () => {
  let repoPath: string;
  let warnSpy: string[];
  let originalWarn: typeof console.warn;

  beforeEach(() => {
    repoPath = makeRepo();
    warnSpy = [];
    originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnSpy.push(args.map(String).join(" "));
    };
  });

  afterEach(() => {
    console.warn = originalWarn;
  });

  test("GEPA_LIVE_GENERATOR unset → generator_mode 'synthetic' + loud warning naming the env var", async () => {
    delete process.env["GEPA_LIVE_GENERATOR"];

    const result = await runOptimize({
      repoPath,
      agent: "fullstack-dev",
      k: 1,
      budgetUsd: 1,
      failingTrials: [],
      generator: makeNoopGenerator(),
      scorer: makeNoopScorer(),
      artifactOnly: true
    });

    expect(result).not.toBeNull();
    expect(result?.generator_mode).toBe("synthetic");

    const warned = warnSpy.some(
      (line) => line.includes("SYNTHETIC") && line.includes("GEPA_LIVE_GENERATOR")
    );
    expect(warned).toBe(true);
  });

  test('GEPA_LIVE_GENERATOR="0" → generator_mode "synthetic" + warning', async () => {
    process.env["GEPA_LIVE_GENERATOR"] = "0";

    const result = await runOptimize({
      repoPath,
      agent: "fullstack-dev",
      k: 1,
      budgetUsd: 1,
      failingTrials: [],
      generator: makeNoopGenerator(),
      scorer: makeNoopScorer(),
      artifactOnly: true
    });

    expect(result?.generator_mode).toBe("synthetic");
    expect(warnSpy.some((line) => line.includes("SYNTHETIC"))).toBe(true);
  });

  test('GEPA_LIVE_GENERATOR="1" → generator_mode "live" + no synthetic warning', async () => {
    process.env["GEPA_LIVE_GENERATOR"] = "1";

    const result = await runOptimize({
      repoPath,
      agent: "fullstack-dev",
      k: 1,
      budgetUsd: 1,
      failingTrials: [],
      generator: makeNoopGenerator(),
      scorer: makeNoopScorer(),
      artifactOnly: true
    });

    expect(result?.generator_mode).toBe("live");
    expect(warnSpy.some((line) => line.includes("SYNTHETIC"))).toBe(false);
  });

  test("generator_mode is persisted in the written opt artifact", async () => {
    delete process.env["GEPA_LIVE_GENERATOR"];

    const result = await runOptimize({
      repoPath,
      agent: "fullstack-dev",
      k: 1,
      budgetUsd: 1,
      failingTrials: [],
      generator: makeNoopGenerator(),
      scorer: makeNoopScorer(),
      artifactOnly: true
    });
    expect(result).not.toBeNull();
    if (!result) return;

    const artifactPath = join(
      repoPath,
      ".claude",
      "artifacts",
      "crew",
      "gepa",
      "opt",
      `${result.run_id}.json`
    );
    const written = JSON.parse(readFileSync(artifactPath, "utf8"));
    expect(written.generator_mode).toBe("synthetic");
  });
});
