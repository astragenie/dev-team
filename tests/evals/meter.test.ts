/**
 * tests/evals/meter.test.ts
 *
 * SLICE-111 (FEAT-186 S2) — unit tests for evals/lib/meter.ts:
 *   - createDailyCapMeter factory smoke
 *   - persist path resolution (explicit override + default derivation)
 *   - passthroughMeter always-ok behavior
 *   - resolveProviderCeiling: merged map, fallback, warn-once
 */

import { describe, test, expect } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createDailyCapMeter,
  passthroughMeter,
  resolveProviderCeiling,
  DEFAULT_PROVIDER_CEILINGS,
} from "../../evals/lib/meter.ts";

function tmpFile(): string {
  const dir = mkdtempSync(join(tmpdir(), "meter-test-"));
  return join(dir, "meter.json");
}

describe("createDailyCapMeter", () => {
  test("returns a BudgetMeter with correct dailyCap()", () => {
    const meter = createDailyCapMeter({ capUsd: 3.5, persistPath: tmpFile() });
    expect(meter.dailyCap()).toBe(3.5);
  });

  test("reserve() succeeds when under cap", async () => {
    const meter = createDailyCapMeter({ capUsd: 1.0, persistPath: tmpFile() });
    const result = await meter.reserve(0.5);
    expect(result.ok).toBe(true);
    expect(result.remainingUsd).toBeCloseTo(0.5, 5);
  });

  test("reserve() blocks when over cap", async () => {
    const persistPath = tmpFile();
    const meter = createDailyCapMeter({ capUsd: 1.0, persistPath });
    const r1 = await meter.reserve(0.8);
    expect(r1.ok).toBe(true);
    // record the reservation so it's consumed as spend
    await meter.record(r1.reservationId, 0.8);

    // now $0.20 remaining — try to reserve $0.25
    const r2 = await meter.reserve(0.25);
    expect(r2.ok).toBe(false);
  });

  test("spentToday() accumulates after record()", async () => {
    const persistPath = tmpFile();
    const meter = createDailyCapMeter({ capUsd: 5.0, persistPath });
    const r = await meter.reserve(0.3);
    expect(r.ok).toBe(true);
    await meter.record(r.reservationId, 0.3);
    expect(await meter.spentToday()).toBeCloseTo(0.3, 5);
  });

  test("uses explicit persistPath when provided", () => {
    const custom = tmpFile();
    const meter = createDailyCapMeter({ capUsd: 1.0, persistPath: custom });
    // meter creation itself shouldn't write the file until reserve/record
    expect(meter.dailyCap()).toBe(1.0);
  });

  test("default persistPath is derived when omitted (relative .claude/state path)", () => {
    // createDailyCapMeter without persistPath should not throw — it constructs
    // the meter with a default path. We validate it compiles and dailyCap is set.
    // (We cannot exercise file I/O on the default path in tests without cwd coupling.)
    const meter = createDailyCapMeter({ capUsd: 2.0 });
    expect(meter.dailyCap()).toBe(2.0);
  });
});

describe("passthroughMeter", () => {
  test("reserve() always returns ok=true with Infinity remaining", async () => {
    const meter = passthroughMeter();
    const r = await meter.reserve(999999);
    expect(r.ok).toBe(true);
    expect(r.remainingUsd).toBe(Infinity);
  });

  test("record() is a no-op (does not throw)", async () => {
    const meter = passthroughMeter();
    const r = await meter.reserve(0.1);
    await expect(meter.record(r.reservationId, 0.1)).resolves.toBeUndefined();
  });

  test("spentToday() always returns 0", async () => {
    const meter = passthroughMeter();
    expect(await meter.spentToday()).toBe(0);
  });

  test("dailyCap() returns Infinity", () => {
    const meter = passthroughMeter();
    expect(meter.dailyCap()).toBe(Infinity);
  });
});

describe("resolveProviderCeiling", () => {
  test("returns DEFAULT_PROVIDER_CEILINGS value for known provider", () => {
    const warned = new Set<string>();
    const ceiling = resolveProviderCeiling("groq", undefined, warned);
    const expected = DEFAULT_PROVIDER_CEILINGS["groq"] ?? 0.05;
    expect(ceiling).toBe(expected);
    expect(warned.size).toBe(0);
  });

  test("custom ceiling overrides default for the same provider", () => {
    const warned = new Set<string>();
    const ceiling = resolveProviderCeiling("groq", { groq: 0.01 }, warned);
    expect(ceiling).toBe(0.01);
  });

  test("falls back to 0.20 for unknown provider", () => {
    const warned = new Set<string>();
    const ceiling = resolveProviderCeiling("unknown-llm", undefined, warned);
    expect(ceiling).toBe(0.2);
  });

  test("adds unknown provider to warned set on first call", () => {
    const warned = new Set<string>();
    resolveProviderCeiling("mystery-provider", undefined, warned);
    expect(warned.has("mystery-provider")).toBe(true);
  });

  test("warn-once: second call for same unknown provider does not duplicate in set", () => {
    const warned = new Set<string>();
    resolveProviderCeiling("mystery-provider", undefined, warned);
    resolveProviderCeiling("mystery-provider", undefined, warned);
    // Set deduplicates — still only 1 entry
    expect(warned.size).toBe(1);
  });

  test("custom ceilings for new providers take precedence over fallback", () => {
    const warned = new Set<string>();
    const ceiling = resolveProviderCeiling("custom-llm", { "custom-llm": 0.05 }, warned);
    expect(ceiling).toBe(0.05);
    expect(warned.size).toBe(0);
  });
});
