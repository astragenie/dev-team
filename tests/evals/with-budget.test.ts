/**
 * tests/evals/with-budget.test.ts
 *
 * SLICE-111 (FEAT-186 S2) — unit tests for evals/lib/with-budget.ts:
 *   - happy-path reservation lifecycle (reserve → evaluate → record)
 *   - error-path: evaluate() throws → record({usd:0, latency_ms}) in finally
 *   - over-budget: reserve() returns ok=false → BudgetExceededError thrown
 *   - provider-ceiling fallback: unknown provider falls back to $0.20 + warn-once
 *   - describe() is forwarded unchanged from inner judge
 */

import { describe, test, expect } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dailyCapMeter } from "@astragenie/gepa-core";
import type { LLMJudge, BudgetMeter, JudgeCost } from "@astragenie/gepa-core";
import { withBudget, BudgetExceededError } from "../../evals/lib/with-budget.ts";
import { passthroughMeter } from "../../evals/lib/meter.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tmpMeterPath(): string {
  return join(mkdtempSync(join(tmpdir(), "wb-test-")), "meter.json");
}

/** Build a mock LLMJudge that resolves with a fixed result. */
function makeMockJudge(
  provider: string,
  costUsd = 0.01,
  latencyMs = 100,
  shouldThrow = false
): LLMJudge {
  return {
    describe() {
      return { provider, model: "mock-model" };
    },
    async evaluate(_opts) {
      if (shouldThrow) throw new Error("judge exploded");
      return {
        pass: true,
        score: 1,
        rubricScores: {},
        rationale: "ok",
        cost_usd: costUsd,
        latency_ms: latencyMs
      };
    }
  };
}

/** Build a spy BudgetMeter that records all calls. */
function makeSpyMeter(capUsd: number): BudgetMeter & {
  reserveCalls: number[];
  recordCalls: Array<{ id: string; cost: number | JudgeCost }>;
} {
  const inner = dailyCapMeter(capUsd, tmpMeterPath());
  const reserveCalls: number[] = [];
  const recordCalls: Array<{ id: string; cost: number | JudgeCost }> = [];

  return {
    reserveCalls,
    recordCalls,
    async reserve(estimateUsd) {
      reserveCalls.push(estimateUsd);
      return inner.reserve(estimateUsd);
    },
    async record(id, cost) {
      recordCalls.push({ id, cost });
      return inner.record(id, cost);
    },
    async release(id) {
      return inner.release(id);
    },
    async spentToday() {
      return inner.spentToday();
    },
    dailyCap() {
      return inner.dailyCap();
    }
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("withBudget — happy path", () => {
  test("describe() is forwarded from inner judge", () => {
    const judge = makeMockJudge("groq");
    const wrapped = withBudget(judge, passthroughMeter());
    expect(wrapped.describe()).toEqual({ provider: "groq", model: "mock-model" });
  });

  test("evaluate() calls reserve() before and record() after", async () => {
    const spy = makeSpyMeter(10.0);
    const judge = makeMockJudge("groq", 0.03);
    const wrapped = withBudget(judge, spy);

    const opts = {
      candidateOutput: "hello",
      expected: {
        id: "t1",
        input: null,
        held_out: false
      } as import("@astragenie/gepa-core").EvalCase,
      rubric: ["be helpful"]
    };

    const result = await wrapped.evaluate(opts);
    expect(result.pass).toBe(true);
    expect(spy.reserveCalls.length).toBe(1);
    expect(spy.recordCalls.length).toBe(1);
  });

  test("record() is called with JudgeCost shape matching evaluate() result", async () => {
    const spy = makeSpyMeter(10.0);
    const judge = makeMockJudge("groq", 0.05, 120);
    const wrapped = withBudget(judge, spy);

    const opts = {
      candidateOutput: "test",
      expected: {
        id: "t2",
        input: null,
        held_out: false
      } as import("@astragenie/gepa-core").EvalCase,
      rubric: ["rubric"]
    };

    await wrapped.evaluate(opts);
    const recorded = spy.recordCalls[0];
    expect(recorded).toBeDefined();
    const cost = recorded!.cost as JudgeCost;
    expect(cost.usd).toBeCloseTo(0.05, 5);
    expect(cost.latency_ms).toBe(120);
  });
});

describe("withBudget — error path", () => {
  test("record() is still called with {usd:0} when evaluate() throws", async () => {
    const spy = makeSpyMeter(10.0);
    const judge = makeMockJudge("groq", 0.01, 50, /* shouldThrow */ true);
    const wrapped = withBudget(judge, spy);

    const opts = {
      candidateOutput: "test",
      expected: {
        id: "t3",
        input: null,
        held_out: false
      } as import("@astragenie/gepa-core").EvalCase,
      rubric: ["rubric"]
    };

    await expect(wrapped.evaluate(opts)).rejects.toThrow("judge exploded");
    // record() must still have been called in the finally block
    expect(spy.recordCalls.length).toBe(1);
    const recorded = spy.recordCalls[0];
    const cost = recorded!.cost as JudgeCost;
    expect(cost.usd).toBe(0);
  });
});

describe("withBudget — over-budget", () => {
  test("throws BudgetExceededError when reserve() returns ok=false", async () => {
    // Configure a $0.10 cap, pre-spend $0.09 via a direct record on the inner meter
    const persistPath = tmpMeterPath();
    const innerMeter = dailyCapMeter(0.1, persistPath);

    // Pre-fill 0.09 of spend
    const pre = await innerMeter.reserve(0.09);
    await innerMeter.record(pre.reservationId, 0.09);

    // Now wrap a judge with this exhausted meter
    const judge = makeMockJudge("groq", 0.05);
    const wrapped = withBudget(judge, innerMeter);

    const opts = {
      candidateOutput: "test",
      expected: {
        id: "t4",
        input: null,
        held_out: false
      } as import("@astragenie/gepa-core").EvalCase,
      rubric: ["rubric"]
    };

    // groq ceiling is 0.05, remaining is 0.01 — reserve(0.05) should fail
    await expect(wrapped.evaluate(opts)).rejects.toThrow(BudgetExceededError);
  });

  test("BudgetExceededError.remainingUsd is populated", async () => {
    const persistPath = tmpMeterPath();
    const innerMeter = dailyCapMeter(0.1, persistPath);
    const pre = await innerMeter.reserve(0.09);
    await innerMeter.record(pre.reservationId, 0.09);

    const judge = makeMockJudge("groq", 0.05);
    const wrapped = withBudget(judge, innerMeter);

    const opts = {
      candidateOutput: "test",
      expected: {
        id: "t5",
        input: null,
        held_out: false
      } as import("@astragenie/gepa-core").EvalCase,
      rubric: ["rubric"]
    };

    let caught: BudgetExceededError | null = null;
    try {
      await wrapped.evaluate(opts);
    } catch (err) {
      if (err instanceof BudgetExceededError) caught = err;
    }
    expect(caught).not.toBeNull();
    expect(caught!.remainingUsd).toBeCloseTo(0.01, 5);
  });
});

describe("withBudget — provider ceiling fallback", () => {
  test("unknown provider uses $0.20 fallback ceiling for reservation", async () => {
    const spy = makeSpyMeter(10.0);
    const judge = makeMockJudge("mystery-provider", 0.01);
    const wrapped = withBudget(judge, spy);

    const opts = {
      candidateOutput: "test",
      expected: {
        id: "t6",
        input: null,
        held_out: false
      } as import("@astragenie/gepa-core").EvalCase,
      rubric: ["rubric"]
    };

    await wrapped.evaluate(opts);
    // reservation estimate should be 0.20 (fallback)
    expect(spy.reserveCalls[0]).toBeCloseTo(0.2, 5);
  });

  test("custom providerCeilings override default for known provider", async () => {
    const spy = makeSpyMeter(10.0);
    const judge = makeMockJudge("groq", 0.01);
    const wrapped = withBudget(judge, spy, { groq: 0.001 });

    const opts = {
      candidateOutput: "test",
      expected: {
        id: "t7",
        input: null,
        held_out: false
      } as import("@astragenie/gepa-core").EvalCase,
      rubric: ["rubric"]
    };

    await wrapped.evaluate(opts);
    expect(spy.reserveCalls[0]).toBeCloseTo(0.001, 5);
  });
});

describe("withBudget — passthrough meter (AC-4 passthrough mode)", () => {
  test("evaluate() succeeds with passthrough meter (no-op budget)", async () => {
    const judge = makeMockJudge("groq", 0.01);
    const wrapped = withBudget(judge, passthroughMeter());

    const opts = {
      candidateOutput: "test",
      expected: {
        id: "t8",
        input: null,
        held_out: false
      } as import("@astragenie/gepa-core").EvalCase,
      rubric: ["rubric"]
    };

    const result = await wrapped.evaluate(opts);
    expect(result.pass).toBe(true);
  });
});
