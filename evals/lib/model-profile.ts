/**
 * evals/lib/model-profile.ts — resolves the live candidate's dispatch model
 * from models.yaml when CREW_MODEL_PROFILE is set.
 * Module boundary: MUST NOT import from agents/, scripts/, src/, hooks/, commands/
 * (mirrors every sibling file in evals/lib/) — this duplicates a small amount
 * of validation that scripts/lib/models/schema.ts also does via Zod; evals/
 * does not depend on zod today, so this file validates by hand instead of
 * importing that schema across the module boundary.
 *
 * FEAT-crew-architecture-review Section 7, Decision 4.
 *
 * No behavior change when CREW_MODEL_PROFILE is unset: resolveCandidateModel
 * falls through to the pre-existing `candidateCfg.model ?? DEFAULT_CANDIDATE_MODEL`
 * path used by evals/lib/run-eval.ts before this file existed.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";

/** Matches evals/lib/candidate-dispatch.ts's own DEFAULT_MODEL literal. */
export const DEFAULT_CANDIDATE_MODEL = "claude-sonnet-4-6";

const TIERS = ["reasoning", "standard", "light"] as const;
export type ModelTier = (typeof TIERS)[number];

export interface ModelProfile {
  reasoning: string;
  standard: string;
  light: string;
}

export interface ModelsConfig {
  version: string;
  default_profile: string;
  profiles: Record<string, ModelProfile>;
}

export class ModelProfileError extends Error {}

function isModelProfile(value: unknown): value is ModelProfile {
  if (typeof value !== "object" || value === null) return false;
  return TIERS.every((tier) => typeof (value as Record<string, unknown>)[tier] === "string");
}

/** Validates raw YAML-decoded models.yaml data. Throws ModelProfileError on shape mismatch. */
export function validateModelsConfig(data: unknown): ModelsConfig {
  if (typeof data !== "object" || data === null) {
    throw new ModelProfileError("models.yaml: root must be an object");
  }
  const cfg = data as Record<string, unknown>;
  if (typeof cfg["version"] !== "string") {
    throw new ModelProfileError("models.yaml: missing or invalid 'version'");
  }
  if (typeof cfg["default_profile"] !== "string") {
    throw new ModelProfileError("models.yaml: missing or invalid 'default_profile'");
  }
  if (typeof cfg["profiles"] !== "object" || cfg["profiles"] === null) {
    throw new ModelProfileError("models.yaml: missing or invalid 'profiles'");
  }
  const profiles = cfg["profiles"] as Record<string, unknown>;
  for (const [name, profile] of Object.entries(profiles)) {
    if (!isModelProfile(profile)) {
      throw new ModelProfileError(
        `models.yaml: profile "${name}" must define all tiers: ${TIERS.join(", ")}`
      );
    }
  }
  if (!(cfg["default_profile"] in profiles)) {
    throw new ModelProfileError(
      `models.yaml: default_profile "${String(cfg["default_profile"])}" is not present in 'profiles'`
    );
  }
  return {
    version: cfg["version"],
    default_profile: cfg["default_profile"],
    profiles: profiles as Record<string, ModelProfile>
  };
}

const configCache = new Map<string, ModelsConfig>();

export async function loadModelsConfig(repoRoot: string): Promise<ModelsConfig> {
  const key = path.resolve(repoRoot);
  const cached = configCache.get(key);
  if (cached) return cached;
  const raw = await fs.readFile(path.join(repoRoot, "models.yaml"), "utf8");
  const config = validateModelsConfig(parseYaml(raw));
  configCache.set(key, config);
  return config;
}

/** Test seam: drops memoized models.yaml parses (config is immutable per run otherwise). */
export function clearModelsConfigCache(): void {
  configCache.clear();
}

/** Resolves a single tier value for a named profile. Throws ModelProfileError on an unknown profile name. */
export function resolveProfileTier(config: ModelsConfig, profileName: string, tier: ModelTier = "standard"): string {
  const profile = config.profiles[profileName];
  if (!profile) {
    throw new ModelProfileError(
      `Unknown model profile "${profileName}" (CREW_MODEL_PROFILE). Known profiles: ${Object.keys(config.profiles).join(", ")}`
    );
  }
  return profile[tier];
}

/**
 * Resolves the model string for a live candidate dispatch.
 *
 * Resolution order (highest wins):
 * 1. `CREW_CANDIDATE_MODEL` — direct model override, no models.yaml read.
 * 2. `CREW_MODEL_PROFILE` — loads models.yaml (memoized) and resolves that
 *    profile's "standard" tier, OVERRIDING any `candidate.model` in the eval
 *    spec — the point of the env var is swapping every candidate's model from
 *    one place for cross-provider / profile testing without hand-editing
 *    every yaml.
 * 3. Neither set: identical to the pre-Decision-4 behavior —
 *    `candidateCfg.model ?? DEFAULT_CANDIDATE_MODEL`. models.yaml is never
 *    read in this path.
 */
export async function resolveCandidateModel(
  repoRoot: string,
  candidateCfg: { model?: string } | undefined,
  env: NodeJS.ProcessEnv = process.env
): Promise<string> {
  const directOverride = env["CREW_CANDIDATE_MODEL"];
  if (directOverride) return directOverride;
  const profileName = env["CREW_MODEL_PROFILE"];
  if (!profileName) {
    return candidateCfg?.model ?? DEFAULT_CANDIDATE_MODEL;
  }
  const config = await loadModelsConfig(repoRoot);
  return resolveProfileTier(config, profileName, "standard");
}
