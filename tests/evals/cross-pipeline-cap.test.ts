/**
 * tests/evals/cross-pipeline-cap.test.ts
 *
 * SLICE-111 (FEAT-186 S2) AC-2 — cross-pipeline daily cap enforcement.
 *
 * Scenario (from AC-2 spec):
 *   - Configure $1/day cap on a shared meter instance.
 *   - Pipeline A (evals): spend $0.60 via withBudget(judge).evaluate().
 *   - Pipeline B (gepa Trial simulation): spend $0.50 via direct meter.record().
 *   - Third evaluate() call must throw BudgetExceededError because
 *     $0.60 + $0.50 + estimate > $1.00.
 *
 * The test uses a SHARED in-memory (file-backed) meter instance to simulate
 * the cross-pipeline constraint. Both pipelines converge on the same
 * file-backed state in the same process (same persistPath).
 */

import { describe, test, expect } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dailyCapMeter, toJudgeCost } from "@astragenie/gepa-core";
import type { LLMJudge } from "@astragenie/gepa-core";
import { withBudget, BudgetExceededError } from "../../evals/lib/with-budget.ts";

function tmpMeterPath(): string {
  return join(mkdtempSync(join(tmpdir(), "xpipeline-cap-")), "meter.json");
}

/** Build a mock LLMJudge returning fixed cost. */
function makeMockJudge(provider: string, costUsd: number): LLMJudge {
  return {
    describe() {
      return { provider, model: "mock-model" };
    },
    async evaluate(_opts) {
      return {
        pass: true,
        score: 1,
        rubricScores: {},
        rationale: "ok",
        cost_usd: costUsd,
        latency_ms: 50,
        tokens: { in: 100, out: 20 }
      };
    }
  };
}

describe("AC-2: cross-pipeline daily cap enforcement", () => {
  test("$1 cap: evals $0.60 spent, gepa-Trial $0.50 reserve attempt blocked (cross-pipeline enforcement)", async () => {
    // Shared meter — both "pipelines" use the same instance.
    const persistPath = tmpMeterPath();
    const sharedMeter = dailyCapMeter(1.0, persistPath);

    // --- Pipeline A (evals/cli.ts pattern): use withBudget wrapper ---
    // groq ceiling set to $0.60 so the single eval call consumes $0.60.
    const evalJudge = makeMockJudge("groq", 0.6);
    const wrappedJudge = withBudget(evalJudge, sharedMeter, { groq: 0.6 });

    const opts = {
      candidateOutput: "candidate response text",
      expected: {
        id: "case-a",
        input: null,
        held_out: false
      } as import("@astragenie/gepa-core").EvalCase,
      rubric: ["rubric criterion"]
    };

    const resultA = await wrappedJudge.evaluate(opts);
    expect(resultA.pass).toBe(true);
    expect(await sharedMeter.spentToday()).toBeCloseTo(0.6, 5);

    // --- Pipeline B (gepa Trial simulation): direct meter.reserve for $0.50 ---
    // $0.60 spent + $0.50 estimate = $1.10 > $1.00 → reserve MUST fail.
    const gepReservation = await sharedMeter.reserve(0.5);
    expect(gepReservation.ok).toBe(false);
    // Remaining is $1.00 - $0.60 = $0.40.
    expect(gepReservation.remainingUsd).toBeCloseTo(0.4, 5);
  });

  test("canonical AC-2: $1 cap, $0.60 evals + $0.30 gepa-Trial, third $0.20 blocked", async () => {
    const persistPath = tmpMeterPath();
    const sharedMeter = dailyCapMeter(1.0, persistPath);

    // Pipeline A (evals): withBudget wrapper, groq ceiling set to 0.60 for this test.
    const evalJudge = makeMockJudge("groq", 0.6);
    const wrappedJudge = withBudget(evalJudge, sharedMeter, { groq: 0.6 });

    const opts = {
      candidateOutput: "test output",
      expected: {
        id: "ac2-a",
        input: null,
        held_out: false
      } as import("@astragenie/gepa-core").EvalCase,
      rubric: ["rubric"]
    };

    const resultA = await wrappedJudge.evaluate(opts);
    expect(resultA.pass).toBe(true);
    expect(await sharedMeter.spentToday()).toBeCloseTo(0.6, 5);

    // Pipeline B (gepa Trial simulation): direct reserve+record, $0.30 JudgeCost shape.
    const gepReservation = await sharedMeter.reserve(0.3);
    expect(gepReservation.ok).toBe(true);
    await sharedMeter.record(
      gepReservation.reservationId,
      toJudgeCost({
        cost_usd: 0.3,
        latency_ms: 180,
        tokens: { in: 500, out: 80 }
      })
    );

    expect(await sharedMeter.spentToday()).toBeCloseTo(0.9, 5);

    // Third attempt: another evals call for groq ($0.20 ceiling).
    const thirdJudge = makeMockJudge("groq", 0.2);
    const thirdWrapped = withBudget(thirdJudge, sharedMeter, { groq: 0.2 });

    await expect(
      thirdWrapped.evaluate({
        candidateOutput: "test output",
        expected: {
          id: "ac2-c",
          input: null,
          held_out: false
        } as import("@astragenie/gepa-core").EvalCase,
        rubric: ["rubric"]
      })
    ).rejects.toThrow(BudgetExceededError);
  });

  test("AC-2 direct: $1 cap, $0.60 + $0.50 = over cap on second reserve", async () => {
    // Demonstrates that with $1 cap and $0.60 already spent, reserving $0.50 fails.
    // This is the stricter reading: two separate "pipeline" calls can block before
    // reaching a literal third call.
    const persistPath = tmpMeterPath();
    const sharedMeter = dailyCapMeter(1.0, persistPath);

    // Spend $0.60 via evals wrapper
    const evalJudge = makeMockJudge("groq", 0.6);
    const wrapped = withBudget(evalJudge, sharedMeter, { groq: 0.6 });

    await wrapped.evaluate({
      candidateOutput: "output",
      expected: {
        id: "d1",
        input: null,
        held_out: false
      } as import("@astragenie/gepa-core").EvalCase,
      rubric: ["r"]
    });
    expect(await sharedMeter.spentToday()).toBeCloseTo(0.6, 5);

    // Try to reserve $0.50 directly (gepa pipeline) — $0.60 + $0.50 = $1.10 > $1.00.
    const gepR = await sharedMeter.reserve(0.5);
    // Budget already at 0.60 spent, attempting 0.50 more = 1.10 > 1.00 → blocked.
    expect(gepR.ok).toBe(false);
    expect(gepR.remainingUsd).toBeCloseTo(0.4, 5);
  });

  test("toJudgeCost feeds directly into meter.record() from gepa-pipeline pattern", async () => {
    const persistPath = tmpMeterPath();
    const sharedMeter = dailyCapMeter(1.0, persistPath);

    const r = await sharedMeter.reserve(0.1);
    expect(r.ok).toBe(true);

    // Simulate gepa trial cost shape
    const gepaCost = toJudgeCost({
      cost_usd: 0.1,
      latency_ms: 300,
      tokens: { in: 400, out: 60 }
    });
    await sharedMeter.record(r.reservationId, gepaCost);
    expect(await sharedMeter.spentToday()).toBeCloseTo(0.1, 5);
  });
});
