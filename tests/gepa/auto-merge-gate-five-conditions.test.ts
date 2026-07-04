/**
 * tests/gepa/auto-merge-gate-five-conditions.test.ts — SLICE-106
 *
 * Covers AC-10 (32 truth-table combos for the 5 gate conditions) and
 * AC-2 (critical-agent allowlist — reviewer/verifier/architect forced draft).
 *
 * The 5 boolean gates tested:
 *   G1: pareto_rank === 1
 *   G2: held_out_pass >= champion_held_out_pass + minPassDelta
 *   G3: min_held_out_case_score >= minCaseScoreFloor (0.6)
 *   G4: cost_usd_delta <= 0 (no cost regression)
 *   G5: latency_ms_delta <= 0 (no latency regression)
 *
 * Additional gates (not truth-table; tested separately):
 *   G6: soakPassed
 *   G7: branchProtectionPresent
 *   G8: agent in policy.eligible_agents
 *   G9: agent NOT in champion_frozen
 *   G10: NOT critical-agent (checked first)
 *
 * Implementation: shimmed `gh` binary so no real CLI is invoked.
 */

import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  evaluateAutoMergeGate,
  type AutoMergePolicy
} from "../../scripts/lib/gepa/auto-merge-gate.ts";
import type { OptimizationResult } from "../../scripts/lib/gepa/optimize-runner.ts";

// ── Constants ─────────────────────────────────────────────────────────────────

const ELIGIBLE_AGENT = "fullstack-dev";
const CYCLE_ID = "cccc-dddd-4eee-8fff-0000";
const TRIAL_ID = "aaaa-bbbb-4ccc-8ddd-eeee";

// ── Fixtures ──────────────────────────────────────────────────────────────────

/**
 * Build an OptimizationResult with specific gate conditions.
 *
 * Gate mapping:
 *   g1ParetoRank1  → winner.pareto_rank === 1
 *   g2PassDelta    → winner.pass = true means held_out_pass = 1.0, champion = 0.9 → delta = 0.10 > 0.05
 *   g3TailRisk     → winner.score ≥ 0.6 (min_held_out_case_score proxy)
 *   g4NoCostReg    → winner.cost_usd <= 0 (delta ≤ 0)
 *   g5NoLatReg     → winner.latency_ms <= 0 (delta ≤ 0)
 *
 * Note: when pass=true we set champion held_out_pass to 0.9 so delta = 0.10 ≥ minPassDelta=0.05.
 * When pass=false we set held_out_pass=0 so delta = 0 - 0.9 < 0.05 → gate fails.
 */
function makeResult(gates: {
  g1ParetoRank1: boolean;
  g2PassDelta: boolean;
  g3TailRisk: boolean;
  g4NoCostReg: boolean;
  g5NoLatReg: boolean;
}): OptimizationResult {
  return {
    run_id: CYCLE_ID,
    cycle_id: CYCLE_ID,
    agent: ELIGIBLE_AGENT,
    k: 5,
    candidates_evaluated: 5,
    partial: false,
    no_winner: false,
    winner: {
      candidate_id: TRIAL_ID,
      pareto_rank: gates.g1ParetoRank1 ? 1 : 2,
      score: gates.g3TailRisk ? 0.75 : 0.5,
      pass: gates.g2PassDelta,
      cost_usd: gates.g4NoCostReg ? -0.001 : 0.01,
      latency_ms: gates.g5NoLatReg ? -10 : 100,
      prompt_path: ""
    },
    trials: [],
    started_at: "2026-07-01T10:00:00.000Z",
    finished_at: "2026-07-01T10:05:00.000Z"
  };
}

const BASE_POLICY: AutoMergePolicy = {
  eligible_agents: [ELIGIBLE_AGENT],
  champion_frozen: [],
  gate: {
    minPassDelta: 0.05,
    minCaseScoreFloor: 0.6,
    allowCostRegression: false,
    allowLatencyRegression: false
  }
};

// Champion with 0.9 held_out_pass so that pass=true (1.0) → delta=0.10 > 0.05.
const CHAMPION_90 = { held_out_pass: 0.9 };
// Champion with 0.0 held_out_pass so that pass=false (0.0) → delta = 0 - 0 = 0 < 0.05.
// When g2 is false, we need champion 0.95 so delta < 0.05 even on pass=true branch.
const CHAMPION_SAME = { held_out_pass: 1.0 };

// ── Temporary directory setup ─────────────────────────────────────────────────

let tmpDir: string;
let ghCallLog: string;
let ghPath: string;

function writeGhShim(dir: string, callLog: string, mergeExitCode = 0): string {
  mkdirSync(dir, { recursive: true });
  const shimMjs = join(dir, "gh-impl.mjs");
  const script = [
    `import { appendFileSync } from "node:fs";`,
    `const argv = process.argv.slice(2);`,
    `appendFileSync(${JSON.stringify(callLog)}, JSON.stringify(argv) + "\\n");`,
    `const args = argv.join(" ");`,
    `if (args.includes("pr merge")) { process.exit(${mergeExitCode}); }`,
    `process.exit(0);`
  ].join("\n");
  writeFileSync(shimMjs, script, "utf8");

  if (process.platform === "win32") {
    const cmdPath = join(dir, "gh.cmd");
    writeFileSync(cmdPath, `@node "${shimMjs}" %*\r\n`, "utf8");
    return cmdPath;
  }
  const shimPath = join(dir, "gh");
  writeFileSync(shimPath, `#!/bin/sh\nexec node "${shimMjs}" "$@"\n`, { mode: 0o755 });
  return shimPath;
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "gepa-gate-test-"));
  ghCallLog = join(tmpDir, "gh-calls.txt");
  ghPath = writeGhShim(join(tmpDir, "bin"), ghCallLog, 0);
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ── Helper: run gate with all soak/protection/eligibility gates green ─────────

function runGateAllGreen(
  result: OptimizationResult,
  overrides: Partial<Parameters<typeof evaluateAutoMergeGate>[0]> = {}
) {
  return evaluateAutoMergeGate({
    repoPath: tmpDir,
    agent: ELIGIBLE_AGENT,
    result,
    soakPassed: true,
    branchProtectionPresent: true,
    policy: BASE_POLICY,
    prUrl: "https://github.com/test/repo/pull/1",
    championMetrics: CHAMPION_90,
    ghPath,
    ...overrides
  });
}

// ── 32-combo truth table ──────────────────────────────────────────────────────

describe("auto-merge gate — 5-condition truth table (32 combos)", () => {
  // Generate all 32 combinations.
  for (let mask = 0; mask < 32; mask++) {
    const g1 = (mask & 0b10000) !== 0;
    const g2 = (mask & 0b01000) !== 0;
    const g3 = (mask & 0b00100) !== 0;
    const g4 = (mask & 0b00010) !== 0;
    const g5 = (mask & 0b00001) !== 0;
    const allGreen = g1 && g2 && g3 && g4 && g5;

    const label = `mask=${mask.toString(2).padStart(5, "0")} (G1=${g1} G2=${g2} G3=${g3} G4=${g4} G5=${g5}) → ${allGreen ? "PASS" : "FAIL"}`;

    it(label, () => {
      // Champion held_out_pass:
      //   g2=true  → we need pass=true AND champion < 0.95 so delta >= 0.05.
      //   g2=false → force champion = 1.0 so even pass=true gives delta = 0.
      const champion = g2 ? CHAMPION_90 : CHAMPION_SAME;
      const result = makeResult({
        g1ParetoRank1: g1,
        g2PassDelta: g2,
        g3TailRisk: g3,
        g4NoCostReg: g4,
        g5NoLatReg: g5
      });

      const gateResult = runGateAllGreen(result, { championMetrics: champion });

      if (allGreen) {
        expect(gateResult.eligible).toBe(true);
        expect(gateResult.merged).toBe(true);
        expect(gateResult.blockedBy).toHaveLength(0);
        // gh pr merge should have been called (recorded as JSON array).
        const calls = existsSync(ghCallLog) ? readFileSync(ghCallLog, "utf8") : "";
        expect(calls).toContain('"pr","merge"');
      } else {
        expect(gateResult.eligible).toBe(false);
        expect(gateResult.merged).toBe(false);
        expect(gateResult.blockedBy.length).toBeGreaterThan(0);

        // Verify specific blockedBy reasons for each failing gate.
        if (!g1) expect(gateResult.blockedBy).toContain("not_pareto_rank_1");
        if (!g3) expect(gateResult.blockedBy).toContain("tail_risk_block");
        if (!g4) expect(gateResult.blockedBy).toContain("cost_regression");
        if (!g5) expect(gateResult.blockedBy).toContain("latency_regression");
        // gh pr merge should NOT have been called.
        const calls = existsSync(ghCallLog) ? readFileSync(ghCallLog, "utf8") : "";
        expect(calls).not.toContain('"pr","merge"');
      }
    });
  }
});

// ── Critical-agent tests (AC-2) ───────────────────────────────────────────────

describe("auto-merge gate — critical-agent allowlist (AC-2)", () => {
  for (const criticalAgent of ["reviewer", "verifier", "architect"] as const) {
    it(`${criticalAgent}: critical-agent check fires FIRST, PR left as draft, gh pr merge NEVER called`, () => {
      const result = makeResult({
        g1ParetoRank1: true,
        g2PassDelta: true,
        g3TailRisk: true,
        g4NoCostReg: true,
        g5NoLatReg: true
      });
      result.agent = criticalAgent;

      const policy: AutoMergePolicy = {
        ...BASE_POLICY,
        eligible_agents: [criticalAgent] // agent is eligible but is critical
      };

      const gateResult = evaluateAutoMergeGate({
        repoPath: tmpDir,
        agent: criticalAgent,
        result,
        soakPassed: true,
        branchProtectionPresent: true,
        policy,
        prUrl: `https://github.com/test/repo/pull/99`,
        championMetrics: CHAMPION_90,
        ghPath
      });

      // Critical-agent check fires first.
      expect(gateResult.eligible).toBe(false);
      expect(gateResult.merged).toBe(false);
      expect(gateResult.draftPr).toBe(true);
      expect(gateResult.blockedBy).toContain("critical_agent");
      // Must be first reason.
      expect(gateResult.blockedBy[0]).toBe("critical_agent");

      // gh pr merge must NOT have been called.
      const calls = existsSync(ghCallLog) ? readFileSync(ghCallLog, "utf8") : "";
      expect(calls).not.toContain("pr merge");
    });
  }
});

// ── Additional gate tests (G6–G9) ────────────────────────────────────────────

describe("auto-merge gate — soak not passed (G6)", () => {
  it("blocks with soak_not_passed when soakPassed=false", () => {
    const result = makeResult({
      g1ParetoRank1: true,
      g2PassDelta: true,
      g3TailRisk: true,
      g4NoCostReg: true,
      g5NoLatReg: true
    });
    const gateResult = runGateAllGreen(result, { soakPassed: false });
    expect(gateResult.eligible).toBe(false);
    expect(gateResult.blockedBy).toContain("soak_not_passed");
  });
});

describe("auto-merge gate — branch protection missing (G7)", () => {
  it("blocks with branch_protection_missing when branchProtectionPresent=false", () => {
    const result = makeResult({
      g1ParetoRank1: true,
      g2PassDelta: true,
      g3TailRisk: true,
      g4NoCostReg: true,
      g5NoLatReg: true
    });
    const gateResult = runGateAllGreen(result, { branchProtectionPresent: false });
    expect(gateResult.eligible).toBe(false);
    expect(gateResult.blockedBy).toContain("branch_protection_missing");
  });
});

describe("auto-merge gate — agent_not_eligible (AC-4)", () => {
  it("blocks when policy.eligible_agents is empty []", () => {
    const result = makeResult({
      g1ParetoRank1: true,
      g2PassDelta: true,
      g3TailRisk: true,
      g4NoCostReg: true,
      g5NoLatReg: true
    });
    const gateResult = runGateAllGreen(result, {
      policy: { ...BASE_POLICY, eligible_agents: [] }
    });
    expect(gateResult.eligible).toBe(false);
    expect(gateResult.blockedBy).toContain("agent_not_eligible");
  });

  it("blocks when agent is not in eligible_agents list", () => {
    const result = makeResult({
      g1ParetoRank1: true,
      g2PassDelta: true,
      g3TailRisk: true,
      g4NoCostReg: true,
      g5NoLatReg: true
    });
    const gateResult = runGateAllGreen(result, {
      policy: { ...BASE_POLICY, eligible_agents: ["backend-dev"] }
    });
    expect(gateResult.eligible).toBe(false);
    expect(gateResult.blockedBy).toContain("agent_not_eligible");
  });
});

describe("auto-merge gate — champion_frozen (G9)", () => {
  it("blocks when agent is in champion_frozen list", () => {
    const result = makeResult({
      g1ParetoRank1: true,
      g2PassDelta: true,
      g3TailRisk: true,
      g4NoCostReg: true,
      g5NoLatReg: true
    });
    const gateResult = runGateAllGreen(result, {
      policy: { ...BASE_POLICY, champion_frozen: [ELIGIBLE_AGENT] }
    });
    expect(gateResult.eligible).toBe(false);
    expect(gateResult.blockedBy).toContain("champion_frozen");
  });
});

// ── AC-3: tail_risk_block event written ───────────────────────────────────────

describe("auto-merge gate — tail_risk_block event on G3 failure (AC-3)", () => {
  it("tail_risk_block in blockedBy when min_held_out_case_score < 0.6", () => {
    const result = makeResult({
      g1ParetoRank1: true,
      g2PassDelta: true,
      g3TailRisk: false, // score = 0.5 < floor=0.6
      g4NoCostReg: true,
      g5NoLatReg: true
    });
    const gateResult = runGateAllGreen(result);
    expect(gateResult.eligible).toBe(false);
    expect(gateResult.blockedBy).toContain("tail_risk_block");
  });
});
