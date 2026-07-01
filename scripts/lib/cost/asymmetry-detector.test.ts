/**
 * scripts/lib/cost/asymmetry-detector.test.ts
 *
 * SLICE-114 (FEAT-186 S5) — unit tests for detectAsymmetry.
 *
 * AC-1: Three fixture cases:
 *   - asymmetric-warning.json: (gepa=$0.50, eval=$0.04) → 12.5× + $0.46 delta → warning
 *   - symmetric-no-warning.json: (gepa=$0.10, eval=$0.08) → 1.25× → no warning
 *   - floor-guard-no-warning.json: (gepa=$0.001, eval=$0.012) → 12× but $0.011 delta → no warning
 *
 * AC-2: no throw, no process.exit — returns data.
 *
 * Additional coverage:
 *   - empty entries → empty findings
 *   - single pipeline → no pair to compare → empty findings
 *   - exact-ratio boundary (10× with floor > $0.10) → warning
 *   - exact-ratio boundary at 10× → no warning (must exceed, not equal)
 */

import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { detectAsymmetry } from "./asymmetry-detector.ts";
import type { CostEntry } from "./cost-report-renderer.ts";

// ---------------------------------------------------------------------------
// Fixture loader
// ---------------------------------------------------------------------------

const FIXTURE_DIR = join(import.meta.dir, "../../../tests/fixtures/cost-asymmetry");

function loadFixture(name: string): CostEntry[] {
  const absPath = join(FIXTURE_DIR, name);
  const raw = readFileSync(absPath, "utf8");
  // Guard against CRLF drift (mirrors AC-4 pattern from SLICE-112)
  if (raw.includes("\r\n")) {
    throw new Error(
      `Fixture ${name} contains CRLF line endings. Check .gitattributes — tests/fixtures/cost-asymmetry/** must pin text=lf.`
    );
  }
  return JSON.parse(raw) as CostEntry[];
}

// ---------------------------------------------------------------------------
// AC-1: Three AC-specified fixture cases
// ---------------------------------------------------------------------------

describe("detectAsymmetry — AC-1 fixture cases", () => {
  test("asymmetric-warning: gepa=$0.50 eval=$0.04 → 12.5× + $0.46 delta → one finding", () => {
    const entries = loadFixture("asymmetric-warning.json");
    const findings = detectAsymmetry(entries);
    expect(findings).toHaveLength(1);
    const f = findings[0];
    expect(f).toBeDefined();
    expect(f!.highPipeline).toBe("gepa");
    expect(f!.lowPipeline).toBe("eval");
    expect(f!.highUsd).toBeCloseTo(0.5, 5);
    expect(f!.lowUsd).toBeCloseTo(0.04, 5);
    expect(f!.ratio).toBeCloseTo(12.5, 2);
    expect(f!.deltaUsd).toBeCloseTo(0.46, 5);
  });

  test("symmetric-no-warning: gepa=$0.10 eval=$0.08 → 1.25× → no finding", () => {
    const entries = loadFixture("symmetric-no-warning.json");
    const findings = detectAsymmetry(entries);
    expect(findings).toHaveLength(0);
  });

  test("floor-guard-no-warning: gepa=$0.001 eval=$0.012 → 12× but $0.011 delta → no finding", () => {
    const entries = loadFixture("floor-guard-no-warning.json");
    const findings = detectAsymmetry(entries);
    // Ratio is 12× which exceeds 10×, but absolute delta is $0.011 < $0.10 floor
    expect(findings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC-2: no throw, no process.exit — returns data
// ---------------------------------------------------------------------------

describe("detectAsymmetry — AC-2 no-throw contract", () => {
  test("never throws on empty entries", () => {
    expect(() => detectAsymmetry([])).not.toThrow();
    expect(detectAsymmetry([])).toHaveLength(0);
  });

  test("never throws on single-pipeline entries", () => {
    const entries: CostEntry[] = [
      { pipeline: "eval", provider: "anthropic", usd: 999.99, latency_ms: 5000 }
    ];
    expect(() => detectAsymmetry(entries)).not.toThrow();
    expect(detectAsymmetry(entries)).toHaveLength(0);
  });

  test("never throws on NaN-free entries with zero usd", () => {
    const entries: CostEntry[] = [
      { pipeline: "gepa", provider: "ollama", usd: 0.0, latency_ms: 100 },
      { pipeline: "eval", provider: "groq", usd: 0.0, latency_ms: 200 }
    ];
    expect(() => detectAsymmetry(entries)).not.toThrow();
    expect(detectAsymmetry(entries)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Boundary cases
// ---------------------------------------------------------------------------

describe("detectAsymmetry — boundary cases", () => {
  test("ratio exactly 10× with delta > $0.10 → no warning (must exceed, not equal)", () => {
    // 0.50 / 0.05 = exactly 10.0 — must be > 10 to trigger
    const entries: CostEntry[] = [
      { pipeline: "gepa", provider: "anthropic", usd: 0.5, latency_ms: 1000 },
      { pipeline: "eval", provider: "anthropic", usd: 0.05, latency_ms: 500 }
    ];
    const findings = detectAsymmetry(entries);
    // 0.50 / 0.05 = 10, not > 10, so no finding
    expect(findings).toHaveLength(0);
  });

  test("ratio just above 10× with delta just above $0.10 → warning", () => {
    // 0.51 / 0.05 = 10.2 > 10; delta = $0.46 > $0.10
    const entries: CostEntry[] = [
      { pipeline: "gepa", provider: "anthropic", usd: 0.51, latency_ms: 1000 },
      { pipeline: "eval", provider: "anthropic", usd: 0.05, latency_ms: 500 }
    ];
    const findings = detectAsymmetry(entries);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.highPipeline).toBe("gepa");
    expect(findings[0]!.ratio).toBeGreaterThan(10);
  });

  test("delta exactly $0.10 → no warning (must exceed, not equal)", () => {
    // ratio 11×, delta exactly $0.10 — must be > $0.10
    const entries: CostEntry[] = [
      { pipeline: "gepa", provider: "anthropic", usd: 0.11, latency_ms: 1000 },
      { pipeline: "eval", provider: "anthropic", usd: 0.01, latency_ms: 500 }
    ];
    const findings = detectAsymmetry(entries);
    // delta = $0.10 exactly, not > $0.10, so no finding
    expect(findings).toHaveLength(0);
  });

  test("zero-cost low pipeline → ratio Infinity → warning if delta > $0.10", () => {
    // lowUsd = 0 → ratio = Infinity; delta = $0.50 > $0.10 → finding
    const entries: CostEntry[] = [
      { pipeline: "gepa", provider: "anthropic", usd: 0.5, latency_ms: 1000 },
      { pipeline: "eval", provider: "anthropic", usd: 0.0, latency_ms: 100 }
    ];
    const findings = detectAsymmetry(entries);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.ratio).toBe(Number.POSITIVE_INFINITY);
    expect(findings[0]!.highUsd).toBeCloseTo(0.5, 5);
  });

  test("multi-entry same pipeline: totals are summed before comparison", () => {
    // gepa total = 0.30 + 0.20 = 0.50; eval total = 0.04
    // ratio 12.5×, delta $0.46 → one finding
    const entries: CostEntry[] = [
      { pipeline: "gepa", provider: "anthropic", usd: 0.3, latency_ms: 600 },
      { pipeline: "gepa", provider: "groq", usd: 0.2, latency_ms: 400 },
      { pipeline: "eval", provider: "anthropic", usd: 0.04, latency_ms: 800 }
    ];
    const findings = detectAsymmetry(entries);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.highUsd).toBeCloseTo(0.5, 5);
    expect(findings[0]!.lowUsd).toBeCloseTo(0.04, 5);
  });
});
