import { test } from "node:test";
import assert from "node:assert/strict";

import { computeModelCompliance } from "../scripts/lib/briefing/collect.mjs";

// Cost reports expose usdPct on a 0-100 scale (matches parseModelMix in
// briefing/collect.mjs). All test data below uses that scale.

test("computeModelCompliance returns null for empty cost reports", () => {
  assert.equal(computeModelCompliance([]), null);
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
  assert.ok(result, "must return result");
  assert.ok(Math.abs(result.sonnetPct - 70) < 1, `expected ~70, got ${result.sonnetPct}`);
  assert.equal(result.sliceCount, 2);
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
  assert.equal(result.compliant, false);
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
  assert.equal(result.compliant, true);
});

test("computeModelCompliance skips reports without modelMix", () => {
  const reports = [{ modelMix: null }, { modelMix: [{ model: "claude-sonnet-4-6", usdPct: 75 }] }];
  const result = computeModelCompliance(reports);
  assert.ok(result !== null);
  assert.equal(result.sliceCount, 1);
  assert.equal(result.sonnetPct, 75);
});

test("computeModelCompliance returns 0 sonnetPct when no sonnet entry present", () => {
  const reports = [
    {
      modelMix: [{ model: "claude-opus-4-7", usdPct: 100 }]
    }
  ];
  const result = computeModelCompliance(reports);
  assert.equal(result.sonnetPct, 0);
  assert.equal(result.compliant, false);
});
