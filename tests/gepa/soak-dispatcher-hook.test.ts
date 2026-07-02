/**
 * tests/gepa/soak-dispatcher-hook.test.ts — SLICE-104 (FEAT-183 S7)
 *
 * Unit tests for evaluateSoakHook() — I/O boundary paths.
 *
 * Coverage (all paths that don't require the soak verdict to be "passed"):
 *   - no_soak: soak.json absent → falls back to main champion
 *   - no_soak: agent not in soak.json → falls back to main champion
 *   - no_soak: malformed soak.json → readSoakMap returns null → no_soak
 *   - soak_skip: random() >= soakPercent → use main champion (AC-10)
 *   - soak_use:  random() < soakPercent → use soak champion path (AC-10)
 *   - early_revert: 0.50 vs 0.80 pass rate → gepa_soak_revert_early (AC-4)
 *
 * Verdict "passed" (soak_promoted) and "reverted" (insufficient_traffic)
 * are pure algorithm paths fully covered by
 * gepa-core/tests/algorithms/soak-monitor.test.ts. The integration paths
 * in dev-team will be added after operator publishes gepa-core 0.6.0.
 *
 * Note: requires gepa-core 0.6.0 exports at runtime (evaluateSoak).
 * These tests will fail with ImportError until the operator publishes 0.6.0
 * and removes the package.json overrides block.
 */

import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evaluateSoakHook } from "../../scripts/lib/gepa/soak-dispatcher-hook.ts";

// ── Helpers ────────────────────────────────────────────────────────────────────

// Mirror of SoakPolicy from gepa-core 0.6.0 (avoiding the import until publish)
const BASE_POLICY = {
  soakDays: 7,
  minSoakTrials: 20,
  maxSoakDays: 21,
  soakEpsilon: 0.02,
  soakPercent: 0.1,
  eligibleAgents: [] as string[],
  minPassDelta: 0.05,
  minCaseScoreFloor: 0.6,
  allowCostRegression: false,
  allowLatencyRegression: false
};

function makeTmpRepo(): string {
  return mkdtempSync(join(tmpdir(), "soak-hook-test-"));
}

function writeSoakJson(repoRoot: string, content: unknown): void {
  const dir = join(repoRoot, ".claude", "artifacts", "crew", "gepa");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "soak.json"), JSON.stringify(content), "utf8");
}

function writeMalformedSoakJson(repoRoot: string): void {
  const dir = join(repoRoot, ".claude", "artifacts", "crew", "gepa");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "soak.json"), "{ not valid json", "utf8");
}

// ── no_soak paths ─────────────────────────────────────────────────────────────

describe("evaluateSoakHook — no_soak paths", () => {
  it("soak.json absent → status: no_soak", () => {
    const repoRoot = makeTmpRepo();
    try {
      const result = evaluateSoakHook({
        repoRoot,
        agent: "fullstack-dev",
        policy: BASE_POLICY,
        nowIso: "2026-07-01T12:00:00.000Z",
        randomValue: 0.05
      });
      expect(result.status).toBe("no_soak");
      expect(result.events).toHaveLength(0);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("agent not in soak.json → status: no_soak", () => {
    const repoRoot = makeTmpRepo();
    try {
      writeSoakJson(repoRoot, {
        "other-agent": {
          agent: "other-agent",
          started_at: "2026-07-01T00:00:00.000Z",
          champion_path: "/tmp/prompt.md",
          trials: [],
          main_pass_rate: 0.8
        }
      });
      const result = evaluateSoakHook({
        repoRoot,
        agent: "fullstack-dev",
        policy: BASE_POLICY,
        nowIso: "2026-07-01T12:00:00.000Z",
        randomValue: 0.05
      });
      expect(result.status).toBe("no_soak");
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("malformed soak.json → readSoakMap returns null → no_soak (does not throw)", () => {
    const repoRoot = makeTmpRepo();
    try {
      writeMalformedSoakJson(repoRoot);
      let threw = false;
      let result: ReturnType<typeof evaluateSoakHook> | null = null;
      try {
        result = evaluateSoakHook({
          repoRoot,
          agent: "fullstack-dev",
          policy: BASE_POLICY,
          nowIso: "2026-07-01T12:00:00.000Z",
          randomValue: 0.05
        });
      } catch {
        threw = true;
      }
      expect(threw).toBe(false);
      expect(result?.status).toBe("no_soak");
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});

// ── soak routing paths (AC-10) ────────────────────────────────────────────────

describe("evaluateSoakHook — soak routing via random injection (AC-10)", () => {
  const STARTED = "2026-07-01T00:00:00.000Z";
  // day 1.5 — within soakDays=7; 5 trials < minSoakTrials=20; no early-revert (all passing)
  const NOW = "2026-07-02T12:00:00.000Z";

  function makeActiveSoak(repoRoot: string): void {
    writeSoakJson(repoRoot, {
      "fullstack-dev": {
        agent: "fullstack-dev",
        started_at: STARTED,
        champion_path: "/tmp/champion-prompt.md",
        trials: Array.from({ length: 5 }, () => ({
          created_at: NOW,
          pass: true,
          score: 0.9,
          source: "soak"
        })),
        main_pass_rate: 0.8
      }
    });
  }

  it("random=0.05 < soakPercent=0.10 → soak_use with champion_path (AC-10)", () => {
    const repoRoot = makeTmpRepo();
    try {
      makeActiveSoak(repoRoot);
      const result = evaluateSoakHook({
        repoRoot,
        agent: "fullstack-dev",
        policy: BASE_POLICY,
        nowIso: NOW,
        randomValue: 0.05
      });
      expect(result.status).toBe("soak_use");
      expect(result.champion_path).toBe("/tmp/champion-prompt.md");
      expect(result.events).toHaveLength(0);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("random=0.50 >= soakPercent=0.10 → soak_skip, no champion_path", () => {
    const repoRoot = makeTmpRepo();
    try {
      makeActiveSoak(repoRoot);
      const result = evaluateSoakHook({
        repoRoot,
        agent: "fullstack-dev",
        policy: BASE_POLICY,
        nowIso: NOW,
        randomValue: 0.5
      });
      expect(result.status).toBe("soak_skip");
      expect(result.champion_path).toBeUndefined();
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("random=0.10 (exactly soakPercent) → soak_skip (boundary: strictly less than)", () => {
    const repoRoot = makeTmpRepo();
    try {
      makeActiveSoak(repoRoot);
      const result = evaluateSoakHook({
        repoRoot,
        agent: "fullstack-dev",
        policy: BASE_POLICY,
        nowIso: NOW,
        randomValue: 0.1
      });
      expect(result.status).toBe("soak_skip");
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});

// ── Early-revert path (AC-4) ─────────────────────────────────────────────────

describe("evaluateSoakHook — early-revert (AC-4)", () => {
  const STARTED = "2026-07-01T00:00:00.000Z";
  const NOW = "2026-07-02T12:00:00.000Z";

  it("soak_pass_rate 0.50 vs main_pass_rate 0.80 (30pp gap) → early_revert + event", () => {
    const repoRoot = makeTmpRepo();
    try {
      const trials = [
        ...Array.from({ length: 5 }, () => ({
          created_at: NOW,
          pass: true,
          score: 0.9,
          source: "soak" as const
        })),
        ...Array.from({ length: 5 }, () => ({
          created_at: NOW,
          pass: false,
          score: 0.2,
          source: "soak" as const
        }))
      ];
      writeSoakJson(repoRoot, {
        "fullstack-dev": {
          agent: "fullstack-dev",
          started_at: STARTED,
          champion_path: "/tmp/champion-prompt.md",
          trials,
          main_pass_rate: 0.8
        }
      });
      const result = evaluateSoakHook({
        repoRoot,
        agent: "fullstack-dev",
        policy: BASE_POLICY,
        nowIso: NOW,
        randomValue: 0.05
      });
      expect(result.status).toBe("early_revert");
      expect(result.events).toContain("gepa_soak_revert_early");
      expect(result.reason).toContain("early-revert");
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
