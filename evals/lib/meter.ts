/**
 * evals/lib/meter.ts — factory for DailyCapMeter instances.
 *
 * SLICE-111 (FEAT-186 S2): introduced as the DI entry-point so evals/cli.ts
 * constructs one meter per agent-run and passes it down rather than using a
 * module-level singleton. Callers that omit `capUsd` (or pass `undefined`)
 * receive a passthrough no-op meter — passthrough mode ensures AC-4
 * byte-for-byte fixture replay is unaffected when no budget block is present.
 */

import type { BudgetMeter } from "@astragenie/gepa-core";
import { dailyCapMeter } from "@astragenie/gepa-core";
import path from "node:path";

// Default provider cost ceiling map (USD) — used by withBudget when estimating
// reservation amounts before a judge call. Intentionally conservative. Callers
// may override per-provider via `providerCeilings` arg.
export const DEFAULT_PROVIDER_CEILINGS: Readonly<Record<string, number>> = {
  ollama: 0.001,
  "generic-openai": 0.1,
  groq: 0.05,
  gemini: 0.08,
  azure: 0.2,
  bedrock: 0.2,
  "claude-p": 0.1,
};

/**
 * Options for createDailyCapMeter.
 * `capUsd` is required. `persistPath` defaults to `.claude/state/gepa-meter.json`.
 * `providerCeilings` merges on top of DEFAULT_PROVIDER_CEILINGS.
 */
export interface DailyCapMeterOpts {
  capUsd: number;
  persistPath?: string;
  providerCeilings?: Record<string, number>;
}

/**
 * Factory: return a configured BudgetMeter backed by dailyCapMeter from gepa-core.
 * The instance is file-persisted so reservations survive process restarts and
 * day-roll-over is handled automatically by the underlying implementation.
 */
export function createDailyCapMeter(opts: DailyCapMeterOpts): BudgetMeter {
  const persistPath =
    opts.persistPath ?? path.join(".claude", "state", "gepa-meter.json");
  return dailyCapMeter(opts.capUsd, persistPath);
}

/**
 * Resolve the provider ceiling for the given provider name.
 * Returns the merged value from custom + default maps; falls back to $0.20.
 * Logs a one-time warning per unknown provider via the returned `warned` set.
 */
export function resolveProviderCeiling(
  provider: string,
  customCeilings: Record<string, number> | undefined,
  warned: Set<string>
): number {
  const merged = { ...DEFAULT_PROVIDER_CEILINGS, ...(customCeilings ?? {}) };
  if (provider in merged) {
    return merged[provider] as number;
  }
  // Unknown provider — fallback + one-time warning.
  if (!warned.has(provider)) {
    warned.add(provider);
    process.stderr.write(
      `[gepa-budget] unknown provider "${provider}" — using $0.20 ceiling fallback\n`
    );
  }
  return 0.2;
}

/**
 * Passthrough no-op BudgetMeter — returned when no budget block is configured.
 * All operations are immediate no-ops; reserve() always returns ok=true with
 * remainingUsd=Infinity so existing code paths remain unaffected (AC-4).
 */
export function passthroughMeter(): BudgetMeter {
  return {
    async reserve(_estimateUsd) {
      return { reservationId: crypto.randomUUID(), ok: true, remainingUsd: Infinity };
    },
    async record(_reservationId, _cost) {
      // no-op
    },
    async release(_reservationId) {
      // no-op
    },
    async spentToday() {
      return 0;
    },
    dailyCap() {
      return Infinity;
    },
  };
}
