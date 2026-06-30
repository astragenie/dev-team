/**
 * tests/gepa/split-train-heldout.test.ts — SLICE-98
 */

import { describe, expect, test } from "bun:test";
import {
  parseSplitFlag,
  splitTrainHeldout,
} from "../../scripts/lib/gepa/split-train-heldout.ts";

function cases(n: number, prefix = "case") {
  return Array.from({ length: n }, (_, i) => ({ id: `${prefix}-${i}` }));
}

describe("SLICE-98 — splitTrainHeldout determinism", () => {
  test("same input → same partition (no shuffling between calls)", () => {
    const input = cases(20);
    const first = splitTrainHeldout(input, { train: 16, heldOut: 4 });
    const second = splitTrainHeldout(input, { train: 16, heldOut: 4 });
    expect(first.train.map((c) => c.id)).toEqual(second.train.map((c) => c.id));
    expect(first.heldOut.map((c) => c.id)).toEqual(second.heldOut.map((c) => c.id));
  });

  test("different seed → different partition", () => {
    const input = cases(20);
    const a = splitTrainHeldout(input, { train: 16, heldOut: 4, seed: "seed-a" });
    const b = splitTrainHeldout(input, { train: 16, heldOut: 4, seed: "seed-b" });
    // Heldout sets should not be identical (vanishingly low probability).
    expect(a.heldOut.map((c) => c.id)).not.toEqual(b.heldOut.map((c) => c.id));
  });

  test("partition is total (no case duplicated across tranches, no case dropped at right size)", () => {
    const input = cases(20);
    const { train, heldOut } = splitTrainHeldout(input, { train: 16, heldOut: 4 });
    const allIds = [...train, ...heldOut].map((c) => c.id).sort();
    const expected = input.map((c) => c.id).sort();
    expect(allIds).toEqual(expected);
  });

  test("input order does NOT affect partition (sort-by-hash invariant)", () => {
    const input = cases(20);
    const reordered = [...input].reverse();
    const direct = splitTrainHeldout(input, { train: 16, heldOut: 4 });
    const reverse = splitTrainHeldout(reordered, { train: 16, heldOut: 4 });
    expect(direct.heldOut.map((c) => c.id).sort()).toEqual(
      reverse.heldOut.map((c) => c.id).sort(),
    );
  });

  test("adding a case to the input preserves existing heldOut membership", () => {
    const before = cases(20);
    const splitBefore = splitTrainHeldout(before, { train: 16, heldOut: 4 });

    const after = [...before, { id: "case-99" }];
    const splitAfter = splitTrainHeldout(after, { train: 17, heldOut: 4 });

    // All ids that were heldOut before MAY land train OR heldOut after, but the
    // critical invariant is that EVERY new case landing in heldOut is one that
    // was deterministically picked by hash — never a case shifted out by mere
    // array index. Verify by asserting at least 75% overlap on the heldOut set.
    const beforeSet = new Set(splitBefore.heldOut.map((c) => c.id));
    const overlap = splitAfter.heldOut.filter((c) => beforeSet.has(c.id)).length;
    expect(overlap).toBeGreaterThanOrEqual(3); // 3/4 = 75%
  });
});

describe("SLICE-98 — splitTrainHeldout size handling", () => {
  test("train + heldOut < cases.length → extra cases dropped (train respected)", () => {
    const input = cases(20);
    const { train, heldOut } = splitTrainHeldout(input, { train: 10, heldOut: 4 });
    expect(train.length).toBe(10);
    expect(heldOut.length).toBe(4);
  });

  test("train + heldOut > cases.length → heldOut filled first, train shrinks", () => {
    const input = cases(5);
    const { train, heldOut } = splitTrainHeldout(input, { train: 10, heldOut: 4 });
    expect(heldOut.length).toBe(4);
    expect(train.length).toBe(1);
  });

  test("heldOut > cases.length → heldOut clamped, train empty", () => {
    const input = cases(3);
    const { train, heldOut } = splitTrainHeldout(input, { train: 5, heldOut: 10 });
    expect(heldOut.length).toBe(3);
    expect(train.length).toBe(0);
  });

  test("empty input → empty tranches", () => {
    const { train, heldOut } = splitTrainHeldout([], { train: 10, heldOut: 4 });
    expect(train.length).toBe(0);
    expect(heldOut.length).toBe(0);
  });
});

describe("SLICE-98 — parseSplitFlag", () => {
  test('"16/4" → { train: 16, heldOut: 4 }', () => {
    expect(parseSplitFlag("16/4")).toEqual({ train: 16, heldOut: 4 });
  });

  test('"0/0" → { train: 0, heldOut: 0 } (both zero is valid input)', () => {
    expect(parseSplitFlag("0/0")).toEqual({ train: 0, heldOut: 0 });
  });

  test("malformed input returns null", () => {
    expect(parseSplitFlag("abc")).toBeNull();
    expect(parseSplitFlag("10")).toBeNull();
    expect(parseSplitFlag("10/")).toBeNull();
    expect(parseSplitFlag("")).toBeNull();
  });
});
