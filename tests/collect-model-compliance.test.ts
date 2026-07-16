import { test, expect } from "bun:test";

import { computeModelCompliance } from "../scripts/lib/briefing/collect.ts";

// Cost reports expose usdPct on a 0-100 scale (matches parseModelMix in
// briefing/collect.mjs). All test data below uses that scale.

test("computeModelCompliance returns null for empty cost reports", () => {
  expect(computeModelCompliance([])).toBe(null);
});

test("computeModelCompliance averages sonnetPct across reports", () => {
  const reports = [
    {
      modelMix: [
        { model: "claude-sonnet-4-6", usdPct: 60 },
        { model: "claude-opus-4-7", usdPct: 40 }
      ]
    },
    {
      modelMix: [
        { model: "claude-sonnet-4-6", usdPct: 80 },
        { model: "claude-opus-4-7", usdPct: 20 }
      ]
    }
  ];
  const result = computeModelCompliance(reports);
  expect(result, "must return result").toBeTruthy();
  expect(
    Math.abs(result!.sonnetPct - 70) < 1,
    `expected ~70, got ${result!.sonnetPct}`
  ).toBeTruthy();
  expect(result!.sliceCount).toBe(2);
});

test("computeModelCompliance flags non-compliant when sonnetPct < 60", () => {
  const reports = [
    {
      modelMix: [
        { model: "claude-sonnet-4-6", usdPct: 30 },
        { model: "claude-opus-4-7", usdPct: 70 }
      ]
    },
    {
      modelMix: [
        { model: "claude-sonnet-4-6", usdPct: 40 },
        { model: "claude-opus-4-7", usdPct: 60 }
      ]
    }
  ];
  const result = computeModelCompliance(reports);
  expect(result!.compliant).toBe(false);
});

test("computeModelCompliance flags compliant when sonnetPct >= 60", () => {
  const reports = [
    {
      modelMix: [
        { model: "claude-sonnet-4-6", usdPct: 70 },
        { model: "claude-opus-4-7", usdPct: 30 }
      ]
    }
  ];
  const result = computeModelCompliance(reports);
  expect(result!.compliant).toBe(true);
});

test("computeModelCompliance skips reports without modelMix", () => {
  const reports = [{ modelMix: null }, { modelMix: [{ model: "claude-sonnet-4-6", usdPct: 75 }] }];
  const result = computeModelCompliance(reports);
  expect(result !== null).toBeTruthy();
  expect(result!.sliceCount).toBe(1);
  expect(result!.sonnetPct).toBe(75);
});

test("computeModelCompliance returns 0 sonnetPct when no sonnet entry present", () => {
  const reports = [
    {
      modelMix: [{ model: "claude-opus-4-7", usdPct: 100 }]
    }
  ];
  const result = computeModelCompliance(reports);
  expect(result!.sonnetPct).toBe(0);
  expect(result!.compliant).toBe(false);
});
