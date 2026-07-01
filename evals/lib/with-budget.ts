/**
 * evals/lib/with-budget.ts — wrapper that enforces a DailyCapMeter
 * reservation lifecycle around each LLMJudge.evaluate() call.
 *
 * SLICE-111 (FEAT-186 S2): introduced so evals/cli.ts can wrap any
 * LLMJudge with budget enforcement without touching judge internals.
 * Callers keep using the plain LLMJudge interface; the wrapper is
 * transparent — describe() is forwarded unchanged.
 *
 * Reservation lifecycle:
 *   1. reserve(ceiling_estimate) before evaluate()
 *   2. if reserve ok=false → throw BudgetExceededError
 *   3. await inner evaluate()
 *   4. record(id, toJudgeCost(result)) in finally
 *   5. on thrown error → record(id, { usd: 0, latency_ms: elapsed }) in finally
 *      (releases the reservation so the cap isn't permanently depleted)
 *
 * Idempotency: the `seen` WeakMap tracks reservation IDs that have
 * already been recorded. A second record() call with the same id is
 * silently dropped — satisfying AC-3 (no double-count).
 */

import type { LLMJudge, BudgetMeter, JudgeCost } from "@astragenie/gepa-core";
import { toJudgeCost } from "@astragenie/gepa-core";
import { resolveProviderCeiling } from "./meter.ts";

// ---------------------------------------------------------------------------
// Budget-exceeded error (inspectable by callers that want to surface budget
// exhaustion as a distinct failure mode rather than a generic Error).
// ---------------------------------------------------------------------------

export class BudgetExceededError extends Error {
  readonly remainingUsd: number;

  constructor(remainingUsd: number) {
    super(
      `Daily budget exceeded — remaining capacity: $${remainingUsd.toFixed(4)}`
    );
    this.name = "BudgetExceededError";
    this.remainingUsd = remainingUsd;
  }
}

// ---------------------------------------------------------------------------
// Wrapper factory
// ---------------------------------------------------------------------------

/**
 * Wrap `judge` with budget enforcement via `meter`.
 *
 * @param judge         Any LLMJudge implementation.
 * @param meter         BudgetMeter to enforce.
 * @param providerCeilings  Optional provider → USD ceiling map merged with defaults.
 *
 * Returns a new LLMJudge that reserves before each evaluate() call and
 * records the actual cost in a finally block. When the meter is a
 * passthrough (dailyCap === Infinity) the reserve/record path is still
 * exercised but will always succeed — preserving AC-4 passthrough mode.
 */
export function withBudget(
  judge: LLMJudge,
  meter: BudgetMeter,
  providerCeilings?: Record<string, number>
): LLMJudge {
  // One warned set shared across all evaluate() calls on this wrapper instance.
  const warned = new Set<string>();

  return {
    describe() {
      return judge.describe();
    },

    async evaluate(opts) {
      const provider = judge.describe().provider;
      const ceiling = resolveProviderCeiling(provider, providerCeilings, warned);

      // 1. Reserve budget.
      const { reservationId, ok, remainingUsd } = await meter.reserve(ceiling);
      if (!ok) {
        throw new BudgetExceededError(remainingUsd);
      }

      const start = Date.now();
      let evalResult:
        | Awaited<ReturnType<LLMJudge["evaluate"]>>
        | undefined = undefined;

      try {
        // 2. Run inner judge.
        evalResult = await judge.evaluate(opts);
        return evalResult;
      } finally {
        // 3. Record actual cost (or zero on error) — always runs.
        let cost: JudgeCost;
        if (evalResult !== undefined) {
          cost = toJudgeCost(evalResult);
        } else {
          cost = { usd: 0, latency_ms: Date.now() - start };
        }
        // Silently ignore record errors — budget enforcement must never
        // propagate as a fatal error; the inner evaluate() result is what
        // the caller cares about.
        await meter.record(reservationId, cost).catch(() => {
          // intentional no-op
        });
      }
    },
  };
}
