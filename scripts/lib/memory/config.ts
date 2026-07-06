// scripts/lib/memory/config.ts — FEAT-188 S2
//
// Parses the unified `memory` config block and resolves the enabled x
// provider precedence rule (AC-3):
//   - provider:"none" forces effective-disabled regardless of `enabled`.
//   - enabled:"never" disables emit/recall regardless of `provider`.
//   - provider:"file"|"astramem" with enabled:"auto" is active.
//   - recall.enabled is a separate kill-switch scoped to recall only.
import { MemoryConfigSchema, type MemoryConfig, type MemoryProviderKind } from "./schema.ts";

/** Parse + validate a raw `memory` config block. Absent/undefined -> all defaults (provider:"none"). */
export function parseMemoryConfig(raw: unknown): MemoryConfig {
  return MemoryConfigSchema.parse(raw ?? {});
}

export interface EffectiveMemoryConfig {
  captureEnabled: boolean;
  recallEnabled: boolean;
  provider: MemoryProviderKind;
  dualWrite: boolean;
  recall: { k: number; timeoutMs: number; maxTokens: number };
  project: string | undefined;
}

/** Resolve the enabled x provider precedence rule into a single effective config. */
export function resolveEffectiveConfig(config: MemoryConfig): EffectiveMemoryConfig {
  const providerDisabled = config.provider === "none";
  const enabledDisabled = config.enabled === "never";
  const captureEnabled = !providerDisabled && !enabledDisabled;

  return {
    captureEnabled,
    recallEnabled: captureEnabled && config.recall.enabled,
    provider: config.provider,
    dualWrite: config.dualWrite,
    recall: {
      k: config.recall.k,
      timeoutMs: config.recall.timeoutMs,
      maxTokens: config.recall.maxTokens
    },
    project: config.project
  };
}
